import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import {
  InMemoryWebStorage,
  Log,
  User,
  UserManager,
  UserManagerSettings,
  WebStorageStateStore,
} from 'oidc-client-ts';
import { Config } from './config';
import { RequestScope } from './scope';

export type AuthState =
  'initializing' | 'anonymous' | 'authenticated' | 'refreshing' | 'expired' | 'error';
export const OIDC_MANAGER = new InjectionToken<(settings: UserManagerSettings) => UserManager>(
  'Console OIDC manager',
  { providedIn: 'root', factory: () => (settings) => new UserManager(settings) },
);
export function safeReturn(value: unknown): string {
  return typeof value === 'string' &&
    /^\/(?!\/)/.test(value) &&
    !/[\\\u0000-\u0020]/.test(value) &&
    !value.startsWith('/auth') &&
    !value.startsWith('/login')
    ? value
    : '/dashboard';
}
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly config = inject(Config);
  private readonly scope = inject(RequestScope);
  private readonly createManager = inject(OIDC_MANAGER);
  private manager?: UserManager;
  private user: User | null = null;
  readonly state = signal<AuthState>('initializing');
  readonly authenticated = computed(() => ['authenticated', 'refreshing'].includes(this.state()));
  initialize(): void {
    const config = this.config.value;
    Log.setLevel(Log.NONE);
    this.manager = this.createManager({
      authority: config.issuer,
      client_id: config.clientId,
      redirect_uri: `${location.origin}/auth/callback`,
      post_logout_redirect_uri: `${location.origin}/auth/logged-out`,
      response_type: 'code',
      scope: 'openid profile',
      userStore: new WebStorageStateStore({
        store: new InMemoryWebStorage(),
        prefix: 'xarionix.console.user.',
      }),
      // This store contains only short-lived OIDC transaction state, never the User/token response.
      stateStore: new WebStorageStateStore({
        store: sessionStorage,
        prefix: 'xarionix.console.transaction.',
      }),
      automaticSilentRenew: true,
      monitorSession: false,
      loadUserInfo: false,
      staleStateAgeInSeconds: 300,
      accessTokenExpiringNotificationTimeInSeconds: 45,
      includeIdTokenInSilentRenew: false,
      revokeTokensOnSignout: false,
    });
    this.manager.events.addUserLoaded((user) => {
      this.user = user;
      this.state.set('authenticated');
    });
    this.manager.events.addAccessTokenExpiring(() => this.state.set('refreshing'));
    this.manager.events.addAccessTokenExpired(() => this.expire());
    this.manager.events.addSilentRenewError(() => this.expire());
    this.manager.events.addUserUnloaded(() => {
      this.user = null;
      this.scope.invalidate();
    });
    void this.manager.clearStaleState().catch(() => undefined);
    this.state.set('anonymous');
  }
  token(): string | null {
    return this.user && !this.user.expired ? this.user.access_token : null;
  }
  async login(returnTo = '/dashboard', mfa = false): Promise<void> {
    if (!this.manager) throw new Error('OIDC не настроен');
    this.user = null;
    this.scope.invalidate();
    this.manager.stopSilentRenew();
    this.state.set('initializing');
    try {
      await this.manager.removeUser();
      await this.manager.signinRedirect({
        state: { returnTo: safeReturn(returnTo) },
        ...(mfa
          ? { prompt: 'login', max_age: 0, acr_values: this.config.value.mfaAcr || undefined }
          : {}),
      });
    } catch {
      this.state.set('error');
    }
  }
  async callback(): Promise<string> {
    if (!this.manager) throw new Error('OIDC не настроен');
    try {
      const user = await this.manager.signinRedirectCallback();
      this.user = user;
      this.scope.invalidate();
      this.state.set('authenticated');
      const state = user.state as { returnTo?: unknown } | undefined;
      history.replaceState(null, '', '/auth/callback');
      return safeReturn(state?.returnTo);
    } catch {
      history.replaceState(null, '', '/auth/callback');
      this.user = null;
      this.scope.invalidate();
      void this.manager.removeUser();
      this.state.set('error');
      throw new Error('Не удалось завершить вход. Начните новый вход.');
    }
  }
  expire(): void {
    this.user = null;
    this.manager?.stopSilentRenew();
    void this.manager?.removeUser();
    this.scope.invalidate();
    this.state.set('expired');
  }
  async logout(): Promise<void> {
    const manager = this.manager;
    this.user = null;
    this.scope.invalidate();
    this.state.set('anonymous');
    if (!manager) return;
    manager.stopSilentRenew();
    await manager.removeUser();
    // Remove the User first: Keycloak logout uses client_id, never an ID JWT in the URL.
    try {
      await manager.signoutRedirect({
        extraQueryParams: { client_id: this.config.value.clientId },
      });
    } catch {
      this.state.set('error');
    }
  }
}
