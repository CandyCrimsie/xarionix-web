import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { Addresses } from '../../pages/addresses/addresses';
import { PermissionService } from '../../core/permissions/permission.service';
import { ErpBridge } from './bridge';
import { Config } from '../core/config';
import { UI, ICONS } from '../shared/ui';

@Component({
  selector: 'app-platform-erp-map',
  imports: [Addresses, UI],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!config.value.erpEnabled) {
      <section class="panel" data-testid="erp-migration-boundary">
        <h1>Карта и адреса</h1>
        <p class="description">
          Интеграция ERP не включена. Подключите проверенный OIDC backend и явные привязки
          пользователей и компаний.
        </p>
      </section>
    } @else if (!bridge.session.company()) {
      <section class="panel">
        <h1>Карта и адреса</h1>
        <p class="description">Выберите компанию для работы с инфраструктурой.</p>
        <a hlmBtn variant="outline" routerLink="/companies">Компании</a>
      </section>
    } @else if (bridge.loading()) {
      <p role="status" class="text-sm text-muted-foreground">Проверяем доступ к ERP…</p>
    } @else if (bridge.error() || !bridge.context()) {
      <section class="panel" role="alert">
        <h1>Доступ к ERP не подтверждён</h1>
        <p class="description">
          Проверьте привязку учётной записи и компании, права ERP и доступность Core. Новые записи
          автоматически не создаются.
        </p>
        <button hlmBtn variant="outline" (click)="bridge.load()">Повторить</button>
      </section>
    } @else if (permissions.isCurrentContextReady()) {
      <div class="h-[calc(100dvh-10rem)] min-h-96" data-testid="unified-erp-map">
        <app-addresses />
      </div>
    } @else if (permissions.state() === 'error') {
      <p role="alert">Не удалось проверить права ERP.</p>
    } @else {
      <p role="status" class="text-sm text-muted-foreground">Загружаем права ERP…</p>
    }
  `,
})
export class PlatformErpMapPage {
  readonly bridge = inject(ErpBridge);
  readonly config = inject(Config);
  readonly permissions = inject(PermissionService);
  constructor() {
    effect(() => {
      const company = this.bridge.session.company();
      if (company && this.bridge.session.auth.authenticated())
        untracked(() => void this.bridge.load());
    });
  }
}
