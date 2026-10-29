# Полировка интерфейса карты

Изменения ограничены frontend. API, модели, геометрия, split/place, права и
MapLibre layers не изменены. Commit/push не выполнялись.

## Что исправлено

- Контекстное меню границы вынесено в небольшой presentation-компонент
  `MapInstallationBoundaryMenu`. Замороженный снимок соединения, version,
  geometry token и HTTP-запрос по-прежнему принадлежат `AddressMap`.
- Основное меню: заголовок с Route, сведения «до/после», координаты по кнопке
  Info через Spartan Collapsible, три одинаковые строки действий высотой 36 px.
- Изменение: Back, Select, пояснение диапазона, Cancel/Save. Меняется только
  участок до следующей границы, как и раньше.
- Удаление: два варианта Spartan Radio Group, явное подтверждение
  «Объединить участки». Payload `keep: previous | next` не изменён. Первый
  клик на удаление больше не отправляет запрос.
- Ошибка оставляет меню, выбранную границу и введённое значение открытыми.
  Она не дублируется одновременно в нижней панели карты.
  Loading блокирует повторное подтверждение. При смене состояния фокус
  переводится на существующую кнопку, а не остаётся на удалённом DOM-узле.
- Видимый handle — 12 px, кнопка — 28 px. Непрозрачные семантические цвета,
  selected-ring и focus-visible. Поповер привязан к реальной кнопке, а не
  только к замороженным экранным координатам; работает восстановление фокуса.
  Клик во внешнюю часть кнопки не передаётся кабелю. Алгоритм snap не изменён.
- Меню «Добавить на трассу»: тот же Popover, сетка иконок 20 px, строки 36 px,
  заголовки двух групп, Separator, самостоятельное действие прокладки.
  Используются существующие специализированные SVG и allowlist операций.
- В карточках добавлены согласованные Lucide-иконки для паспорта, перемещения,
  привязки и редактирования. Отвязка объекта от кабеля — компактная icon-only
  кнопка с tooltip. Удаление дома использует штатный destructive Menu Item.
- Фильтры получили связанные с Select подписи Field. Постоянная справка
  перенесена в Info Popover; вложенная справка слоёв сохранена. Кнопка удаления
  слоя выделена semantic destructive-цветом.
- Редакторы уплотнены: интервалы 12 px, согласованные заголовки Collapsible
  высотой 36 px, без перестройки формы. Поля и Select блокируются на сохранении.
  Выбор точки остаётся рядом с координатами, swap — между концами соединения.
- Паспорт ограничен высотой экрана, прокручивается только содержимое;
  footer не уезжает за пределы диалога.
- Легенда проверена: существующие Spartan Collapsible и общий набор
  MapLibre/SVG line styles сохранены без лишних изменений.

## Что сохранено

Пользовательская кнопка fullscreen: `hlmBtn`, `variant="secondary"`,
`size="icon"`, `absolute bottom-3 right-3 z-10`, только Maximize и aria-label.
Не возвращались `bg-background/90`, blur или текстовая подпись у этой кнопки.
Существующее форматирование и остальные пользовательские HTML-правки сохранены.
Debug-атрибуция не менялась. Новых зависимостей и глобальных CSS-токенов нет.

Стандартные контролы: Spartan Popover, Button, Select, Radio Group, Collapsible,
Separator, Field, Tooltip, Dropdown Menu и существующие Dialog/Alert Dialog.
Специальные картографические DOM handles/hover-plus остались как исключение;
новых overlay/outside-click реализаций нет.

## Проверка

- `npx ng test --watch=false`: 664 теста, 80 файлов (в том числе новые тесты
  состояний меню, удаления, ошибки, Select, увеличенного handle и fullscreen).
- `npx tsc -p tsconfig.app.json --noEmit` и
  `npx tsc -p tsconfig.spec.json --noEmit`: успешно.
- `npm run build`: успешно. Сохраняется предупреждение initial bundle > 500 kB.
  Итоговый размер — 859.68 kB (предельный error budget 1 MB не превышен).
- Отдельный lint target в `angular.json` и npm script отсутствует; новый
  инструмент lint не устанавливался. `git diff --check` используется отдельно.

Браузерный runner — настоящий MapLibre/WebGL и Spartan, транспорт API/тайлов
заменён локальными fixtures. Запросы в Яндекс и мутации development database
не выполняются:

```sh
npm start -- --port 4217 --host 127.0.0.1 --live-reload=false --hmr=false
MAP_VERIFY_UX=1 MAP_VERIFY_WORKSPACE=1 MAP_VISUAL_OUT=../docs/verification/map-polish/ node scripts/verify-map-stage25172.mjs
```

Скриншоты до изменений доступны в `verification/map-polish-before/`
(светлая тема DPR 1/2); после — в `verification/map-polish/`.
Полный результат браузерных конфигураций записывается в `browser-results.json`.
Итоговый прогон: **4/4 конфигурации прошли** (light/dark × DPR 1/2),
`errors: []`, `unknownApi: []` во всех конфигурациях. Использован Brave
Chromium с WebGL/SwiftShader; DPR 2 также проверяет локальную подложку,
имитирующую спутниковое изображение.
Проверяются вложенный Select (включая Escape), возврат назад, явное подтверждение
объединения, retry после 409 без закрытия формы, клик за пределами видимого
12 px кружка, меню в верхнем правом углу обычной/узкой развёрнутой карты,
outside-click, фокус, сохранность draft после выбора координат, reverse трассы,
повторный fullscreen без нового MapLibre instance, фильтры, слои и паспорта.
Перед проверкой нового экранного положения runner ждёт реального resize
canvas после переноса карты между контейнерами.

## Файлы

- `src/app/features/map/components/address-map/address-map.{html,ts,spec.ts}`
- `src/app/features/map/components/map-installation-boundary-menu/map-installation-boundary-menu.{html,ts,spec.ts}`
- `src/app/features/map/components/map-toolbar/map-toolbar.{html,ts}`
- `src/app/features/map/components/map-marker-editor/map-marker-editor.html`
- `src/app/features/map/components/map-connection-editor/map-connection-editor.html`
- `src/app/features/map/components/map-passport/map-passport.html`
- `scripts/verify-map-ux.mjs`
- `scripts/verify-map-splice.mjs` (снимок меню добавления на трассу)
- этот отчёт и изображения/JSON в `docs/verification/map-polish*/`

## Границы проверки

Не проводился отдельный аудит Safari/Firefox, реальной подложки Яндекса и
нагрузки backend: изменения касаются UI. Существующие MapLibre слои сохранены,
постоянные точки не превращались в DOM-компонент для каждой границы компании.
