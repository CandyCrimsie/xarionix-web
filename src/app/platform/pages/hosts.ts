import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Session } from '../core/session';
import { Config } from '../core/config';
import { DeploymentHost } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { Actions } from '../shared/actions';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
@Component({
  selector: 'console-hosts',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Deployment</p>
        <h1>Deployment hosts</h1>
        <p class="description">Доверенные Linux-хосты изолированного runtime.</p>
      </div>
      <button hlmBtn (click)="register()">
        <ng-icon name="lucidePlus" />Зарегистрировать host
      </button>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Платформа', 'Состояние', 'Ревизия', 'Последняя связь']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="select($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />
    @if (selected(); as host) {
      <section class="panel mt-6">
        <div class="flex items-center justify-between">
          <h2>{{ host.name }}</h2>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            aria-label="Закрыть host"
            (click)="selected.set(null)"
          >
            <ng-icon name="lucideX" />
          </button>
        </div>
        <dl class="detail-list">
          <dt>Host UUID</dt>
          <dd class="font-mono text-xs">{{ host.id }}</dd>
          <dt>Engine ID</dt>
          <dd class="break-all font-mono text-xs">{{ host.engine_id }}</dd>
          <dt>Ответственный</dt>
          <dd class="font-mono text-xs">{{ host.owner_user_id }}</dd>
          <dt>Платформа</dt>
          <dd>{{ host.platform }}</dd>
          <dt>Ревизия</dt>
          <dd>{{ host.revision }}</dd>
        </dl>
        @if (host.status !== 'revoked') {
          <div class="mt-5 flex gap-2">
            <button
              hlmBtn
              variant="outline"
              (click)="status(host, host.status === 'active' ? 'disable' : 'enable')"
            >
              {{ host.status === 'active' ? 'Отключить' : 'Включить' }}</button
            ><button
              hlmBtn
              variant="outline"
              class="text-destructive"
              (click)="status(host, 'revoke')"
            >
              Отозвать host
            </button>
          </div>
        }
      </section>
    }
  `,
})
export class HostsPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  private readonly config = inject(Config);
  readonly data = new PageData<DeploymentHost>();
  readonly selected = signal<DeploymentHost | null>(null);
  readonly rows = computed(() =>
    this.data.data().items.map((h) => ({
      id: h.id,
      title: h.name,
      subtitle: h.engine_id,
      cells: [
        h.platform,
        label(h.status),
        String(h.revision),
        h.last_seen ? new Date(h.last_seen).toLocaleString('ru-RU') : 'Нет связи',
      ],
    })),
  );
  constructor() {
    this.data.load((offset) =>
      this.session.api.page<DeploymentHost>('/platform/deployment-hosts', offset),
    );
  }
  select(id: string): void {
    this.selected.set(this.data.data().items.find((h) => h.id === id) ?? null);
  }
  register(): void {
    this.actions.open({
      title: 'Зарегистрировать deployment host',
      description:
        'Метаданные уже подготовленной deployment machine identity. Console не создаёт service account и не принимает секреты.',
      fields: [
        { key: 'id', label: 'Host UUID', required: true },
        { key: 'name', label: 'Название', required: true, max: 120 },
        {
          key: 'issuer',
          label: 'Issuer',
          required: true,
          initial: this.config.value.issuer,
          max: 512,
        },
        { key: 'subject', label: 'Subject deployment identity', required: true, max: 255 },
        { key: 'client_id', label: 'Client ID deployment identity', required: true, max: 120 },
        {
          key: 'engine_id',
          label: 'Rootless Docker engine ID',
          required: true,
          pattern: '[A-Za-z0-9:-]{8,120}',
          max: 120,
        },
        {
          key: 'platform',
          label: 'Платформа',
          type: 'select',
          initial: 'linux/amd64',
          options: [
            { value: 'linux/amd64', label: 'Linux amd64' },
            { value: 'linux/arm64', label: 'Linux arm64' },
          ],
        },
      ],
      execute: (v) => this.session.api.post('/platform/deployment-hosts', v),
      done: () => this.data.reload(),
    });
  }
  status(host: DeploymentHost, action: 'enable' | 'disable' | 'revoke'): void {
    this.actions.open({
      title:
        action === 'revoke'
          ? 'Отозвать host?'
          : action === 'disable'
            ? 'Отключить host?'
            : 'Включить host?',
      description: `${host.name} · ревизия ${host.revision}. ${action === 'revoke' ? 'Отзыв терминальный. Уже запущенные workloads не считаются мгновенно остановленными.' : 'Изменение проверяется по текущей ревизии.'}`,
      confirm: true,
      destructive: action === 'revoke',
      execute: () =>
        this.session.api.post(`/platform/deployment-hosts/${host.id}/${action}`, {
          expected_revision: host.revision,
        }),
      done: () => {
        this.selected.set(null);
        this.data.reload();
      },
    });
  }
}
