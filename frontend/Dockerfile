FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# С lock-файлом — воспроизводимая установка; без него (пока заглушка) — обычная
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# standalone-сервер слушает HOSTNAME, а Docker подставляет туда id контейнера
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S helpdesk && adduser -S helpdesk -G helpdesk
COPY --from=build --chown=helpdesk:helpdesk /app/.next/standalone ./
COPY --from=build --chown=helpdesk:helpdesk /app/.next/static ./.next/static
USER helpdesk

EXPOSE 3000
CMD ["node", "server.js"]
