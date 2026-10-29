# Итоговая проверка рабочей области карты

Дата: 2026-10-29. Изменения не опубликованы; рабочая БД не мигрировалась.
Исходные проверки были зелёными: backend 562, frontend 601 тест.

## Автоматизированные проверки

| Проверка | Результат |
|---|---|
| Backend `pytest -vv` | 581 passed, реальные PostgreSQL 18.6 и Redis 8 |
| Map/layers/split/routes/addresses профиль | 95 passed |
| Frontend `npx ng test --watch=false` | 638 passed, 78 файлов |
| `npx tsc --noEmit -p tsconfig.app.json` | Успешно |
| `npm run build` | Успешно; предупреждение initial budget: 857.25 kB / 500 kB |
| `docker compose config --quiet` | Успешно, инфраструктура не менялась |
| `git diff --check` в обоих репозиториях | Успешно |
| Migration CLI dry-run → apply → apply → dry-run | Проверено в отдельной тестовой БД; второй apply идемпотентен, missing=[] |

Отдельного lint target в проекте нет. Ни один старый regression-тест не отключён.
Изолированные map API тесты теперь очищают тестовый Redis, поскольку пересоздание
PostgreSQL-схемы само по себе не очищает permission cache с повторяющимися ID.
Это исправление тестовой изоляции, не изменение production RBAC.

## Реальный браузер / WebGL

```bash
npm start -- --port 4217 --host 127.0.0.1 --hmr=false --live-reload=false
MAP_VERIFY_WORKSPACE=1 MAP_VERIFY_ROUTES=1 MAP_VERIFY_ADDRESS_FIX=1 node scripts/verify-map-stage25172.mjs
```

Существующий Playwright runner, Brave headless / SwiftShader, настоящий MapLibre.
API и raster fixtures локальные: нет обращений к Яндексу, реальной авторизации и
записей в пользовательской БД. DPR 1 — схема улиц, DPR 2 — неоднородная
спутникоподобная текстура; это не сертификация живых спутниковых тайлов.
Обе темы проверяются с DPR 1 и 2. Подробные результаты: [browser-results.json](browser-results.json).

Проверяются:

- верхние панели, взаимное закрытие, Escape, узкая карта без горизонтального overflow;
- создание слоя, членство существующего объекта, all-off без возврата всего набора;
- паспорт по запросу, сохранение, конфликт с сохранением draft, отсутствие лишнего POST;
- три повторных expand/collapse той же карты, неизменные камера/bearing/pitch,
  focus restore, приоритет Escape у вложенного паспорта/легенды;
- скрытие кабелей, пустой hit source, отсутствие geometry reads после pan/обычного
  выбора дома; явный Show links и восстановление настроек после reload;
- старые проверки split/hover snap/отмены, 14 иконок и alpha `note`, муфта/бокс,
  pass-through без разрыва, installation boundary и 6 способов прокладки;
- pixel clipping под circle/rounded/pill/icon: 0 изменённых пикселей в исключённых
  footprint-зонах; отсутствие дублей sources/layers после повторного открытия;
- один dependency Alert Dialog, кнопка/backdrop/Escape/focus, PATCH прежней метки,
  запись координат дома и единственное семантическое представление дома;
- 1000 дополнительных точек без 1000 Angular/DOM-маркеров (проверка старого runner).

В старой browser fixture стояло `expires_at=9999999999`: переполнение setTimeout
провоцировало постоянную перезагрузку растров. Исправлены fixture TTL и верхняя
граница таймера в обоих картографических компонентах. Перед скриншотом теперь
ожидается загрузка raster source, а не только фиксированная задержка.

## Выбранные снимки

- [Фильтры](dark-dpr1-workspace-filters.png)
- [Развёрнутая карта и легенда](dark-dpr1-workspace-expanded-legend.png)
- [Неоднородная подложка / DPR 2](dark-dpr2-workspace-expanded-legend.png)
- [Паспорт объекта](dark-dpr1-workspace-passport-view.png)
- [Draft после конфликта](dark-dpr1-workspace-passport-conflict.png)
- [Узкая встроенная карта](light-dpr1-workspace-narrow.png)
- [Зависимости удаления](dark-dpr1-delete-dependencies.png)
- [Смешанная прокладка](dark-dpr1-mixed-methods.png)
- [Прозрачный маркер и подрезание](dark-dpr1-transparent-marker-clipping.png)
- [Сетка существующих SVG](dark-dpr1-icon-grid.png)

Полная матрица PNG генерируется рядом локально, но .gitignore оставляет для Git
только эти представительные изображения и JSON. Не копируйте случайный
промежуточный `failure.png` как итоговый результат.

## Границы проверки

Реальный PostgreSQL проверен отдельно backend-тестами; браузерные fixtures не
заменяют эту проверку. Live Yandex/proxy performance/load не тестировались и
не менялись. Production-миграция не выполнялась. PostGIS, файлы/фото, аудит,
полигоны, учёт волокон/портов и новые слои тайлов остаются вне этого этапа.
Временно скрытые элементы Яндекса не восстановлены по debug-указанию владельца.
