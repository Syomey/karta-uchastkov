# Карта участков (прототип)

Статический сайт для Vercel. Вход по логину и паролю (`middleware.js`).

## Файлы
- `index.html` — сама карта.
- `data/objects.js` — наши участки. Обновляется без пересборки сетки.
- `data/grid/*.js` — кадастровая сетка кусками; грузится только то, что видно на экране при сильном приближении.
- `middleware.js` — проверка логина и пароля.

## Логины
Vercel → проект → Settings → Environment Variables → `MAP_USERS`:
```
vadim:придумайте-пароль,zakazchik:другой-пароль
```
Убрать человека: удалить его пару и нажать Redeploy.

## Обновление данных
На компьютере: `KadastrKim\karta\build.ps1 ... -Site KadastrKim\site` пересобирает `index.html` и `data/objects.js`.
Сетка — `KadastrKim\karta\build_grid_chunks.ps1 -Site KadastrKim\site`, только когда она меняется.
Затем отправить изменения на GitHub — Vercel обновит сайт сам.
