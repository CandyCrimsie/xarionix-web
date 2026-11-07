import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { of, throwError } from 'rxjs';
import { Session } from '../core/session';
import { Auth } from '../core/auth';
import { RequestScope } from '../core/scope';
import { CoreError } from '../core/errors';
import { ModuleStoragePanel } from './module-storage-panel';

describe('persistent storage controls', () => {
  let fixture: ComponentFixture<ModuleStoragePanel>;
  const api = { get: vi.fn() };
  const state = {
    allocation: {
      maximum_bytes: 67108864,
      data_schema_version: 1,
      revision: 3,
      retained_epoch_count: 0,
    },
    items: [
      {
        id: 'backup-a',
        package_version: '1.1.0',
        data_schema_version: 1,
        size: 8192,
        created_at: '2026-11-06T00:00:00Z',
      },
    ],
    limit: 20,
    offset: 0,
  };
  beforeEach(() => {
    vi.useFakeTimers();
    api.get.mockReset();
    api.get.mockReturnValue(of(state));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideSpartanHlm(),
        { provide: Auth, useValue: {} },
        { provide: Session, useValue: { api } },
      ],
    });
    fixture = TestBed.createComponent(ModuleStoragePanel);
    fixture.componentRef.setInput('installationId', 'installation-a');
    fixture.componentRef.setInput('runtime', { observed: 'running', desired: 'running' });
  });
  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });
  async function load() {
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }
  it('keeps backup disabled for a running writer and enables it after an observed stop', async () => {
    await load();
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
      (b as HTMLButtonElement).textContent?.includes('Подготовить резервную копию'),
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const emit = vi.fn();
    fixture.componentInstance.prepare.subscribe(emit);
    fixture.componentRef.setInput('runtime', { observed: 'stopped', desired: 'stopped' });
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    button.click();
    expect(emit).toHaveBeenCalledWith({ action: 'backup' });
  });
  it('restores only a displayed backup with a stopped writer', async () => {
    await load();
    const emit = vi.fn();
    fixture.componentInstance.prepare.subscribe(emit);
    fixture.componentInstance.restore('backup-a');
    expect(emit).not.toHaveBeenCalled();
    fixture.componentRef.setInput('runtime', { observed: 'stopped', desired: 'stopped' });
    fixture.detectChanges();
    fixture.componentInstance.restore('foreign');
    expect(emit).not.toHaveBeenCalled();
    fixture.componentInstance.restore('backup-a');
    expect(emit).toHaveBeenCalledWith({ action: 'restore', backupId: 'backup-a' });
    TestBed.inject(RequestScope).invalidate();
    fixture.componentInstance.restore('backup-a');
    expect(emit).toHaveBeenCalledTimes(1);
  });
  it('shows an API failure and stops polling instead of claiming a backup exists', async () => {
    api.get.mockReturnValue(
      throwError(() => new CoreError(403, 'platform_admin_required', 'Нет доступа')),
    );
    await load();
    expect(fixture.nativeElement.textContent).toContain('Нет доступа');
    await vi.advanceTimersByTimeAsync(20000);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.live.value()).toBeNull();
  });
});
