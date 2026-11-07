import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Session } from '../core/session';
import { CoreError, coreError } from '../core/errors';
import { ErrorBox } from '../shared/feedback';
import { UI, ICONS } from '../shared/ui';

interface Items {
  company_id: string;
  version: string;
  items: { id: string; name: string }[];
}

// Reviewed, compiled UI. Packages cannot provide JavaScript or an arbitrary API URL.
@Component({
  selector: 'app-hello-business',
  imports: [UI, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">Модули компании</p>
        <h1>Деловые записи</h1>
        <p class="description">{{ session.company()?.name ?? 'Выберите компанию' }}</p>
      </div>
      <button
        hlmBtn
        variant="outline"
        [disabled]="busy() || !session.can('hello.items.read')"
        (click)="read()"
      >
        <ng-icon name="lucideRefreshCw" />Обновить
      </button>
    </div>
    <console-error [error]="error()" />
    @if (!session.company()) {
      <section class="panel">
        <p>Для работы с записями выберите компанию.</p>
        <a hlmBtn variant="outline" class="mt-4" routerLink="/companies">Выбрать компанию</a>
      </section>
    } @else if (!session.can('hello.items.read')) {
      <section class="panel"><p>Нет подтверждённого права на чтение записей.</p></section>
    } @else {
      <section class="panel">
        @if (session.can('hello.items.create')) {
          <form class="mb-5 flex items-end gap-2" (ngSubmit)="create()">
            <label class="min-w-0 flex-1 text-sm"
              >Название
              <input
                hlmInput
                class="mt-2 w-full"
                name="name"
                maxlength="100"
                required
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
                [disabled]="busy()"
              />
            </label>
            <button hlmBtn type="submit" [disabled]="busy() || !name().trim()">Добавить</button>
          </form>
        }
        @if (busy()) {
          <p role="status" class="text-sm text-muted-foreground">Выполняем запрос…</p>
        }
        @if (data(); as result) {
          <ul class="divide-y divide-border">
            @for (item of result.items; track item.id) {
              <li class="py-3 text-sm">{{ item.name }}</li>
            } @empty {
              <li class="py-3 text-sm text-muted-foreground">Записей пока нет.</li>
            }
          </ul>
          <p class="mt-4 text-xs text-muted-foreground">Версия модуля {{ result.version }}</p>
        }
      </section>
    }
  `,
})
export class HelloBusinessPage {
  readonly session = inject(Session);
  readonly data = signal<Items | null>(null);
  readonly name = signal('');
  readonly error = signal<CoreError | null>(null);
  readonly busy = signal(false);
  private revision = 0;
  constructor() {
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => this.revision++);
    this.session.scope.changed.pipe(takeUntilDestroyed(destroy)).subscribe(() => this.clear());
    effect(() => {
      const company = this.session.company();
      const allowed = this.session.can('hello.items.read');
      if (!company || !allowed) this.clear();
    });
  }
  private clear(): void {
    this.revision++;
    this.data.set(null);
    this.name.set('');
    this.error.set(null);
    this.busy.set(false);
  }
  read(): Promise<void> {
    return this.invoke('items-read', {});
  }
  create(): Promise<void> {
    const name = this.name().trim();
    if (!name || name.length > 100 || !this.session.can('hello.items.create'))
      return Promise.resolve();
    return this.invoke('items-create', { name });
  }
  private async invoke(operation: 'items-read' | 'items-create', body: object): Promise<void> {
    const company = this.session.company();
    if (this.busy() || !company || !this.session.can('hello.items.read')) return;
    const epoch = this.session.scope.epoch(),
      revision = ++this.revision;
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.session.api.post<{ request_id: string; body: Items }>(
          `/companies/${company.id}/modules/hello-business/operations/${operation}`,
          body,
        ),
      );
      if (epoch !== this.session.scope.epoch() || revision !== this.revision) return;
      const result = response.body;
      if (result.company_id !== company.id)
        throw new CoreError(
          502,
          'module_context_mismatch',
          'Модуль вернул данные другой компании.',
        );
      this.data.set(result);
      if (operation === 'items-create') this.name.set('');
    } catch (error) {
      if (epoch === this.session.scope.epoch() && revision === this.revision) {
        this.data.set(null);
        this.error.set(coreError(error));
      }
    } finally {
      if (revision === this.revision) this.busy.set(false);
    }
  }
}
