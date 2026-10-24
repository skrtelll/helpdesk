# HelpDesk

Учебная система технической поддержки.

| Каталог | Сервис | Стек |
|---|---|---|
| `backend/` | Main Backend, REST `/api/v1` | Kotlin, Spring Boot, PostgreSQL, Flyway |
| `frontend/` | Web UI | Next.js, TypeScript — пока заглушка |
| `airflow/` | ETL: DAG'и и образ Airflow | Apache Airflow 3, CeleryExecutor |
| `backup/` | бэкапы PostgreSQL в MinIO (только сервер) | `pg_dump`, `rclone` |
| `loadtest/` | сценарии нагрузочного тестирования | k6 |
| `docs/devops/` | документация по инфраструктуре | |

## Локальный запуск

Нужны Docker с Compose v2 и `make`. Java, Node и Python локально не нужны.

```bash
make up       # создаёт .env со сгенерированными секретами, собирает и поднимает стек
make airflow  # то же вместе с Airflow
make test     # интеграционные тесты backend (Testcontainers)
make test-e2e # smoke-тест изолированного стека
make help     # все команды: logs, ps, test, psql, sh, clean, ...
```

Без `make`:

```bash
cp .env.example .env        # заполнить DB_PASSWORD, JWT_SECRET
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

| Адрес | Что |
|---|---|
| http://localhost:3000 | frontend |
| http://localhost:8080/health | backend healthcheck |
| http://localhost:8080/swagger-ui.html | Swagger UI |
| `localhost:5432` | PostgreSQL (только с этой машины) |
| http://localhost:8081 | Airflow UI (`make airflow`), логин `admin`, пароль `AIRFLOW_ADMIN_PASSWORD` из `.env` |

## Compose-файлы

| Файл | Назначение |
|---|---|
| `docker-compose.yml` | базовый состав: backend, frontend и Airflow в профиле `airflow` (образы из GHCR), порты не публикуются |
| `docker-compose.local.yml` | локально: сборка из исходников, контейнеры PostgreSQL для приложения и метабазы Airflow, порты 8080, 3000 и 8081 |
| `docker-compose.test.yml` | тесты: изолированный проект `helpdesk-test`, БД в `tmpfs`, k6 |
| `docker-compose.prod.yml` | сервер: внешние сети `pg` (PostgreSQL), `edge` (Nginx Proxy Manager), `monitoring` (Prometheus), `s3` (MinIO) и сервис бэкапов |

Airflow поднимается, только если включён профиль: `--profile airflow` или
`COMPOSE_PROFILES=airflow` в `.env`. На сервере профиль включён в `deploy/prod.env`.

На сервере PostgreSQL не входит в проект — используется уже работающий инстанс
(отличие от ТЗ, где `postgres-operational` описан как сервис compose). Наружу сервисы
публикует только Nginx Proxy Manager.

## CI/CD

- **`ci.yml`** — PR в `main`/`develop` и push в `develop`. Запускаются только джобы
  затронутых сервисов: тесты backend (Testcontainers), сборка Docker-образов, проверка DAG'ов,
  smoke-тест стека (k6), проверка compose-файлов. Подробнее — [docs/devops/testing.md](docs/devops/testing.md).
- **`loadtest.yml`** — вручную: нагрузочный тест k6 на тестовом стеке в раннере.
- **`deploy.yml`** — push в `main`: CI → сборка и публикация образов в GHCR
  (`ghcr.io/skrtelll/helpdesk-<service>:sha-<commit>` и `:latest`) → деплой по SSH.
- При провале любой джобы приходит уведомление в Telegram; об успехе — нет.

### Конфигурация прода

Несекретные значения лежат в `deploy/prod.env` и меняются обычным PR. Значение `CHANGE_ME`
останавливает деплой с ошибкой.

Секреты — Settings → Secrets and variables → Actions → **Secrets**. GitHub Variables не используются:
репозиторий публичный, а их значения видны в логах Actions.

| Имя | Что |
|---|---|
| `SSH_HOST`, `SSH_PORT`, `SSH_USER` | адрес сервера, порт (по умолчанию `22`), пользователь деплоя |
| `SSH_PRIVATE_KEY` | приватный ключ пользователя деплоя |
| `SSH_KNOWN_HOSTS` | строка из `ssh-keyscan -p <port> <host>`, проверенная вручную |
| `DB_PASSWORD` | пароль роли `helpdesk_user` в PostgreSQL |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `TELEGRAM_TOKEN` | токен бота |
| `TELEGRAM_TO` | id чата/канала |
| `GHCR_PULL_TOKEN` | *необязательно*: PAT с `read:packages`, если пакеты GHCR приватные |
| `ETL_DB_PASSWORD` | пароль роли `helpdesk_etl`, только `[A-Za-z0-9_-]` |
| `AIRFLOW_DB_PASSWORD` | пароль роли `airflow_user`, только `[A-Za-z0-9_-]` |
| `AIRFLOW_ADMIN_PASSWORD` | пароль `admin` в UI Airflow |
| `AIRFLOW_FERNET_KEY` | `openssl rand -base64 32 \| tr '+/' '-_'`; после первого деплоя не менять |
| `AIRFLOW_SECRET_KEY` | `openssl rand -hex 32` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | пользователь MinIO `helpdesk-backup` |

Секреты не должны содержать одинарную кавычку — деплой это проверяет.

### Подготовка сервера (один раз)

1. Пользователь деплоя в группе `docker`, его публичный ключ — в `~/.ssh/authorized_keys`.
2. База и роли в существующем PostgreSQL (инстанс общий с другими проектами):

   | Роль | Права | Кто |
   |---|---|---|
   | `helpdesk_user` | владелец БД `helpdesk` | backend (Flyway) |
   | `helpdesk_readonly` | только `SELECT` | люди через SSH-туннель |
   | `helpdesk_etl` | чтение `public`, владелец схемы `analytics` | Airflow |
   | `airflow_user` | владелец БД `airflow` (метабаза) | Airflow |

   `helpdesk_etl` и `airflow_user` создаются по [docs/devops/airflow.md](docs/devops/airflow.md).

   ```sql
   CREATE ROLE helpdesk_user LOGIN PASSWORD '...';
   CREATE ROLE helpdesk_readonly LOGIN PASSWORD '...';
   CREATE DATABASE helpdesk OWNER helpdesk_user;
   REVOKE CONNECT, TEMPORARY ON DATABASE helpdesk FROM PUBLIC;
   GRANT CONNECT ON DATABASE helpdesk TO helpdesk_readonly;
   \c helpdesk
   GRANT USAGE ON SCHEMA public TO helpdesk_readonly;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO helpdesk_readonly;
   ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_user IN SCHEMA public
     GRANT SELECT ON TABLES TO helpdesk_readonly;
   ```

   `DEFAULT PRIVILEGES` выдаёт `SELECT` на таблицы, которые Flyway создаст позже.
3. `DB_HOST` в `deploy/prod.env` — имя контейнера PostgreSQL в сети `pg` (`docker ps`).
4. Внешние сети `pg`, `edge`, `monitoring` и `s3` существуют (`docker network ls`).
5. Доступ к `main_postgres` с loopback сервера (порт `5432` хоста занят другим PostgreSQL):
   ```bash
   docker run -d --name main_postgres_tunnel --restart unless-stopped \
     --network pg -p 127.0.0.1:15432:5432 \
     alpine/socat tcp-listen:5432,fork,reuseaddr tcp-connect:main_postgres:5432
   ```
6. Proxy host в Nginx Proxy Manager на домен проекта:

   | Location | Forward |
   |---|---|
   | `/` | `helpdesk-frontend:3000` |
   | `/api` (Custom location) | `helpdesk-backend:8080` |

   На backend проксируется только `/api`, поэтому `/health`, `/prometheus` и Swagger
   снаружи недоступны. Airflow UI — отдельный поддомен на `helpdesk-airflow:8080`.
7. Бакет и пользователь MinIO для бэкапов — [docs/devops/backups.md](docs/devops/backups.md).

### Доступ к БД на сервере

БД наружу не открыта, подключение — через SSH-туннель:

```bash
ssh -N -L 5433:127.0.0.1:15432 <user>@<server>
```

Затем в DBeaver / psql: `localhost:5433`, БД `helpdesk`, роль `helpdesk_readonly`.
Доступ выдаётся и отзывается SSH-ключом; пароль `helpdesk_user` людям не раздаётся.

### Мониторинг

Метрики, логи и алерты собирает общий стек сервера (Prometheus, Alertmanager, Loki, Grafana).
Как HelpDesk подключён к стеку и какие правила и дашборды в нём есть — [docs/devops/monitoring.md](docs/devops/monitoring.md).

### Airflow и бэкапы

- [docs/devops/airflow.md](docs/devops/airflow.md): состав, подключения к БД, роли `airflow_user` и `helpdesk_etl`.
- [docs/devops/backups.md](docs/devops/backups.md): бэкапы в MinIO, бэкап вручную, восстановление.

### Откат

На сервере в `$DEPLOY_DIR/.env` заменить `IMAGE_TAG` на предыдущий `sha-…` и выполнить:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait
```
