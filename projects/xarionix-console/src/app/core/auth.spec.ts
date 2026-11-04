import { TestBed } from '@angular/core/testing';
import { UserManager, UserManagerSettings } from 'oidc-client-ts';
import { Auth, OIDC_MANAGER } from './auth';
import { Config } from './config';
import { RequestScope } from './scope';
const mock = {
  settings: null as unknown,
  callbacks: new Map<string, (value?: unknown) => void>(),
  redirect: vi.fn(),
  callback: vi.fn(),
  logout: vi.fn(),
  remove: vi.fn(),
  stop: vi.fn(),
};
class FakeManager {
  constructor(settings: unknown) {
    mock.settings = settings;
  }
  events = {
    addUserLoaded: (fn: (v?: unknown) => void) => mock.callbacks.set('loaded', fn),
    addAccessTokenExpiring: (fn: () => void) => mock.callbacks.set('expiring', fn),
    addAccessTokenExpired: (fn: () => void) => mock.callbacks.set('expired', fn),
    addSilentRenewError: (fn: () => void) => mock.callbacks.set('renewError', fn),
    addUserUnloaded: (fn: () => void) => mock.callbacks.set('unloaded', fn),
  };
  signinRedirect = mock.redirect;
  signinRedirectCallback = mock.callback;
  signoutRedirect = mock.logout;
  removeUser = mock.remove;
  stopSilentRenew = mock.stop;
  clearStaleState = () => Promise.resolve();
}
describe('OIDC session lifecycle', () => {
  let auth: Auth;
  beforeEach(() => {
    vi.clearAllMocks();
    mock.callbacks.clear();
    mock.redirect.mockResolvedValue(undefined);
    mock.remove.mockResolvedValue(undefined);
    mock.logout.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: OIDC_MANAGER,
          useValue: (settings: UserManagerSettings) =>
            new FakeManager(settings) as unknown as UserManager,
        },
        {
          provide: Config,
          useValue: {
            value: {
              issuer: 'https://id.example.test',
              clientId: 'console',
              mfaAcr: 'urn:org:mfa',
            },
          },
        },
      ],
    });
    auth = TestBed.inject(Auth);
    auth.initialize();
  });
  it('uses public code flow without client secret and memory-only User storage', async () => {
    const settings = mock.settings as UserManagerSettings;
    expect(settings.response_type).toBe('code');
    expect(settings.client_secret).toBeUndefined();
    expect(settings.disablePKCE).not.toBe(true);
    expect(settings.automaticSilentRenew).toBe(true);
    await settings.userStore!.set('user', 'jwt-in-memory');
    expect(Object.values(sessionStorage).join()).not.toContain('jwt-in-memory');
    expect(Object.values(localStorage).join()).not.toContain('jwt-in-memory');
  });
  it('safely validates return context during login', async () => {
    await auth.login('//evil.test');
    expect(mock.redirect).toHaveBeenCalledWith({ state: { returnTo: '/dashboard' } });
  });
  it('requests real fresh MFA and does not remember a privileged mutation', async () => {
    await auth.login('/platform/install-plans/123', true);
    expect(mock.redirect).toHaveBeenCalledWith({
      state: { returnTo: '/platform/install-plans/123' },
      prompt: 'login',
      max_age: 0,
      acr_values: 'urn:org:mfa',
    });
  });
  it('receives tokens only through a validated library callback', async () => {
    mock.callback.mockResolvedValue({
      access_token: 'access',
      expired: false,
      state: { returnTo: '/profile' },
    });
    expect(await auth.callback()).toBe('/profile');
    expect(auth.token()).toBe('access');
    expect(auth.state()).toBe('authenticated');
  });
  it('fails closed on callback error without a redirect loop', async () => {
    mock.callback.mockRejectedValue(new Error('unsafe remote error'));
    await expect(auth.callback()).rejects.toThrow('Не удалось завершить вход');
    expect(auth.state()).toBe('error');
    expect(auth.token()).toBeNull();
    expect(mock.redirect).not.toHaveBeenCalled();
  });
  it.each(['expired', 'renewError'])('clears tokens and scope on %s', async (event) => {
    mock.callback.mockResolvedValue({ access_token: 'access', expired: false, state: {} });
    await auth.callback();
    const previous = TestBed.inject(RequestScope).epoch();
    mock.callbacks.get(event)!();
    expect(auth.token()).toBeNull();
    expect(auth.state()).toBe('expired');
    expect(TestBed.inject(RequestScope).epoch()).toBeGreaterThan(previous);
  });
  it('exposes refreshing state without persisting a refresh token', async () => {
    mock.callback.mockResolvedValue({ access_token: 'access', expired: false, state: {} });
    await auth.callback();
    mock.callbacks.get('expiring')!();
    expect(auth.state()).toBe('refreshing');
    expect(auth.authenticated()).toBe(true);
  });
  it('removes the User before logout, so no ID token is put in URL hints', async () => {
    await auth.logout();
    expect(mock.remove).toHaveBeenCalledOnce();
    expect(mock.logout).toHaveBeenCalledWith({ extraQueryParams: { client_id: 'console' } });
    expect(mock.remove.mock.invocationCallOrder[0]).toBeLessThan(
      mock.logout.mock.invocationCallOrder[0],
    );
  });
});
