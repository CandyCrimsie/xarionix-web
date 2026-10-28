# Карта и адресный каталог: исправления привязок и удаления

## Реализовано

- Один Spartan NG Alert Dialog для `409 detail.code=object_has_dependencies`.
  Настоящие доступные связи группируются; длинный список прокручивается. Нет крестика,
  есть одна кнопка «Закрыть». Включены поддерживаемые `closeOnOutsidePointerEvents`,
  `disableClose=false`, `restoreFocus`. Escape и backdrop проверены в браузере.
- Для этого конфликта нет Sonner error и постоянного `actionError`. Сетевые,
  access и непредвиденные ошибки не подавляются. Повторный DELETE блокируется;
  ответ старой компании/старого выбора не открывает устаревшее окно.
- Подтверждение DELETE закрывается явно: в установленной библиотеке
  `hlmAlertDialogAction` сам его не закрывает. Переход ждёт реального `CDK DialogRef.closed`,
  а не таймера; два активных alertdialog одновременно не появляются.
- Существующий маркер редактируется PATCH с прежним ID и `expected_version`.
  Уже выбранная точка не стирается при выборе непозиционированного дома как основной
  метки: используется `building_position`. Начальный центр карты не считается явным
  согласием разместить дом. При выборе уже расположенного дома используется его
  каноническая точка; дальнейшее перемещение остаётся отдельным явным действием.
- `binding_effects` mutation сразу обновляет роль/версию прежней основной метки.
  Последующее чтение viewport защищено существующими generation counters.
- Основной дом определяется по `building_id` и `building_link_role=represents`.
  Стандартная точка подавляется в пользу основной, включая случай устаревшего
  NULL-snapshot выбранного дома. Независимые `reference/located_at` не скрываются.
- После сохранения закрывается устаревший popup, очищаются editor/placement состояния
  и сообщение о координатах; прежние bounds-запросы инвалидируются. При очистке выбора
  и смене компании старые ответы также не возвращают сообщение.
- Закрытие редактора/открытие другой метки инвалидирует незавершённый callback,
  чтобы поздний результат не закрыл новую форму и не перезаписал её состояние.
  Это не отменяет уже завершённую серверную транзакцию; следующий viewport читает БД.

## Изменённые файлы frontend

- `src/app/pages/addresses/address-dependencies-dialog.ts`
- `src/app/pages/addresses/address-dependencies-dialog.html`
- `src/app/pages/addresses/address-dependencies-dialog.spec.ts`
- `src/app/pages/addresses/addresses.ts`
- `src/app/pages/addresses/addresses.html` — только подключения/действия bugfix;
  предшествующее пользовательское оформление сохранено.
- `src/app/pages/addresses/addresses.spec.ts`
- `src/app/features/map/components/address-map/address-map.ts`
- `src/app/features/map/components/address-map/address-map.html` — привязка `positionChosen`;
  остальные незакоммиченные изменения пользователя сохранены.
- `src/app/features/map/components/address-map/address-map.spec.ts`
- `src/app/features/map/components/map-marker-editor/map-marker-editor.ts`
- `src/app/features/map/components/map-marker-editor/map-marker-editor.spec.ts`
- `src/app/features/map/models/map.models.ts`
- `scripts/verify-map-stage25172.mjs`, `scripts/verify-map-address-bugfix.mjs`
- `docs/verification/address-map-bugfix/` — реальные browser/WebGL-проверки.

Незакоммиченные `map-legend.html` и `address-type-manager.html` принадлежали пользователю
до начала задачи и не изменялись в рамках аудита. Старый тест набора popup-действий
проверяет тот же состав без зависимости от пользовательской перестановки кнопок.

## Проверки

- `npx ng test --watch=false`: **601 passed**, 74 файла тестов.
  Новые regression-тесты проходят; существующие не отключены.
- `npm run build`: успешно; существующее предупреждение initial bundle budget
  (852.46 kB при warning-пороге 500 kB). Лимиты сборки не ослаблялись.
- `MAP_VERIFY_ADDRESS_FIX=1 node scripts/verify-map-stage25172.mjs`:
  light/dark × DPR 1/2, настоящий Chromium/Brave + MapLibre WebGL (SwiftShader).
  Все четыре запуска успешны, console/page rendering errors отсутствуют.
- Проверены один конфликтный dialog, три способа закрытия, восстановление фокуса,
  отсутствие error-toast/banner, PATCH того же ID, informational binding без перемещения
  дома, canonical building_position, один дом в трёх GeoJSON sources, отсутствие старого
  сообщения, повторное открытие карты и уникальные layer IDs.
- Browser использует локальные API/raster fixtures. Реальный PostgreSQL contract,
  rollback, приватность и конкуренция проверены backend-набором: 562 passed.
  Ни рабочая БД, ни Yandex API не использовались для тестовой записи/нагрузки.

### Согласованное изменение проверки логотипа

`AddressMap > shows the empty-coordinate state and an official clickable Yandex logo`:
в исходных незакоммиченных пользовательских HTML-правках удалён блок логотипа/атрибуции
Яндекса. Изначально тест ожидал `img[src="/yandex-logo-ru.svg"]` и падал.
29 октября 2026 пользователь явно подтвердил: «Нет, оставить удалённым».
HTML оставлен без изменений. Тест переименован и согласован с этим решением:
по-прежнему проверяет сообщение об отсутствии координат и теперь проверяет отсутствие
удалённого логотипа. Тест не отключён; полный Angular-набор проходит.

## Артефакты

- [Результаты всех четырёх запусков](verification/address-map-bugfix/browser-results.json)
- [Диалог, тёмная тема](verification/address-map-bugfix/dark-dpr1-delete-dependencies.png)
- [Редактор основного дома](verification/address-map-bugfix/dark-dpr1-primary-binding.png)
- [Карта после сохранения](verification/address-map-bugfix/dark-dpr1-canonical-house.png)

Backend-причины, контракт 409, правила приватности и перечень серверных файлов находятся
в `xarionix-erp/docs/map-address-bugfix.md`. Схема БД не менялась; миграции не нужны.
