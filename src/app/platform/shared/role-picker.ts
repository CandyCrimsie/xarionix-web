import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { Session } from '../core/session';
import { Role } from '../core/models';
import { PageData } from './page-data';
import { UI } from './ui';
import { ErrorBox } from './feedback';
@Component({
  selector: 'console-role-picker',
  imports: [UI, ErrorBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <console-error [error]="data.error()" [retryable]="true" (retry)="data.reload()" />
    <div class="max-h-52 overflow-y-auto divide-y rounded-lg border">
      @for (role of data.data().items; track role.id) {
        <label class="flex items-center gap-3 p-3 text-sm"
          ><hlm-checkbox
            [inputId]="'console-role-' + role.id"
            [checked]="selected().includes(role.id)"
            [disabled]="disabled() || !role.active"
            (checkedChange)="toggle(role.id, $event)"
          /><span
            >{{ role.name
            }}<span class="block text-xs text-muted-foreground">{{
              role.description || role.code
            }}</span></span
          ></label
        >
      } @empty {
        <p class="p-4 text-sm text-muted-foreground">Нет доступных ролей</p>
      }
    </div>
    <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
      <span>Выбрано: {{ selected().length }}</span>
      <div>
        <button
          hlmBtn
          variant="ghost"
          size="sm"
          [disabled]="data.data().offset === 0 || data.loading()"
          (click)="data.page(data.data().offset - 20)"
        >
          Назад</button
        ><button
          hlmBtn
          variant="ghost"
          size="sm"
          [disabled]="data.loading() || data.data().offset + 20 >= (data.data().total ?? 0)"
          (click)="data.page(data.data().offset + 20)"
        >
          Далее
        </button>
      </div>
    </div>
  `,
})
export class RolePicker {
  readonly session = inject(Session);
  readonly selected = model<string[]>([]);
  readonly multiple = input(true);
  readonly disabled = input(false);
  readonly data = new PageData<Role>();
  constructor() {
    const id = this.session.company()!.id;
    this.data.load((offset) => this.session.api.page<Role>(`/companies/${id}/roles`, offset));
  }
  toggle(id: string, on: boolean): void {
    this.selected.update((values) =>
      on
        ? this.multiple()
          ? [...new Set([...values, id])].slice(0, 20)
          : [id]
        : values.filter((v) => v !== id),
    );
  }
}
