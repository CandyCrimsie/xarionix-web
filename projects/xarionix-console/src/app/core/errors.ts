import { HttpErrorResponse } from '@angular/common/http';

export class CoreError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null = null,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
  get mfa(): boolean {
    return this.code === 'configured_recent_mfa_required';
  }
  get conflict(): boolean {
    return this.status === 409;
  }
}
const messages: Record<number, string> = {
  0: 'Сервис недоступен. Проверьте соединение.',
  400: 'Проверьте параметры запроса.',
  401: 'Сессия истекла. Войдите снова.',
  403: 'Недостаточно прав для этого действия.',
  404: 'Запись не найдена или недоступна.',
  408: 'Время загрузки истекло.',
  409: 'Данные изменились. Обновите их и проверьте действие заново.',
  413: 'Пакет превышает допустимый размер.',
  415: 'Сервис ожидает файл .xpkg.',
  422: 'Проверьте введённые данные.',
  429: 'Слишком много запросов. Повторите позже.',
  503: 'Сервис временно недоступен.',
};
const codes: Record<string, string> = {
  configured_recent_mfa_required:
    'Требуется повторный вход с MFA. После входа заново проверьте план и подтвердите действие.',
  last_owner_required: 'Нельзя удалить или отключить последнего владельца.',
  last_platform_admin_required: 'Нельзя отключить последнего администратора платформы.',
  principal_human_required: 'Учётная запись ещё не допущена оператором как пользователь.',
  platform_admin_required: 'Этот раздел доступен администратору платформы.',
  user_suspended: 'Учётная запись приостановлена.',
  signing_trust_revoked: 'Доверие к подписи отозвано.',
  installation_plan_expired: 'План истёк. Подготовьте новый план.',
  deployment_plan_expired: 'План истёк. Подготовьте новый план.',
};
export function coreError(error: unknown): CoreError {
  if (error instanceof CoreError) return error;
  if (!(error instanceof HttpErrorResponse))
    return new CoreError(0, 'unknown', 'Не удалось выполнить операцию.');
  const body: unknown = error.error;
  const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
  const code =
    detail &&
    typeof detail === 'object' &&
    'code' in detail &&
    typeof detail.code === 'string' &&
    /^[a-z0-9_]{1,120}$/.test(detail.code)
      ? detail.code
      : `http_${error.status}`;
  const fields: Record<string, string> = {};
  if (Array.isArray(detail))
    for (const item of detail) {
      if (item && typeof item === 'object' && Array.isArray(item.loc)) {
        const field = item.loc
          .filter((p: unknown) => typeof p === 'string' || typeof p === 'number')
          .slice(1)
          .join('.');
        fields[field] = 'Проверьте значение';
      }
    }
  const id = error.headers.get('X-Request-ID');
  return new CoreError(
    error.status,
    code,
    codes[code] ?? messages[error.status] ?? 'Не удалось выполнить операцию.',
    id && /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : null,
    fields,
  );
}
