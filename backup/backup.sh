#!/bin/sh
set -eu

: "${PGHOST:?}" "${PGUSER:?}" "${PGPASSWORD:?}" "${BACKUP_DATABASES:?}" "${BACKUP_BUCKET:?}"
: "${RCLONE_CONFIG_S3_ENDPOINT:?}" "${RCLONE_CONFIG_S3_ACCESS_KEY_ID:?}" "${RCLONE_CONFIG_S3_SECRET_ACCESS_KEY:?}"
PGPORT="${PGPORT:-5432}"
BACKUP_INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
export PGPORT

log() {
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

backup_db() {
    db="$1"
    ts="$(date -u +%Y%m%dT%H%M%SZ)"
    file="/tmp/${db}_${ts}.dump"
    pg_dump -d "$db" -Fc -f "$file" || { rm -f "$file"; return 1; }
    size="$(du -h "$file" | cut -f1)"
    rclone copyto --s3-no-check-bucket "$file" "s3:${BACKUP_BUCKET}/${db}/${db}_${ts}.dump" \
        || { rm -f "$file"; return 1; }
    rm -f "$file"
    log "backup ok: ${db} ${size}"
}

run() {
    status=0
    for db in $BACKUP_DATABASES; do
        backup_db "$db" || { log "backup failed: ${db}"; status=1; }
    done
    rclone delete --min-age "${BACKUP_RETENTION_DAYS}d" "s3:${BACKUP_BUCKET}" \
        || { log "backup failed: retention cleanup"; status=1; }
    [ "$status" -eq 0 ] && touch /tmp/last-success
    return 0
}

if [ "${1:-}" = "once" ]; then
    run
    [ -f /tmp/last-success ]
    exit
fi

while true; do
    run
    sleep "$((BACKUP_INTERVAL_HOURS * 3600))"
done
