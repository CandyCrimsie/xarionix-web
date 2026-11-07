import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Session } from '../core/session';
import { ModuleStorageView, RuntimeDeployment, UUID } from '../core/models';
import { LiveData } from './live-data';
import { DataTable } from './data-table';
import { ErrorBox } from './feedback';
import { UI, ICONS } from './ui';

@Component({
  selector: 'app-module-storage',
  imports: [UI, DataTable, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="panel">
    <div class="flex items-center justify-between gap-3">
      <h2>Данные модуля</h2>
      <button hlmBtn size="sm" variant="outline" (click)="live.reload()">Обновить</button>
    </div>
    <console-error
      class="mt-4 block"
      [error]="live.error()"
      [retryable]="true"
      (retry)="live.reload()"
    />
    @if (live.value(); as data) {
      @if (data.allocation; as allocation) {
        <dl class="detail-list">
          <dt>Хранилище</dt>
          <dd>SQLite · {{ allocation.maximum_bytes / 1048576 }} МиБ</dd>
          <dt>Версия схемы</dt>
          <dd>{{ allocation.data_schema_version }}</dd>
          <dt>Ревизия</dt>
          <dd>{{ allocation.revision }}</dd>
          <dt>Сохранённые эпохи</dt>
          <dd>{{ allocation.retained_epoch_count }}</dd>
        </dl>
        <p class="mt-4 text-xs text-muted-foreground">
          Остановка, удаление runtime и uninstall сохраняют бизнес-данные. Необратимое удаление
          здесь недоступно.
        </p>
        <div class="mt-5">
          <button
            hlmBtn
            variant="outline"
            size="sm"
            [disabled]="!stopped() || allocation.data_schema_version === 0"
            (click)="prepare.emit({ action: 'backup' })"
          >
            <ng-icon name="lucideDownload" />Подготовить резервную копию
          </button>
        </div>
        @if (!stopped()) {
          <p class="mt-3 text-xs text-muted-foreground">
            Для backup и restore сначала остановите runtime.
          </p>
        }
      } @else {
        <p class="description">
          Постоянное хранилище ещё не зарезервировано утверждённым deployment-планом.
        </p>
      }
      <h3 class="mt-7 mb-3 text-sm font-medium">Резервные копии</h3>
      <console-table
        [rows]="rows()"
        [columns]="['Версия пакета', 'Схема', 'Размер']"
        [page]="data"
        [loading]="false"
        [error]="null"
        (selected)="restore($event)"
        (pageChange)="offset.set($event)"
      />
    }
  </section>`,
})
export class ModuleStoragePanel {
  readonly installationId = input.required<UUID>();
  readonly runtime = input.required<RuntimeDeployment>();
  readonly prepare = output<{ action: 'backup' | 'restore'; backupId?: UUID }>();
  readonly session = inject(Session);
  readonly live = new LiveData<ModuleStorageView>();
  readonly offset = signal(0);
  readonly stopped = computed(
    () =>
      ['stopped', 'not_provisioned'].includes(this.runtime().observed) &&
      ['stopped', 'absent', 'provisioned'].includes(this.runtime().desired),
  );
  readonly rows = computed(
    () =>
      this.live.value()?.items.map((backup) => ({
        id: backup.id,
        title: new Date(backup.created_at).toLocaleString('ru-RU'),
        subtitle: backup.id,
        cells: [
          backup.package_version,
          String(backup.data_schema_version),
          `${Math.ceil(backup.size / 1024)} КиБ`,
        ],
      })) ?? [],
  );
  constructor() {
    effect(() => {
      const id = this.installationId(),
        offset = this.offset();
      this.live.start(() =>
        this.session.api.get<ModuleStorageView>(`/platform/runtime-deployments/${id}/storage`, {
          offset,
          limit: 20,
        }),
      );
    });
  }
  restore(id: string): void {
    const backup = this.live.value()?.items.find((item) => item.id === id);
    if (backup && this.stopped()) this.prepare.emit({ action: 'restore', backupId: backup.id });
  }
}
