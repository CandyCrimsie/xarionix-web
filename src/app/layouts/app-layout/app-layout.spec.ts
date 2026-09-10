import {
  signal,
} from '@angular/core';

import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import {
  provideRouter,
} from '@angular/router';

import {
  of,
} from 'rxjs';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AuthService,
} from '../../core/auth/auth.service';

import {
  CompanyContextService,
} from '../../core/company/company-context.service';

import {
  PermissionService,
} from '../../core/permissions/permission.service';

import {
  AppLayout,
} from './app-layout';


describe(
  'AppLayout',
  () => {
    let component:
      AppLayout;

    let fixture:
      ComponentFixture<AppLayout>;

    const canManageMembers =
      signal(false);

    const auth = {
      user: signal(null).asReadonly(),

      logout:
        vi.fn(() =>
          of(undefined),
        ),
    };

    const companyContext = {
      activeCompany:
        signal(null).asReadonly(),

      activeCompanyId:
        signal<number | null>(
          null,
        ).asReadonly(),

      availableCompanies:
        signal([]).asReadonly(),

      switchCompany:
        vi.fn(),

      reset:
        vi.fn(),
    };

    const permissions = {
      canSignal:
        vi.fn(
          () =>
            canManageMembers
              .asReadonly(),
        ),
    };


    beforeEach(async () => {
      vi.clearAllMocks();

      canManageMembers.set(
        false,
      );

      await TestBed
        .configureTestingModule({
          imports: [
            AppLayout,
          ],

          providers: [
            provideRouter([]),

            {
              provide:
                AuthService,

              useValue:
                auth,
            },

            {
              provide:
                CompanyContextService,

              useValue:
                companyContext,
            },

            {
              provide:
                PermissionService,

              useValue:
                permissions,
            },
          ],
        })
        .compileComponents();

      fixture =
        TestBed.createComponent(
          AppLayout,
        );

      component =
        fixture.componentInstance;

      fixture.detectChanges();
    });


    it(
      'should create',
      () => {
        expect(
          component,
        ).toBeTruthy();
      },
    );


    it(
      'should hide members navigation without members manage permission',
      () => {
        const element = fixture.nativeElement as HTMLElement;

        expect(
          element.querySelector(
            '[data-testid="employees-group"]',
          ),
        ).toBeNull();

        expect(
          element.querySelector(
            '[data-testid="invite-nav-item"]',
          ),
        ).toBeNull();
      },
    );


    it(
      'should show members navigation with members manage permission',
      () => {
        canManageMembers.set(
          true,
        );

        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;

        expect(
          element.querySelector(
            '[data-testid="employees-group"]',
          ),
        ).not.toBeNull();

        expect(
          element.querySelector(
            '[data-testid="invite-nav-item"]',
          ),
        ).not.toBeNull();
      },
    );


    it(
      'should reactively hide members navigation when permission is lost',
      () => {
        canManageMembers.set(
          true,
        );

        fixture.detectChanges();

        let element = fixture.nativeElement as HTMLElement;

        expect(
          element.querySelector(
            '[data-testid="invite-nav-item"]',
          ),
        ).not.toBeNull();


        canManageMembers.set(
          false,
        );

        fixture.detectChanges();

        element = fixture.nativeElement as HTMLElement;

        expect(
          element.querySelector(
            '[data-testid="employees-group"]',
          ),
        ).toBeNull();

        expect(
          element.querySelector(
            '[data-testid="invite-nav-item"]',
          ),
        ).toBeNull();
      },
    );
  },
);