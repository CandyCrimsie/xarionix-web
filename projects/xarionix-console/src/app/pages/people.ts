import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Session } from '../core/session';
import { Employee, Invitation, Member, Role } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { DataTable } from '../shared/data-table';
import { Actions, FormField } from '../shared/actions';
import { PageData } from '../shared/page-data';
import { ErrorBox } from '../shared/feedback';
import { CoreError, coreError } from '../core/errors';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { PermissionPicker } from '../shared/permission-picker';
import { toast } from '@spartan-ng/brain/sonner';
const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
@Component({
  selector: 'console-members',
  imports: [UI, DataTable, ErrorBox, HlmDialogImports, PermissionPicker],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ session.company()?.name }}</p>
        <h1>Участники</h1>
      </div>
      <a
        hlmBtn
        variant="outline"
        [routerLink]="'/companies/' + session.company()?.id + '/invitations'"
        >Приглашения</a
      >
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Базовая роль', 'Статус']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="select($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />
    @if (selected(); as member) {
      <section class="panel mt-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2>
            Участник <span class="font-mono text-xs">{{ member.user_id }}</span>
          </h2>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            aria-label="Закрыть участника"
            (click)="selected.set(null)"
          >
            <ng-icon name="lucideX" />
          </button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          @if (session.can('core.members.manage')) {
            <button hlmBtn variant="outline" size="sm" (click)="edit(member)">
              Базовая роль и статус</button
            ><button
              hlmBtn
              variant="outline"
              size="sm"
              class="text-destructive"
              (click)="remove(member)"
            >
              Отключить участие
            </button>
          }
          @if (session.can('core.roles.assign') && session.can('core.members.roles.assign')) {
            <button hlmBtn variant="outline" size="sm" (click)="assign(member)">
              Назначить роль
            </button>
          }
          @if (session.can('core.permissions.delegate')) {
            <button hlmBtn variant="outline" size="sm" (click)="delegation(member)">
              Делегирование
            </button>
          }
        </div>
        <h3 class="mt-6 text-sm font-medium">Назначенные роли</h3>
        <console-table
          [rows]="roleRows()"
          [columns]="['Статус']"
          [page]="roles.data()"
          [loading]="roles.loading()"
          [error]="roles.error()"
          (selected)="revokeRole($event)"
          (retry)="roles.reload()"
          (pageChange)="roles.page($event)"
        />
      </section>
    }
    @if (delegating()) {
      <hlm-dialog
        state="open"
        [disableClose]="saving()"
        (stateChanged)="$event === 'closed' && delegating.set(false)"
        ><hlm-dialog-content *hlmDialogPortal class="sm:max-w-xl"
          ><hlm-dialog-header
            ><h2 hlmDialogTitle>Делегирование прав</h2>
            <p hlmDialogDescription>
              Права, которые участник сможет передавать другим. Допустимость проверяет Core.
            </p></hlm-dialog-header
          ><console-permission-picker
            [(selected)]="permissions"
            [disabled]="saving()"
          /><console-error [error]="error()" /><hlm-dialog-footer
            ><button hlmBtn variant="outline" [disabled]="saving()" (click)="delegating.set(false)">
              Отмена</button
            ><button hlmBtn [disabled]="saving()" (click)="saveDelegation()">
              {{ saving() ? 'Сохранение…' : 'Сохранить' }}
            </button></hlm-dialog-footer
          ></hlm-dialog-content
        ></hlm-dialog
      >
    }
  `,
})
export class MembersPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly destroy = inject(DestroyRef);
  readonly data = new PageData<Member>();
  readonly roles = new PageData<Role>();
  readonly selected = signal<Member | null>(null);
  readonly delegating = signal(false);
  readonly permissions = signal<string[]>([]);
  readonly saving = signal(false);
  readonly error = signal<CoreError | null>(null);
  readonly rows = computed(() =>
    this.data.data().items.map((m) => ({
      id: m.id,
      title: m.user_id,
      subtitle: m.id,
      cells: [label(m.role), label(m.status)],
    })),
  );
  readonly roleRows = computed(() =>
    this.roles
      .data()
      .items.map((r) => ({ id: r.id, title: r.name, subtitle: r.code, cells: [label(r.active)] })),
  );
  private base(): string {
    return `/companies/${this.session.company()!.id}/members`;
  }
  constructor() {
    this.data.load((offset) => this.session.api.page<Member>(this.base(), offset));
    effect(() => {
      this.session.scope.epoch();
      this.selected.set(null);
      this.delegating.set(false);
    });
  }
  select(id: string): void {
    const member = this.data.data().items.find((m) => m.id === id);
    if (!member) return;
    this.selected.set(member);
    this.roles.load((offset) =>
      this.session.api.page<Role>(`${this.base()}/${member.id}/roles`, offset),
    );
  }
  edit(member: Member): void {
    this.actions.open({
      title: 'Изменить участника',
      description: 'Последнего владельца защищают серверные ограничения.',
      fields: [
        {
          key: 'role',
          label: 'Базовая роль',
          type: 'select',
          initial: member.role,
          options: ['owner', 'admin', 'member'].map((value) => ({ value, label: label(value) })),
        },
        {
          key: 'status',
          label: 'Статус',
          type: 'select',
          initial: member.status,
          options: ['active', 'suspended', 'removed'].map((value) => ({
            value,
            label: label(value),
          })),
        },
      ],
      execute: (v) => this.session.api.patch(`${this.base()}/${member.id}`, v),
      done: () => {
        this.selected.set(null);
        this.data.reload();
        void this.session.revalidate();
      },
    });
  }
  remove(member: Member): void {
    this.actions.open({
      title: 'Отключить участника?',
      description: 'Доступ к компании будет отозван. Данные сотрудника сохранятся.',
      confirm: true,
      destructive: true,
      execute: () => this.session.api.delete(`${this.base()}/${member.id}`),
      done: () => {
        this.selected.set(null);
        this.data.reload();
        void this.session.revalidate();
      },
    });
  }
  assign(member: Member): void {
    this.actions.open({
      title: 'Назначить роль',
      description: 'Выберите существующую активную роль компании.',
      fields: [
        { key: 'role_id', label: 'Роль компании', type: 'role', required: true, initial: [] },
      ],
      execute: (v) =>
        this.session.api.post(`${this.base()}/${member.id}/roles`, {
          role_id: Array.isArray(v['role_id']) ? v['role_id'][0] : v['role_id'],
        }),
      done: () => {
        this.roles.reload();
        void this.session.revalidate();
      },
    });
  }
  revokeRole(id: string): void {
    const member = this.selected();
    if (
      !member ||
      !this.session.can('core.roles.revoke') ||
      !this.session.can('core.members.roles.assign')
    )
      return;
    const role = this.roles.data().items.find((r) => r.id === id);
    if (!role) return;
    this.actions.open({
      title: 'Снять роль?',
      description: role.name,
      confirm: true,
      destructive: true,
      execute: () => this.session.api.delete(`${this.base()}/${member.id}/roles/${role.id}`),
      done: () => this.roles.reload(),
    });
  }
  delegation(member: Member): void {
    this.error.set(null);
    this.session.api
      .get<{ permissions: string[] }>(`${this.base()}/${member.id}/delegation`)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (value) => {
          this.permissions.set(value.permissions);
          this.delegating.set(true);
        },
        error: (e) => this.error.set(coreError(e)),
      });
  }
  saveDelegation(): void {
    const member = this.selected();
    if (!member || this.saving()) return;
    this.saving.set(true);
    this.session.api
      .put(`${this.base()}/${member.id}/delegation`, { permissions: this.permissions() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.delegating.set(false);
          toast.success('Настройки делегирования сохранены');
        },
        error: (e) => {
          this.error.set(coreError(e));
          this.saving.set(false);
        },
      });
  }
}
@Component({
  selector: 'console-employees',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">{{ session.company()?.name }}</p>
        <h1>Сотрудники</h1>
      </div>
      @if (session.can('core.employees.manage')) {
        <button hlmBtn (click)="edit()"><ng-icon name="lucidePlus" />Добавить сотрудника</button>
      }
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Должность', 'Подразделение', 'Статус']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="select($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />
    @if (detail(); as employee) {
      <section class="panel mt-6">
        <div class="flex items-center justify-between">
          <h2>{{ employee.display_name }}</h2>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            aria-label="Закрыть карточку сотрудника"
            (click)="detail.set(null)"
          >
            <ng-icon name="lucideX" />
          </button>
        </div>
        <dl class="detail-list">
          <dt>Должность</dt>
          <dd>{{ employee.position || '—' }}</dd>
          <dt>Подразделение</dt>
          <dd>{{ employee.department || '—' }}</dd>
          <dt>Пользователь Core</dt>
          <dd class="font-mono text-xs">{{ employee.user_id || 'Не связан' }}</dd>
          <dt>Статус</dt>
          <dd>{{ status(employee.status) }}</dd>
        </dl>
      </section>
    }`,
})
export class EmployeesPage {
  readonly detail = signal<Employee | null>(null);
  readonly status = label;
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly data = new PageData<Employee>();
  readonly rows = computed(() =>
    this.data.data().items.map((e) => ({
      id: e.id,
      title: e.display_name,
      subtitle: e.user_id ?? 'Без учётной записи',
      cells: [e.position ?? '—', e.department ?? '—', label(e.status)],
    })),
  );
  private base(): string {
    return `/companies/${this.session.company()!.id}/employees`;
  }
  constructor() {
    this.data.load((offset) => this.session.api.page<Employee>(this.base(), offset));
  }
  select(id: string): void {
    const employee = this.data.data().items.find((e) => e.id === id);
    if (employee) {
      if (this.session.can('core.employees.manage')) this.edit(employee);
      else this.detail.set(employee);
    }
  }
  edit(employee?: Employee): void {
    if (!this.session.can('core.employees.manage')) return;
    const fields: FormField[] = [
      {
        key: 'display_name',
        label: 'Имя',
        required: true,
        max: 160,
        initial: employee?.display_name ?? '',
      },
      { key: 'position', label: 'Должность', max: 160, initial: employee?.position ?? '' },
      { key: 'department', label: 'Подразделение', max: 160, initial: employee?.department ?? '' },
      {
        key: 'user_id',
        label: 'Пользователь Core · UUID',
        initial: employee?.user_id ?? '',
        help: 'Необязательно. Не связывается автоматически по email.',
      },
      {
        key: 'status',
        label: 'Статус',
        type: 'select',
        initial: employee?.status ?? 'active',
        options: ['active', 'inactive'].map((value) => ({ value, label: label(value) })),
      },
    ];
    this.actions.open({
      title: employee ? 'Сотрудник' : 'Новый сотрудник',
      description: 'Карточка сотрудника компании.',
      fields,
      execute: (v) => {
        const body = {
          ...v,
          position: v['position'] || null,
          department: v['department'] || null,
          user_id: v['user_id'] || null,
        };
        return employee
          ? this.session.api.patch(`${this.base()}/${employee.id}`, body)
          : this.session.api.post(this.base(), body);
      },
      done: () => this.data.reload(),
    });
  }
}
@Component({
  selector: 'console-invitations',
  imports: [UI, DataTable, HlmDialogImports],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ session.company()?.name }}</p>
        <h1>Приглашения</h1>
      </div>
      <button hlmBtn (click)="create()"><ng-icon name="lucidePlus" />Пригласить</button>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Роль', 'Статус', 'Срок действия']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="revoke($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />
    @if (secret()) {
      <hlm-dialog state="open" (stateChanged)="$event === 'closed' && secret.set('')"
        ><hlm-dialog-content *hlmDialogPortal
          ><hlm-dialog-header
            ><h2 hlmDialogTitle>Приглашение создано</h2>
            <p hlmDialogDescription>
              Секрет показывается один раз. Передайте его получателю защищённым способом.
            </p></hlm-dialog-header
          ><input
            hlmInput
            readonly
            aria-label="Одноразовый секрет приглашения"
            [value]="secret()"
          /><hlm-dialog-footer
            ><button hlmBtn (click)="secret.set('')">Готово</button></hlm-dialog-footer
          ></hlm-dialog-content
        ></hlm-dialog
      >
    }
  `,
})
export class InvitationsPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly data = new PageData<Invitation>();
  readonly secret = signal('');
  readonly rows = computed(() =>
    this.data.data().items.map((i) => ({
      id: i.id,
      title: i.recipient_email ?? i.recipient_user_id ?? 'Приглашение',
      subtitle: i.id,
      cells: [label(i.role), label(i.status), new Date(i.expires_at).toLocaleString('ru-RU')],
    })),
  );
  private base(): string {
    return `/companies/${this.session.company()!.id}/invitations`;
  }
  constructor() {
    this.data.load((offset) => this.session.api.page<Invitation>(this.base(), offset));
    effect(() => {
      this.session.scope.epoch();
      this.secret.set('');
    });
    inject(DestroyRef).onDestroy(() => this.secret.set(''));
  }
  create(): void {
    this.actions.open({
      title: 'Новое приглашение',
      description: 'Секрет будет показан один раз после создания.',
      fields: [
        {
          key: 'recipient_email',
          label: 'Email получателя',
          type: 'email',
          required: true,
          max: 254,
        },
        {
          key: 'role',
          label: 'Базовая роль',
          type: 'select',
          initial: 'member',
          options: [
            { value: 'member', label: 'Участник' },
            { value: 'admin', label: 'Администратор' },
          ],
        },
        {
          key: 'expires_in_hours',
          label: 'Срок действия · часы',
          type: 'number',
          initial: 72,
          min: 1,
          max: 168,
          required: true,
        },
        ...(this.session.can('core.roles.read')
          ? [{ key: 'role_ids', label: 'Дополнительные роли', type: 'roles' as const, initial: [] }]
          : []),
      ],
      execute: (v) =>
        this.session.api.post(this.base(), {
          ...v,
          expires_in_hours: Number(v['expires_in_hours']),
        }),
      done: (result) => {
        const issued = result as { secret: string };
        this.secret.set(issued.secret);
        this.data.reload();
      },
    });
  }
  revoke(id: string): void {
    const i = this.data.data().items.find((i) => i.id === id);
    if (!i || i.status !== 'pending') return;
    this.actions.open({
      title: 'Отозвать приглашение?',
      description: i.recipient_email ?? i.id,
      confirm: true,
      destructive: true,
      execute: () => this.session.api.delete(`${this.base()}/${i.id}`),
      done: () => this.data.reload(),
    });
  }
}
