# Мониторинг

Логи, метрики и алерты HelpDesk собирает общий стек мониторинга сервера. Он обслуживает
все проекты на сервере, а не только HelpDesk, и развёрнут на сервере отдельно от проекта,
как PostgreSQL и MinIO. Стек работает во внешней docker-сети `monitoring`.

## Схема

```
            сеть monitoring (external)
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  helpdesk-backend:8080/prometheus ◄── Prometheus ──► Alertmanager ──► Telegram
│                                         ▲    ▲              ▲
│  cAdvisor, node-exporter ───────────────┘    │              │
│                                              │              │
│  Docker logs ──► Alloy ──► Loki ─────────────┼──── ruler ───┘
│                                 ▲            │
│                                 └─ Grafana ──┘
└──────────────────────────────────────────────────────────┘
```

| Компонент | Задача |
|---|---|
| Prometheus | собирает метрики, вычисляет правила алертов |
| Alertmanager | группирует алерты, убирает дубли, отправляет в Telegram |
| Loki | хранит логи контейнеров |
| Grafana Alloy | читает логи Docker и отправляет в Loki (замена Promtail, который больше не развивается) |
| cAdvisor | метрики контейнеров: CPU, память, рестарты |
| node-exporter | метрики хоста |
| Grafana | дашборды и поиск по логам |

## Подключение HelpDesk

- Backend в проде подключён к внешней сети `monitoring` с алиасом `helpdesk-backend`
  (`docker-compose.prod.yml`). Prometheus ходит к нему напрямую, наружу ничего не открывается.
- У всех сервисов ротация логов Docker: `json-file`, 3 файла по 10 МБ (`docker-compose.yml`).
  Без неё логи растут на диске сервера без ограничений.
- Backend отдаёт метрики на `/prometheus` через Micrometer (`micrometer-registry-prometheus`),
  все метрики с тегом `application: helpdesk-backend`, для `http.server.requests`
  включена гистограмма, по ней считаются перцентили.

Наружу `/prometheus`, `/health` и Swagger не попадают: в Nginx Proxy Manager на backend
проксируется только `location /api` (см. README).

## Конфигурация общего стека

Ниже — части конфигурации стека, которые относятся к HelpDesk.

### Prometheus: цель

Цель в `prometheus.yml`, раздел `scrape_configs`:

```yaml
- job_name: helpdesk-backend
  metrics_path: /prometheus
  static_configs:
    - targets: ["helpdesk-backend:8080"]
      labels:
        project: helpdesk
```

### Prometheus: правила алертов

Правила лежат в `rules/helpdesk.yml` и подключены через `rule_files`:

```yaml
groups:
  - name: helpdesk
    rules:
      - alert: HelpdeskBackendDown
        expr: up{job="helpdesk-backend"} == 0
        for: 2m
        labels:
          project: helpdesk
          severity: critical
        annotations:
          summary: Backend не отвечает на /prometheus

      - alert: HelpdeskContainerMissing
        expr: |
          absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="backend"})
          or absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="ml-service"})
          or absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="frontend"})
        for: 2m
        labels:
          project: helpdesk
          severity: critical
        annotations:
          summary: "Контейнер {{ $labels.container_label_com_docker_compose_service }} не запущен"

      - alert: HelpdeskContainerRestarting
        expr: changes(container_start_time_seconds{container_label_com_docker_compose_project="helpdesk"}[15m]) > 2
        labels:
          project: helpdesk
          severity: warning
        annotations:
          summary: "Контейнер {{ $labels.container_label_com_docker_compose_service }} перезапускается"

      - alert: HelpdeskHigh5xxRate
        expr: |
          sum(rate(http_server_requests_seconds_count{application="helpdesk-backend", status=~"5.."}[5m]))
          / sum(rate(http_server_requests_seconds_count{application="helpdesk-backend"}[5m])) > 0.05
        for: 5m
        labels:
          project: helpdesk
          severity: warning
        annotations:
          summary: "Больше 5% ответов backend — 5xx"

      - alert: HelpdeskSlowRequests
        expr: |
          histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket{application="helpdesk-backend"}[5m]))) > 1
        for: 10m
        labels:
          project: helpdesk
          severity: warning
        annotations:
          summary: p95 времени ответа backend больше 1 секунды

      - alert: HelpdeskDbPoolExhausted
        expr: hikaricp_connections_pending{application="helpdesk-backend"} > 0
        for: 5m
        labels:
          project: helpdesk
          severity: warning
        annotations:
          summary: Запросы ждут свободного соединения с БД

      - alert: HelpdeskHeapHigh
        expr: |
          sum(jvm_memory_used_bytes{application="helpdesk-backend", area="heap"})
          / sum(jvm_memory_max_bytes{application="helpdesk-backend", area="heap"}) > 0.9
        for: 10m
        labels:
          project: helpdesk
          severity: warning
        annotations:
          summary: Heap backend заполнен больше чем на 90%
```

Когда контейнер останавливается, cAdvisor перестаёт отдавать его метрики. Поэтому
падение ловит `absent(...)`, а не порог на `container_last_seen`: такой порог на
пропавшей серии просто не сработает.

### Alertmanager

Алерты маршрутизируются по метке `project`, у каждого проекта может быть свой чат:

```yaml
route:
  receiver: default
  group_by: [project, alertname]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers: [project="helpdesk"]
      receiver: helpdesk-telegram

receivers:
  - name: default
  - name: helpdesk-telegram
    telegram_configs:
      - bot_token_file: /etc/alertmanager/secrets/telegram_token
        chat_id: <id чата, тот же что TELEGRAM_TO в GitHub>
        parse_mode: HTML
        send_resolved: true
```

Бот тот же, что и для уведомлений CI. Токен лежит в файле, а не в `alertmanager.yml`.

### Alloy: логи контейнеров

```alloy
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = discovery.docker.containers.targets

  rule {
    source_labels = ["__meta_docker_container_label_com_docker_compose_project"]
    target_label  = "project"
  }
  rule {
    source_labels = ["__meta_docker_container_label_com_docker_compose_service"]
    target_label  = "service"
  }
}

loki.source.docker "containers" {
  host          = "unix:///var/run/docker.sock"
  targets       = discovery.docker.containers.targets
  relabel_rules = discovery.relabel.containers.rules
  forward_to    = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

Метки `project` и `service` берутся из меток, которые Docker Compose сам вешает на
контейнеры, поэтому в compose-файлах HelpDesk для логов ничего не настроено.

### Loki: алерт по логам

Правило ruler Loki, алерты уходят в тот же Alertmanager:

```yaml
groups:
  - name: helpdesk-logs
    rules:
      - alert: HelpdeskErrorLogs
        expr: sum by (service) (count_over_time({project="helpdesk"} |= "ERROR" [5m])) > 10
        for: 5m
        labels:
          project: helpdesk
          severity: warning
        annotations:
          summary: "Много ERROR в логах {{ $labels.service }}"
```

## Grafana

Источники данных: Prometheus и Loki.

Готовые дашборды (Dashboards → Import по ID):

| ID | Дашборд |
|---|---|
| 4701 | JVM (Micrometer): память, GC, потоки backend |
| 1860 | Node Exporter Full: хост |

Дашборд «HelpDesk»:

| Панель | Запрос |
|---|---|
| RPS по эндпоинтам | `sum by (uri) (rate(http_server_requests_seconds_count{application="helpdesk-backend"}[5m]))` |
| Доля 5xx | `sum(rate(http_server_requests_seconds_count{application="helpdesk-backend", status=~"5.."}[5m])) / sum(rate(http_server_requests_seconds_count{application="helpdesk-backend"}[5m]))` |
| p95 ответа | `histogram_quantile(0.95, sum by (le, uri) (rate(http_server_requests_seconds_bucket{application="helpdesk-backend"}[5m])))` |
| Соединения с БД | `hikaricp_connections_active{application="helpdesk-backend"}`, `hikaricp_connections_pending{application="helpdesk-backend"}` |
| CPU контейнеров | `sum by (container_label_com_docker_compose_service) (rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_project="helpdesk"}[5m]))` |
| Память контейнеров | `container_memory_working_set_bytes{container_label_com_docker_compose_project="helpdesk"}` |
| Логи | `{project="helpdesk"}`, фильтр по `service` |

## Проверка

1. `docker network inspect monitoring`: в сети есть контейнер `helpdesk-backend-1`.
2. Prometheus → Status → Targets: `helpdesk-backend` в состоянии `UP`.
3. Grafana → Explore → Loki: `{project="helpdesk"}` показывает логи.
4. `docker stop helpdesk-ml-service-1`: через 2–3 минуты в Telegram приходит
   `HelpdeskContainerMissing`, после `docker start` приходит resolved.
