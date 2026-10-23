# Бэкапы PostgreSQL

Сервис `db-backup` (только на сервере, `docker-compose.prod.yml`) раз в
`BACKUP_INTERVAL_HOURS` часов (по умолчанию 24) снимает `pg_dump` БД `helpdesk` и
загружает дамп в MinIO. Дампы старше `BACKUP_RETENTION_DAYS` дней (по умолчанию 14) удаляются.

| Что | Значение |
|---|---|
| Образ | `ghcr.io/skrtelll/helpdesk-backup`: `postgres:16-alpine` + `rclone` |
| Формат | `pg_dump -Fc` (custom, сжатый, восстанавливается через `pg_restore`) |
| Куда | `s3://helpdesk-backups/helpdesk/helpdesk_<UTC-время>.dump` |
| Роль | `helpdesk_user`, владелец БД |
| Сети | `pg` (PostgreSQL), `s3` (MinIO) |

В дамп БД `helpdesk` входят обе схемы: `public` и `analytics`. Метабаза Airflow
не бэкапится: в ней только история запусков, DAG'и лежат в git.

## Контроль

- Первый бэкап снимается сразу при старте контейнера, следующие — через заданный интервал.
- После успешного бэкапа контейнер отмечает время. Если с последнего успеха прошло
  больше интервала плюс час, healthcheck переводит контейнер в `unhealthy`.
- В логах есть строки `backup ok: helpdesk 12M` или `backup failed: ...`. По `backup failed`
  срабатывает алерт Loki (см. [мониторинг](monitoring.md)).

## Подготовка MinIO (один раз)

Отдельный пользователь с доступом только к своему бакету:

```bash
mc mb <alias>/helpdesk-backups

cat > helpdesk-backup-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": ["arn:aws:s3:::helpdesk-backups"]},
    {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": ["arn:aws:s3:::helpdesk-backups/*"]}
  ]
}
EOF

mc admin user add <alias> helpdesk-backup <secret-key>
mc admin policy create <alias> helpdesk-backup helpdesk-backup-policy.json
mc admin policy attach <alias> helpdesk-backup --user helpdesk-backup
```

Бакет создаётся заранее: у сервиса нет права `CreateBucket`.

- `S3_ENDPOINT` в `deploy/prod.env`: адрес MinIO в сети `s3` (`http://<контейнер>:9000`).
- Секреты GitHub: `S3_ACCESS_KEY` (`helpdesk-backup`) и `S3_SECRET_KEY`.

## Бэкап вручную

```bash
cd /opt/helpdesk
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm db-backup once
```

## Восстановление

1. Скачать дамп:

   ```bash
   mc ls <alias>/helpdesk-backups/helpdesk/
   mc cp <alias>/helpdesk-backups/helpdesk/helpdesk_<время>.dump /tmp/
   ```

2. Проверить дамп, восстановив его в отдельную БД:

   ```bash
   docker run --rm --network pg -v /tmp:/backup -e PGPASSWORD postgres:16-alpine \
     sh -c 'createdb -h main_postgres -U helpdesk_user helpdesk_restore_check &&
            pg_restore -h main_postgres -U helpdesk_user -d helpdesk_restore_check --no-owner /backup/helpdesk_<время>.dump'
   ```

3. Восстановить рабочую БД. Сначала остановить backend и Airflow, чтобы никто не писал в БД:

   ```bash
   cd /opt/helpdesk
   docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend airflow-worker airflow-scheduler
   docker run --rm --network pg -v /tmp:/backup -e PGPASSWORD postgres:16-alpine \
     pg_restore -h main_postgres -U helpdesk_user -d helpdesk --clean --if-exists /backup/helpdesk_<время>.dump
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait
   ```

`PGPASSWORD` берётся из окружения: перед командой выполнить `export PGPASSWORD=...`
(пароль `helpdesk_user`).

Схемой `analytics` владеет `helpdesk_etl`. `helpdesk_user` состоит в этой роли
(`GRANT helpdesk_etl TO helpdesk_user`, см. [Airflow](airflow.md)), поэтому и дамп,
и восстановление под ним проходят целиком.
