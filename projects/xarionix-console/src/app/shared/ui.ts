import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideArrowLeft,
  lucideArrowRight,
  lucideBuilding2,
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideCircleAlert,
  lucideClipboard,
  lucideDownload,
  lucideEllipsis,
  lucideExternalLink,
  lucideFileBox,
  lucideInfo,
  lucideKeyRound,
  lucideLayoutDashboard,
  lucideLoaderCircle,
  lucideLogOut,
  lucideMenu,
  lucideMoon,
  lucidePackage,
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideServer,
  lucideSettings,
  lucideShieldCheck,
  lucideSun,
  lucideTrash2,
  lucideUpload,
  lucideUser,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';

export const UI = [
  FormsModule,
  RouterLink,
  NgIcon,
  HlmButtonImports,
  HlmBadgeImports,
  HlmInputImports,
  HlmTextareaImports,
  HlmFieldImports,
  HlmSelectImports,
  HlmCheckboxImports,
  HlmTooltipImports,
  HlmSeparatorImports,
  HlmTableImports,
  HlmCollapsibleImports,
] as const;
export const ICONS = provideIcons({
  lucideActivity,
  lucideArrowLeft,
  lucideArrowRight,
  lucideBuilding2,
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideCircleAlert,
  lucideClipboard,
  lucideDownload,
  lucideEllipsis,
  lucideExternalLink,
  lucideFileBox,
  lucideInfo,
  lucideKeyRound,
  lucideLayoutDashboard,
  lucideLoaderCircle,
  lucideLogOut,
  lucideMenu,
  lucideMoon,
  lucidePackage,
  lucidePencil,
  lucidePlus,
  lucideRefreshCw,
  lucideSearch,
  lucideServer,
  lucideSettings,
  lucideShieldCheck,
  lucideSun,
  lucideTrash2,
  lucideUpload,
  lucideUser,
  lucideUsers,
  lucideX,
});
export const STATUS: Record<string, string> = {
  stale: 'Нет свежего подтверждения',
  installed_disabled: 'Установлен · выключен',
  installed_enabled: 'Установлен · включён',
  active: 'Активна',
  suspended: 'Приостановлена',
  archived: 'В архиве',
  inactive: 'Неактивен',
  removed: 'Отключён',
  pending: 'Ожидает',
  approved: 'Одобрен',
  applied: 'Применён',
  cancelled: 'Отменён',
  rejected: 'Отклонён',
  accepted: 'Принято',
  revoked: 'Отозван',
  available: 'Доступен',
  quarantined: 'Карантин',
  retired: 'Выведен из эксплуатации',
  installed: 'Установлен',
  enabled: 'Включён',
  disabled: 'Выключен',
  uninstalled: 'Удалён',
  queued: 'В очереди',
  leased: 'Выполняется',
  succeeded: 'Завершено',
  failed: 'Ошибка',
  expired: 'Истёк',
  running: 'Запущен',
  starting: 'Запускается',
  stopped: 'Остановлен',
  unknown: 'Неизвестно',
  not_provisioned: 'Не развёрнут',
  healthy: 'Исправен',
  unhealthy: 'Неисправен',
  connected: 'Подключён',
  disconnected: 'Нет связи',
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
  standard: 'Стандартный',
  autonomous: 'Автономный',
};
export function label(value: unknown): string {
  return value === null || value === undefined
    ? '—'
    : typeof value === 'boolean'
      ? value
        ? 'Да'
        : 'Нет'
      : (STATUS[String(value)] ?? String(value));
}
