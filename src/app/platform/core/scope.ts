import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RequestScope {
  readonly epoch = signal(0);
  readonly changed = new Subject<void>();
  readonly denied = new Subject<{ path: string; mfa: boolean }>();
  invalidate(): void {
    this.epoch.update((n) => n + 1);
    this.changed.next();
  }
}
