import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Session } from '../core/session';
import { Clock } from '../core/clock';
import { InstallPlan, uuid } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { LiveData } from '../shared/live-data';
import { ErrorBox } from '../shared/feedback';
import { Actions } from '../shared/actions';
import { Report } from '../shared/report';
@Component({
  selector: 'console-install-plan',
  imports: [UI, ErrorBox, Report],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Module Manager</p>
        <h1>План установки</h1>
        <p class="description">
          Проверьте точный пакет, изменения прав и зависимости перед одобрением.
        </p>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="live.reload()">
        <ng-icon name="lucideRefreshCw" />Обновить состояние
      </button>
    </div>
    <console-error [error]="live.error()" [retryable]="true" (retry)="live.reload()" />
    @if (live.value(); as p) {
      <section class="panel">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2>{{ p.plan.module_id }} · {{ p.plan.target_version }}</h2>
          <span hlmBadge variant="outline">{{ status(p.state) }}</span>
        </div>
        <dl class="detail-list">
          <dt>Операция</dt>
          <dd>{{ actionLabel(p.plan.action) }}</dd>
          <dt>Переход состояния</dt>
          <dd>{{ status(p.plan.current_state) }} → {{ status(p.plan.next_state) }}</dd>
          <dt>Ожидаемое поколение</dt>
          <dd>{{ p.plan.expected_generation }}</dd>
          <dt>Тип модуля</dt>
          <dd>{{ status(p.plan.module_type) }}</dd>
          <dt>SHA-256 пакета</dt>
          <dd class="font-mono text-xs break-all">{{ p.plan.package_sha256 }}</dd>
          <dt>Digest плана</dt>
          <dd class="font-mono text-xs break-all" data-testid="plan-digest">{{ p.digest }}</dd>
          <dt>Истекает</dt>
          <dd>{{ p.expires_at }}</dd>
          <dt>Совместимость</dt>
          <dd>
            {{
              p.plan.core_compatible && p.plan.protocol_supported
                ? 'Подтверждена'
                : 'Не подтверждена'
            }}
          </dd>
        </dl>
      </section>
      @if (expired()) {
        <div class="mt-5 rounded-lg border border-destructive/30 p-4 text-sm">
          Срок плана или его одобрения истёк. Создайте новый снимок и подтвердите его заново.
        </div>
      }
      <div class="mt-5 grid gap-5 lg:grid-cols-2">
        <section class="panel">
          <h2>Изменения прав</h2>
          <div class="mt-4"><console-report [value]="p.plan.permission_diff" /></div>
        </section>
        <section class="panel">
          <h2>Зависимости</h2>
          <div class="mt-4"><console-report [value]="p.plan.dependency_graph" /></div>
        </section>
      </div>
      <section class="panel mt-5">
        <h2>Проверки и ограничения</h2>
        <p class="mt-3 text-sm">
          {{ p.plan.ready ? 'Блокирующих условий нет' : 'Применение заблокировано' }}
        </p>
        <ul class="mt-3 space-y-2 text-sm text-destructive">
          @for (blocker of p.plan.blockers; track blocker) {
            <li>{{ blocker }}</li>
          }
        </ul>
        <ul class="mt-3 space-y-2 text-xs text-muted-foreground">
          @for (warning of p.plan.warnings; track warning) {
            <li>{{ warning }}</li>
          }
        </ul>
        <hlm-collapsible class="mt-4"
          ><button hlmBtn hlmCollapsibleTrigger variant="ghost" size="sm">
            Снимок доверия пакетов</button
          ><hlm-collapsible-content class="mt-3"
            ><console-report [value]="p.plan.authorities" /></hlm-collapsible-content
        ></hlm-collapsible>
      </section>
      @if (p.state === 'approved' && !expired()) {
        <section class="panel mt-5 border-primary/30" data-testid="awaiting-trusted-executor">
          <h2>Ожидает применения доверенным оператором</h2>
          <p class="mt-3 text-sm text-muted-foreground">
            Одобрение сохранено. Console не выполняет installer CLI и не запускает код пакета.
            Передайте оператору идентификатор плана для штатного доверенного executor Core.
          </p>
          <p class="mt-4 break-all rounded-md bg-muted p-3 font-mono text-sm">{{ p.id }}</p>
          <p class="mt-3 text-xs text-muted-foreground">
            Статус обновляется автоматически до 10 минут. После применения появится состояние
            «Применён». Runtime разворачивается отдельным одобренным deployment-планом.
          </p>
        </section>
      }
      @if (p.state === 'applied') {
        <section class="panel mt-5">
          <h2>План применён</h2>
          <a hlmBtn variant="outline" class="mt-4" routerLink="/admin/modules/installations"
            >Открыть установленные модули</a
          >
        </section>
      }
      <footer class="mt-6 flex flex-wrap justify-end gap-3">
        <button hlmBtn variant="outline" (click)="refresh(p)">Создать свежий план</button>
        @if (p.state === 'pending' || p.state === 'approved') {
          <button hlmBtn variant="outline" (click)="cancel(p)">Отменить план</button>
        }
        @if (p.state === 'pending') {
          <button
            hlmBtn
            [disabled]="expired() || !p.plan.ready || !!live.error()"
            (click)="approve(p)"
          >
            Одобрить план
          </button>
        }
      </footer>
    }
  `,
})
export class InstallPlanPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly router = inject(Router);
  private readonly clock = inject(Clock);
  readonly id = uuid(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  readonly live = new LiveData<InstallPlan>();
  readonly status = label;
  readonly expired = computed(() => {
    const p = this.live.value();
    return (
      !p ||
      Date.parse(p.expires_at) <= this.clock.now() ||
      (p.state === 'approved' &&
        !!p.approved_until &&
        Date.parse(p.approved_until) <= this.clock.now())
    );
  });
  constructor() {
    this.live.start(() =>
      this.session.api.get<InstallPlan>(`/platform/module-install-plans/${this.id}`),
    );
  }
  actionLabel(value: string): string {
    return (
      (
        {
          install: 'Установить метаданные',
          enable: 'Включить',
          disable: 'Выключить',
          update: 'Обновить',
          uninstall: 'Удалить метаданные',
          rollback: 'Откатить',
        } as Record<string, string>
      )[value] ?? value
    );
  }
  approve(p: InstallPlan): void {
    if (this.expired() || p.state !== 'pending' || !p.plan.ready) return;
    this.actions.open({
      title: 'Одобрить этот план?',
      description: `${this.actionLabel(p.plan.action)} · ${p.plan.module_id} ${p.plan.target_version}. Подтверждается только показанный digest ${p.digest}. Применение выполняет доверенный executor.`,
      confirm: true,
      submitLabel: 'Одобрить',
      execute: () =>
        this.session.api.post(`/platform/module-install-plans/${p.id}/approve`, {
          digest: p.digest,
        }),
      done: () => this.live.reload(),
    });
  }
  cancel(p: InstallPlan): void {
    this.actions.open({
      title: 'Отменить план?',
      description: 'Ранее одобренный план станет недействителен.',
      confirm: true,
      execute: () =>
        this.session.api.post(`/platform/module-install-plans/${p.id}/cancel`, {
          digest: p.digest,
        }),
      done: () => this.live.reload(),
    });
  }
  refresh(p: InstallPlan): void {
    this.actions.open({
      title: 'Подготовить новый план?',
      description:
        'Будет создан новый снимок с новым digest. Старое одобрение на него не переносится.',
      confirm: true,
      submitLabel: 'Подготовить',
      execute: () =>
        this.session.api.post<InstallPlan>(`/platform/module-install-plans/${p.id}/refresh`),
      done: (result) =>
        void this.router.navigate(['/admin/modules/install-plans', (result as InstallPlan).id]),
    });
  }
}
