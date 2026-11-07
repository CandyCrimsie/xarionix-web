import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Session } from '../core/session';
import { UI } from '../shared/ui';
import { ErrorBox } from '../shared/feedback';
@Component({
  selector: 'console-unavailable',
  imports: [UI, ErrorBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="panel mx-auto max-w-lg">
    <h1>Раздел недоступен</h1>
    <p class="description">
      Не удалось подтвердить доступ. Проверьте выбранную компанию и права учётной записи.
    </p>
    <console-error [error]="session.error()" [retryable]="true" (retry)="session.load()" />
    <div class="mt-5 flex gap-2">
      <a hlmBtn variant="outline" routerLink="/profile">Профиль</a
      ><a hlmBtn routerLink="/companies">Компании</a>
    </div>
  </section>`,
})
export class UnavailablePage {
  readonly session = inject(Session);
}
