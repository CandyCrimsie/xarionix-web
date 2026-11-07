import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { toast } from '@spartan-ng/brain/sonner';
import { Session } from '../core/session';
import { Role } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { Actions } from '../shared/actions';
import { PermissionPicker } from '../shared/permission-picker';
import { ErrorBox } from '../shared/feedback';
import { coreError, CoreError } from '../core/errors';
@Component({
  selector: 'console-roles',
  imports: [UI, DataTable, HlmDialogImports, PermissionPicker, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ session.company()?.name }}</p>
        <h1>Роли и права</h1>
      </div>
      @if (session.can('core.roles.create')) {
        <button hlmBtn (click)="create()"><ng-icon name="lucidePlus" />Создать роль</button>
      }
    </div>
    <console-error [error]="error()" />
    <console-table
      [rows]="rows()"
      [columns]="['Код', 'Статус', 'Версия']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="select($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />
    @if (selected(); as role) {
      <section class="panel mt-6">
        <div class="flex items-center justify-between">
          <h2>{{ role.name }}</h2>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            aria-label="Закрыть роль"
            (click)="selected.set(null)"
          >
            <ng-icon name="lucideX" />
          </button>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">{{ role.description }}</p>
        <p class="mt-2 font-mono text-xs text-muted-foreground">{{ role.id }}</p>
        <div class="mt-5 flex gap-2">
          <button hlmBtn variant="outline" size="sm" (click)="openPermissions(role)">
            Права роли
          </button>
          @if (session.can('core.roles.manage') && !role.is_system) {
            <button hlmBtn variant="outline" size="sm" (click)="edit(role)">Изменить</button
            ><button
              hlmBtn
              variant="outline"
              size="sm"
              class="text-destructive"
              (click)="remove(role)"
            >
              Удалить
            </button>
          }
        </div>
      </section>
    }
    @if (editingPermissions(); as role) {
      <hlm-dialog
        state="open"
        [disableClose]="saving()"
        (stateChanged)="$event === 'closed' && editingPermissions.set(null)"
        ><hlm-dialog-content *hlmDialogPortal class="sm:max-w-xl"
          ><hlm-dialog-header
            ><h2 hlmDialogTitle>Права · {{ role.name }}</h2>
            <p hlmDialogDescription>
              Сохранение проверяет версию роли и границы делегирования.
            </p></hlm-dialog-header
          ><console-permission-picker
            [(selected)]="keys"
            [disabled]="saving() || !session.can('core.roles.manage') || role.is_system"
          /><console-error [error]="permissionError()" /><hlm-dialog-footer
            ><button
              hlmBtn
              variant="outline"
              [disabled]="saving()"
              (click)="editingPermissions.set(null)"
            >
              Отмена
            </button>
            @if (session.can('core.roles.manage') && !role.is_system) {
              <button hlmBtn [disabled]="saving()" (click)="savePermissions()">
                {{ saving() ? 'Сохранение…' : 'Сохранить' }}
              </button>
            }
          </hlm-dialog-footer></hlm-dialog-content
        ></hlm-dialog
      >
    }
  `,
})
export class RolesPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly destroy = inject(DestroyRef);
  readonly data = new PageData<Role>();
  readonly selected = signal<Role | null>(null);
  readonly editingPermissions = signal<Role | null>(null);
  readonly keys = signal<string[]>([]);
  readonly saving = signal(false);
  readonly error = signal<CoreError | null>(null);
  readonly permissionError = signal<CoreError | null>(null);
  readonly rows = computed(() =>
    this.data.data().items.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: r.is_system ? 'Системная роль' : 'Роль компании',
      cells: [r.code, label(r.active), String(r.version)],
    })),
  );
  private base(): string {
    return `/companies/${this.session.company()!.id}/roles`;
  }
  constructor() {
    this.data.load((offset) => this.session.api.page<Role>(this.base(), offset));
  }
  select(id: string): void {
    this.selected.set(this.data.data().items.find((r) => r.id === id) ?? null);
  }
  create(): void {
    this.actions.open({
      title: 'Создать роль',
      description: 'Права можно выбрать после создания роли.',
      fields: [
        { key: 'name', label: 'Название', required: true, max: 160 },
        {
          key: 'code',
          label: 'Код роли',
          required: true,
          pattern: '[a-z][a-z0-9_-]{1,62}',
          max: 63,
        },
        { key: 'description', label: 'Описание', type: 'textarea', max: 1000 },
      ],
      execute: (v) =>
        this.session.api.post(this.base(), {
          ...v,
          description: v['description'] || null,
          permissions: [],
        }),
      done: () => this.data.reload(),
    });
  }
  edit(role: Role): void {
    this.actions.open({
      title: 'Изменить роль',
      description: `Версия ${role.version}`,
      fields: [
        { key: 'name', label: 'Название', required: true, max: 160, initial: role.name },
        {
          key: 'description',
          label: 'Описание',
          type: 'textarea',
          max: 1000,
          initial: role.description ?? '',
        },
        { key: 'active', label: 'Роль активна', type: 'checkbox', initial: role.active },
      ],
      execute: (v) =>
        this.session.api.patch(`${this.base()}/${role.id}`, {
          ...v,
          description: v['description'] || null,
          expected_version: role.version,
        }),
      done: () => {
        this.selected.set(null);
        this.data.reload();
      },
    });
  }
  remove(role: Role): void {
    this.actions.open({
      title: 'Удалить роль?',
      description: 'Назначения этой роли также будут отозваны. Системные роли защищены.',
      confirm: true,
      destructive: true,
      execute: () => this.session.api.delete(`${this.base()}/${role.id}`),
      done: () => {
        this.selected.set(null);
        this.data.reload();
      },
    });
  }
  openPermissions(role: Role): void {
    this.error.set(null);
    this.session.api
      .get<{ permissions: string[]; version: number }>(`${this.base()}/${role.id}/permissions`)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (value) => {
          this.keys.set(value.permissions);
          this.permissionError.set(null);
          this.editingPermissions.set({ ...role, version: value.version });
        },
        error: (e) => this.error.set(coreError(e)),
      });
  }
  savePermissions(): void {
    const role = this.editingPermissions();
    if (!role || this.saving()) return;
    this.saving.set(true);
    this.permissionError.set(null);
    this.session.api
      .put<Role>(`${this.base()}/${role.id}/permissions`, {
        permissions: this.keys(),
        expected_version: role.version,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (updated) => {
          this.editingPermissions.set(null);
          this.selected.set(updated);
          this.saving.set(false);
          this.data.reload();
          toast.success('Права роли сохранены');
        },
        error: (e) => {
          this.permissionError.set(coreError(e));
          this.saving.set(false);
        },
      });
  }
}
