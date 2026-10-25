# Эта папка намеренно пустая

В проекте используется Next.js App Router (папка `app/`), а слой страниц FSD лежит в `src/pages/`.
Next.js принимает `src/pages/` за Pages Router и падает с ошибкой «Conflicting app and page files».
Пустая `pages/` в корне заставляет Next.js игнорировать `src/pages/`.

Не удаляйте эту папку и не кладите в неё страницы.
