import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { forkJoin, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Session } from '../core/session';
import { UI, ICONS, label } from '../shared/ui';
import { ErrorBox } from '../shared/feedback';
import { CoreError, coreError } from '../core/errors';
import type {
  Company,
  DeploymentHost,
  Installation,
  InstallOperation,
  RuntimeDeployment,
} from '../core/models';
@Component({
  selector: 'console-dashboard',
  imports: [UI, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Рабочее пространство</p>
        <h1>Обзор платформы</h1>
        <p class="description">
          {{ session.profile()?.display_name || 'Пользователь' }}, здесь состояние доступных вам
          сервисов.
        </p>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="load()">
        <ng-icon name="lucideRefreshCw" />Обновить
      </button>
    </div>
    <console-error [error]="error()" [retryable]="true" (retry)="load()" />
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      @for (card of cards(); track card.title) {
        <a
          [routerLink]="card.path"
          class="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/40"
          ><p class="text-sm text-muted-foreground">{{ card.title }}</p>
          <p class="mt-4 text-2xl font-semibold tracking-tight">{{ card.value }}</p>
          <p class="mt-2 text-xs text-muted-foreground">{{ card.hint }}</p></a
        >
      }
    </div>
    <div class="mt-6 grid gap-5 lg:grid-cols-2">
      <section class="panel">
        <h2>Система</h2>
        <dl class="detail-list">
          <dt>Core</dt>
          <dd>{{ coreVersion() || 'Не удалось получить версию' }}</dd>
          <dt>Готовность</dt>
          <dd>{{ ready() ? 'Готов' : 'Нет подтверждения готовности' }}</dd>
          <dt>Текущая компания</dt>
          <dd>{{ session.company()?.name || 'Не выбрана' }}</dd>
          <dt>Доступ</dt>
          <dd>{{ session.admin() === 'allowed' ? 'Администратор платформы' : 'Пользователь' }}</dd>
        </dl>
      </section>
      <section class="panel">
        <h2>Начало работы</h2>
        <div class="mt-4 space-y-2">
          <a hlmBtn variant="ghost" class="w-full justify-start" routerLink="/companies"
            ><ng-icon name="lucideBuilding2" />Выбрать компанию</a
          >
          @if (session.admin() === 'allowed') {
            <a hlmBtn variant="ghost" class="w-full justify-start" routerLink="/platform/packages"
              ><ng-icon name="lucidePackage" />Реестр пакетов</a
            ><a hlmBtn variant="ghost" class="w-full justify-start" routerLink="/platform/runtime"
              ><ng-icon name="lucideActivity" />Состояние runtime</a
            >
          }
        </div>
      </section>
    </div>
    @if (recent().length) {
      <section class="panel mt-6">
        <h2>Последние операции</h2>
        <div class="mt-4 divide-y">
          @for (operation of recent(); track operation.id) {
            <a
              [routerLink]="'/platform/install-plans/' + operation.plan_id"
              class="flex items-center justify-between gap-3 py-3 text-sm"
              ><span class="font-mono text-xs">{{ operation.id }}</span
              ><span>{{ status(operation.state) }}</span></a
            >
          }
        </div>
      </section>
    }
  `,
})
export class Dashboard {
  readonly session = inject(Session);
  private readonly destroy = inject(DestroyRef);
  readonly status = label;
  readonly error = signal<CoreError | null>(null);
  readonly ready = signal(false);
  readonly coreVersion = signal('');
  readonly cards = signal<{ title: string; value: string; hint: string; path: string }[]>([]);
  readonly recent = signal<InstallOperation[]>([]);
  constructor() {
    this.load();
  }
  load(): void {
    const api = this.session.api,
      epoch = this.session.scope.epoch();
    this.error.set(null);
    forkJoin({
      health: api.health().pipe(catchError(() => of(null))),
      info: api.get<{ version: string }>('/system/info'),
      companies: api.page<Company>('/me/companies', 0, 1),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: ({ health, info, companies }) => {
          if (epoch !== this.session.scope.epoch()) return;
          this.ready.set(!!health);
          this.coreVersion.set(info.version);
          this.cards.update((cards) => [
            {
              title: 'Ваши компании',
              value: String(companies.total ?? companies.items.length),
              hint: 'Активное участие',
              path: '/companies',
            },
            ...cards.filter((card) => card.path !== '/companies'),
          ]);
        },
        error: (error) => this.error.set(coreError(error)),
      });
    if (this.session.admin() === 'allowed')
      forkJoin({
        installations: api.page<Installation>('/platform/module-installations', 0, 20),
        hosts: api.page<DeploymentHost>('/platform/deployment-hosts', 0, 20),
        runtimes: api.page<RuntimeDeployment>('/platform/runtime-deployments', 0, 20),
        operations: api.page<InstallOperation>('/platform/module-install-operations', 0, 5),
      })
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: (result) => {
            if (epoch !== this.session.scope.epoch()) return;
            this.cards.update((cards) => [
              ...cards.filter((c) => c.path === '/companies'),
              {
                title: 'Установленные модули',
                value: String(result.installations.total ?? result.installations.items.length),
                hint: 'Метаданные установки',
                path: '/platform/installations',
              },
              {
                title: 'Deployment hosts',
                value:
                  String(result.hosts.items.length) + (result.hosts.items.length === 20 ? '+' : ''),
                hint: 'На первой странице, до 20',
                path: '/platform/hosts',
              },
              {
                title: 'Runtime deployments',
                value:
                  String(result.runtimes.items.length) +
                  (result.runtimes.items.length === 20 ? '+' : ''),
                hint: 'На первой странице, до 20',
                path: '/platform/runtime',
              },
            ]);
            this.recent.set(result.operations.items);
          },
          error: (error) => this.error.set(coreError(error)),
        });
  }
}
