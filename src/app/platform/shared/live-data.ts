import { DestroyRef, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { poll } from '../core/polling';
import { RequestScope } from '../core/scope';
import { CoreError, coreError } from '../core/errors';

export class LiveData<T> {
  private readonly scope = inject(RequestScope);
  private readonly destroy = inject(DestroyRef);
  private subscription?: Subscription;
  private request?: () => Observable<T>;
  readonly value = signal<T | null>(null);
  readonly error = signal<CoreError | null>(null);
  readonly updated = signal<number | null>(null);
  readonly stopped = signal(false);
  constructor() {
    const changes = this.scope.changed.subscribe(() => {
      this.subscription?.unsubscribe();
      this.value.set(null);
      this.error.set(null);
      this.stopped.set(true);
    });
    this.destroy.onDestroy(() => {
      changes.unsubscribe();
      this.subscription?.unsubscribe();
    });
  }
  start(request: () => Observable<T>): void {
    this.request = request;
    this.subscription?.unsubscribe();
    this.error.set(null);
    this.stopped.set(false);
    const epoch = this.scope.epoch();
    this.subscription = poll(
      request,
      (value) => {
        if (epoch !== this.scope.epoch()) return;
        this.value.set(value);
        this.updated.set(Date.now());
      },
      (error) => {
        if (epoch === this.scope.epoch()) this.error.set(coreError(error));
      },
    );
    this.subscription.add(() => this.stopped.set(true));
  }
  reload(): void {
    if (this.request) this.start(this.request);
  }
}
