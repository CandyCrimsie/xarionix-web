import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Session } from '../core/session';
import { Company, CompanyRequest } from '../core/models';
import { UI, ICONS, label } from '../shared/ui';
import { Actions, FormField } from '../shared/actions';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { ErrorBox } from '../shared/feedback';
export const companyFields: FormField[] = [
  { key: 'name', label: 'Название', required: true, max: 160 },
  {
    key: 'slug',
    label: 'Адресное имя',
    required: true,
    max: 63,
    pattern: '[a-z][a-z0-9-]{1,61}[a-z0-9]',
    help: 'Латиница, цифры и дефис. Например, north-telecom.',
  },
];
@Component({
  selector: 'console-companies',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Рабочие пространства</p>
        <h1>{{ platform ? 'Компании платформы' : 'Мои компании' }}</h1>
        <p class="description">У каждой компании собственный состав участников и права доступа.</p>
      </div>
      <div class="flex gap-2">
        @if (!platform) {
          <button hlmBtn variant="outline" (click)="accept()">Принять приглашение</button>
        }
        <button hlmBtn variant="outline" (click)="create(true)">Подать заявку</button
        ><button hlmBtn (click)="create(false)">
          <ng-icon name="lucidePlus" />Создать компанию
        </button>
      </div>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Адресное имя', 'Статус']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />
  `,
})
export class CompaniesPage {
  accept(): void {
    this.actions.open({
      title: 'Принять приглашение',
      description: 'Укажите UUID компании и полученный секрет. Секрет не сохраняется в браузере.',
      fields: [
        { key: 'company_id', label: 'Компания · UUID', required: true },
        { key: 'secret', label: 'Секрет приглашения', type: 'password', required: true, max: 128 },
      ],
      execute: (v) => this.session.api.post('/invitations/accept', v),
      done: () => this.data.reload(),
    });
  }
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly route = inject(ActivatedRoute);
  readonly platform = !!this.route.snapshot.data['platform'];
  readonly data = new PageData<Company>();
  readonly rows = computed(() =>
    this.data.data().items.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: c.id,
      cells: [c.slug, label(c.status)],
      path: `/companies/${c.id}`,
    })),
  );
  constructor() {
    this.data.load((offset) =>
      this.session.api.page<Company>(
        this.platform ? '/platform/companies' : '/me/companies',
        offset,
      ),
    );
  }
  create(request: boolean): void {
    this.actions.open({
      title: request ? 'Заявка на компанию' : 'Создать компанию',
      description: request
        ? 'Администратор платформы рассмотрит заявку.'
        : 'Создание проверяется серверной политикой платформы.',
      fields: companyFields,
      execute: (v) => this.session.api.post(request ? '/company-requests' : '/companies', v),
      done: () => this.data.reload(),
    });
  }
}
@Component({
  selector: 'console-company',
  imports: [UI, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session.company(); as company) {
      <div class="page-heading">
        <div>
          <p class="eyebrow">Компания</p>
          <h1>{{ company.name }}</h1>
          <p class="description">{{ company.slug }} · {{ status(company.status) }}</p>
        </div>
        @if (session.can('core.company.manage')) {
          <button hlmBtn variant="outline" (click)="edit()">
            <ng-icon name="lucidePencil" />Изменить
          </button>
        }
      </div>
      <console-error [error]="session.error()" [retryable]="true" (retry)="session.revalidate()" />
      <section class="panel max-w-3xl">
        <h2>Рабочее пространство</h2>
        <dl class="detail-list">
          <dt>Идентификатор Core</dt>
          <dd class="font-mono text-xs">{{ company.id }}</dd>
          <dt>Создана</dt>
          <dd>{{ company.created_at }}</dd>
          <dt>Эффективные права</dt>
          <dd>{{ session.permissions()?.permissions?.length ?? 0 }}</dd>
        </dl>
        <hlm-collapsible class="mt-4"
          ><button hlmBtn hlmCollapsibleTrigger variant="ghost" size="sm">
            Мои эффективные права</button
          ><hlm-collapsible-content
            ><ul class="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs text-muted-foreground">
              @for (key of session.permissions()?.permissions; track key) {
                <li>{{ key }}</li>
              }
            </ul></hlm-collapsible-content
          ></hlm-collapsible
        >
        <div class="mt-6 flex flex-wrap gap-2">
          @for (link of links; track link.path) {
            @if (session.can(link.permission)) {
              <a
                hlmBtn
                variant="outline"
                [routerLink]="'/companies/' + company.id + '/' + link.path"
                >{{ link.label }}</a
              >
            }
          }
        </div>
      </section>
    }
  `,
})
export class CompanyPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly status = label;
  readonly links = [
    { path: 'members', label: 'Участники', permission: 'core.members.read' },
    { path: 'employees', label: 'Сотрудники', permission: 'core.employees.read' },
    { path: 'roles', label: 'Роли и права', permission: 'core.roles.read' },
    { path: 'invitations', label: 'Приглашения', permission: 'core.invitations.manage' },
  ];
  edit(): void {
    const c = this.session.company();
    if (!c) return;
    this.actions.open({
      title: 'Изменить компанию',
      description: 'Статус влияет на доступ всех участников.',
      fields: [
        ...companyFields.map((f) => ({ ...f, initial: f.key === 'name' ? c.name : c.slug })),
        {
          key: 'status',
          label: 'Статус',
          type: 'select',
          initial: c.status,
          options: ['active', 'suspended', 'archived'].map((value) => ({
            value,
            label: label(value),
          })),
        },
      ],
      execute: (v) => this.session.api.patch<Company>(`/companies/${c.id}`, v),
      done: (result) => void this.session.select(result as Company),
    });
  }
}
@Component({
  selector: 'console-requests',
  imports: [UI, DataTable],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Компании</p>
        <h1>{{ platform ? 'Заявки на создание' : 'Мои заявки' }}</h1>
      </div>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Адресное имя', 'Статус']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (selected)="review($event)"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />`,
})
export class RequestsPage {
  readonly session = inject(Session);
  readonly actions = inject(Actions);
  readonly platform = !!inject(ActivatedRoute).snapshot.data['platform'];
  readonly data = new PageData<CompanyRequest>();
  readonly rows = computed(() =>
    this.data.data().items.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: r.review_comment ?? '',
      cells: [r.requested_slug, label(r.status)],
    })),
  );
  constructor() {
    this.data.load((offset) =>
      this.session.api.page<CompanyRequest>(
        this.platform ? '/platform/company-requests' : '/company-requests/me',
        offset,
      ),
    );
  }
  review(id: string): void {
    const r = this.data.data().items.find((r) => r.id === id);
    if (!r || r.status !== 'pending') return;
    if (!this.platform) {
      this.actions.open({
        title: 'Отменить заявку?',
        description: r.name,
        confirm: true,
        execute: () => this.session.api.post(`/company-requests/${r.id}/cancel`),
        done: () => this.data.reload(),
      });
      return;
    }
    this.actions.open({
      title: 'Рассмотреть заявку',
      description: `${r.name} · ${r.requested_slug}`,
      fields: [
        {
          key: 'decision',
          label: 'Решение',
          type: 'select',
          initial: 'approve',
          options: [
            { value: 'approve', label: 'Одобрить' },
            { value: 'reject', label: 'Отклонить' },
          ],
        },
        { key: 'comment', label: 'Комментарий', type: 'textarea', max: 1000 },
      ],
      execute: (v) =>
        this.session.api.post(`/platform/company-requests/${r.id}/${v['decision']}`, {
          comment: v['comment'] || null,
        }),
      done: () => this.data.reload(),
    });
  }
}
