# Airflow

Airflow запускает ETL: переносит данные из operational-схемы `public` в аналитическую
схему `analytics`, считает витрины и проверки качества данных. DAG'и пишет дата-инженер
в `airflow/dags/`.

## Состав

Airflow 3 с CeleryExecutor. Все сервисы находятся в compose-профиле `airflow`.

| Сервис | Задача |
|---|---|
| `airflow-init` | миграции метабазы и создание администратора; запускается, завершается и не перезапускается |
| `airflow-apiserver` | UI и REST API (в Airflow 2 это был webserver) |
| `airflow-scheduler` | планирует запуски задач |
| `airflow-dag-processor` | парсит файлы DAG'ов |
| `airflow-triggerer` | обслуживает deferrable-операторы |
| `airflow-worker` | Celery worker, выполняет задачи |
| `airflow-redis` | брокер очереди Celery |

| Данные | Где хранятся |
|---|---|
| метаданные, XCom, результаты Celery | БД `airflow` |
| логи задач | volume `airflow-logs`, общий для всех сервисов Airflow |
| DAG'и | в образе `helpdesk-airflow`; локально монтируются из `airflow/dags/` |

## Подключения к БД

Подключения задаются переменными окружения `AIRFLOW_CONN_*` в `docker-compose.yml`.
В UI они не видны и не редактируются.

| conn_id | БД | Права |
|---|---|---|
| `helpdesk_operational` | `DB_NAME` (`helpdesk`) | чтение схемы `public` |
| `helpdesk_analytics` | `ANALYTICS_DB_NAME` (`helpdesk`) | запись в схему `analytics` |

Сейчас обе указывают на одну БД, но DAG'и должны использовать их по назначению.
Тогда вынос аналитики в отдельную БД сведётся к смене `ANALYTICS_DB_NAME`.

В DAG'е:

```python
from airflow.providers.postgres.hooks.postgres import PostgresHook

src = PostgresHook(postgres_conn_id="helpdesk_operational")
dst = PostgresHook(postgres_conn_id="helpdesk_analytics")
```

DAG `helpdesk_connections_check` проверяет оба подключения: в UI его надо снять с паузы
и запустить вручную.

## Локально

```bash
make airflow        # весь стек + Airflow, UI на http://localhost:8081
make airflow-down   # остановить только Airflow
```

Логин `admin`, пароль — `AIRFLOW_ADMIN_PASSWORD` из `.env`. Если `.env` создан до
появления Airflow, нужно добавить в него переменные `AIRFLOW_*` из `.env.example`
или пересоздать: `rm .env && make env`.

- Метабаза лежит в отдельном контейнере `airflow-postgres`, данные HelpDesk — в `postgres`.
- `airflow/dags/` смонтирован в контейнеры, изменения подхватываются без пересборки
  (dag-processor перечитывает файлы примерно раз в 30 секунд).
- Новые Python-зависимости добавляются в `airflow/requirements.txt`, после этого
  нужно выполнить `make airflow`, чтобы пересобрать образ.
- Чтобы `docker compose up` поднимал Airflow без `make`, в `.env` задаётся
  `COMPOSE_PROFILES=airflow`.

## На сервере

Образ `ghcr.io/skrtelll/helpdesk-airflow` собирается в CI и деплоится вместе с остальными
сервисами. Профиль `airflow` включён через `COMPOSE_PROFILES` в `deploy/prod.env`.

- Метабаза `airflow` лежит в `main_postgres` (сеть `pg`).
- Redis свой, во внутренней сети проекта.
- UI доступен через Nginx Proxy Manager: `apiserver` подключён к сети `edge` с
  алиасом `helpdesk-airflow`.

### Подготовка (один раз)

1. Метабаза:

   ```sql
   CREATE ROLE airflow_user LOGIN PASSWORD '...';
   CREATE DATABASE airflow OWNER airflow_user;
   REVOKE CONNECT, TEMPORARY ON DATABASE airflow FROM PUBLIC;
   ```

2. Роль ETL в БД `helpdesk`. Читает `public`, владеет схемой `analytics`:

   ```sql
   CREATE ROLE helpdesk_etl LOGIN PASSWORD '...';
   GRANT CONNECT ON DATABASE helpdesk TO helpdesk_etl;
   \c helpdesk
   GRANT USAGE ON SCHEMA public TO helpdesk_etl;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO helpdesk_etl;
   ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_user IN SCHEMA public
     GRANT SELECT ON TABLES TO helpdesk_etl;

   CREATE SCHEMA IF NOT EXISTS analytics AUTHORIZATION helpdesk_etl;
   GRANT helpdesk_etl TO helpdesk_user;
   GRANT USAGE ON SCHEMA analytics TO helpdesk_readonly;
   ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_etl IN SCHEMA analytics
     GRANT SELECT ON TABLES TO helpdesk_readonly;
   ```

   Схемой `analytics` владеет `helpdesk_etl`, поэтому DDL аналитики (таблицы фактов,
   измерений, витрины) выполняют DAG'и или дата-инженер под этой ролью, а не Flyway
   backend'а. `helpdesk_user` состоит в роли `helpdesk_etl`, чтобы бэкап под ним
   дампил и восстанавливал `analytics` целиком.

3. Пароли `airflow_user` и `helpdesk_etl` состоят только из `[A-Za-z0-9_-]`
   (`openssl rand -hex 24`): они подставляются в URL подключения и JSON. Деплой это проверяет.

4. Proxy host в NPM на отдельный поддомен, например `airflow.<домен>` → `helpdesk-airflow:8080`.

5. Секреты GitHub: `AIRFLOW_DB_PASSWORD`, `ETL_DB_PASSWORD`, `AIRFLOW_ADMIN_PASSWORD`,
   `AIRFLOW_FERNET_KEY`, `AIRFLOW_SECRET_KEY` (см. README).

`AIRFLOW_FERNET_KEY` шифрует пароли подключений и переменных в метабазе. Если ключ
сменить, расшифровать их будет нельзя, поэтому после первого деплоя его не меняют.

## Проверка

1. `docker compose ps`: все `airflow-*` в состоянии `healthy`, `airflow-init` — `exited (0)`.
2. UI открывается, логин под `admin` проходит.
3. DAG `helpdesk_connections_check` проходит зелёным, в логах задач видны
   `current_database` и `current_user`.
