# Sprint 6B — фактическая проверка Web

Проверки 6–7 ноября 2026 года. Web/Core HEAD совпали с заданием; ERP найден с HEAD
`08e5f63b82e38b41aa97e17355079d6ef2312977`. Начальные рабочие деревья чистые.
Commit/push/deployment и изменения Runner не выполнялись.

| Проверка | Результат |
| --- | --- |
| ERP + platform Web unit/regression | **781 passed**, 95 файлов |
| Compatibility Console + unified tests | **117 passed**, 15 файлов |
| Primary Web production build | Успешен, initial ~749 kB; warning 500 kB и error gate 1 MB сохранены |
| Console compatibility build | Успешен, тот же root/shell, SVG loader и declarations согласованы |
| Сохранённый ERP migration build | Успешен |
| Реальные Core/ERP/PostgreSQL/Redis/Keycloak browser E2E | **6 passed**, disposable окружение |
| PKCE S256 + настоящий OTP, logout | Проверены |
| Одна session Core + ERP | Отказ до binding, успешный context после operator CLI; правильные numeric IDs; реальное создание/чтение private marker с прежним owner ID; чужой company context запрещён, legacy login/refresh не вызываются |
| Signed xpkg + approval + отдельный executor | Проверены |
| Обычный пользователь, прямой admin URL | Отказ; protected package API не запрашивается |
| MapLibre WebGL regression | Light/dark × DPR 1/2, errors=[]; mock transport, отдельно от настоящего OIDC/API теста |
| Public HTTPS nginx -t | Успешен, disposable certificates, non-root image |
| Git packed refs CI transfer regression | Успешен |
| ERP backend regressions | **610 passed**, включая все прежние map graph/split tests и новый OIDC слой |
| ERP security | Bandit и MyPy нового слоя проходят; pip-audit установленного project environment — 0 известных уязвимостей после PyJWT 2.15.1 |
| Secret scanning | Core/Web рабочие источники — passed; ERP Git history — passed, только exact synthetic fixture exception |

Локальные artifacts находятся в игнорируемом `reports/`: `sprint-6b-web-erp-full.log`,
`sprint-6b-compat-erp-unit.log`, `sprint-6b-browser-final-verified.log`,
`console-e2e.xml`, `console-screenshots/`, `sprint-6b-map-final.log`,
`unified-map-ux-final/`. Токены, пароли и private E2E state не включаются в reports.

Дополнительно проверены Gateway revision/scope, stateful Hello company isolation,
запрет автоматического повтора uncertain write, stopped-writer backup/restore и
явное destructive подтверждение restore. Approval показывает схемы, epoch/revision
и точный backup SHA-256. На карте сохранены существующие SVG, controls и debug
настройка атрибуции. [Полный список файлов](sprint-6b-changes.md).

## Исправленные причины

- Два production bootstrap заменены одним root/Router/shell с серверными guards.
- Смешивать ERP number IDs/HS auth с Core UUID/OIDC было нельзя: реализован отдельный
  opt-in ERP verifier, fresh Core checks и trusted explicit bindings, без casts/JIT.
- Файл константы ERP API импортировал старый Router, затягивая password/setup pages
  в новую сборку. Удалён неиспользуемый ApplicationConfig из этого файла; bundle gate
  запрещает legacy login/setup UI. Старый target продолжает собираться отдельно.
- Compatibility target раньше не нуждался в SVG text loader/declarations карты;
  теперь он использует те же options/assets, что primary target.
- Исходный ERP PyJWT 2.13.0 имел известные уязвимости: обновлён до Core pin 2.15.1.
  Async SQLAlchemy extra устраняет отсутствие greenlet на ARM/macOS.

## Границы готовности

Карта/адреса используют проверенную общую session; **все исторические ERP workflow
не объявляются полностью мигрированными**. Остальные ERP страницы/контракты сохранены
в legacy target. Для реальных данных оператору нужны проверенные bindings и точная
ERP audience/client. Рабочие users/companies автоматически не изменялись.

Новый GitLab pipeline не запускался: commits запрещены. После самостоятельного
push нужны `CONSOLE_CORE_REF`, `CONSOLE_ERP_REF` и Repositories Read allowlist ERP.
Runner и GitLab permissions в этой задаче не менялись. Nginx проверен локально,
production domains/certificates/rollout администратор применяет отдельно.

SDK/persistence/native E2E описаны в [отчёте Core](../../xarionix-core/docs/sprint-6b-validation.md).
