FROM alpine:3.22

RUN apk add --no-cache postgresql16-client rclone

ENV RCLONE_CONFIG=/dev/null

COPY --chmod=755 backup.sh /usr/local/bin/backup.sh

USER postgres
WORKDIR /tmp

ENTRYPOINT ["/usr/local/bin/backup.sh"]
