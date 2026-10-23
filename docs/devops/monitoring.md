# Мониторинг

Логи, метрики и алерты HelpDesk собирает общий стек мониторинга сервера. Он обслуживает
все проекты сервера, развёрнут отдельно от HelpDesk в `/opt/monitoring` (compose-проект
`monitoring`) и работает во внешней docker-сети `monitoring`. Ниже — его фактическая
конфигурация.

## Схема

```
                      сеть monitoring (external)
┌──────────────────────────────────────────────────────────────────────────┐
│ helpdesk-backend:8080/prometheus ◄─┐                                     │
│ cAdvisor, node-exporter ◄──────────┼── Prometheus ──► Alertmanager ──► Telegram
│                                    │                       ▲             │
│ Docker logs ──► Alloy ──► Loki ── ruler ───────────────────┘             │
│                             ▲        ▲                                   │
│                             └─ Grafana ─┘ ◄── сеть edge ◄── NPM          │
└──────────────────────────────────────────────────────────────────────────┘
```

| Сервис | Образ | Задача | Хранение |
|---|---|---|---|
| prometheus | `prom/prometheus:v3.5.0` | метрики, правила алертов | 30 дней или 10 ГБ |
| alertmanager | `prom/alertmanager:v0.28.1` | группировка алертов, отправка в Telegram | — |
| loki | `grafana/loki:3.7.2` | логи контейнеров, алерты по логам | 14 дней |
| alloy | `grafana/alloy:v1.10.0` | читает логи Docker и отправляет в Loki (замена Promtail) | — |
| cadvisor | `ghcr.io/google/cadvisor:0.57.0` | метрики контейнеров | — |
| node-exporter | `prom/node-exporter:v1.9.1` | метрики хоста | — |
| grafana | `grafana/grafana:12.1.0` | дашборды, поиск по логам | — |

Наружу стек портов не публикует. Grafana подключена к сети `edge` с алиасом
`monitoring-grafana` и открывается через Nginx Proxy Manager.

Версии выбраны не случайно:

- Loki 3.5.0 с Alloy 1.10 сыпал в лог `negative structured metadata bytes received`
  на каждый push; в 3.7 ошибки нет.
- cAdvisor ≤ 0.52 с `gcr.io` не видит контейнеры в Docker 29 (пустые метки compose);
  новые версии публикуются в `ghcr.io/google/cadvisor`.

## Подключение HelpDesk

- Backend в проде подключён к сети `monitoring` с алиасом `helpdesk-backend`
  (`docker-compose.prod.yml`), Prometheus ходит к нему напрямую.
- У всех сервисов HelpDesk ротация логов Docker: `json-file`, 3 файла по 10 МБ.
- Backend отдаёт метрики на `/prometheus` через Micrometer (`micrometer-registry-prometheus`)
  с тегом `application: helpdesk-backend` и гистограммой `http.server.requests`.
  Наружу эндпоинт не попадает: NPM проксирует на backend только `/api`.
- Метки `project` и `service` в логах и метриках контейнеров берутся из меток, которые
  Docker Compose вешает сам, — в compose-файлах HelpDesk для этого ничего не настроено.

Цель и правила HelpDesk лежат в стеке выключенными (`.off`): до первого деплоя сразу
сработали бы алерты о пропавших контейнерах.

| Когда | Что сделать в `/opt/monitoring` |
|---|---|
| после первого деплоя HelpDesk | `mv prometheus/rules/helpdesk.yml.off prometheus/rules/helpdesk.yml` |
| backend отдаёт `/prometheus` | `mv prometheus/scrape/helpdesk.yml.off prometheus/scrape/helpdesk.yml` |

После изменения файлов Prometheus перечитывает конфиг без перезапуска:

```bash
docker compose exec prometheus wget -qO- --post-data='' http://127.0.0.1:9090/-/reload
```

Алерты по логам (`loki/rules/fake/helpdesk.yml`) включены сразу: они срабатывают только
на строки в логах HelpDesk. После изменения правил Loki — `docker compose restart loki`.

## Конфигурация

### `compose.yml`

```yaml
name: monitoring

x-logging: &logging
  driver: json-file
  options:
    max-size: 10m
    max-file: "3"

services:
  prometheus:
    image: prom/prometheus:v3.5.0
    restart: unless-stopped
    logging: *logging
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --storage.tsdb.retention.time=${PROMETHEUS_RETENTION_TIME:-30d}
      - --storage.tsdb.retention.size=${PROMETHEUS_RETENTION_SIZE:-10GB}
      - --web.enable-lifecycle
    volumes:
      - ./prometheus:/etc/prometheus:ro
      - prometheus-data:/prometheus
    networks:
      - monitoring
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:9090/-/healthy"]
      interval: 30s
      timeout: 5s
      retries: 3

  alertmanager:
    image: prom/alertmanager:v0.28.1
    restart: unless-stopped
    logging: *logging
    command:
      - --config.file=/etc/alertmanager/alertmanager.yml
      - --storage.path=/alertmanager
    volumes:
      - ./alertmanager:/etc/alertmanager:ro
      - ./secrets/telegram_token:/run/secrets/telegram_token:ro
      - alertmanager-data:/alertmanager
    networks:
      - monitoring
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:9093/-/healthy"]
      interval: 30s
      timeout: 5s
      retries: 3

  loki:
    image: grafana/loki:3.7.2
    restart: unless-stopped
    logging: *logging
    command: -config.file=/etc/loki/loki.yml
    volumes:
      - ./loki/loki.yml:/etc/loki/loki.yml:ro
      - ./loki/rules:/etc/loki/rules:ro
      - loki-data:/loki
    networks:
      - monitoring

  alloy:
    image: grafana/alloy:v1.10.0
    restart: unless-stopped
    logging: *logging
    command:
      - run
      - --server.http.listen-addr=0.0.0.0:12345
      - --storage.path=/var/lib/alloy/data
      - /etc/alloy/config.alloy
    volumes:
      - ./alloy/config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - alloy-data:/var/lib/alloy/data
    networks:
      - monitoring
    depends_on:
      - loki

  cadvisor:
    image: ghcr.io/google/cadvisor:0.57.0
    restart: unless-stopped
    logging: *logging
    privileged: true
    devices:
      - /dev/kmsg
    command:
      - --docker_only=true
      - --housekeeping_interval=30s
      - --store_container_labels=false
      - --whitelisted_container_labels=com.docker.compose.project,com.docker.compose.service
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:v1.9.1
    restart: unless-stopped
    logging: *logging
    pid: host
    command:
      - --path.rootfs=/host
    volumes:
      - /:/host:ro,rslave
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:12.1.0
    restart: unless-stopped
    logging: *logging
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:?GRAFANA_ADMIN_PASSWORD is required}
      GF_SERVER_ROOT_URL: ${GRAFANA_ROOT_URL:?GRAFANA_ROOT_URL is required}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_ANALYTICS_REPORTING_ENABLED: "false"
      GF_ANALYTICS_CHECK_FOR_UPDATES: "false"
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana-data:/var/lib/grafana
    networks:
      monitoring:
      edge:
        aliases:
          - monitoring-grafana
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  prometheus-data:
  alertmanager-data:
  loki-data:
  alloy-data:
  grafana-data:

networks:
  monitoring:
    external: true
  edge:
    external: true
```

`.env` (права 600): `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`, `GRAFANA_ROOT_URL`
(адрес Grafana в NPM), `PROMETHEUS_RETENTION_TIME`, `PROMETHEUS_RETENTION_SIZE`.
Токен бота — в `secrets/telegram_token`, владелец `65534` (Alertmanager работает от `nobody`).

### Prometheus

`prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_config_files:
  - /etc/prometheus/scrape/*.yml

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["127.0.0.1:9090"]

  - job_name: alertmanager
    static_configs:
      - targets: ["alertmanager:9093"]

  - job_name: loki
    static_configs:
      - targets: ["loki:3100"]

  - job_name: alloy
    static_configs:
      - targets: ["alloy:12345"]

  - job_name: grafana
    static_configs:
      - targets: ["grafana:3000"]

  - job_name: cadvisor
    static_configs:
      - targets: ["cadvisor:8080"]

  - job_name: node
    static_configs:
      - targets: ["node-exporter:9100"]
        labels:
          instance: homelab
```

`prometheus/scrape/helpdesk.yml`:

```yaml
scrape_configs:
  - job_name: helpdesk-backend
    metrics_path: /prometheus
    static_configs:
      - targets: ["helpdesk-backend:8080"]
        labels:
          project: helpdesk
```

`prometheus/rules/homelab.yml` — общие правила хоста и контейнеров:

```yaml
groups:
  - name: homelab
    rules:
      - alert: TargetDown
        expr: up == 0
        for: 5m
        labels:
          project: homelab
          severity: critical
        annotations:
          summary: "{{ $labels.job }} не отдаёт метрики"

      - alert: HostDiskLow
        expr: |
          (
            node_filesystem_avail_bytes{fstype!~"tmpfs|overlay|squashfs|erofs"}
            / node_filesystem_size_bytes{fstype!~"tmpfs|overlay|squashfs|erofs"} < 0.15
          )
          and node_filesystem_readonly == 0
        for: 10m
        labels:
          project: homelab
          severity: warning
        annotations:
          summary: "На {{ $labels.mountpoint }} свободно меньше 15%"

      - alert: HostMemoryLow
        expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
        for: 10m
        labels:
          project: homelab
          severity: warning
        annotations:
          summary: Свободной памяти меньше 10%

      - alert: HostHighCpu
        expr: 1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) > 0.9
        for: 15m
        labels:
          project: homelab
          severity: warning
        annotations:
          summary: CPU загружен больше 90% уже 15 минут

      - alert: ContainerOomKilled
        expr: increase(container_oom_events_total{container_label_com_docker_compose_service!=""}[10m]) > 0
        labels:
          project: homelab
          severity: warning
        annotations:
          summary: "{{ $labels.container_label_com_docker_compose_project }}/{{ $labels.container_label_com_docker_compose_service }} убит по OOM"
```

`prometheus/rules/helpdesk.yml`:

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
          or absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="frontend"})
          or absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="airflow-apiserver"})
          or absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="airflow-scheduler"})
          or absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="airflow-worker"})
          or absent(container_last_seen{container_label_com_docker_compose_project="helpdesk", container_label_com_docker_compose_service="db-backup"})
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

Когда контейнер останавливается, cAdvisor перестаёт отдавать его метрики, поэтому
падение ловит `absent(...)`: порог на `container_last_seen` на пропавшей серии не сработает.

### Alertmanager

`alertmanager/alertmanager.yml`:

```yaml
route:
  receiver: telegram
  group_by: [project, alertname]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

inhibit_rules:
  - source_matchers: [severity="critical"]
    target_matchers: [severity="warning"]
    equal: [project, alertname]

receivers:
  - name: telegram
    telegram_configs:
      - bot_token_file: /run/secrets/telegram_token
        chat_id: <id чата, тот же что TELEGRAM_TO в GitHub>
        parse_mode: HTML
        send_resolved: true
```

Все проекты пока уходят в один чат, проект виден по метке `project`. Отдельный чат для
проекта — дочерний `route` с `matchers: [project="..."]` и своим receiver.

Сервер находится в РФ, и `api.telegram.org` с него недоступен: пока у Alertmanager нет
рабочего прокси наружу (`http_config.proxy_url` в `telegram_configs`), алерты видны только
в Grafana (Alerting) и UI Alertmanager, в Telegram они не доходят. Уведомления CI это не
затрагивает — они отправляются с раннеров GitHub.

### Loki

`loki/loki.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  log_level: warn

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  replication_factor: 1
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2026-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 336h
  reject_old_samples: true
  reject_old_samples_max_age: 168h

compactor:
  working_directory: /loki/compactor
  retention_enabled: true
  delete_request_store: filesystem

ruler:
  storage:
    type: local
    local:
      directory: /etc/loki/rules
  rule_path: /loki/rules-temp
  alertmanager_url: http://alertmanager:9093
  enable_api: true
  ring:
    kvstore:
      store: inmemory

analytics:
  reporting_enabled: false
```

`loki/rules/fake/helpdesk.yml` (`fake` — tenant по умолчанию при `auth_enabled: false`):

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

      - alert: HelpdeskBackupFailed
        expr: sum(count_over_time({project="helpdesk", service="db-backup"} |= "backup failed" [1h])) > 0
        labels:
          project: helpdesk
          severity: critical
        annotations:
          summary: Бэкап БД helpdesk не снялся, см. логи db-backup
```

### Alloy

`alloy/config.alloy`:

```alloy
discovery.docker "containers" {
  host             = "unix:///var/run/docker.sock"
  refresh_interval = "10s"
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

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
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

`refresh_interval = "10s"`: по умолчанию Alloy ищет контейнеры раз в минуту и теряет логи
короткоживущих и перезапускающихся контейнеров.

### Grafana

`grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Loki
    uid: loki
    type: loki
    access: proxy
    url: http://loki:3100

  - name: Alertmanager
    uid: alertmanager
    type: alertmanager
    access: proxy
    url: http://alertmanager:9093
    jsonData:
      implementation: prometheus
```

Готовые дашборды (Dashboards → Import по ID):

| ID | Дашборд |
|---|---|
| 1860 | Node Exporter Full: хост |
| 4701 | JVM (Micrometer): память, GC, потоки backend — когда backend начнёт отдавать метрики |

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

1. Prometheus: `up` — все цели `1`; после включения scrape-файла среди них `helpdesk-backend`.
2. cAdvisor видит проекты:
   `count by (container_label_com_docker_compose_project) (container_last_seen)` — есть `helpdesk`.
3. Grafana → Explore → Loki: `{project="helpdesk"}` показывает логи.
4. `docker stop helpdesk-frontend-1`: через 2–3 минуты в Alertmanager появляется
   `HelpdeskContainerMissing`, после `docker start` он уходит в resolved.
