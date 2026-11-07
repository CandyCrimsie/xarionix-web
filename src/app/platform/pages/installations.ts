import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Session } from '../core/session';
import { Clock } from '../core/clock';
import {
  Installation,
  InstallationHistory,
  InstallOperation,
  InstallPlan,
  runtimeObservation,
  uuid,
} from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { ErrorBox } from '../shared/feedback';
import { Actions } from '../shared/actions';
import { LiveData } from '../shared/live-data';
import { Report } from '../shared/report';
@Component({
  selector: 'console-installations',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Модули</p>
        <h1>Установленные модули</h1>
        <p class="description">
          Состояние установки метаданных и доступность runtime учитываются отдельно.
        </p>
      </div>
      <a hlmBtn variant="outline" routerLink="/admin/modules/packages">Реестр пакетов</a>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Версия', 'Тип', 'Установка', 'Runtime', 'Поколение']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />`,
})
export class InstallationsPage {
  readonly session = inject(Session);
  readonly clock = inject(Clock);
  readonly data = new PageData<Installation>();
  readonly rows = computed(() =>
    this.data.data().items.map((i) => ({
      id: i.id,
      title: i.module_id,
      subtitle: i.current_trust ? 'Доверие подтверждено' : 'Доверие отсутствует',
      cells: [
        i.version,
        label(i.module_type),
        label(i.status),
        label(runtimeObservation(i.runtime, this.clock.now())['state']),
        String(i.generation),
      ],
      path: `/admin/modules/installations/${i.id}`,
    })),
  );
  constructor() {
    this.data.load((offset) =>
      this.session.api.page<Installation>('/platform/module-installations', offset),
    );
  }
}
@Component({
  selector: 'console-installation',
  imports: [UI, ErrorBox, Report, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <a
          hlmBtn
          variant="link"
          class="mb-2 h-auto p-0 text-muted-foreground"
          routerLink="/admin/modules/installations"
          ><ng-icon name="lucideArrowLeft" />Модули</a
        >
        <h1>{{ live.value()?.module_id || 'Модуль' }}</h1>
        <p class="description">
          {{ live.value()?.version }} · поколение {{ live.value()?.generation }}
        </p>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="live.reload()">
        <ng-icon name="lucideRefreshCw" />Обновить
      </button>
    </div>
    <console-error [error]="live.error()" [retryable]="true" (retry)="live.reload()" />
    @if (live.value(); as i) {
      <div class="grid gap-5 lg:grid-cols-2">
        <section class="panel">
          <h2>Установка</h2>
          <dl class="detail-list">
            <dt>Статус метаданных</dt>
            <dd>{{ status(i.status) }}</dd>
            <dt>Тип</dt>
            <dd>{{ status(i.module_type) }}</dd>
            <dt>Доверие</dt>
            <dd>{{ i.current_trust ? 'Подтверждено' : 'Отсутствует' }}</dd>
            <dt>Пространство прав</dt>
            <dd>{{ i.namespace }}</dd>
            <dt>Пакет</dt>
            <dd>
              <a
                class="underline underline-offset-4"
                [routerLink]="'/admin/modules/packages/' + i.package_id"
                >Открыть пакет</a
              >
            </dd>
            <dt>SHA-256</dt>
            <dd class="break-all font-mono text-xs">{{ i.package_sha256 }}</dd>
          </dl>
          <div class="mt-5 flex flex-wrap gap-2">
            @for (action of metadataActions(i); track action.value) {
              <button hlmBtn variant="outline" size="sm" (click)="prepare(i, action.value)">
                {{ action.label }}
              </button>
            }
          </div>
        </section>
        <section class="panel">
          <div class="flex justify-between">
            <h2>Runtime</h2>
            <a hlmBtn variant="outline" size="sm" [routerLink]="'/admin/modules/runtime/' + i.id"
              >Управление</a
            >
          </div>
          <div class="mt-5">
            <console-report [value]="runtimeObservation(i.runtime, clock.now())" />
          </div>
          @if (i.module_type === 'autonomous' && i.runtime['mode'] === 'external_agent') {
            <button hlmBtn variant="outline" size="sm" class="mt-5" (click)="bind(i)">
              Привязать существующий экземпляр
            </button>
          }
        </section>
      </div>
      <section class="panel mt-5">
        <h2>История метаданных</h2>
        <console-table
          [rows]="historyRows()"
          [columns]="['Состояние', 'Поколение', 'Время']"
          [page]="history.data()"
          [loading]="history.loading()"
          [error]="history.error()"
          (retry)="history.reload()"
          (pageChange)="history.page($event)"
        />
      </section>
      <section class="panel mt-5">
        <h2>Безопасность</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          Карантин и вывод из эксплуатации блокируют обычные операции. Вывод из эксплуатации —
          терминальное действие; бизнес-данные не удаляются. Остановка на недоступном host может
          выполняться с задержкой.
        </p>
        <div class="mt-4 flex gap-2">
          <button hlmBtn variant="outline" (click)="retire(i, 'quarantined')">Карантин</button
          ><button hlmBtn variant="outline" class="text-destructive" (click)="retire(i, 'retired')">
            Вывести из эксплуатации
          </button>
        </div>
      </section>
    }
  `,
})
export class InstallationPage {
  readonly clock = inject(Clock);
  readonly runtimeObservation = runtimeObservation;
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly router = inject(Router);
  readonly id = uuid(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  readonly live = new LiveData<Installation>();
  readonly history = new PageData<InstallationHistory>();
  readonly status = label;
  readonly historyRows = computed(() =>
    this.history.data().items.map((h) => ({
      id: h.id,
      title: h.operation_id,
      cells: [label(h.state), String(h.generation), new Date(h.created_at).toLocaleString('ru-RU')],
    })),
  );
  constructor() {
    this.live.start(() =>
      this.session.api.get<Installation>(`/platform/module-installations/${this.id}`),
    );
    this.history.load((offset) =>
      this.session.api.page<InstallationHistory>(
        `/platform/module-installations/${this.id}/history`,
        offset,
      ),
    );
  }
  metadataActions(i: Installation): { value: string; label: string }[] {
    if (i.status === 'removed') return [{ value: 'install', label: 'Установить заново' }];
    return [
      {
        value: i.status === 'installed_enabled' ? 'disable' : 'enable',
        label: i.status === 'installed_enabled' ? 'Выключить' : 'Включить',
      },
      { value: 'update', label: 'Обновить' },
      ...(i.status === 'installed_disabled'
        ? [{ value: 'uninstall', label: 'Удалить метаданные' }]
        : []),
      ...(i.previous_package_id ? [{ value: 'rollback', label: 'Откатить' }] : []),
    ];
  }
  prepare(i: Installation, action: string): void {
    const update = action === 'update';
    const idempotencyKey = crypto.randomUUID();
    this.actions.open({
      title: 'Подготовить план',
      description: `${i.module_id} · текущее поколение ${i.generation}. Подготовка ничего не применяет.`,
      fields: update
        ? [{ key: 'package_id', label: 'Новый пакет из реестра · UUID', required: true }]
        : [],
      submitLabel: 'Подготовить',
      execute: (v) =>
        this.session.api.post<InstallPlan>('/platform/module-install-plans', {
          action,
          package_id: update
            ? v['package_id']
            : action === 'rollback'
              ? i.previous_package_id
              : i.package_id,
          expected_generation: i.generation,
          idempotency_key: idempotencyKey,
        }),
      done: (result) =>
        void this.router.navigate(['/admin/modules/install-plans', (result as InstallPlan).id]),
    });
  }
  bind(i: Installation): void {
    this.actions.open({
      title: 'Привязать экземпляр',
      description:
        'Только уже зарегистрированный доверенным оператором экземпляр автономного модуля. Machine identity и секреты здесь не создаются.',
      fields: [{ key: 'instance_id', label: 'Экземпляр · UUID', required: true }],
      execute: (v) =>
        this.session.api.post(`/platform/module-installations/${i.id}/bind-instance`, {
          instance_id: v['instance_id'],
          package_sha256: i.package_sha256,
          expected_generation: i.generation,
          expected_revision: Number(i.runtime['binding_revision'] ?? 0),
        }),
      done: () => this.live.reload(),
    });
  }
  retire(i: Installation, state: 'quarantined' | 'retired'): void {
    this.actions.open({
      title: state === 'retired' ? 'Окончательно вывести модуль?' : 'Поместить модуль в карантин?',
      description:
        state === 'retired'
          ? 'Терминальное действие. Не восстанавливает отозванное доверие. Бизнес-данные сохраняются.'
          : 'Обычные операции будут заблокированы. Core и deployment agent контролируют безопасное завершение.',
      confirm: true,
      destructive: true,
      execute: () =>
        this.session.api.post(`/platform/module-installations/${i.id}/retire`, {
          state,
          expected_installation_generation: i.generation,
        }),
      done: () => this.live.reload(),
    });
  }
}
@Component({
  selector: 'console-operations',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Модули</p>
        <h1>Операции установки</h1>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="data.reload()">Обновить</button>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Состояние', 'Попытки', 'Безопасная ошибка']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />`,
})
export class OperationsPage {
  readonly session = inject(Session);
  readonly data = new PageData<InstallOperation>();
  readonly rows = computed(() =>
    this.data.data().items.map((o) => ({
      id: o.id,
      title: o.id,
      subtitle: o.correlation_id,
      cells: [label(o.state), String(o.attempts), o.safe_error_code ?? '—'],
      path: `/admin/modules/install-plans/${o.plan_id}`,
    })),
  );
  constructor() {
    this.data.load((offset) =>
      this.session.api.page<InstallOperation>('/platform/module-install-operations', offset),
    );
  }
}
