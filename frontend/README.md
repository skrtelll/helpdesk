# HelpDesk — frontend

Next.js 15 (App Router) + TypeScript, без UI-библиотек. Три роли (USER / SUPPORT / ADMIN), все экраны из ТЗ.

## Запуск

Нужен Node.js 20+.

```bash
cd frontend
cp .env.example .env.local    
npm install
npm run dev     

```

## Демо-режим (без backend)

Аккаунты (пароль `password123`): `user@helpdesk.test`, `support@helpdesk.test`, `admin@helpdesk.test`. Кнопка «Сбросить демо-данные» — на странице входа.

## Структура

| Путь | Назначение |
|---|---|
| `app/` | страницы (маршруты): `/login`, `/register`, `/profile`, `/tickets`, `/tickets/new`, `/tickets/[id]`, `/support/queue`, `/support/my-tickets`, `/support/tickets/[id]`, `/admin/users`, `/admin/categories` |
| `components/Protected.tsx` | защита маршрута по входу и роли + шапка с навигацией |
| `components/TicketList.tsx` | список заявок с фильтрами и пагинацией (общий для всех списков) |
| `components/TicketView.tsx` | карточка заявки: действия по роли, комментарии, история |
| `components/Badges.tsx`, `States.tsx`, `Pagination.tsx` | бейджи статуса/приоритета, loading/error/empty, пагинация |
| `lib/types.ts` | типы домена |
| `lib/workflow.ts` | таблица переходов статусов, общая для UI и mock |
| `lib/labels.ts` | русские подписи, тексты ошибок по кодам API |
| `lib/auth.tsx` | контекст аутентификации |
| `lib/useAsync.ts` | хук загрузки данных |
| `lib/api/` | `types.ts` (контракт), `http.ts` (backend), `mock.ts` (демо), `tokens.ts`, `index.ts` (выбор) |
| `tests/mock-api.test.ts` | сценарные проверки правил |
