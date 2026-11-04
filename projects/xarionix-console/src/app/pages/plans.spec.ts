import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { InstallPlanPage } from './install-plan';
import { runtimeActions } from './runtime';
import { Session } from '../core/session';
import { Clock } from '../core/clock';
import { RequestScope } from '../core/scope';
import { Actions } from '../shared/actions';
import { Installation, InstallPlan, RuntimeDeployment } from '../core/models';
describe('reviewed installation plan authority', () => {
  const now = Date.now();
  const plan = {
    id: '12345678-1234-1234-1234-123456789abc',
    digest: 'a'.repeat(64),
    state: 'pending',
    expires_at: new Date(now + 60000).toISOString(),
    approved_until: null,
    plan: { ready: true, action: 'install', module_id: 'hello', target_version: '1.0.0' },
  } as InstallPlan;
  let page: InstallPlanPage;
  const api = { get: vi.fn(() => of(plan)), post: vi.fn(() => of(plan)) };
  beforeEach(() => {
    vi.useFakeTimers();
    api.post.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Session, useFactory: () => ({ api, scope: TestBed.inject(RequestScope) }) },
        { provide: Clock, useValue: { now: () => now } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => plan.id } } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    page = TestBed.runInInjectionContext(() => new InstallPlanPage());
    page.live.value.set(plan);
  });
  afterEach(() => vi.useRealTimers());
  it('only submits the exact server digest after explicit confirmation', () => {
    page.approve(plan);
    expect(api.post).not.toHaveBeenCalled();
    const dialog = TestBed.inject(Actions).current()!;
    dialog.execute({}).subscribe();
    expect(api.post).toHaveBeenCalledWith(`/platform/module-install-plans/${plan.id}/approve`, {
      digest: plan.digest,
    });
  });
  it('does not approve an expired plan', () => {
    const expired = { ...plan, expires_at: new Date(now - 1).toISOString() };
    page.live.value.set(expired);
    page.approve(expired);
    expect(TestBed.inject(Actions).current()).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('does not approve server blockers', () => {
    const blocked = { ...plan, plan: { ...plan.plan, ready: false } };
    page.live.value.set(blocked);
    page.approve(blocked);
    expect(TestBed.inject(Actions).current()).toBeNull();
  });
  it('refreshes through the real new-snapshot endpoint rather than extending approval locally', () => {
    page.refresh(plan);
    TestBed.inject(Actions).current()!.execute({}).subscribe();
    expect(api.post).toHaveBeenCalledWith(`/platform/module-install-plans/${plan.id}/refresh`);
  });
});
describe('runtime actions follow the actual Core lifecycle', () => {
  const installed = {
    status: 'installed_disabled',
    runtime: { mode: 'oci_v1' },
    package_id: 'new',
  } as unknown as Installation;
  it('can provision a disabled installation before enable, avoiding a false frontend deadlock', () =>
    expect(runtimeActions(null, installed)).toEqual(['provision', 'start']));
  it('does not provision removed metadata or unsupported runtime modes', () => {
    expect(runtimeActions(null, { ...installed, status: 'removed' })).toEqual([]);
    expect(runtimeActions(null, { ...installed, runtime: { mode: 'external_agent' } })).toEqual([]);
  });
  it('requires stop before deprovision in normal running state', () => {
    const runtime = {
      desired: 'running',
      observed: 'running',
      package_id: 'new',
    } as RuntimeDeployment;
    expect(runtimeActions(runtime, installed)).toContain('stop');
    expect(runtimeActions(runtime, installed)).not.toContain('deprovision');
  });
  it('offers terminal safety inspection without normal restart', () => {
    const runtime = { desired: 'retired', observed: 'stopped' } as RuntimeDeployment;
    expect(runtimeActions(runtime, installed)).toEqual(['inspect', 'stop', 'deprovision']);
  });
});
