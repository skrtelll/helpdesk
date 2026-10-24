# Тестирование и тестовое окружение

| Уровень | Что | Где запускается |
|---|---|---|
| Интеграционные тесты backend | JUnit + Testcontainers, реальный PostgreSQL | `make test`, CI `backend-test` |
| Smoke-тест стека | весь стек в Docker + k6 `smoke.js` | `make test-e2e`, CI `e2e-smoke` |
| Нагрузочный тест | весь стек в Docker + k6 `load.js` | `make loadtest`, workflow `loadtest` (вручную) |
| Проверка DAG'ов | импорт всех DAG'ов в образе Airflow | CI `airflow-image` |

## Интеграционные тесты backend (Testcontainers)

Тесты поднимают настоящий PostgreSQL 16 в Docker. Миграции Flyway и валидация схемы
Hibernate проверяются так же, как при запуске в проде. Нужен только Docker.

Новые интеграционные тесты подключают общую конфигурацию `TestcontainersConfiguration`:

```kotlin
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration::class)
class TicketApiIT {

    @Autowired
    lateinit var rest: TestRestTemplate

    @Test
    fun createsTicket() { ... }
}
```

- `@ServiceConnection` сам прописывает `spring.datasource.*` из контейнера, поэтому
  `@DynamicPropertySource` не нужен.
- Тестовые классы с одинаковым набором аннотаций получают один и тот же закешированный
  Spring-контекст и один контейнер. Контейнер не пересоздаётся на каждый класс.
- Для слоя JPA без веба: `@DataJpaTest` +
  `@AutoConfigureTestDatabase(replace = Replace.NONE)` + `@Import(TestcontainersConfiguration::class)`.
- Имена классов `*IT` — по соглашению для интеграционных тестов. Запускаются они
  обычным `./gradlew test`.

`ApplicationIT` поднимает приложение целиком и проверяет `/health` и `/v3/api-docs`.
Если backend не стартует, например сущности расходятся с миграциями, этот тест
падает в CI ещё до сборки образа.

Запуск:

```bash
make test                         # в контейнере JDK 21, локально Java не нужна
cd backend && ./gradlew test      # если JDK 21 установлен
```

В CI результаты тестов публикуются как check `backend tests` в PR: список упавших
тестов с сообщениями виден без скачивания артефактов. HTML-отчёт Gradle прикладывается
к запуску при падении.

## Тестовое окружение: `docker-compose.test.yml`

Override поверх local-стека:

| Отличие от local | Зачем |
|---|---|
| проект `helpdesk-test` | не пересекается с dev-стеком: свои контейнеры, сеть и volumes |
| PostgreSQL на `tmpfs`, без volume и порта | каждый запуск с чистой БД, после `down` ничего не остаётся |
| backend только на `127.0.0.1:18080` | не конфликтует с dev-стеком на 8080 |
| frontend без порта | для тестов API не нужен снаружи |
| сервис `k6` (профиль `k6`) | запуск нагрузочных сценариев внутри сети стека |

```bash
make test-e2e     # поднять, прогнать smoke.js, остановить
make test-down    # убрать тестовый стек, если он остался после ошибки
```

## Нагрузочное тестирование (k6)

Скрипты лежат в `loadtest/`:

| Скрипт | Сценарий | Пороги |
|---|---|---|
| `smoke.js` | 1 VU, 5 итераций: `/health`, `/v3/api-docs` | все проверки проходят, 0 ошибок |
| `load.js` | разгон до `VUS` за 30 с, полка `DURATION`, спуск 15 с; список заявок и `/health` | ошибок < 1%, p95 списка заявок < 500 мс, p95 `/health` < 200 мс |

Параметры `load.js`:

| Переменная | По умолчанию | Что |
|---|---|---|
| `VUS` | `20` | число виртуальных пользователей |
| `DURATION` | `2m` | длительность полки |
| `API_PREFIX` | `/api/v1` | префикс API по контракту |
| `LOGIN_EMAIL`, `LOGIN_PASSWORD` | пусто | если заданы, `setup()` логинится через `POST {API_PREFIX}/auth/login` и ходит с `Bearer`-токеном |

```bash
make loadtest VUS=50 DURATION=5m
```

Если какой-то порог не выполнен, k6 завершается с кодом 99 и `make` тоже падает.
Итоги выводятся в консоль, полный отчёт пишется в `loadtest/results/summary.json`
(каталог в `.gitignore`).

В GitHub: Actions → `loadtest` → Run workflow. Параметры те же. Итоги попадают в summary
запуска, `summary.json` — в артефакт `k6-results`. Нагрузка идёт на тестовый стек
внутри раннера GitHub, а не на прод: результаты сравнимы между собой, но абсолютные
цифры ниже, чем на сервере.

## Образы

| Образ | Было | Стало | Что сделано |
|---|---|---|---|
| backend | 414 МБ | 415 МБ | jar разложен на слои Spring Boot: зависимости (68 МБ) в отдельном слое, при изменении кода меняется слой ~0,2 МБ |
| frontend | 315 МБ | 315 МБ | без изменений: уже multi-stage со standalone-сборкой Next.js |
| airflow | 2,88 ГБ | 1,12 ГБ | `slim`-образ + только нужные extras (`celery`, `postgres`, `fab`, `redis`) по официальному constraints-файлу |
| backup | 550 МБ | 138 МБ | `alpine` + `postgresql16-client` + `rclone` вместо полного `postgres:16-alpine` |

Новые Python-пакеты для DAG'ов добавляются в `airflow/requirements.txt`. Constraints-файл
Airflow фиксирует их версии совместимо с самим Airflow. Если нужного провайдера нет в
списке extras, его добавляют в `airflow/Dockerfile`.
