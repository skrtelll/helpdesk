from contextlib import closing
from datetime import datetime, timedelta, timezone

from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.sdk import DAG, get_current_context, task

USER_COLUMNS = (
    "user_id, display_name, role, enabled, source_created_at, source_updated_at"
)
USERS = """
    SELECT id::text, display_name, role, enabled, created_at, updated_at
    FROM public.users
"""


def upsert(cursor, table, columns, key, rows):
    fields = columns.split(", ")
    placeholders = ", ".join(["%s"] * len(fields))
    updates = ", ".join(f"{field} = EXCLUDED.{field}" for field in fields if field != key)
    cursor.executemany(
        f"INSERT INTO analytics.{table} ({columns}) VALUES ({placeholders}) "
        f"ON CONFLICT ({key}) DO UPDATE SET {updates}",
        rows,
    )


def extract(source, query, timestamp_column, window, condition="TRUE"):
    source.execute(
        f"{query} WHERE ({condition}) "
        f"AND (%s::timestamptz IS NULL OR {timestamp_column} >= %s)",
        (window, window),
    )


def load_table(source, target, query, table, columns, key, window,
               timestamp_column="updated_at", condition="TRUE"):
    extract(source, query, timestamp_column, window, condition)
    while rows := source.fetchmany(1000):
        upsert(target, table, columns, key, rows)


def date_key(day):
    return day.year * 10000 + day.month * 100 + day.day if day else None


def load_tickets(source, target, window):
    extract(source, """
        SELECT id::text, author_id::text, assignee_id::text, category_id::text,
               priority, status, created_at, updated_at, resolved_at, closed_at
        FROM public.tickets
    """, "updated_at", window)
    while rows := source.fetchmany(1000):
        facts = []
        calendar = set()
        for ticket_id, author, assignee, category, priority, status, created, updated, resolved, closed in rows:
            dates = [
                timestamp.astimezone(timezone.utc).date() if timestamp else None
                for timestamp in (created, resolved, closed)
            ]
            calendar.update(day for day in dates if day is not None)
            duration = int((resolved - created).total_seconds()) if resolved else None
            facts.append((
                ticket_id, author, assignee, category, *map(date_key, dates),
                priority, status, duration, created, updated, resolved, closed,
            ))

        target.executemany("""
            INSERT INTO analytics.dim_date (
                date_id, full_date, day_of_month, day_of_week, day_name,
                week_of_year, month_number, month_name, quarter, year, is_weekend
            )
            SELECT %s, day, EXTRACT(DAY FROM day), EXTRACT(ISODOW FROM day),
                   to_char(day, 'FMDay'), EXTRACT(WEEK FROM day),
                   EXTRACT(MONTH FROM day), to_char(day, 'FMMonth'),
                   EXTRACT(QUARTER FROM day), EXTRACT(YEAR FROM day),
                   EXTRACT(ISODOW FROM day) IN (6, 7)
            FROM (SELECT %s::date AS day) AS calendar
            ON CONFLICT (date_id) DO NOTHING
        """, [(date_key(day), day) for day in sorted(calendar)])
        upsert(
            target, "fact_tickets",
            "ticket_id, author_id, assignee_id, category_id, created_date_id, "
            "resolved_date_id, closed_date_id, priority, status, resolution_time_seconds, "
            "source_created_at, source_updated_at, resolved_at, closed_at",
            "ticket_id", facts,
        )


with DAG(
    dag_id="helpdesk_initial_load",
    description="Первичная и инкрементальная загрузка HelpDesk",
    schedule="@hourly",
    is_paused_upon_creation=True,
    start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
    catchup=False,
    max_active_runs=1,
    tags=["analytics"],
):
    @task
    def load_analytics():
        operational = PostgresHook(postgres_conn_id="helpdesk_operational")
        analytics = PostgresHook(postgres_conn_id="helpdesk_analytics")
        with closing(operational.get_conn()) as source_conn, closing(analytics.get_conn()) as target_conn:
            source_conn.autocommit = False
            target_conn.autocommit = False
            with source_conn.cursor() as source, target_conn.cursor() as target:
                source.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
                source.execute("SELECT current_database(), transaction_timestamp()")
                target.execute("SELECT current_database()")
                source_db, upper = source.fetchone()
                if (source_db, target.fetchone()[0]) != ("helpdesk", "helpdesk_analytics"):
                    raise ValueError("Ожидаются источник helpdesk и назначение helpdesk_analytics")

                target.execute(
                    "SELECT loaded_through FROM analytics.etl_watermark WHERE pipeline = %s",
                    ("helpdesk",),
                )
                previous = target.fetchone()
                run = get_current_context()["dag_run"]
                full_reload = (run.conf or {}).get("full_reload") is True
                if previous and upper < previous[0]:
                    raise ValueError("Время источника раньше границы предыдущей загрузки")
                lower = previous[0] - timedelta(days=1) if previous and not full_reload else None
                window = lower

                dimensions = None
                load_table(source, target, USERS, "dim_user", USER_COLUMNS, "user_id", dimensions)
                load_table(
                    source, target, USERS, "dim_support_agent", USER_COLUMNS,
                    "user_id", dimensions, condition="role IN ('SUPPORT', 'ADMIN')",
                )
                load_table(
                    source, target,
                    "SELECT id::text, code, name, active, created_at, updated_at FROM public.categories",
                    "dim_category",
                    "category_id, code, name, active, source_created_at, source_updated_at",
                    "category_id", dimensions,
                )
                load_tickets(source, target, window)
                load_table(
                    source, target,
                    "SELECT id::text, ticket_id::text, author_id::text, internal, created_at "
                    "FROM public.comments",
                    "fact_ticket_comments", "comment_id, ticket_id, author_id, internal, created_at",
                    "comment_id", window, timestamp_column="created_at",
                )
                load_table(
                    source, target,
                    "SELECT id::text, ticket_id::text, changed_by::text, event_type, field_name, created_at "
                    "FROM public.ticket_history",
                    "fact_ticket_events", "event_id, ticket_id, changed_by, event_type, field_name, created_at",
                    "event_id", window, timestamp_column="created_at",
                )
                target.execute(
                    """
                    INSERT INTO analytics.etl_watermark (pipeline, loaded_through)
                    VALUES (%s, %s)
                    ON CONFLICT (pipeline) DO UPDATE
                    SET loaded_through = EXCLUDED.loaded_through
                    """,
                    ("helpdesk", upper),
                )
            target_conn.commit()

    load_analytics()
