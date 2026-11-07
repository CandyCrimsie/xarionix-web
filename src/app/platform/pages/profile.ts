import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Session } from '../core/session';
import { Actions } from '../shared/actions';
import { UI, ICONS, label } from '../shared/ui';
import { ErrorBox } from '../shared/feedback';
@Component({
  selector: 'console-profile',
  imports: [UI, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Учётная запись</p>
        <h1>Профиль</h1>
      </div>
      <button hlmBtn variant="outline" (click)="edit()">
        <ng-icon name="lucidePencil" />Изменить имя
      </button>
    </div>
    <console-error [error]="session.error()" [retryable]="true" (retry)="session.load()" />
    @if (session.profile(); as user) {
      <section class="panel max-w-2xl">
        <h2>{{ user.display_name || 'Имя не указано' }}</h2>
        <dl class="detail-list">
          <dt>Пользователь Xarionix</dt>
          <dd class="font-mono text-xs">{{ user.user_id }}</dd>
          <dt>Статус</dt>
          <dd>{{ status(user.status) }}</dd>
          <dt>Тип доступа</dt>
          <dd>
            {{
              user.principal_type === 'human'
                ? 'Пользователь'
                : user.principal_type === 'unclassified'
                  ? 'Ожидает допуска оператором'
                  : 'Сервисная учётная запись'
            }}
          </dd>
          <dt>Identity Provider</dt>
          <dd class="break-all">{{ user.issuer }}</dd>
          <dt>Subject</dt>
          <dd class="font-mono text-xs break-all">{{ user.subject }}</dd>
        </dl>
        <p class="mt-5 text-xs text-muted-foreground">
          Пароль и MFA настраиваются в вашей организации через Keycloak.
        </p>
      </section>
    }
  `,
})
export class ProfilePage {
  readonly status = label;
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  edit(): void {
    this.actions.open({
      title: 'Имя пользователя',
      description: 'Отображаемое имя в Xarionix Core.',
      fields: [
        {
          key: 'display_name',
          label: 'Имя',
          initial: this.session.profile()?.display_name ?? '',
          required: true,
          max: 160,
        },
      ],
      execute: (v) => this.session.api.patch('/me', v),
      done: () => void this.session.load(),
    });
  }
}
