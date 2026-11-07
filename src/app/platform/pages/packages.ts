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
import { forkJoin } from 'rxjs';
import { Session } from '../core/session';
import { InstallPlan, Manifest, Package, uuid } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { PackageUpload } from '../shared/package-upload';
import { ErrorBox } from '../shared/feedback';
import { CoreError, coreError } from '../core/errors';
import { Actions } from '../shared/actions';
import { Report } from '../shared/report';
import { toast } from '@spartan-ng/brain/sonner';
@Component({
  selector: 'console-packages',
  imports: [UI, DataTable, PackageUpload],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Модули</p>
        <h1>Реестр пакетов</h1>
        <p class="description">Импорт пакета не устанавливает и не запускает модуль.</p>
      </div>
      <button hlmBtn variant="outline" size="sm" (click)="data.reload()">
        <ng-icon name="lucideRefreshCw" />Обновить
      </button>
    </div>
    <console-package-upload (imported)="data.reload()" />
    <div class="mt-6">
      <console-table
        [rows]="rows()"
        [columns]="['Версия', 'Издатель', 'Доверие', 'Размер']"
        [page]="data.data()"
        [loading]="data.loading()"
        [error]="data.error()"
        (retry)="data.reload()"
        (pageChange)="data.page($event)"
      />
    </div>`,
})
export class PackagesPage {
  readonly session = inject(Session);
  readonly data = new PageData<Package>();
  readonly rows = computed(() =>
    this.data.data().items.map((p) => ({
      id: p.id,
      title: p.module_id,
      subtitle: label(p.state),
      cells: [
        p.version,
        p.publisher_id,
        p.current_trust ? 'Доверенный' : 'Доверие отсутствует',
        (p.size / 1048576).toFixed(2) + ' МиБ',
      ],
      path: `/admin/modules/packages/${p.id}`,
    })),
  );
  constructor() {
    this.data.load((offset) => this.session.api.page<Package>('/platform/packages', offset));
  }
}
@Component({
  selector: 'console-package',
  imports: [UI, ErrorBox, Report],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <a
          hlmBtn
          variant="link"
          class="mb-2 h-auto p-0 text-muted-foreground"
          routerLink="/admin/modules/packages"
          ><ng-icon name="lucideArrowLeft" />Пакеты</a
        >
        <h1>{{ manifest()?.module?.name || package()?.module_id || 'Пакет' }}</h1>
        <p class="description">{{ package()?.version }} · {{ package()?.publisher_id }}</p>
      </div>
      <div class="flex gap-2">
        <button hlmBtn variant="outline" [disabled]="busy()" (click)="verify()">
          Проверить заново</button
        ><button
          hlmBtn
          [disabled]="busy() || !package()?.current_trust || !package()?.core_compatible"
          (click)="prepare()"
        >
          Подготовить установку
        </button>
      </div>
    </div>
    <console-error [error]="error()" [retryable]="true" (retry)="load()" />
    @if (package(); as p) {
      <div class="grid gap-5 lg:grid-cols-2">
        <section class="panel">
          <h2>Подпись и совместимость</h2>
          <dl class="detail-list">
            <dt>Состояние реестра</dt>
            <dd>{{ status(p.state) }}</dd>
            <dt>Текущее доверие</dt>
            <dd [class.text-destructive]="!p.current_trust">
              {{ p.current_trust ? 'Подтверждено' : 'Отсутствует' }}
            </dd>
            <dt>Совместим с Core</dt>
            <dd>{{ p.core_compatible ? 'Да' : 'Нет' }}</dd>
            <dt>Целостность файла</dt>
            <dd>{{ p.blob_integrity === 'verified' ? 'Проверена' : 'Требуется проверка' }}</dd>
            <dt>Импортирован</dt>
            <dd>{{ p.created_at }}</dd>
            <dt>Размер</dt>
            <dd>{{ p.size }} байт</dd>
            <dt>Ключ</dt>
            <dd>{{ p.key_id }}</dd>
            <dt>Отпечаток</dt>
            <dd class="font-mono text-xs break-all">{{ p.key_fingerprint }}</dd>
            <dt>SHA-256 пакета</dt>
            <dd class="font-mono text-xs break-all">{{ p.package_sha256 }}</dd>
            <dt>SHA-256 манифеста</dt>
            <dd class="font-mono text-xs break-all">{{ p.manifest_sha256 }}</dd>
          </dl>
        </section>
        <section class="panel">
          <h2>Манифест</h2>
          @if (manifest(); as m) {
            <p class="mt-3 text-sm text-muted-foreground">{{ m.module.description }}</p>
            <dl class="detail-list">
              <dt>Тип модуля</dt>
              <dd>{{ status(m.module.type) }}</dd>
              <dt>Core</dt>
              <dd>{{ m.compatibility.core }}</dd>
              <dt>Протокол</dt>
              <dd>{{ m.compatibility.module_protocol }}</dd>
              <dt>Пространство прав</dt>
              <dd>{{ m.permissions.namespace }}</dd>
              <dt>Зависимости</dt>
              <dd>{{ m.dependencies.length }}</dd>
              <dt>Артефакты</dt>
              <dd>{{ m.artifacts.length }}</dd>
            </dl>
          }
        </section>
      </div>
    }
    @if (manifest(); as m) {
      <section class="panel mt-5">
        <h2>Запрашиваемые права</h2>
        <div class="mt-4 divide-y">
          @for (permission of m.permissions.definitions; track permission.key) {
            <div class="py-3 text-sm">
              <p>{{ permission.description }}</p>
              <p class="mt-1 font-mono text-xs text-muted-foreground">{{ permission.key }}</p>
            </div>
          } @empty {
            <p class="text-sm text-muted-foreground">Права не объявлены</p>
          }
        </div>
      </section>
      <section class="panel mt-5">
        <h2>Зависимости</h2>
        <div class="mt-4">
          <console-report [value]="package()?.dependency_report ?? m.dependencies" />
        </div>
      </section>
    }
    @if (verification()) {
      <section class="panel mt-5">
        <h2>Результат повторной проверки</h2>
        <p class="mt-2 text-xs text-muted-foreground">
          Отчёт конкретной операции. Текущее доверие к издателю показано отдельно в карточке.
        </p>
        <div class="mt-4"><console-report [value]="verification()" /></div>
      </section>
    }
    <section class="panel mt-5">
      <div class="flex items-center justify-between gap-3">
        <h2>Сравнение версий</h2>
        <button hlmBtn variant="outline" size="sm" (click)="compare()">
          Выбрать предыдущий пакет
        </button>
      </div>
      @if (diff()) {
        <div class="mt-5"><console-report [value]="diff()" /></div>
      }
    </section>
    @if (manifest(); as m) {
      <hlm-collapsible class="mt-5"
        ><button hlmCollapsibleTrigger hlmBtn variant="ghost">Манифест · исходные данные</button
        ><hlm-collapsible-content>
          <pre class="mt-3 max-h-80 overflow-auto rounded-lg border p-4 text-xs">{{
            pretty(m)
          }}</pre>
        </hlm-collapsible-content></hlm-collapsible
      >
    }
  `,
})
export class PackagePage {
  readonly verification = signal<unknown>(null);
  private readonly prepareKey = crypto.randomUUID();
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly id = uuid(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  readonly package = signal<Package | null>(null);
  readonly manifest = signal<Manifest | null>(null);
  readonly diff = signal<unknown>(null);
  readonly error = signal<CoreError | null>(null);
  readonly busy = signal(false);
  readonly status = label;
  constructor() {
    this.load();
  }
  load(): void {
    this.error.set(null);
    forkJoin({
      package: this.session.api.get<Package>(`/platform/packages/${this.id}`),
      manifest: this.session.api.get<Manifest>(`/platform/packages/${this.id}/manifest`),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (value) => {
          this.package.set(value.package);
          this.manifest.set(value.manifest);
        },
        error: (e) => this.error.set(coreError(e)),
      });
  }
  pretty(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
  verify(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.session.api
      .post<unknown>(`/platform/packages/${this.id}/verify`)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (report) => {
          this.verification.set(report);
          this.busy.set(false);
          toast.success('Проверка пакета завершена');
          this.load();
        },
        error: (e) => {
          this.error.set(coreError(e));
          this.busy.set(false);
        },
      });
  }
  prepare(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.session.api
      .post<InstallPlan>('/platform/module-install-plans', {
        action: 'install',
        package_id: this.id,
        expected_generation: 0,
        idempotency_key: this.prepareKey,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (p) => {
          this.busy.set(false);
          void this.router.navigate(['/admin/modules/install-plans', p.id]);
        },
        error: (e) => {
          this.error.set(coreError(e));
          this.busy.set(false);
        },
      });
  }
  compare(): void {
    this.actions.open({
      title: 'Сравнение пакетов',
      description: 'UUID предыдущего пакета того же модуля. Сравнение выполняет Core.',
      fields: [{ key: 'previous_id', label: 'Предыдущий пакет · UUID', required: true }],
      execute: (v) =>
        this.session.api.get(`/platform/packages/${this.id}/diff`, {
          previous_id: String(v['previous_id']),
        }),
      done: (result) => this.diff.set(result),
    });
  }
}
