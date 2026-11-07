import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Session } from '../core/session';
import { NamespaceGrant, Publisher, SigningKey, uuid } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { Actions } from '../shared/actions';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { ErrorBox } from '../shared/feedback';
import { coreError, CoreError } from '../core/errors';
@Component({
  selector: 'console-publishers',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Доверие</p>
        <h1>Издатели пакетов</h1>
        <p class="description">Публичные ключи и права на пространства имён.</p>
      </div>
      <button hlmBtn (click)="create()"><ng-icon name="lucidePlus" />Добавить издателя</button>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Идентификатор', 'Доверие']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />`,
})
export class PublishersPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly data = new PageData<Publisher>();
  readonly rows = computed(() =>
    this.data.data().items.map((p) => ({
      id: p.id,
      title: p.display_name,
      cells: [p.publisher_id, label(p.status)],
      path: `/admin/publishers/${p.id}`,
    })),
  );
  constructor() {
    this.data.load((offset) =>
      this.session.api.page<Publisher>('/platform/package-publishers', offset),
    );
  }
  create(): void {
    this.actions.open({
      title: 'Доверенный издатель',
      description:
        'Добавление издателя не включает доверие к произвольным пакетам. Зарегистрируйте ключ и пространство имён отдельно.',
      fields: [
        {
          key: 'publisher_id',
          label: 'Идентификатор',
          required: true,
          pattern: '[a-z][a-z0-9-]{1,62}',
          max: 63,
        },
        { key: 'display_name', label: 'Название', required: true, max: 160 },
      ],
      execute: (v) => this.session.api.post('/platform/package-publishers', v),
      done: () => this.data.reload(),
    });
  }
}
@Component({
  selector: 'console-publisher',
  imports: [UI, DataTable, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <a
          hlmBtn
          variant="link"
          class="mb-2 h-auto p-0 text-muted-foreground"
          routerLink="/admin/publishers"
          ><ng-icon name="lucideArrowLeft" />Издатели</a
        >
        <h1>{{ publisher()?.display_name || 'Издатель' }}</h1>
        <p class="description">
          {{ publisher()?.publisher_id }} · {{ status(publisher()?.status) }}
        </p>
      </div>
      @if (publisher()?.status === 'active') {
        <button hlmBtn variant="outline" class="text-destructive" (click)="revoke()">
          Отозвать доверие
        </button>
      }
    </div>
    <console-error [error]="error()" [retryable]="true" (retry)="load()" />
    <section class="panel">
      <div class="mb-5 flex items-center justify-between gap-3">
        <h2>Публичные ключи Ed25519</h2>
        @if (publisher()?.status === 'active') {
          <button hlmBtn variant="outline" size="sm" (click)="addKey()">
            <ng-icon name="lucidePlus" />Ключ
          </button>
        }
      </div>
      <console-table
        [rows]="keyRows()"
        [columns]="['Алгоритм', 'Доверие']"
        [page]="keys.data()"
        [loading]="keys.loading()"
        [error]="keys.error()"
        (selected)="keyDetail($event)"
        (retry)="keys.reload()"
        (pageChange)="keys.page($event)"
      />
      @if (selectedKey(); as key) {
        <div class="mt-5 rounded-lg border p-4">
          <p class="text-sm font-medium">{{ key.key_id }}</p>
          <p class="mt-2 text-xs text-muted-foreground">Отпечаток</p>
          <p class="mt-1 break-all font-mono text-xs">{{ key.fingerprint }}</p>
          <p class="mt-3 text-xs text-muted-foreground">Публичный ключ</p>
          <p class="mt-1 break-all font-mono text-xs">{{ key.public_key }}</p>
          @if (key.status === 'active') {
            <button
              hlmBtn
              variant="outline"
              size="sm"
              class="mt-4 text-destructive"
              (click)="revokeKey(key)"
            >
              Отозвать ключ
            </button>
          }
        </div>
      }
    </section>
    <section class="panel mt-5">
      <div class="flex items-center justify-between">
        <h2>Пространства имён</h2>
        @if (publisher()?.status === 'active') {
          <button hlmBtn variant="outline" size="sm" (click)="editNamespaces()">Изменить</button>
        }
      </div>
      <ul class="mt-4 divide-y">
        @for (grant of grants(); track grant.namespace) {
          <li class="flex justify-between py-3 text-sm">
            <span class="font-mono">{{ grant.namespace }}</span
            ><span class="text-muted-foreground">{{ status(grant.status) }}</span>
          </li>
        } @empty {
          <li class="py-4 text-sm text-muted-foreground">Нет выданных пространств имён</li>
        }
      </ul>
    </section>
  `,
})
export class PublisherPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly destroy = inject(DestroyRef);
  readonly id = uuid(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  readonly publisher = signal<Publisher | null>(null);
  readonly grants = signal<NamespaceGrant[]>([]);
  readonly keys = new PageData<SigningKey>();
  readonly selectedKey = signal<SigningKey | null>(null);
  readonly error = signal<CoreError | null>(null);
  readonly status = label;
  readonly keyRows = computed(() =>
    this.keys.data().items.map((k) => ({
      id: k.id,
      title: k.key_id,
      subtitle: k.fingerprint,
      cells: [k.algorithm, label(k.status)],
    })),
  );
  private base(): string {
    return `/platform/package-publishers/${this.id}`;
  }
  constructor() {
    this.load();
    this.keys.load((offset) => this.session.api.page<SigningKey>(`${this.base()}/keys`, offset));
  }
  load(): void {
    this.error.set(null);
    this.session.api
      .get<Publisher>(this.base())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => this.publisher.set(p),
        error: (e) => this.error.set(coreError(e)),
      });
    this.session.api
      .get<NamespaceGrant[]>(`${this.base()}/namespaces`)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (g) => this.grants.set(g), error: (e) => this.error.set(coreError(e)) });
  }
  revoke(): void {
    this.actions.open({
      title: 'Отозвать доверие к издателю?',
      description:
        'Его пакеты перестанут проходить новые проверки доверия. Это действие не удаляет данные модулей.',
      confirm: true,
      destructive: true,
      execute: () => this.session.api.post(`${this.base()}/revoke`),
      done: () => this.load(),
    });
  }
  addKey(): void {
    this.actions.open({
      title: 'Добавить публичный ключ',
      description: 'Только Ed25519, Base64 (32 байта). Никогда не вводите приватный ключ.',
      fields: [
        {
          key: 'key_id',
          label: 'Идентификатор ключа',
          required: true,
          pattern: '[a-z][a-z0-9-]{1,62}',
          max: 63,
        },
        {
          key: 'public_key',
          label: 'Публичный ключ · Base64',
          required: true,
          min: 44,
          max: 44,
          pattern: '[A-Za-z0-9+/]{43}=',
        },
      ],
      execute: (v) => this.session.api.post(`${this.base()}/keys`, v),
      done: () => this.keys.reload(),
    });
  }
  keyDetail(id: string): void {
    this.selectedKey.set(this.keys.data().items.find((k) => k.id === id) ?? null);
  }
  revokeKey(key: SigningKey): void {
    this.actions.open({
      title: 'Отозвать ключ?',
      description: `${key.key_id} · ${key.fingerprint}. Восстановление этого ключа не предусмотрено.`,
      confirm: true,
      destructive: true,
      execute: () => this.session.api.post(`${this.base()}/keys/${key.id}/revoke`),
      done: () => {
        this.selectedKey.set(null);
        this.keys.reload();
      },
    });
  }
  editNamespaces(): void {
    this.actions.open({
      title: 'Пространства имён',
      description:
        'По одному имени на строку. Исключённые пространства будут отозваны; повторная выдача отозванного имени запрещена Core.',
      fields: [
        {
          key: 'namespaces',
          label: 'Разрешённые пространства',
          type: 'textarea',
          initial: this.grants()
            .filter((g) => g.status === 'active')
            .map((g) => g.namespace)
            .join('\n'),
          max: 2600,
        },
      ],
      execute: (v) =>
        this.session.api.put(`${this.base()}/namespaces`, {
          namespaces: String(v['namespaces']).split(/\s+/).filter(Boolean),
        }),
      done: () => this.load(),
    });
  }
}
