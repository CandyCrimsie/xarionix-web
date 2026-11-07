import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, forkJoin } from 'rxjs';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { Session } from '../core/session';
import { Clock } from '../core/clock';
import {
  DeploymentAction,
  DeploymentHost,
  DeploymentJob,
  DeploymentPlan,
  Installation,
  Page,
  RuntimeDeployment,
  runtimeFresh,
  runtimeObservation,
  uuid,
} from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { LiveData } from '../shared/live-data';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { ErrorBox } from '../shared/feedback';
import { Actions, FormField } from '../shared/actions';
import { ModuleStoragePanel } from '../shared/module-storage-panel';
import { Report } from '../shared/report';
const operations: Record<DeploymentAction, string> = {
  provision: 'Развернуть',
  start: 'Запустить',
  stop: 'Остановить',
  restart: 'Перезапустить',
  upgrade: 'Обновить runtime',
  rollback: 'Откатить runtime',
  deprovision: 'Удалить runtime',
  inspect: 'Проверить состояние',
  reconcile: 'Сверить состояние',
  quarantine: 'Карантин',
  retire: 'Вывести из эксплуатации',
  backup: 'Создать резервную копию',
  restore: 'Восстановить данные',
};
export function runtimeActions(
  runtime: RuntimeDeployment | null,
  installation: Installation,
): DeploymentAction[] {
  if (installation.runtime['mode'] !== 'oci_v1') return [];
  if (!runtime) return installation.status !== 'removed' ? ['provision', 'start'] : [];
  if (['retired', 'quarantined'].includes(runtime.desired))
    return ['inspect', 'stop', 'deprovision'];
  const result: DeploymentAction[] = ['inspect', 'reconcile'];
  if (runtime.desired === 'absent') return ['provision', 'inspect'];
  if (runtime.observed === 'stopped' || runtime.observed === 'not_provisioned')
    result.push('start', 'deprovision');
  else result.push('stop', 'restart');
  if (runtime.package_id !== installation.package_id) result.push('upgrade', 'rollback');
  return result;
}
@Component({
  selector: 'console-runtimes',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Deployment</p>
        <h1>Исполнение модулей</h1>
        <p class="description">
          Желаемое и наблюдаемое состояния. Устаревшие данные не подтверждают здоровье runtime.
        </p>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="load()">Обновить</button>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Желаемое', 'Наблюдаемое', 'Здоровье', 'Поколение']"
      [page]="page()"
      [loading]="!live.value() && !live.error()"
      [error]="live.error()"
      (retry)="load()"
      (pageChange)="offset.set($event); load()"
    />`,
})
export class RuntimesPage {
  readonly session = inject(Session);
  readonly clock = inject(Clock);
  readonly live = new LiveData<Page<RuntimeDeployment>>();
  readonly offset = signal(0);
  readonly page = computed(
    () => this.live.value() ?? { items: [], limit: 20, offset: this.offset() },
  );
  readonly rows = computed(() =>
    this.page().items.map((r) => ({
      id: r.installation_id,
      title: r.installation_id,
      subtitle: r.host_id,
      cells: [
        label(r.desired),
        label(r.observed),
        runtimeFresh(r, this.clock.now()) ? label(r.health) : 'Нет свежего подтверждения',
        `${r.observed_generation} / ${r.generation}`,
      ],
      path: `/admin/modules/runtime/${r.installation_id}`,
      query: { runtimeOffset: this.offset() },
    })),
  );
  constructor() {
    this.load();
  }
  load(): void {
    const offset = this.offset();
    this.live.start(() =>
      this.session.api.page<RuntimeDeployment>('/platform/runtime-deployments', offset),
    );
  }
}
interface RuntimeDetail {
  installation: Installation;
  jobs: Page<DeploymentJob>;
  deployments: Page<RuntimeDeployment>;
}
@Component({
  selector: 'console-runtime',
  imports: [UI, DataTable, ErrorBox, Report, HlmTabsImports, ModuleStoragePanel],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <a
          hlmBtn
          variant="link"
          class="mb-2 h-auto p-0 text-muted-foreground"
          routerLink="/admin/modules/runtime"
          ><ng-icon name="lucideArrowLeft" />Runtime</a
        >
        <h1>{{ live.value()?.installation?.module_id || 'Runtime модуля' }}</h1>
        <p class="description">{{ live.value()?.installation?.version }}</p>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="live.reload()">
        <ng-icon name="lucideRefreshCw" />Обновить
      </button>
    </div>
    <console-error [error]="live.error()" [retryable]="true" (retry)="live.reload()" />
    @if (live.value(); as detail) {
      <hlm-tabs tab="overview"
        ><hlm-tabs-list class="mb-5 w-full justify-start overflow-x-auto"
          ><button hlmTabsTrigger="overview">Обзор</button
          ><button hlmTabsTrigger="configuration">Конфигурация</button
          ><button hlmTabsTrigger="health">Здоровье</button
          ><button hlmTabsTrigger="jobs">Задания</button
          ><button hlmTabsTrigger="security">Безопасность</button>
          @if (runtime()?.profile === 'module-api-stateful-v1') {
            <button hlmTabsTrigger="data">Данные</button>
          }
        </hlm-tabs-list>
        <div hlmTabsContent="overview">
          <section class="panel">
            <h2>Состояние runtime</h2>
            <dl class="detail-list">
              <dt>Установка метаданных</dt>
              <dd>{{ status(detail.installation.status) }}</dd>
              <dt>Режим</dt>
              <dd>{{ detail.installation.runtime['mode'] }}</dd>
              <dt>Состояние Core</dt>
              <dd>
                {{ status(runtimeObservation(detail.installation.runtime, clock.now())['state']) }}
              </dd>
              <dt>Последний heartbeat</dt>
              <dd>{{ detail.installation.runtime['last_heartbeat'] || 'Нет данных' }}</dd>
            </dl>
            @if (runtime(); as r) {
              <dl class="detail-list border-t pt-5">
                <dt>Желаемое</dt>
                <dd>{{ status(r.desired) }}</dd>
                <dt>Наблюдаемое</dt>
                <dd>{{ status(r.observed) }}</dd>
                <dt>Generation</dt>
                <dd>{{ r.observed_generation }} / {{ r.generation }}</dd>
                <dt>Host</dt>
                <dd class="font-mono text-xs">{{ r.host_id }}</dd>
                <dt>Профиль</dt>
                <dd>{{ r.profile }}</dd>
                <dt>Container ID</dt>
                <dd class="font-mono text-xs break-all">{{ r.container_id || 'Не создан' }}</dd>
                <dt>Image digest</dt>
                <dd class="font-mono text-xs break-all">{{ r.image_digest }}</dd>
              </dl>
            } @else if (detail.installation.runtime['state'] !== 'not_provisioned') {
              <div class="mt-5 rounded-lg border p-4 text-sm">
                <p>
                  Подробное наблюдение отсутствует на этой странице реестра. Откройте модуль из
                  списка runtime или выберите страницу наблюдений.
                </p>
                <div class="mt-3 flex gap-2">
                  <button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    [disabled]="runtimeOffset() === 0"
                    (click)="runtimeOffset.set(runtimeOffset() - 20); load()"
                  >
                    Назад</button
                  ><button
                    hlmBtn
                    variant="outline"
                    size="sm"
                    [disabled]="detail.deployments.items.length < 20"
                    (click)="runtimeOffset.set(runtimeOffset() + 20); load()"
                  >
                    Далее
                  </button>
                </div>
              </div>
            }
            <p class="mt-4 text-xs text-muted-foreground">
              Состояние рассчитывает Core с учётом host, trust и generation. При потере связи
              здоровье не гарантируется.
            </p>
            <div class="mt-5 flex flex-wrap gap-2">
              @for (action of available(); track action) {
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  (click)="prepare(detail.installation, action)"
                >
                  {{ operationLabel(action) }}
                </button>
              }
            </div>
          </section>
        </div>
        <div hlmTabsContent="data">
          @if (runtime(); as r) {
            @if (r.profile === 'module-api-stateful-v1') {
              <app-module-storage
                [installationId]="id"
                [runtime]="r"
                (prepare)="prepare(detail.installation, $event.action, $event.backupId)"
              />
            }
          }
        </div>
        <div hlmTabsContent="configuration">
          <section class="panel">
            <h2>Подтверждённые параметры</h2>
            <div class="mt-5"><console-report [value]="detail.installation.runtime" /></div>
            <a
              hlmBtn
              variant="outline"
              class="mt-5"
              [routerLink]="'/admin/modules/installations/' + id"
              >Установка и история метаданных</a
            >
          </section>
        </div>
        <div hlmTabsContent="health">
          <section class="panel">
            <h2>Здоровье и наблюдения</h2>
            @if (runtime(); as r) {
              <dl class="detail-list">
                <dt>Здоровье</dt>
                <dd>{{ fresh() ? status(r.health) : 'Нет свежего подтверждения' }}</dd>
                <dt>Последняя связь</dt>
                <dd>{{ r.last_seen || 'Нет данных' }}</dd>
                <dt>Последняя готовность</dt>
                <dd>{{ r.last_ready || 'Нет данных' }}</dd>
                <dt>Последний live</dt>
                <dd>{{ r.last_live || 'Нет данных' }}</dd>
                <dt>Перезапуски</dt>
                <dd>{{ r.restart_count }}</dd>
                <dt>Безопасный код ошибки</dt>
                <dd>{{ r.safe_error_code || '—' }}</dd>
                <dt>Наблюдаемый image digest</dt>
                <dd class="font-mono text-xs break-all">
                  {{ r.observed_image_digest || 'Нет данных' }}
                </dd>
              </dl>
            }
            <p class="mt-5 text-xs text-muted-foreground">
              Heartbeat не является подтверждением успешного последнего задания. Проверьте его
              результат и поколение.
            </p>
          </section>
        </div>
        <div hlmTabsContent="jobs">
          <section class="panel">
            <h2>История deployment jobs</h2>
            <console-table
              [rows]="jobRows()"
              [columns]="['Операция', 'Статус', 'Поколение', 'Попытки']"
              [page]="detail.jobs"
              [error]="live.error()"
              (pageChange)="jobOffset.set($event); load()"
              (selected)="selectJob($event)"
              (retry)="live.reload()"
            />
            @if (selectedJob(); as job) {
              <div class="mt-5 rounded-lg border p-4">
                <p class="text-sm font-medium">Результат задания</p>
                <div class="mt-3">
                  <console-report [value]="job.result ?? { state: job.state }" />
                </div>
              </div>
            }
          </section>
        </div>
        <div hlmTabsContent="security">
          <section class="panel">
            <h2>Безопасность</h2>
            <p class="mt-3 text-sm text-muted-foreground">
              Операции выполняет отдельный deployment principal. Секреты, Docker socket и команды
              shell недоступны браузеру. Карантин и вывод из эксплуатации доступны из карточки
              установки.
            </p>
            <a
              hlmBtn
              variant="outline"
              class="mt-5"
              [routerLink]="'/admin/modules/installations/' + id"
              >Открыть безопасность установки</a
            >
          </section>
        </div>
      </hlm-tabs>
    }
  `,
})
export class RuntimePage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly id = uuid(this.route.snapshot.paramMap.get('id') ?? '');
  readonly runtimeOffset = signal(
    Math.max(0, Number(this.route.snapshot.queryParamMap.get('runtimeOffset')) || 0),
  );
  readonly live = new LiveData<RuntimeDetail>();
  readonly hosts = new PageData<DeploymentHost>();
  readonly jobOffset = signal(0);
  readonly selectedJob = signal<DeploymentJob | null>(null);
  readonly status = label;
  readonly clock = inject(Clock);
  readonly runtimeObservation = runtimeObservation;
  readonly fresh = computed(() => {
    const runtime = this.runtime();
    return !!runtime && runtimeFresh(runtime, this.clock.now());
  });
  readonly jobRows = computed(
    () =>
      this.live.value()?.jobs.items.map((j) => ({
        id: j.id,
        title: j.id,
        cells: [operations[j.operation], label(j.state), String(j.generation), String(j.attempts)],
      })) ?? [],
  );
  readonly runtime = computed(
    () => this.live.value()?.deployments.items.find((r) => r.installation_id === this.id) ?? null,
  );
  readonly available = computed(() => {
    const i = this.live.value()?.installation;
    if (!i) return [];
    if (!this.runtime() && i.runtime['state'] !== 'not_provisioned') return [];
    return runtimeActions(this.runtime(), i);
  });
  constructor() {
    this.load();
    this.hosts.load((offset) =>
      this.session.api.page<DeploymentHost>('/platform/deployment-hosts', offset),
    );
  }
  load(): void {
    const offset = this.jobOffset();
    this.live.start(() =>
      forkJoin({
        installation: this.session.api.get<Installation>(
          `/platform/module-installations/${this.id}`,
        ),
        jobs: this.session.api.page<DeploymentJob>(
          `/platform/runtime-deployments/${this.id}/jobs`,
          offset,
        ),
        deployments: this.session.api.page<RuntimeDeployment>(
          '/platform/runtime-deployments',
          this.runtimeOffset(),
        ),
      }),
    );
  }
  operationLabel(action: DeploymentAction): string {
    return operations[action];
  }
  selectJob(id: string): void {
    this.selectedJob.set(this.live.value()?.jobs.items.find((j) => j.id === id) ?? null);
  }
  prepare(i: Installation, operation: DeploymentAction, backupId?: string): void {
    const idempotencyKey = crypto.randomUUID();
    const existingHost = i.runtime['deployment_host_id'];
    const generation = Number(i.runtime['binding_revision'] ?? 0);
    const choices = this.hosts
      .data()
      .items.filter((h) => h.status === 'active')
      .map((h) => ({ value: h.id, label: h.name }));
    const stateful = this.runtime()?.profile === 'module-api-stateful-v1';
    const storageFields: FormField[] = stateful
      ? [
          {
            key: 'backup_id',
            label: 'Резервная копия (UUID)',
            required: operation === 'restore',
            initial: backupId ?? '',
            max: 36,
            help: 'Для восстановления или миграции используйте проверенную копию из вкладки «Данные».',
          },
          ...(['start', 'restart', 'upgrade', 'rollback', 'reconcile'].includes(operation)
            ? [
                {
                  key: 'allow_migration',
                  type: 'checkbox' as const,
                  label: 'Подтверждаю миграцию схемы с указанной резервной копией',
                  initial: false,
                },
              ]
            : []),
        ]
      : [];
    this.actions.open({
      title: 'Подготовить deployment-план',
      submitLabel: 'Подготовить',
      description: `${operations[operation]} · ${i.module_id}. Одобрение отдельным шагом. Существующий host фиксируется при safety-операциях; Core проверяет ограничения.`,
      fields: [
        {
          key: 'host_id',
          label: 'Deployment host',
          type: choices.length ? 'select' : 'text',
          required: true,
          initial: typeof existingHost === 'string' ? existingHost : (choices[0]?.value ?? ''),
          options: choices,
          help: choices.length
            ? 'Показана первая страница host. При необходимости откройте список host.'
            : 'Укажите UUID зарегистрированного host.',
        },
        {
          key: 'profile',
          label: 'Профиль изоляции',
          type: 'select',
          initial: this.runtime()?.profile ?? 'offline-small-v1',
          options: [
            { value: 'offline-small-v1', label: 'Small · 256 МиБ / 0.5 CPU' },
            { value: 'offline-medium-v1', label: 'Medium · 512 МиБ / 1 CPU' },
            { value: 'module-api-private-v1', label: 'API · 256 МиБ · без сети' },
            { value: 'module-api-stateful-v1', label: 'API + SQLite · 64 МиБ данных' },
          ],
        },
        ...storageFields,
      ],
      execute: (v) =>
        this.session.api.post<DeploymentPlan>('/platform/deployment-plans', {
          idempotency_key: idempotencyKey,
          installation_id: i.id,
          host_id: v['host_id'],
          operation,
          expected_installation_generation: i.generation,
          expected_deployment_generation: generation,
          profile: v['profile'],
          ...(typeof v['backup_id'] === 'string' && v['backup_id']
            ? { backup_id: uuid(v['backup_id']) }
            : {}),
          ...(v['allow_migration'] === true ? { allow_migration: true } : {}),
        }),
      done: (result) =>
        void this.router.navigate([
          '/admin/modules/deployment-plans',
          (result as DeploymentPlan).id,
        ]),
    });
  }
}
@Component({
  selector: 'console-deployment-plan',
  imports: [UI, ErrorBox, Report],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Deployment</p>
        <h1>План развёртывания</h1>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="live.reload()">Обновить</button>
    </div>
    <console-error [error]="live.error()" [retryable]="true" (retry)="live.reload()" />
    @if (live.value(); as p) {
      <section class="panel">
        <div class="flex items-center justify-between">
          <h2>{{ operationLabel(p.body.operation) }}</h2>
          <span hlmBadge variant="outline">{{ status(p.state) }}</span>
        </div>
        <dl class="detail-list">
          <dt>Installation</dt>
          <dd>{{ p.body.installation_id }}</dd>
          <dt>Host</dt>
          <dd>{{ p.body.host_id }}</dd>
          <dt>Ревизия host</dt>
          <dd>{{ p.body.host_revision }}</dd>
          <dt>Generation установки</dt>
          <dd>{{ p.body.installation_generation }}</dd>
          <dt>Generation runtime</dt>
          <dd>{{ p.body.expected_deployment_generation }}</dd>
          <dt>Engine</dt>
          <dd class="font-mono text-xs break-all">{{ p.body.engine_id }}</dd>
          <dt>Профиль</dt>
          <dd>{{ p.body.profile }}</dd>
          <dt>SHA-256 пакета</dt>
          <dd class="font-mono text-xs break-all">{{ p.body.package_sha256 }}</dd>
          <dt>Digest плана</dt>
          <dd class="font-mono text-xs break-all">{{ p.digest }}</dd>
          <dt>Истекает</dt>
          <dd>{{ p.expires_at }}</dd>
        </dl>
      </section>
      <div class="mt-5 grid gap-5 lg:grid-cols-2">
        <section class="panel">
          <h2>Ресурсные ограничения</h2>
          <div class="mt-5"><console-report [value]="p.body.resource_policy" /></div>
        </section>
        <section class="panel">
          <h2>Контракт runtime</h2>
          <div class="mt-5"><console-report [value]="p.body.runtime" /></div>
        </section>
      </div>
      @if (p.body.storage; as storage) {
        <section class="panel mt-5" data-testid="deployment-storage-review">
          <h2>Постоянные данные</h2>
          <dl class="detail-list">
            <dt>Хранилище</dt>
            <dd>SQLite · {{ storage.maximum_bytes / 1048576 }} МиБ</dd>
            <dt>Схема данных</dt>
            <dd>{{ storage.expected_schema_version }} → {{ storage.target_schema_version }}</dd>
            <dt>Поддерживаемые схемы</dt>
            <dd>{{ storage.compatible_minimum }}–{{ storage.compatible_maximum }}</dd>
            <dt>Ревизия данных</dt>
            <dd>{{ storage.allocation_revision }}</dd>
            <dt>Текущая эпоха</dt>
            <dd class="font-mono text-xs break-all">{{ storage.epoch_id }}</dd>
            @if (storage.next_epoch_id !== storage.epoch_id) {
              <dt>Новая эпоха</dt>
              <dd class="font-mono text-xs break-all">{{ storage.next_epoch_id }}</dd>
            }
            <dt>Миграция схемы</dt>
            <dd>{{ storage.allow_migration ? 'Явно разрешена этим планом' : 'Не разрешена' }}</dd>
            @if (storage.backup_id) {
              <dt>Резервная копия</dt>
              <dd class="font-mono text-xs break-all">{{ storage.backup_id }}</dd>
            }
            @if (storage.backup_sha256) {
              <dt>SHA-256 копии</dt>
              <dd class="font-mono text-xs break-all">{{ storage.backup_sha256 }}</dd>
            }
          </dl>
          @if (p.body.operation === 'restore') {
            <p class="mt-4 text-sm text-destructive">
              Данные будут восстановлены на момент выбранной копии в новую эпоху. Прежняя эпоха
              сохранится; writer должен быть остановлен.
            </p>
          }
          @if (storage.expected_schema_version === 0) {
            <p class="mt-4 text-sm text-muted-foreground">
              Будет инициализирована новая база. Данные прежнего runtime в памяти автоматически не
              переносятся.
            </p>
          }
        </section>
      }
      @if (queued(); as job) {
        <section class="panel mt-5" role="status">
          <h2>Задание поставлено в очередь</h2>
          <p class="mt-3 text-sm text-muted-foreground">
            Одобрение ещё не означает успешное выполнение. Deployment agent должен получить и
            завершить задание.
          </p>
          <p class="mt-3 font-mono text-xs">{{ job }}</p>
          <a
            hlmBtn
            variant="outline"
            class="mt-4"
            [routerLink]="'/admin/modules/runtime/' + p.body.installation_id"
            >Отслеживать выполнение</a
          >
        </section>
      }
      @if (expired()) {
        <p class="mt-5 text-sm text-destructive">
          План истёк. Подготовьте новый из карточки runtime и подтвердите заново.
        </p>
      }
      <footer class="mt-6 flex justify-end gap-3">
        <a
          hlmBtn
          variant="outline"
          [routerLink]="'/admin/modules/runtime/' + p.body.installation_id"
          >К runtime</a
        >
        @if (p.state === 'pending') {
          <button hlmBtn variant="outline" (click)="cancel(p)">Отменить план</button
          ><button hlmBtn [disabled]="expired() || !!live.error()" (click)="approve(p)">
            Одобрить и поставить в очередь
          </button>
        }
      </footer>
    }
  `,
})
export class DeploymentPlanPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly id = uuid(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  private readonly clock = inject(Clock);
  readonly live = new LiveData<DeploymentPlan>();
  readonly queued = signal<string | null>(null);
  readonly status = label;
  readonly expired = computed(
    () => !this.live.value() || Date.parse(this.live.value()!.expires_at) <= this.clock.now(),
  );
  constructor() {
    this.live.start(() =>
      this.session.api.get<DeploymentPlan>(`/platform/deployment-plans/${this.id}`),
    );
  }
  operationLabel(action: DeploymentAction): string {
    return operations[action];
  }
  approve(p: DeploymentPlan): void {
    if (this.expired()) return;
    this.actions.open({
      title: 'Одобрить deployment-план?',
      description: `${operations[p.body.operation]} · host ${p.body.host_id}. Только digest ${p.digest}. ${p.body.operation === 'restore' ? 'Данные вернутся к выбранной копии; прежняя эпоха сохранится. ' : ''}Задание выполнит deployment agent.`,
      confirm: true,
      destructive: ['deprovision', 'retire', 'quarantine', 'restore'].includes(p.body.operation),
      submitLabel: 'Одобрить',
      execute: () =>
        this.session.api.post(`/platform/deployment-plans/${p.id}/approve`, { digest: p.digest }),
      done: (result) => {
        this.queued.set((result as { job_id: string }).job_id);
        this.live.reload();
      },
    });
  }
  cancel(p: DeploymentPlan): void {
    this.actions.open({
      title: 'Отменить deployment-план?',
      description: 'План перестанет допускать создание задания.',
      confirm: true,
      execute: () =>
        this.session.api.post(`/platform/deployment-plans/${p.id}/cancel`, { digest: p.digest }),
      done: () => this.live.reload(),
    });
  }
}
