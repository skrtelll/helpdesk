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
| `docker-compose.yml` | базовый состав: backend, ml-service, frontend (образы из GHCR) |
| `docker-compose.local.yml` | локально: сборка из исходников + контейнер PostgreSQL |
| `docker-compose.prod.yml` | сервер: подключение backend к docker-сети существующего PostgreSQL |

На сервере PostgreSQL не входит в проект — используется уже работающий инстанс
(отличие от ТЗ, где `postgres-operational` описан как сервис compose).

## CI/CD

- **`ci.yml`** — PR в `main`/`develop` и push в `develop`. Запускаются только джобы
  затронутых сервисов: тесты backend (Testcontainers), сборка Docker-образов, проверка compose-файлов.
- **`deploy.yml`** — push в `main`: CI → сборка и публикация образов в GHCR
  (`ghcr.io/skrtelll/helpdesk-<service>:sha-<commit>` и `:latest`) → деплой по SSH.
- При провале любой джобы приходит уведомление в Telegram; об успехе — нет.

### Конфигурация прода

Несекретные значения лежат в `deploy/prod.env` и меняются обычным PR. Перед первым деплоем
заполнить `DB_HOST` и `DB_NETWORK` (сейчас `CHANGE_ME` — деплой с ними не запустится).

Секреты — Settings → Secrets and variables → Actions → **Secrets**. GitHub Variables не используются:
репозиторий публичный, а их значения видны в логах Actions.

| Имя | Что |
|---|---|
| `SSH_HOST`, `SSH_PORT`, `SSH_USER` | адрес сервера, порт (по умолчанию `22`), пользователь деплоя |
| `SSH_PRIVATE_KEY` | приватный ключ пользователя деплоя |
| `SSH_KNOWN_HOSTS` | строка из `ssh-keyscan -p <port> <host>`, проверенная вручную |
| `DB_PASSWORD` | пароль роли `helpdesk` в PostgreSQL |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `ML_INTERNAL_SECRET` | `openssl rand -base64 48` |
| `TELEGRAM_TOKEN` | токен бота |
| `TELEGRAM_TO` | id чата/канала |
| `GHCR_PULL_TOKEN` | *необязательно*: PAT с `read:packages`, если пакеты GHCR приватные |

Секреты не должны содержать одинарную кавычку — деплой это проверяет.

### Подготовка сервера (один раз)

1. Пользователь деплоя в группе `docker`, его публичный ключ — в `~/.ssh/authorized_keys`.
2. База и роль в существующем PostgreSQL:
   ```sql
   CREATE ROLE helpdesk LOGIN PASSWORD '...';
   CREATE DATABASE helpdesk OWNER helpdesk;
   ```
3. Имена для `DB_HOST` и `DB_NETWORK` в `deploy/prod.env`: `docker ps` и
   `docker inspect -f '{{json .NetworkSettings.Networks}}' <контейнер postgres>`.
4. Порт PostgreSQL публикуется только на loopback сервера: `127.0.0.1:5432:5432`.

### Доступ к БД на сервере

БД наружу не открыта, подключение — через SSH-туннель:

```bash
ssh -N -L 5433:127.0.0.1:5432 <user>@<server>
```

Затем в DBeaver / psql: `localhost:5433`. Доступ выдаётся и отзывается SSH-ключом.

### Откат

На сервере в `$DEPLOY_DIR/.env` заменить `IMAGE_TAG` на предыдущий `sha-…` и выполнить:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait
```
