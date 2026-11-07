import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../core/auth';
import { UI, ICONS } from '../shared/ui';
@Component({
  selector: 'console-auth-page',
  imports: [UI],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="grid min-h-dvh place-items-center bg-background p-6">
      <section class="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div class="mb-7 flex items-center gap-3">
          <span
            class="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground font-semibold"
            >X</span
          >
          <div class="font-semibold">
            Xarionix
            <p class="text-xs font-normal text-muted-foreground">Рабочее пространство</p>
          </div>
        </div>
        <h1 class="text-xl font-semibold tracking-tight">
          {{ callback ? 'Завершение входа' : 'Добро пожаловать' }}
        </h1>
        <p class="mt-3 text-sm text-muted-foreground">
          {{
            message() ||
              (auth.state() === 'error'
                ? 'Не удалось начать вход. Проверьте доступность Keycloak и повторите попытку.'
                : 'Войдите через корпоративную учётную запись Keycloak.')
          }}
        </p>
        @if (!callback || message()) {
          <button
            hlmBtn
            class="mt-7 w-full"
            [disabled]="auth.state() === 'initializing'"
            (click)="auth.login(returnTo)"
          >
            Войти через Keycloak
          </button>
        }
        <p class="mt-5 text-xs text-muted-foreground">
          Доступ к компаниям и платформе определяет Xarionix Core.
        </p>
      </section>
    </main>
  `,
})
export class AuthPage {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly callback = this.route.snapshot.routeConfig?.path === 'auth/callback';
  readonly message = signal('');
  readonly returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/dashboard';
  constructor() {
    if (this.callback)
      void this.auth
        .callback()
        .then((path) => this.router.navigateByUrl(path))
        .catch(() => this.message.set('Не удалось завершить вход. Начните новый вход.'));
    else if (this.route.snapshot.routeConfig?.path === 'auth/logged-out')
      this.message.set('Вы вышли из системы. Токены удалены из памяти.');
  }
}
