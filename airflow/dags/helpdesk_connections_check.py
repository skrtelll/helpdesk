from datetime import datetime

from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator
from airflow.sdk import DAG

with DAG(
    dag_id="helpdesk_connections_check",
    description="Проверка подключений Airflow к operational и analytics",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["infra"],
):
    for conn_id in ("helpdesk_operational", "helpdesk_analytics"):
        SQLExecuteQueryOperator(
            task_id=f"check_{conn_id}",
            conn_id=conn_id,
            sql="SELECT current_database(), current_user, version()",
        )
