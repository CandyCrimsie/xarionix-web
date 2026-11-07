import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Session } from '../core/session';
import { Config } from '../core/config';
import { coreError, CoreError } from '../core/errors';
import { DeploymentHost } from '../core/models';
import { Actions } from '../shared/actions';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { ErrorBox } from '../shared/feedback';
import { UI, ICONS, label } from '../shared/ui';

interface GatewayIdentity {
  issuer: string;
  subject: string;
  client_id: string;
  revision: number;
  status: 'active' | 'disabled' | 'revoked';
}
interface GatewayBinding {
  host_id: string;
  identity: GatewayIdentity | null;
}

@Component({
  selector: 'app-gateway',
  imports: [UI, DataTable, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Администрирование</p>
        <h1>Gateway модулей</h1>
        <p class="description">
          Отдельные machine identities бизнес-транспорта. Секреты сервисов настраиваются на сервере.
        </p>
      </div>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Состояние сервера']"
      [page]="hosts.data()"
      [loading]="hosts.loading()"
      [error]="hosts.error()"
      (selected)="select($event)"
      (retry)="hosts.reload()"
      (pageChange)="hosts.page($event)"
    />
    <console-error [error]="error()" />
    @if (selected(); as host) {
      <section class="panel mt-5">
        <h2>{{ host.name }}</h2>
        @if (loading()) {
          <p class="description">Проверяем привязку…</p>
        } @else if (binding(); as detail) {
          @if (detail.identity; as identity) {
            <dl class="detail-list">
              <dt>Доверие identity</dt>
              <dd>{{ status(identity.status) }}</dd>
              <dt>Issuer</dt>
              <dd>{{ identity.issuer }}</dd>
              <dt>Client ID</dt>
              <dd>{{ identity.client_id }}</dd>
              <dt>Subject</dt>
              <dd class="font-mono text-xs">{{ identity.subject }}</dd>
              <dt>Ревизия</dt>
              <dd>{{ identity.revision }}</dd>
            </dl>
            <p class="mt-4 text-xs text-muted-foreground">
              Активное доверие не является подтверждением текущего соединения Agent.
            </p>
            @if (identity.status !== 'revoked') {
              <div class="mt-5 flex gap-2">
                <button
                  hlmBtn
                  variant="outline"
                  (click)="change(identity.status === 'active' ? 'disabled' : 'active')"
                >
                  {{ identity.status === 'active' ? 'Отключить доверие' : 'Включить доверие' }}
                </button>
                <button
                  hlmBtn
                  variant="outline"
                  class="text-destructive"
                  (click)="change('revoked')"
                >
                  Отозвать
                </button>
              </div>
            }
          } @else {
            <p class="description">Gateway identity ещё не привязана.</p>
            <button hlmBtn class="mt-5" [disabled]="host.status !== 'active'" (click)="register()">
              Привязать identity
            </button>
          }
        }
      </section>
    }
  `,
})
export class GatewayPage {
  readonly session = inject(Session);
  private readonly config = inject(Config);
  private readonly actions = inject(Actions);
  readonly hosts = new PageData<DeploymentHost>();
  readonly selected = signal<DeploymentHost | null>(null);
  readonly binding = signal<GatewayBinding | null>(null);
  readonly error = signal<CoreError | null>(null);
  readonly loading = signal(false);
  readonly status = label;
  private revision = 0;
  readonly rows = computed(() =>
    this.hosts.data().items.map((host) => ({
      id: host.id,
      title: host.name,
      cells: [label(host.status)],
    })),
  );
  constructor() {
    this.session.scope.changed.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.revision++;
      this.selected.set(null);
      this.binding.set(null);
      this.error.set(null);
      this.loading.set(false);
    });
    this.hosts.load((offset) =>
      this.session.api.page<DeploymentHost>('/platform/deployment-hosts', offset),
    );
  }
  async select(id: string): Promise<void> {
    const host = this.hosts.data().items.find((item) => item.id === id);
    if (!host) return;
    this.selected.set(host);
    this.binding.set(null);
    this.error.set(null);
    this.loading.set(true);
    const revision = ++this.revision,
      epoch = this.session.scope.epoch();
    try {
      const binding = await firstValueFrom(
        this.session.api.get<GatewayBinding>(
          `/platform/deployment-hosts/${host.id}/gateway-identity`,
        ),
      );
      if (revision === this.revision && epoch === this.session.scope.epoch())
        this.binding.set(binding);
    } catch (error) {
      if (revision === this.revision && epoch === this.session.scope.epoch())
        this.error.set(coreError(error));
    } finally {
      if (revision === this.revision) this.loading.set(false);
    }
  }
  register(): void {
    const host = this.selected();
    if (!host) return;
    this.actions.open({
      title: 'Привязать Gateway identity',
      description:
        'Укажите заранее созданный отдельный client. Пароли и client secrets сюда не вводятся.',
      fields: [
        {
          key: 'issuer',
          label: 'Issuer',
          required: true,
          initial: this.config.value.issuer,
          max: 512,
        },
        { key: 'subject', label: 'Subject Gateway identity', required: true, max: 255 },
        { key: 'client_id', label: 'Client ID Gateway identity', required: true, max: 120 },
      ],
      execute: (values) =>
        this.session.api.post(`/platform/deployment-hosts/${host.id}/gateway-identity`, values),
      done: () => void this.select(host.id),
    });
  }
  change(status: GatewayIdentity['status']): void {
    const host = this.selected(),
      identity = this.binding()?.identity;
    if (!host || !identity) return;
    this.actions.open({
      title: status === 'revoked' ? 'Отозвать Gateway identity?' : 'Изменить доверие Gateway?',
      description:
        status === 'revoked'
          ? 'Отзыв необратим. Данные модулей остаются сохранёнными.'
          : 'Core повторно проверит права и ревизию.',
      confirm: true,
      destructive: status === 'revoked',
      execute: () =>
        this.session.api.patch(`/platform/deployment-hosts/${host.id}/gateway-identity`, {
          status,
          expected_revision: identity.revision,
        }),
      done: () => void this.select(host.id),
    });
  }
}
