import { Injectable, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Auth } from './auth';
import { CoreApi } from './api';
import { coreError, CoreError } from './errors';
import { RequestScope } from './scope';
import type { Company, EffectivePermissions, PlatformSettings, Profile, UUID } from './models';

@Injectable({ providedIn: 'root' })
export class Session {
  readonly auth = inject(Auth);
  readonly api = inject(CoreApi);
  readonly scope = inject(RequestScope);
  readonly profile = signal<Profile | null>(null);
  readonly company = signal<Company | null>(null);
  readonly permissions = signal<EffectivePermissions | null>(null);
  readonly admin = signal<'unknown' | 'allowed' | 'mfa' | 'denied'>('unknown');
  readonly loading = signal(false);
  readonly error = signal<CoreError | null>(null);
  readonly human = computed(
    () => this.profile()?.principal_type === 'human' && this.profile()?.status === 'active',
  );
  constructor() {
    const denied = this.scope.denied.subscribe(({ path, mfa }) => {
      if (path.includes('/companies/')) this.permissions.set(null);
      if (path.includes('/platform/')) this.admin.set(mfa ? 'mfa' : 'denied');
    });
    inject(DestroyRef).onDestroy(() => denied.unsubscribe());
    effect(() => {
      if (!this.auth.authenticated()) {
        this.profile.set(null);
        this.company.set(null);
        this.permissions.set(null);
        this.admin.set('unknown');
      }
    });
  }
  can(key: string): boolean {
    return !!this.permissions()?.permissions.includes(key);
  }
  async load(): Promise<void> {
    const epoch = this.scope.epoch();
    this.loading.set(true);
    this.error.set(null);
    try {
      const profile = await firstValueFrom(this.api.get<Profile>('/me'));
      if (epoch !== this.scope.epoch()) return;
      this.profile.set(profile);
      if (profile.principal_type === 'human') await this.probeAdmin();
    } catch (error) {
      if (epoch === this.scope.epoch()) this.error.set(coreError(error));
    } finally {
      if (epoch === this.scope.epoch()) this.loading.set(false);
    }
  }
  async probeAdmin(): Promise<void> {
    const epoch = this.scope.epoch();
    try {
      await firstValueFrom(this.api.get<PlatformSettings>('/platform/settings'));
      if (epoch === this.scope.epoch()) this.admin.set('allowed');
    } catch (error) {
      if (epoch !== this.scope.epoch()) return;
      const e = coreError(error);
      this.admin.set(e.mfa ? 'mfa' : e.code === 'platform_admin_required' ? 'denied' : 'unknown');
    }
  }
  async select(company: Company): Promise<void> {
    this.scope.invalidate();
    const epoch = this.scope.epoch();
    this.company.set(company);
    this.permissions.set(null);
    this.error.set(null);
    try {
      const permissions = await firstValueFrom(
        this.api.get<EffectivePermissions>(`/companies/${company.id}/me/permissions`),
      );
      if (epoch === this.scope.epoch()) this.permissions.set(permissions);
    } catch (error) {
      if (epoch === this.scope.epoch()) this.error.set(coreError(error));
    }
  }
  async revalidate(): Promise<void> {
    const company = this.company();
    if (company) {
      const epoch = this.scope.epoch();
      this.permissions.set(null);
      try {
        const permissions = await firstValueFrom(
          this.api.get<EffectivePermissions>(`/companies/${company.id}/me/permissions`),
        );
        if (epoch === this.scope.epoch()) this.permissions.set(permissions);
      } catch (error) {
        if (epoch === this.scope.epoch()) this.error.set(coreError(error));
      }
    } else await this.probeAdmin();
  }
  async ensureCompany(id: UUID): Promise<void> {
    if (this.company()?.id === id) {
      await this.revalidate();
      return;
    }
    await this.select(await firstValueFrom(this.api.get<Company>(`/companies/${id}`)));
  }
}
