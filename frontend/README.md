# HelpDesk — frontend

## Описание проекта

HelpDesk — внутренний веб-сервис технической поддержки. Пользователь описывает проблему в заявке, сотрудник поддержки берёт её в работу, ведёт переписку, меняет категорию, приоритет и статус и закрывает заявку. Система хранит историю действий по каждой заявке.

Это frontend проекта: Next.js (App Router) + TypeScript + Ant Design. Сейчас — **голый скелет**: структура, маршруты, подключённая библиотека с базовой темой и пять пустых страниц-заглушек. Форм, запросов к API и бизнес-логики пока нет.

## Сценарии

Страницы скелета соответствуют сценарию пользователя (USER):

1. **Login** (`/login`) — вход.
2. **Register** (`/register`) — регистрация.
3. **TicketList** (`/tickets`) — список своих заявок.
4. **CreateTicket** (`/tickets/new`) — создание заявки.
5. **TicketDetail** (`/tickets/[id]`) — карточка заявки.

Сейчас каждая страница показывает только заголовок; наполнение — в следующих спринтах.

## Структура (Feature-Sliced Design)

Слои FSD лежат в `src/`, Next.js App Router — в корневой `app/`. Слой FSD `pages` совпадает по имени с Pages Router в Next.js, поэтому в корне лежит пустая папка `pages/` (только README): пока она есть, Next.js игнорирует `src/pages/`. Без неё сборка падает с ошибкой «Conflicting app and page files». Файлы в `app/` содержат только маршрут, вся логика в `src/`.

```text
frontend/
├── pages/                       # пустая, см. выше (нужна, чтобы Next.js игнорировал src/pages)
├── app/                         # Next.js App Router: маршруты
│   ├── layout.tsx
│   ├── page.tsx                 # / → редирект на /tickets
│   ├── login/page.tsx           # /login
│   ├── register/page.tsx        # /register
│   └── tickets/
│       ├── page.tsx             # /tickets
│       ├── new/page.tsx         # /tickets/new
│       └── [id]/page.tsx        # /tickets/[id]
└── src/                         # слои FSD (импорт только сверху вниз)
    ├── app/                     # провайдеры, тема Ant Design, глобальные стили
    ├── pages/                   # login, register, ticket-list, ticket-detail, create-ticket
    ├── features/                # пока пусто
    ├── entities/                # пока пусто
    └── shared/                  # config: список маршрутов
```

Правило зависимостей: `app → pages → features → entities → shared`; слой импортирует только нижележащие. Алиас `@/` указывает на `src/`.

## UI-библиотека и тема

Ant Design 5 с `@ant-design/nextjs-registry` и русской локалью. Базовая тема — `src/app/providers/theme.ts`.

## Запуск

Нужен Node.js 20+.

```bash
cd frontend
npm install
npm run dev       
npm run typecheck
```
