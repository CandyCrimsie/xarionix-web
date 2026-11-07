# Установка единого Web и совместимость ERP

## Сборки

- `npm start` / `npm run build` — основное приложение на 4200,
  production `dist/xarionix-web/browser`.
- `console:build` — compatibility build того же entry/shell; второй порт не нужен.
- `erp:legacy:start` / `erp:legacy:build` — исходный ERP bootstrap для остальных
  migration/regression сценариев. Не публикуется второй production SPA.
- `npm test -- --watch=false` — все ERP и platform unit tests;
  `console:test` — перенесённые Console/unified tests.

## Production

1. Применить штатные Core migrations, включая additive `0013_module_storage`.
2. Подготовить проверенный ERP OIDC backend и явные bindings по
   [операторской процедуре](../../xarionix-erp/docs/platform-oidc.md).
   Старые данные не преобразуются. `create_all` создаёт только новые binding tables;
   существующие схемы/FK/RBAC остаются прежними.
3. У public PKCE client — exact redirect `https://<web>/auth/callback`, exact logout
   URI/web origin, S256, Core audience и отдельная ERP audience `xarionix-erp`.
   ERP pin `PLATFORM_OIDC_CLIENT_ID` должен совпадать с Web clientId. Никаких wildcard,
   client secret в Angular, Keycloak master credentials или first-login admin.
4. В публичном `console-config.json` включить `erpEnabled: true` после настройки
   backend/bindings. При false/отсутствии карта показывает настройку интеграции,
   не пытаясь войти через старый password API.
5. Использовать `deploy/web/nginx.conf.example`: один root, один Angular Router.
   Заменить hosts/certs/issuer, выполнить `nginx -t`, затем безопасный reload.
   Production deployment в рамках этой задачи не выполнялся.

Сохранены HTTPS/HSTS, upstream TLS verification для Core/ERP, CSP, cookie isolation,
ограниченный upload и отсутствие OAuth query access logs. Static MapLibre worker
загружается с собственного origin; внешний JS из `.xpkg` не допускается. Разрешён
только reviewed map/address/context ERP API. Login/refresh/setup/debug закрыты.

`/map/tiles/` направлен только в существующий signed tile proxy на loopback:8088.
Он проверяет expiry/signature и хранит provider key. Human Authorization/Cookie
туда не передаются. Настройте прежний proxy с совпадающим ERP signing key;
не раскрывайте его signing key/provider credential в public config. Для другого
host используйте проверенный HTTPS upstream вместо loopback, без публичного порта.
Скрытая debug attribution Яндекса не менялась.

В development `XARIONIX_CONSOLE_CORE_TARGET` задаёт Core, `XARIONIX_WEB_ERP_TARGET`
задаёт ERP (по умолчанию localhost:8001), `XARIONIX_WEB_MAP_TARGET` — прежний tile
proxy. Клиент остаётся на 4200. Legacy proxy сохранён отдельно.

## Фактический статус ERP

| Критерий | Состояние |
| --- | --- |
| Один публичный Web и одна оболочка | Реализованы |
| Keycloak session Core/admin/modules | Проверена реальным PKCE + OTP |
| Та же session карты/адресов ERP | Проверена с реальными Core + ERP + PostgreSQL + Keycloak и operator CLI |
| Все исторические ERP API/страницы переведены в Core model | **Нет**; сохранены в legacy target, DTO/RBAC не смешаны |

`GET /api/v1/auth/platform-context` проверяет собственный JWT contract ERP, fresh
Core identity/membership и bindings, возвращает прежние `user`, `company`,
`permissions`, `scopes` вместе с Core UUID. Unlinked/disabled/foreign contexts
отклоняются. Web никогда не выводит numeric ID из UUID и не выбирает компанию по
названию. Смена компании/выход очищает старые результаты и отменяет запросы.

Старые `/platform/*` URLs redirect к `/admin/*`; backend administrative API
контракты не переименованы. Legacy HS clients ERP остаются отдельным совместимым
путём; общий Web не вызывает его login/refresh.

## Межрепозиторный CI

После самостоятельного commit/push задайте GitLab variables:

- `CONSOLE_CORE_REF` — полный проверенный 40-символьный SHA Core 6B.
- `CONSOLE_ERP_REF` — полный проверенный 40-символьный SHA ERP OIDC bridge.

Job не использует mutable `main` или старые baseline commits. Для Web job token
нужен **Repositories → Read** в allowlist обоих backend проектов. Core allowlist
была настроена ранее; ERP allowlist в этой задаче **не изменялась**. При отсутствии
доступа checkout явно завершится ошибкой, integration не будет ложно skipped.
Production secrets, личные tokens и изменения Runner не нужны.

Обязательный `console:integration` передаёт оба reviewed checkout в изолированный
rootless DinD, создаёт отдельный ERP venv и запускает все браузерные сценарии с
`--erp`. Источники/SQL credentials двух backend не смешиваются; чистятся только
ресурсы этого Compose project. Native module storage проверяется отдельно в Core.

OpenAPI gate сравнивает весь API и strict Manifest schema. Git HEAD не включён
в JSON; источник отдельно закреплён immutable SHA. Локально:

```bash
../xarionix-core/.venv/bin/python scripts/console_contract.py --core ../xarionix-core --check
../xarionix-core/.venv/bin/python scripts/console_integration.py \
  --core ../xarionix-core --erp ../xarionix-erp
```

Pipeline новых commits здесь не запускался: commit/push запрещены заданием.
