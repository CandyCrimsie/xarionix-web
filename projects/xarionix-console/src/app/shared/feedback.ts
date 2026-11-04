import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Auth } from '../core/auth';
import { CoreError } from '../core/errors';
import { UI } from './ui';

@Component({
  selector: 'console-error',
  imports: [UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div
        role="alert"
        class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        data-testid="api-error"
      >
        <p class="font-medium">{{ e.message }}</p>
        @if (e.requestId) {
          <p class="mt-1 text-xs text-muted-foreground">Запрос: {{ e.requestId }}</p>
        }
        <div class="mt-3 flex flex-wrap gap-2">
          @if (e.mfa) {
            <button hlmBtn size="sm" (click)="auth.login(currentPath(), true)">
              Подтвердить MFA
            </button>
          } @else if (e.status === 401) {
            <button hlmBtn size="sm" (click)="auth.login(currentPath())">Войти</button>
          } @else if (retryable()) {
            <button hlmBtn size="sm" variant="outline" (click)="retry.emit()">Повторить</button>
          }
        </div>
      </div>
    }
  `,
})
export class ErrorBox {
  readonly auth = inject(Auth);
  readonly error = input<CoreError | null>(null);
  readonly retryable = input(false);
  readonly retry = output<void>();
  currentPath(): string {
    return location.pathname;
  }
}
@Component({
  selector: 'console-status',
  imports: [UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span hlmBadge variant="outline" [class.text-destructive]="danger()">{{
    text()
  }}</span>`,
})
export class StatusBadge {
  readonly text = input.required<string>();
  readonly danger = input(false);
}
