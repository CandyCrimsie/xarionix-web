import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UI, ICONS } from './ui';
import { ErrorBox } from './feedback';
import { CoreError } from '../core/errors';
import type { Page } from '../core/models';

export interface TableRow {
  id: string;
  title: string;
  subtitle?: string;
  cells: string[];
  path?: string;
  query?: Record<string, string | number>;
}
@Component({
  selector: 'console-table',
  imports: [UI, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <console-error [error]="error()" [retryable]="true" (retry)="retry.emit()" />
    <div class="overflow-x-auto rounded-xl border bg-card" [attr.aria-busy]="loading()">
      <table hlmTable class="w-full">
        <thead hlmTHead>
          <tr hlmTr>
            <th hlmTh>{{ titleColumn() }}</th>
            @for (column of columns(); track column) {
              <th hlmTh>{{ column }}</th>
            }
          </tr>
        </thead>
        <tbody hlmTBody>
          @if (loading()) {
            <tr hlmTr>
              <td
                hlmTd
                [attr.colspan]="columns().length + 1"
                class="h-32 text-center text-muted-foreground"
              >
                Загрузка…
              </td>
            </tr>
          } @else {
            @for (row of rows(); track row.id) {
              <tr hlmTr>
                <td hlmTd class="max-w-80">
                  @if (row.path) {
                    <a
                      [routerLink]="row.path"
                      [queryParams]="row.query ?? null"
                      class="font-medium underline-offset-4 hover:underline"
                      >{{ row.title }}</a
                    >
                  } @else {
                    <button
                      hlmBtn
                      variant="link"
                      class="h-auto max-w-full justify-start p-0 text-left font-medium whitespace-normal"
                      (click)="selected.emit(row.id)"
                    >
                      {{ row.title }}
                    </button>
                  }
                  @if (row.subtitle) {
                    <div class="mt-1 truncate text-xs text-muted-foreground" [title]="row.subtitle">
                      {{ row.subtitle }}
                    </div>
                  }
                </td>
                @for (cell of row.cells; track $index) {
                  <td hlmTd class="text-muted-foreground">{{ cell }}</td>
                }
              </tr>
            } @empty {
              <tr hlmTr>
                <td
                  hlmTd
                  [attr.colspan]="columns().length + 1"
                  class="h-40 text-center text-muted-foreground"
                >
                  Здесь пока нет записей
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
    <div class="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span
        >{{ rows().length ? page().offset + 1 : 0 }}–{{
          rows().length ? page().offset + rows().length : 0
        }}
        @if (page().total !== undefined) {
          из {{ page().total }}
        }
      </span>
      <div class="flex gap-2">
        <button
          hlmBtn
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Обновить таблицу"
          hlmTooltip="Обновить"
          [disabled]="loading()"
          (click)="retry.emit()"
        >
          <ng-icon name="lucideRefreshCw" />
        </button>
        <button
          hlmBtn
          variant="outline"
          size="sm"
          [disabled]="loading() || page().offset === 0"
          (click)="pageChange.emit(page().offset - page().limit)"
        >
          Назад</button
        ><button
          hlmBtn
          variant="outline"
          size="sm"
          [disabled]="loading() || !hasNext()"
          (click)="pageChange.emit(page().offset + page().limit)"
        >
          Далее
        </button>
      </div>
    </div>
  `,
})
export class DataTable {
  readonly rows = input.required<TableRow[]>();
  readonly columns = input<string[]>([]);
  readonly titleColumn = input('Название');
  readonly page = input.required<Page<unknown>>();
  readonly loading = input(false);
  readonly error = input<CoreError | null>(null);
  readonly selected = output<string>();
  readonly pageChange = output<number>();
  readonly retry = output<void>();
  hasNext(): boolean {
    const page = this.page();
    return page.total !== undefined
      ? page.offset + page.limit < page.total
      : page.items.length === page.limit;
  }
}
