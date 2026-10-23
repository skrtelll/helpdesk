ARG AIRFLOW_VERSION=3.1.0
ARG PYTHON_VERSION=3.12

FROM apache/airflow:slim-${AIRFLOW_VERSION}-python${PYTHON_VERSION}
ARG PYTHON_VERSION

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir \
      "apache-airflow[celery,postgres,fab,redis]==${AIRFLOW_VERSION}" \
      -r /tmp/requirements.txt \
      --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt"

COPY --chown=airflow:root dags /opt/airflow/dags
