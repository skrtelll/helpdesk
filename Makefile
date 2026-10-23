COMPOSE      := docker compose -f docker-compose.yml -f docker-compose.local.yml
COMPOSE_ALL  := $(COMPOSE) --profile airflow
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml
GRADLE_IMAGE := eclipse-temurin:21-jdk
s ?=

.DEFAULT_GOAL := help
.PHONY: help env up airflow airflow-down down restart build rebuild logs ps config prod-config test psql sh clean

help: ## список команд
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

env: ## создать .env из шаблона со сгенерированными секретами
	@if [ -f .env ]; then echo ".env уже есть"; exit 0; fi; \
	sed -e "s|^DB_PASSWORD=$$|DB_PASSWORD=$$(openssl rand -hex 16)|" \
	    -e "s|^JWT_SECRET=$$|JWT_SECRET=$$(openssl rand -hex 32)|" \
	    -e "s|^AIRFLOW_ADMIN_PASSWORD=$$|AIRFLOW_ADMIN_PASSWORD=$$(openssl rand -hex 12)|" \
	    -e "s|^AIRFLOW_FERNET_KEY=$$|AIRFLOW_FERNET_KEY=$$(openssl rand -base64 32 | tr '+/' '-_')|" \
	    -e "s|^AIRFLOW_SECRET_KEY=$$|AIRFLOW_SECRET_KEY=$$(openssl rand -hex 32)|" \
	    .env.example > .env && echo ".env создан"

up: env ## поднять стек и дождаться healthcheck'ов
	$(COMPOSE) up -d --build --wait --wait-timeout 180

airflow: env ## поднять стек вместе с Airflow (UI на :8081)
	$(COMPOSE_ALL) up -d --build --wait --wait-timeout 300

airflow-down: ## остановить только Airflow
	$(COMPOSE_ALL) stop airflow-apiserver airflow-scheduler airflow-dag-processor airflow-triggerer airflow-worker airflow-redis airflow-postgres

down: ## остановить стек
	$(COMPOSE_ALL) down

restart: ## перезапустить сервис: make restart s=backend
	$(COMPOSE) restart $(s)

build: ## собрать образы
	$(COMPOSE) build $(s)

rebuild: ## собрать образы без кеша
	$(COMPOSE) build --no-cache $(s)

logs: ## логи: make logs s=backend
	$(COMPOSE_ALL) logs -f --tail=200 $(s)

ps: ## статус сервисов
	$(COMPOSE_ALL) ps

config: env ## проверить local- и prod-конфигурацию compose
	$(COMPOSE_ALL) config -q && echo "local: ok"
	$(COMPOSE_PROD) config -q && echo "prod: ok"

prod-config: ## итоговый prod-конфиг (нужен заполненный .env)
	$(COMPOSE_PROD) config

test: ## тесты backend в контейнере JDK 21 (Testcontainers)
	docker run --rm \
		-v "$(CURDIR)/backend:/src" \
		-v helpdesk-gradle-cache:/root/.gradle \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
		-w /src $(GRADLE_IMAGE) ./gradlew test --no-daemon --console=plain

psql: ## консоль локальной БД
	$(COMPOSE) exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

sh: ## shell в контейнере: make sh s=backend
	$(COMPOSE) exec $(s) sh

clean: ## остановить стек и удалить данные БД и артефакты сборки
	$(COMPOSE_ALL) down -v --remove-orphans
	rm -rf backend/build frontend/.next
