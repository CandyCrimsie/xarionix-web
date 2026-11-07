import { validateConfig } from './config';
import { safeReturn } from './auth';
import { uuid, runtimeFresh, RuntimeDeployment } from './models';
import { reportNodes } from '../shared/report';
const origin = 'https://console.example.test';
const config = {
  development: false,
  coreApi: '/core-api/api/v1',
  coreHealth: '/core-api',
  issuer: 'https://id.example.test/realms/xarionix',
  clientId: 'console',
  mfaAcr: 'urn:company:mfa',
  maxPackageBytes: 1024,
};
describe('public configuration and trust boundaries', () => {
  it('accepts explicit same-origin Core and HTTPS issuer', () =>
    expect(validateConfig(config, origin)).toEqual(config));
  it.each([
    'http://example.test/realms/x',
    'javascript:alert(1)',
    'https://u:p@id.example.test',
    'https://id.example.test?secret=x',
  ])('rejects unsafe issuer %s', (issuer) =>
    expect(() => validateConfig({ ...config, issuer }, origin)).toThrow(),
  );
  it('rejects a cross-origin Core even with HTTPS', () =>
    expect(() =>
      validateConfig({ ...config, coreApi: 'https://other.test/api/v1' }, origin),
    ).toThrow());
  it('rejects accidental secrets or unknown fields', () =>
    expect(() => validateConfig({ ...config, clientSecret: 'never' }, origin)).toThrow());
  it('requires explicit dev mode for HTTP loopback', () => {
    const dev = { ...config, development: true, issuer: 'http://localhost:8090/realms/x' };
    expect(validateConfig(dev, 'http://localhost:4300')).toEqual(dev);
    expect(() => validateConfig({ ...dev, development: false }, 'http://localhost:4300')).toThrow();
  });
  it.each([0, -1, 134217729, 1.5, '1000'])('rejects invalid upload bound %s', (maxPackageBytes) =>
    expect(() => validateConfig({ ...config, maxPackageBytes }, origin)).toThrow(),
  );
  it.each([
    '//evil.test',
    'https://evil.test',
    '/\\evil.test',
    '/auth/callback?code=x',
    '/login?returnTo=x',
    '/dash\nboard',
  ])('rejects open redirect %s', (value) => expect(safeReturn(value)).toBe('/dashboard'));
  it('keeps safe plan context after a fresh login', () =>
    expect(safeReturn('/platform/install-plans/123')).toBe('/platform/install-plans/123'));
  it('does not accept ERP integer IDs as Core company IDs', () => {
    expect(() => uuid('123')).toThrow();
    expect(uuid('12345678-1234-1234-1234-123456789abc')).toContain('-');
  });
  it('renders untrusted metadata as bounded text nodes', () => {
    const nodes = reportNodes({ name: '<img src=x onerror=alert(1)>' });
    expect(nodes[0].text).toBe('<img src=x onerror=alert(1)>');
    expect(reportNodes(Array.from({ length: 1000 }, () => 1))).toHaveLength(100);
  });
  it('does not infer healthy from stale, mismatched generations or digest', () => {
    const now = Date.now();
    const runtime = {
      last_seen: new Date(now - 1000).toISOString(),
      generation: 2,
      observed_generation: 2,
      image_digest: 'a',
      observed_image_digest: 'a',
    } as RuntimeDeployment;
    expect(runtimeFresh(runtime, now)).toBe(true);
    for (const change of [
      { last_seen: new Date(now - 100000).toISOString() },
      { observed_generation: 1 },
      { observed_image_digest: 'b' },
      { last_seen: null },
    ])
      expect(runtimeFresh({ ...runtime, ...change }, now)).toBe(false);
  });
});
