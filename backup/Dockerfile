FROM postgres:16-alpine

RUN apk add --no-cache rclone

ENV RCLONE_CONFIG=/dev/null

COPY --chmod=755 backup.sh /usr/local/bin/backup.sh

USER postgres
WORKDIR /tmp

ENTRYPOINT ["/usr/local/bin/backup.sh"]
