from contextlib import closing
from datetime import datetime, timezone

from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.sdk import DAG, task

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


def load_dimension(source, target, query, table, columns, key):
    source.execute(query)
    while rows := source.fetchmany(1000):
        upsert(target, table, columns, key, rows)


def date_key(day):
    return day.year * 10000 + day.month * 100 + day.day if day else None


def load_tickets(source, target):
    source.execute("""
        SELECT id::text, author_id::text, assignee_id::text, category_id::text,
               priority, status, created_at, updated_at, resolved_at, closed_at
        FROM public.tickets
    """)
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
    description="полная загрузка справочников и заявок HelpDesk",
    schedule=None,
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
                source.execute("SELECT current_database()")
                target.execute("SELECT current_database()")
                if (source.fetchone()[0], target.fetchone()[0]) != ("helpdesk", "helpdesk_analytics"):
                    raise ValueError("Ожидаются источник helpdesk и назначение helpdesk_analytics")

                load_dimension(source, target, USERS, "dim_user", USER_COLUMNS, "user_id")
                load_dimension(
                    source, target, USERS + " WHERE role IN ('SUPPORT', 'ADMIN')",
                    "dim_support_agent", USER_COLUMNS, "user_id",
                )
                load_dimension(
                    source, target,
                    "SELECT id::text, code, name, active, created_at, updated_at FROM public.categories",
                    "dim_category",
                    "category_id, code, name, active, source_created_at, source_updated_at",
                    "category_id",
                )
                load_tickets(source, target)
            target_conn.commit()

    load_analytics()
