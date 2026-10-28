# HelpDesk — frontend

## Описание проекта

HelpDesk — внутренний веб-сервис технической поддержки. Пользователь описывает проблему в заявке, сотрудник поддержки берёт её в работу, ведёт переписку, меняет категорию, приоритет и статус и закрывает заявку. Система хранит историю действий по каждой заявке.

Это frontend проекта: Next.js (App Router) + TypeScript + Ant Design, структура Feature-Sliced Design.

## Сценарии

Экраны для роли USER:

1. **Login** (`/login`) — вход по email и паролю; токены сохраняются, затем переход к списку заявок.
2. **Register** (`/register`) — имя, email, пароль не короче 8 символов; затем переход на вход.
3. **TicketList** (`/tickets`) — таблица своих заявок и кнопка «Создать заявку».
4. **CreateTicket** (`/tickets/new`) — тема (до 200 символов) и описание; затем переход в карточку созданной заявки. Категорию и приоритет выставляет backend.
5. **TicketDetail** (`/tickets/[id]`) — номер, тема, статус, приоритет, даты и описание заявки.

### Формы: валидация и ошибки

- Валидация до отправки (Ant Design Form): обязательные поля, формат email, пароль от 8 символов, длины полей.
- Кнопка отправки блокируется на время запроса (`loading`).
- Ошибка запроса показывается сообщением над формой: нет связи с сервером, 401, 409, 422, 5xx.
- Если backend вернул ошибки конкретных полей (422), они подсвечиваются под полями.

### Состояния

Списки и карточка заявки показывают одно из состояний:

- **Loading** — индикатор загрузки;
- **Error** — сообщение об ошибке и кнопка «Повторить»;
- **Empty** — «Заявок пока нет» (у списка с кнопкой создания) или «Заявка не найдена» (404).

Пока backend не запущен, список и карточка показывают состояние Error: «Нет связи с сервером».


## Структура (Feature-Sliced Design)

Слои FSD лежат в `src/`, Next.js App Router — в корневой `app/`. Слой FSD `pages` совпадает по имени с Pages Router в Next.js, поэтому в корне лежит пустая папка `pages/` (только README): пока она есть, Next.js игнорирует `src/pages/`.

```text
frontend/
├── pages/                       # пустая, нужна, чтобы Next.js игнорировал src/pages
├── app/                         # Next.js App Router: только маршруты
│   ├── layout.tsx
│   ├── page.tsx                 # / → редирект на /tickets
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── tickets/
│       ├── page.tsx
│       ├── new/page.tsx
│       └── [id]/page.tsx
└── src/                         # слои FSD (импорт только сверху вниз)
    ├── app/                     # провайдеры, тема Ant Design, глобальные стили
    ├── pages/                   # login, register, ticket-list, ticket-detail, create-ticket
    ├── features/                # auth (LoginForm, RegisterForm), ticket-create (CreateTicketForm)
    ├── entities/                # ticket: типы, API, теги статуса и приоритета
    └── shared/                  # api (HTTP-клиент, ошибки, токены), lib (useAsync, ошибки форм),
                                 # ui (PageContainer, Loading/Error/Empty), config (маршруты)
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
