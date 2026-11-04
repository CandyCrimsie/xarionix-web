import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  input,
  signal,
} from '@angular/core';
import { CoreApi } from '../core/api';
import { Permission } from '../core/models';
import { PageData } from './page-data';
import { ErrorBox } from './feedback';
import { UI } from './ui';
@Component({
  selector: 'console-permission-picker',
  imports: [UI, ErrorBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      hlmInput
      placeholder="Найти на этой странице каталога"
      aria-label="Поиск прав на странице"
      [ngModel]="query()"
      (ngModelChange)="query.set($event)"
    />
    <console-error [error]="data.error()" [retryable]="true" (retry)="data.reload()" />
    <div class="mt-3 max-h-72 overflow-y-auto divide-y rounded-lg border">
      @for (permission of filtered(); track permission.key) {
        <label class="flex cursor-pointer items-start gap-3 p-3 text-sm"
          ><hlm-checkbox
            [inputId]="'console-permission-' + permission.key"
            [checked]="selected().includes(permission.key)"
            [disabled]="
              disabled() || (!selected().includes(permission.key) && selected().length >= 100)
            "
            (checkedChange)="toggle(permission.key, $event)"
          /><span
            ><span class="block">{{ permission.description }}</span
            ><span class="block text-xs text-muted-foreground"
              >{{ permission.key }}
              @if (permission.protected) {
                · защищённое
              }
            </span></span
          ></label
        >
      }
    </div>
    <div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>Выбрано {{ selected().length }} / 100</span>
      <div class="flex gap-1">
        <button
          hlmBtn
          variant="ghost"
          size="sm"
          [disabled]="data.loading() || data.data().offset === 0"
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
    @if (selected().length) {
      <hlm-collapsible
        ><button hlmCollapsibleTrigger hlmBtn variant="ghost" size="sm">Все выбранные права</button
        ><hlm-collapsible-content
          ><div class="mt-2 flex flex-wrap gap-1">
            @for (key of selected(); track key) {
              <button
                hlmBtn
                variant="outline"
                size="sm"
                [disabled]="disabled()"
                (click)="toggle(key, false)"
                [attr.aria-label]="'Убрать ' + key"
              >
                {{ key }} ×
              </button>
            }
          </div></hlm-collapsible-content
        ></hlm-collapsible
      >
    }
  `,
})
export class PermissionPicker {
  readonly api = inject(CoreApi);
  readonly data = new PageData<Permission>();
  readonly selected = model<string[]>([]);
  readonly disabled = input(false);
  readonly query = signal('');
  readonly filtered = computed(() =>
    this.data
      .data()
      .items.filter((p) =>
        (p.key + ' ' + p.description).toLowerCase().includes(this.query().toLowerCase()),
      ),
  );
  constructor() {
    this.data.load((offset) => this.api.page<Permission>('/permissions', offset));
  }
  toggle(key: string, value: boolean): void {
    this.selected.update((keys) =>
      value ? [...new Set([...keys, key])] : keys.filter((k) => k !== key),
    );
  }
}
