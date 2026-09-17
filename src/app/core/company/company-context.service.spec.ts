import {
  TestBed,
} from '@angular/core/testing';

import {
  HttpClient,
} from '@angular/common/http';

import {
  firstValueFrom,
  of,
} from 'rxjs';

import {
  AuthService,
} from '../auth/auth.service';

import type {
  Company,
} from './company.models';

import {
  CompanyContextService,
} from './company-context.service';


describe(
  'CompanyContextService',
  () => {
    let service:
      CompanyContextService;


    const http = {
      get:
        vi.fn(),
    };


    const auth = {
      isAuthenticated:
        vi.fn(
          () => true,
        ),

      user:
        vi.fn(
          () => ({
            id:
              100,

            username:
              'admin',

            is_active:
              true,

            is_system_admin:
              true,

            created_at:
              '2026-01-01T00:00:00Z',

            updated_at:
              '2026-01-01T00:00:00Z',
          }),
        ),
    };


    const companyA:
      Company = {
      id:
        1,

      parent_id:
        null,

      name:
        'Company A',

      short_name:
        'A',

      is_active:
        true,

      created_at:
        '2026-01-01T00:00:00Z',

      updated_at:
        '2026-01-01T00:00:00Z',
    };


    const companyB:
      Company = {
      id:
        2,

      parent_id:
        null,

      name:
        'Company B',

      short_name:
        'B',

      is_active:
        true,

      created_at:
        '2026-01-01T00:00:00Z',

      updated_at:
        '2026-01-01T00:00:00Z',
    };


    beforeEach(
      () => {
        localStorage.clear();

        vi.clearAllMocks();


        TestBed
          .configureTestingModule({
            providers: [
              {
                provide:
                  HttpClient,

                useValue:
                  http,
              },

              {
                provide:
                  AuthService,

                useValue:
                  auth,
              },
            ],
          });


        service =
          TestBed.inject(
            CompanyContextService,
          );
      },
    );


    afterEach(
      () => {
        localStorage.clear();
      },
    );


    it(
      'should initialize available companies and select first company',
      async () => {
        http.get
          .mockReturnValue(
            of([
              companyA,
              companyB,
            ]),
          );


        await firstValueFrom(
          service.initialize(),
        );


        expect(
          service
            .availableCompanies(),
        ).toEqual([
          companyA,
          companyB,
        ]);


        expect(
          service
            .activeCompany(),
        ).toEqual(
          companyA,
        );


        expect(
          service
            .activeCompanyId(),
        ).toBe(
          companyA.id,
        );
      },
    );


    it(
      'should preserve active company when refreshed companies still contain it',
      async () => {
        http.get
          .mockReturnValueOnce(
            of([
              companyA,
              companyB,
            ]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        service.switchCompany(
          companyB.id,
        );


        const emittedCompanyIds:
          Array<number | null> =
          [];


        const subscription =
          service
            .companyChanged$
            .subscribe(
              companyId => {
                emittedCompanyIds
                  .push(
                    companyId,
                  );
              },
            );


        http.get
          .mockReturnValueOnce(
            of([
              companyA,
              companyB,
            ]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        expect(
          service
            .activeCompanyId(),
        ).toBe(
          companyB.id,
        );


        expect(
          emittedCompanyIds,
        ).toEqual([]);


        subscription
          .unsubscribe();
      },
    );


    it(
      'should switch to first available company and emit change when active company disappears',
      async () => {
        http.get
          .mockReturnValueOnce(
            of([
              companyA,
              companyB,
            ]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        service.switchCompany(
          companyB.id,
        );


        expect(
          service
            .activeCompanyId(),
        ).toBe(
          companyB.id,
        );


        const emittedCompanyIds:
          Array<number | null> =
          [];


        const subscription =
          service
            .companyChanged$
            .subscribe(
              companyId => {
                emittedCompanyIds
                  .push(
                    companyId,
                  );
              },
            );


        http.get
          .mockReturnValueOnce(
            of([
              companyA,
            ]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        expect(
          service
            .availableCompanies(),
        ).toEqual([
          companyA,
        ]);


        expect(
          service
            .activeCompanyId(),
        ).toBe(
          companyA.id,
        );


        expect(
          emittedCompanyIds,
        ).toEqual([
          companyA.id,
        ]);


        subscription
          .unsubscribe();
      },
    );


    it(
      'should clear active company and emit null when no companies remain',
      async () => {
        http.get
          .mockReturnValueOnce(
            of([
              companyA,
            ]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        expect(
          service
            .activeCompanyId(),
        ).toBe(
          companyA.id,
        );


        const emittedCompanyIds:
          Array<number | null> =
          [];


        const subscription =
          service
            .companyChanged$
            .subscribe(
              companyId => {
                emittedCompanyIds
                  .push(
                    companyId,
                  );
              },
            );


        http.get
          .mockReturnValueOnce(
            of([]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        expect(
          service
            .availableCompanies(),
        ).toEqual([]);


        expect(
          service
            .activeCompany(),
        ).toBeNull();


        expect(
          service
            .activeCompanyId(),
        ).toBeNull();


        expect(
          emittedCompanyIds,
        ).toEqual([
          null,
        ]);


        subscription
          .unsubscribe();
      },
    );


    it(
      'should add new available company without changing active company',
      async () => {
        http.get
          .mockReturnValueOnce(
            of([
              companyA,
            ]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        const emittedCompanyIds:
          Array<number | null> =
          [];


        const subscription =
          service
            .companyChanged$
            .subscribe(
              companyId => {
                emittedCompanyIds
                  .push(
                    companyId,
                  );
              },
            );


        http.get
          .mockReturnValueOnce(
            of([
              companyA,
              companyB,
            ]),
          );


        await firstValueFrom(
          service
            .loadAvailableCompanies(),
        );


        expect(
          service
            .availableCompanies(),
        ).toEqual([
          companyA,
          companyB,
        ]);


        expect(
          service
            .activeCompanyId(),
        ).toBe(
          companyA.id,
        );


        expect(
          emittedCompanyIds,
        ).toEqual([]);


        subscription
          .unsubscribe();
      },
    );
  },
);