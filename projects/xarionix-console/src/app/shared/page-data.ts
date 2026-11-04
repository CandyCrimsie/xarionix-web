import { DestroyRef, inject, signal } from '@angular/core';
import { Observable, Subscription, finalize } from 'rxjs';
import { RequestScope } from '../core/scope';
import { CoreError, coreError } from '../core/errors';
import type { Page } from '../core/models';

// Every page owns its subscription; an epoch change immediately removes old company/session data.
export class PageData<T> {
  private readonly scope = inject(RequestScope);
  private readonly destroyed = inject(DestroyRef);
  private subscription?: Subscription;
  readonly data = signal<Page<T>>({ items: [], limit: 20, offset: 0 });
  readonly loading = signal(false);
  readonly error = signal<CoreError | null>(null);
  private request?: (offset: number) => Observable<Page<T>>;
  constructor() {
    const scopeSub = this.scope.changed.subscribe(() => {
      this.subscription?.unsubscribe();
      this.data.set({ items: [], limit: 20, offset: 0 });
      this.error.set(null);
      this.loading.set(false);
    });
    this.destroyed.onDestroy(() => {
      scopeSub.unsubscribe();
      this.subscription?.unsubscribe();
    });
  }
  load(request: (offset: number) => Observable<Page<T>>, offset = 0): void {
    this.request = request;
    this.subscription?.unsubscribe();
    const epoch = this.scope.epoch();
    this.loading.set(true);
    this.error.set(null);
    this.subscription = request(offset)
      .pipe(
        finalize(() => {
          if (epoch === this.scope.epoch()) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (data) => {
          if (epoch === this.scope.epoch()) this.data.set(data);
        },
        error: (error) => {
          if (epoch === this.scope.epoch()) this.error.set(coreError(error));
        },
      });
  }
  reload(): void {
    if (this.request) this.load(this.request, this.data().offset);
  }
  page(offset: number): void {
    if (this.request) this.load(this.request, Math.max(0, offset));
  }
}
