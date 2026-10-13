# HelpDesk

Учебная система технической поддержки с ML-классификацией заявок.

| Каталог | Сервис | Стек |
|---|---|---|
| `backend/` | Main Backend, REST `/api/v1` | Kotlin, Spring Boot, PostgreSQL, Flyway |
| `ml-service/` | ML Service (внутренний) | Python, FastAPI — пока заглушка |
| `frontend/` | Web UI | Next.js, TypeScript — пока заглушка |

## Локальный запуск

Нужны Docker с Compose v2 и `make`. Java, Node и Python локально не нужны.

```bash
make up      # создаёт .env со сгенерированными секретами, собирает и поднимает стек
make help    # все команды: logs, ps, test, psql, sh, clean, ...
```

Без `make`:

```bash
cp .env.example .env        # заполнить DB_PASSWORD, JWT_SECRET, ML_INTERNAL_SECRET
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

| Адрес | Что |
|---|---|
| http://localhost:3000 | frontend |
| http://localhost:8080/health | backend healthcheck |
| http://localhost:8080/swagger-ui.html | Swagger UI |
| `localhost:5432` | PostgreSQL (только с этой машины) |

ML Service наружу не публикуется — backend обращается к нему по `http://ml-service:8001`.

## Compose-файлы

| Файл | Назначение |
|---|---|
| `docker-compose.yml` | базовый состав: backend, ml-service, frontend (образы из GHCR), порты не публикуются |
| `docker-compose.local.yml` | локально: сборка из исходников, контейнер PostgreSQL, порты 8080 и 3000 |
| `docker-compose.prod.yml` | сервер: подключение к внешним сетям `pg` (PostgreSQL) и `edge` (Nginx Proxy Manager) |

На сервере PostgreSQL не входит в проект — используется уже работающий инстанс
(отличие от ТЗ, где `postgres-operational` описан как сервис compose). Наружу сервисы
публикует только Nginx Proxy Manager.

## CI/CD

- **`ci.yml`** — PR в `main`/`develop` и push в `develop`. Запускаются только джобы
  затронутых сервисов: тесты backend (Testcontainers), сборка Docker-образов, проверка compose-файлов.
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
| `ML_INTERNAL_SECRET` | `openssl rand -base64 48` |
| `TELEGRAM_TOKEN` | токен бота |
| `TELEGRAM_TO` | id чата/канала |
| `GHCR_PULL_TOKEN` | *необязательно*: PAT с `read:packages`, если пакеты GHCR приватные |

Секреты не должны содержать одинарную кавычку — деплой это проверяет.

### Подготовка сервера (один раз)

1. Пользователь деплоя в группе `docker`, его публичный ключ — в `~/.ssh/authorized_keys`.
2. База и роли в существующем PostgreSQL (инстанс общий с другими проектами):

   | Роль | Права | Кто |
   |---|---|---|
   | `helpdesk_user` | владелец БД `helpdesk` | backend (Flyway) |
   | `helpdesk_readonly` | только `SELECT` | люди через SSH-туннель |

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
4. Внешние сети `pg` и `edge` существуют (`docker network ls`).
5. Порт PostgreSQL публикуется только на loopback сервера: `127.0.0.1:5432:5432`.
6. Proxy hosts в Nginx Proxy Manager:

   | Куда | Forward |
   |---|---|
   | домен фронтенда | `helpdesk-frontend:3000` |
   | домен API или location `/api` | `helpdesk-backend:8080` |

### Доступ к БД на сервере

БД наружу не открыта, подключение — через SSH-туннель:

```bash
ssh -N -L 5433:127.0.0.1:5432 <user>@<server>
```

Затем в DBeaver / psql: `localhost:5433`, БД `helpdesk`, роль `helpdesk_readonly`.
Доступ выдаётся и отзывается SSH-ключом; пароль `helpdesk_user` людям не раздаётся.

### Откат

На сервере в `$DEPLOY_DIR/.env` заменить `IMAGE_TAG` на предыдущий `sha-…` и выполнить:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait
```
