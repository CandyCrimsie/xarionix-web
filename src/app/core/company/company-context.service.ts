import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  catchError,
  map,
  Observable,
  of,
  tap,
  Subject
} from 'rxjs';

import { API_BASE_URL } from '../api/api.config';

import { AuthService } from '../auth/auth.service';

import { Company } from './company.models';


@Injectable({
  providedIn: 'root',
})
export class CompanyContextService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _availableCompanies = signal<Company[]>([]);

  private readonly _activeCompany = signal<Company | null>(null);

  private readonly _companyChanged = new Subject<number | null>();

  readonly companyChanged$ = this._companyChanged.asObservable();


  readonly availableCompanies = this._availableCompanies.asReadonly();

  readonly activeCompany = this._activeCompany.asReadonly();

  readonly activeCompanyId = computed(() => this._activeCompany()?.id ?? null,);
  readonly hasCompanies = computed(() => this._availableCompanies().length > 0,);


  initialize(): Observable<void> {
    if (!this.auth.isAuthenticated()) {
      this.reset();

      return of(undefined);
    }

    return this.loadAvailableCompanies().pipe(
      map(() => undefined),

      catchError(() => {
        this.reset();

        return of(undefined);
      }),
    );
  }


  loadAvailableCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(
      `${API_BASE_URL}/me/companies`,
    ).pipe(
      tap(companies => {
        this._availableCompanies.set(
          companies,
        );

        this.restoreActiveCompany(
          companies,
        );
      }),
    );
  }


  switchCompany(
    companyId: number,
  ): void {
    const company =
      this._availableCompanies().find(
        item => item.id === companyId,
      );

    if (!company) {
      throw new Error(
        'Company is not available for current user',
      );
    }

    if (
      this._activeCompany()?.id === company.id
    ) {
      return;
    }

    this._activeCompany.set(company);

    this.storeActiveCompanyId(
      company.id,
    );

    this._companyChanged.next(
      company.id,
    );
  }


  reset(): void {
    this._availableCompanies.set([]);
    this._activeCompany.set(null);

    this._companyChanged.next(null);
  }

  private restoreActiveCompany(
    companies: Company[],
  ): void {
    if (companies.length === 0) {
      this._activeCompany.set(null);

      return;
    }

    const storedCompanyId =
      this.getStoredActiveCompanyId();

    const storedCompany =
      storedCompanyId !== null
        ? companies.find(
          company =>
            company.id === storedCompanyId,
        )
        : undefined;

    const company =
      storedCompany ?? companies[0];

    this._activeCompany.set(company);

    this.storeActiveCompanyId(
      company.id,
    );
  }


  private getStoredActiveCompanyId():
    number | null {
    const key = this.getStorageKey();

    if (!key) {
      return null;
    }

    const value =
      localStorage.getItem(key);

    if (!value) {
      return null;
    }

    const companyId = Number(value);

    if (!Number.isInteger(companyId)) {
      return null;
    }

    if (companyId <= 0) {
      return null;
    }

    return companyId;
  }


  private storeActiveCompanyId(
    companyId: number,
  ): void {
    const key = this.getStorageKey();

    if (!key) {
      return;
    }

    localStorage.setItem(
      key,
      String(companyId),
    );
  }


  private getStorageKey(): string | null {
    const user = this.auth.user();

    if (!user) {
      return null;
    }

    return `erp.active-company-id:${user.id}`;
  }
}
