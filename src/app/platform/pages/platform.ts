import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Session } from '../core/session';
import { AuditEvent, PlatformAdmin, PlatformSettings, PlatformUser } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { Actions } from '../shared/actions';
import { ErrorBox } from '../shared/feedback';
import { CoreError, coreError } from '../core/errors';
import { Report } from '../shared/report';
@Component({
  selector: 'console-platform-users',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Платформа</p>
        <h1>Пользователи</h1>
        <p class="description">
          Внутренние учётные записи Xarionix. Паролями управляет Identity Provider.
        </p>
      </div>
      <button hlmBtn variant="outline" (click)="classify()">Классифицировать identity</button>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Статус', 'Создан']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="edit($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />`,
})
export class PlatformUsersPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly data = new PageData<PlatformUser>();
  readonly rows = computed(() =>
    this.data.data().items.map((u) => ({
      id: u.id,
      title: u.display_name ?? 'Имя не указано',
      subtitle: u.id,
      cells: [label(u.status), new Date(u.created_at).toLocaleDateString('ru-RU')],
    })),
  );
  constructor() {
    this.data.load((offset) => this.session.api.page<PlatformUser>('/platform/users', offset));
  }
  edit(id: string): void {
    const u = this.data.data().items.find((u) => u.id === id);
    if (!u) return;
    this.actions.open({
      title: u.status === 'active' ? 'Приостановить пользователя?' : 'Активировать пользователя?',
      description: `${u.display_name ?? 'Пользователь'} · ${u.id}. Изменение действует на все компании.`,
      confirm: true,
      destructive: u.status === 'active',
      execute: () =>
        this.session.api.patch(`/platform/users/${u.id}`, {
          status: u.status === 'active' ? 'suspended' : 'active',
        }),
      done: () => this.data.reload(),
    });
  }
  classify(): void {
    this.actions.open({
      title: 'Классифицировать identity',
      description:
        'Явный допуск известной внешней идентичности. Укажите identity UUID, а не user UUID.',
      fields: [
        { key: 'id', label: 'Identity UUID', required: true },
        {
          key: 'principal_type',
          label: 'Тип',
          type: 'select',
          initial: 'human',
          options: [
            { value: 'human', label: 'Пользователь' },
            { value: 'service', label: 'Сервис' },
            { value: 'unclassified', label: 'Не классифицирован' },
          ],
        },
      ],
      execute: (v) =>
        this.session.api.patch(`/platform/identities/${v['id']}`, {
          principal_type: v['principal_type'],
        }),
      done: () => this.data.reload(),
    });
  }
}
@Component({
  selector: 'console-platform-admins',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Платформа</p>
        <h1>Администраторы</h1>
        <p class="description">
          Высокопривилегированный доступ. Каждое изменение требует свежего MFA.
        </p>
      </div>
      <button hlmBtn (click)="grant()"><ng-icon name="lucidePlus" />Назначить</button>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Доступ']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="revoke($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />`,
})
export class PlatformAdminsPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly data = new PageData<PlatformAdmin>();
  readonly rows = computed(() =>
    this.data.data().items.map((u) => ({
      id: u.user_id,
      title: u.user_id,
      cells: [u.active ? 'Действует' : 'Отозван'],
    })),
  );
  constructor() {
    this.data.load((offset) => this.session.api.page<PlatformAdmin>('/platform/admins', offset));
  }
  grant(): void {
    this.actions.open({
      title: 'Назначить администратора',
      description:
        'Пользователь получит управление всей платформой, включая политики, пакеты и deployment. Требуется свежий MFA.',
      fields: [
        { key: 'user_id', label: 'Пользователь Core · UUID', required: true },
        {
          key: 'confirmed',
          label: 'Подтверждаю выдачу глобального административного доступа',
          type: 'checkbox',
          required: true,
          initial: false,
        },
      ],
      submitLabel: 'Подтвердить назначение',
      execute: (v) => this.session.api.post('/platform/admins', { user_id: v['user_id'] }),
      done: () => this.data.reload(),
    });
  }
  revoke(id: string): void {
    const admin = this.data.data().items.find((a) => a.user_id === id);
    if (!admin?.active) return;
    this.actions.open({
      title: 'Отозвать административный доступ?',
      description: `Пользователь ${id}. Последний активный администратор защищён сервером.`,
      confirm: true,
      destructive: true,
      execute: () => this.session.api.delete(`/platform/admins/${id}`),
      done: () => this.data.reload(),
    });
  }
}
@Component({
  selector: 'console-platform-settings',
  imports: [UI, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Платформа</p>
        <h1>Настройки</h1>
      </div>
      @if (settings()) {
        <button hlmBtn variant="outline" (click)="edit()">
          <ng-icon name="lucidePencil" />Изменить
        </button>
      }
    </div>
    <console-error [error]="error()" [retryable]="true" (retry)="load()" />
    @if (settings(); as s) {
      <section class="panel max-w-2xl">
        <h2>Политика компаний</h2>
        <dl class="detail-list">
          <dt>Создание компаний</dt>
          <dd>{{ policyLabel(s.company_creation_policy) }}</dd>
          <dt>Лимит владельца</dt>
          <dd>{{ s.max_owned_companies_per_user }}</dd>
          <dt>Приглашения</dt>
          <dd>{{ s.invitations_enabled ? 'Разрешены' : 'Запрещены' }}</dd>
        </dl>
      </section>
    }`,
})
export class PlatformSettingsPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly destroy = inject(DestroyRef);
  readonly settings = signal<PlatformSettings | null>(null);
  readonly error = signal<CoreError | null>(null);
  constructor() {
    this.load();
  }
  policyLabel(value: string): string {
    return (
      ({ closed: 'Закрыто', approval: 'По заявке', open: 'Открыто' } as Record<string, string>)[
        value
      ] ?? value
    );
  }
  load(): void {
    this.error.set(null);
    this.session.api
      .get<PlatformSettings>('/platform/settings')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (s) => this.settings.set(s), error: (e) => this.error.set(coreError(e)) });
  }
  edit(): void {
    const s = this.settings();
    if (!s) return;
    this.actions.open({
      title: 'Политика платформы',
      description: 'Применяется ко всем компаниям.',
      fields: [
        {
          key: 'company_creation_policy',
          label: 'Создание компаний',
          type: 'select',
          initial: s.company_creation_policy,
          options: ['closed', 'approval', 'open'].map((value) => ({
            value,
            label: this.policyLabel(value),
          })),
        },
        {
          key: 'max_owned_companies_per_user',
          label: 'Максимум компаний у владельца',
          type: 'number',
          initial: s.max_owned_companies_per_user,
          min: 1,
          max: 100,
          required: true,
        },
        {
          key: 'invitations_enabled',
          label: 'Разрешить приглашения',
          type: 'checkbox',
          initial: s.invitations_enabled,
        },
      ],
      execute: (v) =>
        this.session.api.patch('/platform/settings', {
          ...v,
          max_owned_companies_per_user: Number(v['max_owned_companies_per_user']),
        }),
      done: () => this.load(),
    });
  }
}
@Component({
  selector: 'console-audit',
  imports: [UI, DataTable, Report],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Платформа</p>
        <h1>Аудит</h1>
        <p class="description">
          События Core в порядке от новых к старым. Данные доступны только администраторам.
        </p>
      </div>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Ресурс', 'Время']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="select($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />
    @if (selected(); as event) {
      <section class="panel mt-6">
        <div class="flex justify-between gap-3">
          <h2>{{ event.action }}</h2>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            aria-label="Закрыть событие"
            (click)="selected.set(null)"
          >
            <ng-icon name="lucideX" />
          </button>
        </div>
        <dl class="detail-list">
          <dt>Ресурс</dt>
          <dd>{{ event.resource_type }} · {{ event.resource_id }}</dd>
          <dt>Пользователь</dt>
          <dd>{{ event.actor_user_id || '—' }}</dd>
          <dt>Запрос</dt>
          <dd>{{ event.request_id || '—' }}</dd>
        </dl>
        <div class="mt-5"><console-report [value]="event.details" /></div>
      </section>
    }`,
})
export class AuditPage {
  readonly session = inject(Session);
  readonly data = new PageData<AuditEvent>();
  readonly selected = signal<AuditEvent | null>(null);
  readonly rows = computed(() =>
    this.data.data().items.map((e) => ({
      id: e.id,
      title: e.action,
      subtitle: e.request_id ?? '',
      cells: [e.resource_type, new Date(e.created_at).toLocaleString('ru-RU')],
    })),
  );
  constructor() {
    this.data.load((offset) => this.session.api.page<AuditEvent>('/platform/audit', offset));
  }
  select(id: string): void {
    this.selected.set(this.data.data().items.find((e) => e.id === id) ?? null);
  }
}
