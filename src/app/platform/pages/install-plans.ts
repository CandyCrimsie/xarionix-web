import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Session } from '../core/session';
import { InstallPlan } from '../core/models';
import { PageData } from '../shared/page-data';
import { DataTable } from '../shared/data-table';
import { UI, label } from '../shared/ui';

@Component({
  selector: 'app-install-plans',
  imports: [UI, DataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">Модули</p>
        <h1>Планы установки</h1>
        <p class="description">Проверенные сервером планы и отдельные решения об их одобрении.</p>
      </div>
    </div>
    <console-table
      [rows]="rows()"
      [columns]="['Действие', 'Состояние', 'Версия']"
      [page]="data.data()"
      [loading]="data.loading()"
      [error]="data.error()"
      (retry)="data.reload()"
      (pageChange)="data.page($event)"
    />`,
})
export class InstallPlansPage {
  readonly session = inject(Session);
  readonly data = new PageData<InstallPlan>();
  readonly rows = computed(() =>
    this.data.data().items.map((value) => ({
      id: value.id,
      title: value.plan.module_id,
      cells: [label(value.plan.action), label(value.state), value.plan.target_version],
      path: `/admin/modules/install-plans/${value.id}`,
    })),
  );
  constructor() {
    this.data.load((offset) =>
      this.session.api.page<InstallPlan>('/platform/module-install-plans', offset),
    );
  }
}
