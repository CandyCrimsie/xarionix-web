import { Injectable, computed, inject } from '@angular/core';
import { from, map } from 'rxjs';
import { ErpBridge } from './bridge';

/** Numeric IDs originate exclusively from ERP's verified platform-context response. */
@Injectable({ providedIn: 'root' })
export class PlatformErpCompanyContext {
  private readonly bridge = inject(ErpBridge);
  readonly companyChanged$ = this.bridge.changed.asObservable();
  readonly activeCompany = computed(() => this.bridge.context()?.company ?? null);
  readonly activeCompanyId = computed(() => this.activeCompany()?.id ?? null);
  readonly availableCompanies = computed(() =>
    this.activeCompany() ? [this.activeCompany()!] : [],
  );
  readonly hasCompanies = computed(() => !!this.activeCompany());
  initialize() {
    return from(this.bridge.load());
  }
  loadAvailableCompanies() {
    return from(this.bridge.load()).pipe(map(() => this.availableCompanies()));
  }
  reset() {
    this.bridge.reset();
  }
  switchCompany(id: number) {
    if (id !== this.activeCompanyId()) throw new Error('Выберите компанию в Xarionix');
  }
}
