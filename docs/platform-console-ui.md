# Интерфейс Console

Console использует standalone Angular 21, Signals и установленный Spartan Brain с существующими Helm primitives. Никаких копий ERP-страниц. Основная тема — тёмная; светлая полноценна. В localStorage сохраняется только `xarionix.console.theme`.

Оболочка: Sidebar с мобильным Sheet, верхняя панель с названием раздела, переключателем темы и Dropdown Menu профиля. Набор company links зависит от свежих effective permissions. Platform links отображаются только после серверного capability probe. Сворачивание sidebar, focus management, меню и dialogs принадлежат Spartan.

Страницы:

- Обзор: реальная версия Core, readiness, число доступных компаний; для admin — bounded установки, hosts, runtime и последние операции. Отсутствующий `total` не заменяется вымышленным глобальным счётчиком.
- Профиль: внутренний user/identity UUID, issuer/subject, допуск principal, изменение имени. Пароли/MFA остаются в Keycloak.
- Компании: создание или заявка согласно серверной политике; карточка, статус, выбор контекста, участники, сотрудники, приглашения, роли.
- Участники: базовая роль/статус, выключение, отдельные fine-grained роли и делегирование. Последний owner защищён Core.
- Роли: имя/описание/active, создание, удаление, versioned permission editor с постраничным каталогом.
- Приглашения: email, базовая/дополнительные роли, expiry, revoke. Секрет выдаётся один раз и стирается при закрытии, смене компании/сессии или уничтожении страницы.
- Platform administration: users, explicit identity classification, admins с отдельным checkbox подтверждения глобальных прав, компании/заявки/settings/audit.
- Module Manager: publishers, public keys/fingerprints, namespace grants, packages, structured manifest/diff, plans, installations/history и operations.
- Deployment: hosts, versioned plans, runtime tabs, jobs и terminal retirement.

Основные элементы — HlmButton, Input, Textarea, Field, Select, Checkbox, Table, Badge, Dialog, Alert Dialog, Sidebar/Sheet, Dropdown Menu, Tooltip, Collapsible, Tabs, Separator и Sonner. Самописных backdrop/focus traps нет.

В установленном Helm `HlmSelectTrigger` передаёт label ID внутренней кнопке через `buttonId`, а `HlmCheckbox` — через `inputId`. DOM id внешнего custom element не заменяет эти параметры. Каждый checkbox получает уникальный ID; подпись принадлежит своей оборачивающей label. Это проверяется component regression и настоящим выбором дополнительной роли в E2E. Вложенный Select использует штатный overlay Spartan.

Формы компактны, имеют ограниченную по высоте прокручиваемую область и доступный footer. Loading блокирует повторную отправку и закрытие при pending save. Ошибка API оставляет форму и значения. 422 отображается у полей; MFA/409 — в контекстном error box. Success toast появляется после ответа сервера.

Для безопасных admin данных, которые API возвращает словарём, используются bounded text-only structured reports. Основные карточки имеют подписанные поля, digest/SHA/доверие/поколения. JSON Manifest доступен только как дополнительный текст в Collapsible.

Не реализованы фиктивные таблицы лицензий, каскадное удаление, remote shell, generic «Apply package» HTTP-кнопка или чужой module frontend.
