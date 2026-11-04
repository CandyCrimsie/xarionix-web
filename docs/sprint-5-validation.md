# Sprint 5 — реализация и проверка Platform Console

Дата проверки: 4 ноября 2026. Изменения находятся в рабочем дереве Web; commit, push и production deployment не выполнялись.

## 1. Изученные репозитории

`xarionix-web`: действующее ERP-приложение, Angular workspace, Helm/Brain, авторизация, company context, CI и тесты. `xarionix-core`: baseline `c6ab57707a0b2b486715017316e67d52b80b6d4e`, фактические OpenAPI/Pydantic/service contracts, ограничения RBAC/MFA, installation CLI и Deployment Agent. Core остался без изменений; ERP backend не изменялся.

## 2–3. Созданные и изменённые файлы

Изменены `.gitignore`, `.gitlab-ci.yml`, `README.md`, `angular.json`, `package.json`, `package-lock.json`, `tsconfig.json`. Существующие ERP `src/`, Helm `libs/`, ERP tests/proxy/Dockerfile не переписывались.

Созданы:

| Каталог / файлы | Назначение |
|---|---|
| `projects/xarionix-console/src/app/core/{api,auth,clock,config,errors,guards,models,navigation,polling,route-reuse,scope,session}.ts` | Изолированные контракты, OIDC, RBAC, запросы и состояние |
| `projects/xarionix-console/src/app/shared/{actions,data-table,feedback,live-data,package-upload,page-data,permission-picker,report,role-picker,ui}.ts` | Переиспользуемые Spartan формы, таблицы, загрузка, безопасные отчёты |
| `projects/xarionix-console/src/app/pages/{auth-page,companies,dashboard,hosts,install-plan,installations,packages,people,platform,profile,publishers,roles,runtime,unavailable}.ts` | Рабочие страницы Console |
| `projects/xarionix-console/src/app/{app.config,app.routes,app,shell}.ts`, `app.html`, `app.css` | Оболочка и маршрутизация |
| `projects/xarionix-console/src/{main.ts,index.html,styles.css,test-setup.ts}` | Отдельный entry point, тема и test setup |
| `projects/xarionix-console/{tsconfig.app.json,tsconfig.spec.json,proxy.conf.cjs}` | Отдельные build/test/proxy contracts |
| `projects/xarionix-console/{public,production}/console-config.json` | Явно раздельные dev и production public config |
| `projects/xarionix-console/contracts/core-openapi.json` | Проверяемый снимок 87 API paths и строгой схемы Manifest |
| `projects/xarionix-console/src/app/core/*.spec.ts`, `pages/plans.spec.ts`, `shared/*.spec.ts` | Unit/component regression |
| `projects/xarionix-console/e2e/{console.e2e.ts,playwright.config.ts,safe-reporter.ts}` | Настоящий браузерный E2E, безопасный JUnit |
| `scripts/{check-console,check-console-bundle,console-preview,console-security}.mjs` | Isolation, CSP/bundle, preview/proxy, dependency gate |
| `scripts/{console-ci-checkout,console-ci-inner}.sh`, `scripts/{console_ci,console_contract,console_integration}.py` | GitLab checkout/bridge, contract export, disposable интеграция |
| `.dockerignore`, `deploy/console/{e2e.Dockerfile,nginx.conf.example}` | Тестовый toolbox и пример HTTPS deployment |
| `docs/platform-console-{architecture,authentication,api-contract,ui,module-manager,deployment,security,development}.md` | Архитектура, диаграммы, эксплуатация и ограничения |
| `docs/sprint-5-validation.md` | Этот отчёт |

## 4. Изоляция ERP и Console

Два standalone application targets в одном workspace. Общие только существующие визуальные Helm primitives; Console не импортирует ERP services, auth/interceptors, routes или карту. ERP остаётся с числовыми company IDs и `/api/**`; Console использует UUID, отдельный `/core-api/**` proxy и свой Session. Обычные npm start/build/test явно указывают ERP target.

AST gate проверяет импортные границы, небезопасное выполнение, browser logging/storage и стандартные controls; bundle gate проверяет отсутствие ERP/MapLibre, eval, inline event handlers и development config в production. Critical CSS inlining отключён только в Console: он генерировал `onload`, несовместимый со строгим script CSP.

## 5. Keycloak OIDC

Используется `oidc-client-ts` 3.5.0, public client, Authorization Code + S256 PKCE. User/access/refresh tokens находятся в памяти. sessionStorage хранит только короткоживущую OIDC transaction, theme — отдельный localStorage key. JWT не используется в качестве источника Platform Admin или company RBAC. Callback очищает code/state из адресной строки. Logout сначала удаляет User, затем использует client_id без ID JWT в URL. После reload требуется новый OIDC вход; Keycloak может применить свою SSO-сессию.

## 6. Core API client

Собственный HttpClient context/interceptor, typed DTO, branded UUID, проверка same-origin API prefix, Bearer только на разрешённые Core API calls. Health — без Bearer. Proxy не пересылает cookies браузера в Core. Ошибки нормализуются без arbitrary payload/stack/input/ctx; безопасный request ID сохраняется. Изменения не повторяются автоматически. Page stores владеют subscriptions; смена company/logout уничтожает старые результаты и запросы через epoch. Polling не перекрывается, ограничен по времени и останавливается при ошибке/уничтожении страницы.

## 7. Рабочие страницы

Обзор, профиль, компании/заявки, участники, сотрудники и их карточка, приглашения/принятие/отзыв, роли/права/делегирование, platform users/admins/settings/audit, publishers/keys/namespaces, raw packages/manifest/verification/diff, installations/history/operations, install plans, deployment hosts/plans, runtime и jobs. Формы сохраняют значения при ошибке и блокируют повторную отправку; права и подтверждения проверяет Core.

## 8. Используемые endpoints

Полная таблица методов, payload и authority — [API contract](platform-console-api-contract.md), точный OpenAPI — в `contracts/core-openapi.json`. Основные группы: `/me`, `/me/companies`, `/companies`, `/company-requests`, company-scoped `/members|employees|invitations|roles|me/permissions`, `/permissions`, `/invitations/accept`, `/platform/{users,admins,settings,audit,package-publishers,packages,module-installations,module-install-plans,deployment-hosts,deployment-plans,runtime-deployments}`. Несуществующие endpoints не имитируются.

## 9. Company RBAC

Контекст загружает текущий `companies/{uuid}/me/permissions`. Navigation/actions зависят от этих прав; guard повторно проверяет их. 403 отзывает локальную capability, но окончательное решение всегда на сервере. Дополнительные роли выбираются из постраничного каталога, без загрузки всех пользователей/ролей. Уникальные `inputId` исправляют ошибку, когда все checkboxes Spartan получали подпись первой роли. Чужие company responses после переключения игнорируются.

## 10. Platform Admin

Read-only probe существующего `/platform/settings`: 200 — доступен, `platform_admin_required` — отказ, `configured_recent_mfa_required` — требуется свежая MFA. Порядок проверок подтверждён по Core. Outage/неизвестный ответ не предоставляет доступ. Назначение администратора требует явного checkbox подтверждения; первый JWT никого администратором не делает.

## 11. XPKG upload

File передаётся как raw bytes с `application/vnd.xarionix.package+zip`, без multipart и без чтения большого архива в JS memory. Есть лимит, extension preflight, progress, cancellation, server verification errors и reload registry. Отмена запроса не объявляется откатом серверного импорта. Приватные signing keys не принимаются UI.

## 12. Install Plans

Серверные snapshot/digest, permission/dependency diff, blockers, SHA и поколения показываются перед одобрением. Подтверждается точный digest. Expiry не продлевается локально; refresh создаёт новый план. Idempotency key стабилен внутри одной попытки пользователя. Доступны реальные install/enable/disable/update/rollback/uninstall contracts.

## 13. Trusted Executor

Console только готовит и одобряет план. В состоянии ожидания показан отдельный доверенный оператор; HTTP apply/remote shell не добавлены. В E2E отдельный Python operator по private file IPC запускает настоящий Core CLI с отдельной ограниченной SQL role. UI видит `applied` только из Core.

## 14. Runtime

Регистрируются публичные метаданные уже подготовленной deployment identity; secrets/service accounts из браузера не создаются. Versioned deployment plan → digest approval → queued job → наблюдение реального Agent. Желаемое состояние, observed generation/digest, freshness, health и успешность задания различаются. Реальный порядок OCI: `installed_disabled` → provision/start → healthy → enable metadata. Попытка enable до healthy показывает настоящий blocker `runtime_not_healthy`.

Quarantine/retire сопровождаются явными предупреждениями о терминальности и сохранении business data. Heartbeat не выдается за readiness или успешное задание.

## 15. Свежая MFA

При отказе Core показано действие повторного входа с `prompt=login`, `max_age=0` и сконфигурированным ACR. Сохраняется только безопасный локальный return route, не payload операции. После входа необходимо перечитать и заново подтвердить план. Старое изменение не воспроизводится автоматически.

## 16. Реальные E2E

Выполнен финальный native прогон: **5/5** больших сценариев, без mock Core/JWT/healthy reports:

1. Настоящий Keycloak PKCE + OTP, профиль, смена имени, темы/mobile screenshots, отсутствие JWT в browser storage, logout.
2. Компания → сотрудник → роль и сохранение permission → приглашение с дополнительной ролью → вход другого пользователя → принятие → ограниченные права сотрудника.
3. Publisher/key/namespace → подписанный Hello OCI `.xpkg` → точный план/одобрение → отдельный настоящий CLI executor → host → настоящий native rootless Agent → provision/stopped → start/healthy → enable metadata → stop.
4. Неадминистратор не открывает platform management; скрытые controls не предоставляют authority.
5. Повторный импорт настоящего пакета возвращает 200 и одну запись; повреждённый `.xpkg` отклонён реальным Core; отзыв signing key отключает подготовку установки. Network fault injection проверяет offline Core и повторную загрузку после восстановления. Reload приводит к новому входу без persistent JWT; offline OIDC Discovery показывает понятный отказ без redirect loop.

Для native теста использован ранее разрешённый пустой rootless test engine с cgroup v2 и реальными RAM/swap/PID/CPU limits через защищённый Unix forward. Frontend/Playwright не выполнялись на VM/Runner; системный Docker, Runner и чужие volumes не менялись. После теста containers на выбранном native engine: **0**.

Native JUnit: `reports/console-native-e2e.xml` (локальный, исключён из Git). Скриншоты профиля и runtime: `reports/console-screenshots/`, просмотрены светлая/тёмная темы и мобильная компоновка. Screenshot animations отключены, чтобы не принимать промежуточные цвета CSS transition за дефект темы.

Дополнительно **успешно выполнен Docker CI bridge** локально: отдельный pinned rootless DinD over verified TLS → Core/Python + Node 22.22.2/Chromium toolbox → настоящий `npm ci` → production Console build/bundle gate → проверка Core OpenAPI HEAD → отдельные PostgreSQL/Keycloak/Core → **5/5 Playwright сценариев** → проверка controller exit через docker wait/inspect и возврат только sanitized JUnit. Default CI path показывает реальную очередь deployment, без выдуманного healthy. Положительный native runtime проверен отдельным прогоном выше.

В CI helper исправлены абсолютные Web build paths и перенос проверяемой Git identity без clone credentials. Подтверждено, что из перенесённого HEAD действительно читается audited Core commit. Доверенные Runner/VM не перенастраивались. Временный локальный DinD, его volumes и TLS-файлы удалены; native socket forward закрыт. Это локальное воспроизведение CI job, **не** заявление об успешном pipeline на GitLab.

## 17. ERP regression и остальные проверки

| Проверка | Фактический результат |
|---|---|
| ERP `npm test -- --watch=false` | **80 файлов, 664 tests passed** |
| ERP `npm run build` | Passed; initial 862.85 kB, warning >500 kB, error limit 1 MB не превышен |
| Существующий ERP WebGL runner `MAP_VERIFY_UX=1` | Passed: light/dark × DPR 1/2; 4/4 сочетания, без rendering errors и неизвестных API requests; локальные fixtures/tiles, без запросов к Яндексу |
| Console Vitest | **10 файлов, 91 tests passed**, JUnit сформирован |
| Console TypeScript | Passed |
| Console Prettier + AST boundaries | Passed |
| Console production build | Passed; initial 694.70 kB, warning >500 kB, error limit 1 MB не превышен |
| Console bundle/CSP/isolation gate | Passed |
| Core OpenAPI snapshot | Passed, 87 paths |
| Python Ruff | Passed для новых helper scripts |
| Shell syntax / GitLab YAML parse | Passed |
| Rootless DinD CI bridge | Passed: Node 22 production build, contract snapshot, **5/5 real E2E**, verified controller exit, sanitized JUnit restore |
| Nginx example | Настоящий `nginx -t` passed; HTTPS SPA ответ с доверенным временным сертификатом содержит CSP/HSTS/no-store |
| Git diff whitespace | Passed |

Brain закреплён на исходном `1.3.4`: автоматическое разрешение старого диапазона на 1.9 ломало ERP Dialog regression. Общие Helm primitives не переписаны. Angular обновлён совместимым security patch; lockfile проверен настоящим `npm ci`. Отдельный regression проверяет отмену зависшего HTTP на deadline polling: `takeUntil` размещён после `exhaustMap`, поэтому отменяет и внутреннюю subscription. В Nginx исправлена потеря security headers из-за наследования `add_header`.

## 18. Security

Production npm dependency audit: **0 vulnerabilities**. Полный tree: baseline **32 advisories** (30 moderate, 2 high tooling entries). High относится к Zod 3 внутри Spartan CLI и наследующей записи CLI. Применено узкое dev-only exception только для этого advisory/path до **18 ноября 2026**, с обязательным отказом при новом high/critical, production exposure или истечении срока. Причина и пересмотр — [security](platform-console-security.md). Весь dependency tree не объявляется чистым.

Gitleaks: история Git (128 commits) — без находок; финальные tracked + untracked source files (3.58 MB) — без находок. Секреты disposable fixture хранятся вне репозитория в private temp directories и удаляются. В artifacts передаётся только allowlisted sanitized JUnit; traces, token-bearing snapshots, private fixture state не публикуются. Старый диагностический XML из ошибочного вложенного output path удалён; этот путь и Python bytecode исключены из source control. Production bundle не содержит eval/inline onload, ERP auth или MapLibre.

## 19. Ограничения и CI

Backend gaps документированы в [API contract](platform-console-api-contract.md): нет single-runtime GET, полного host identity view, display name projection участников, OrgUnit API и module navigation metadata. Использованы существующие bounded APIs; чужие права не расширяются.

GitLab pipeline не запускался: изменений на сервере нет, push выполняет пользователь. Jobs подготовлены и локально проверяются. Для Docker job нужен разрешённый `debian` Docker executor с pinned rootless DinD service over TLS, `/certs/client` и ресурсами для браузера/Keycloak. Core project должен разрешить Web CI_JOB_TOKEN для read repository. Нативный `runtime-rootless` Runner не используется frontend jobs.

Не выполнена отдельная браузерная матрица всех expiry/generation/failed-job/revocation комбинаций из задания. Основные границы и ошибки покрыты Vitest и настоящими сценариями выше; Core security regression не подменяется заявлениями о frontend coverage. Не выполнены production HTTPS deployment, нагрузочное тестирование и ручной аудит каждого браузера/экранного диктора. Console проверена Chromium, 1440×1000 и 390×844, светлая/тёмная темы; существующая ERP — штатным Brave/SwiftShader WebGL runner, light/dark и DPR 1/2 с `MAP_VERIFY_UX=1`. Остальные opt-in модули старого runner отдельно не перезапускались. Automated visual baseline comparison пока не настроен.

## 20. Будущее объединение ERP UI и Core

Нужен отдельный план миграции ERP identity и числовых company IDs к Core UUID, mapping пользователей/членства, переход ERP API к Core permission model и company context, миграция auth guards/interceptors и совместимые endpoints. Для module navigation нужен закрытый серверный declarative contract и reviewed compiled route registry. Нельзя просто направить существующий `/api/**` proxy на Core или загружать arbitrary package JS.

Быстрый локальный запуск: `npm run console:start` (4300); ERP остаётся `npm start` (4200). Настройка Keycloak и полного E2E описана в [development](platform-console-development.md) и [authentication](platform-console-authentication.md).
