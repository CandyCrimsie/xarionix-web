import {
  signal,
  computed
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

import {
  PermissionCode,
  PermissionScope,
  PermissionState,
} from '../../core/permissions/permission.models';


describe(
  'AppLayout',
  () => {
    let component:
      AppLayout;

    let fixture:
      ComponentFixture<AppLayout>;

    const canManageMembers =
      signal(false);

    const canReadMembers =
      signal(false);

    const canReadUnits =
      signal(false);

    const canReadRoles =
      signal(false);

    const permissionState =
      signal<PermissionState>(
        'ready',
      );

    const auth = {
      user: signal(null).asReadonly(),

      logout:
        vi.fn(() =>
          of(undefined),
        ),
    };

    const activeCompanyId =
      signal<number | null>(
        null,
      );

    const companyContext = {
      activeCompany:
        signal(null).asReadonly(),

      activeCompanyId:
        activeCompanyId
          .asReadonly(),

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
          (
            permission:
              PermissionCode,

            minimumScope?:
              PermissionScope,
          ) => {
            if (
              permission
              === PermissionCode.MembersRead
            ) {
              return canReadMembers
                .asReadonly();
            }

            if (
              permission
              === PermissionCode.MembersManage
            ) {
              return canManageMembers
                .asReadonly();
            }

            if (
              permission
              === PermissionCode.RolesRead
              && minimumScope
              === PermissionScope.Company
            ) {
              return canReadRoles
                .asReadonly();
            }

            if (
              permission
              === PermissionCode
                .OrganizationalUnitsRead
            ) {
              return canReadUnits
                .asReadonly();
            }

            return signal(
              false,
            ).asReadonly();
          },
        ),

      state:
        permissionState
          .asReadonly(),

      isLoading:
        computed(
          () =>
            permissionState()
            === 'loading',
        ),

      initialize:
        vi.fn(
          () =>
            of(undefined),
        ),
    };


    beforeEach(async () => {
      vi.clearAllMocks();

      canReadUnits.set(
        false,
      );

      canReadMembers.set(
        false,
      );

      canManageMembers.set(
        false,
      );

      permissionState.set(
        'ready',
      );

      activeCompanyId.set(
        null,
      );

      canReadRoles.set(
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

    it(
      'should show permission loading state',
      () => {
        permissionState.set(
          'loading',
        );

        fixture.detectChanges();

        const element:
          HTMLElement =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="permissions-loading"]',
          ),
        ).not.toBeNull();

        expect(
          element.querySelector(
            '[data-testid="permissions-error"]',
          ),
        ).toBeNull();
      },
    );


    it(
      'should show permission error state',
      () => {
        permissionState.set(
          'error',
        );

        fixture.detectChanges();

        const element:
          HTMLElement =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="permissions-error"]',
          ),
        ).not.toBeNull();

        expect(
          element.querySelector(
            '[data-testid="permissions-retry"]',
          ),
        ).not.toBeNull();

        expect(
          element.querySelector(
            '[data-testid="permissions-loading"]',
          ),
        ).toBeNull();
      },
    );


    it(
      'should retry permission initialization',
      () => {
        permissionState.set(
          'error',
        );

        fixture.detectChanges();

        const element:
          HTMLElement =
          fixture.nativeElement;

        const retryButton =
          element.querySelector<HTMLButtonElement>(
            '[data-testid="permissions-retry"]',
          );

        expect(
          retryButton,
        ).not.toBeNull();

        retryButton?.click();

        expect(
          permissions.initialize,
        ).toHaveBeenCalledTimes(1);
      },
    );


    it(
      'should hide permission status when permissions are ready',
      () => {
        permissionState.set(
          'loading',
        );

        fixture.detectChanges();

        expect(
          fixture.nativeElement.querySelector(
            '[data-testid="permissions-loading"]',
          ),
        ).not.toBeNull();


        permissionState.set(
          'ready',
        );

        fixture.detectChanges();

        expect(
          fixture.nativeElement.querySelector(
            '[data-testid="permissions-loading"]',
          ),
        ).toBeNull();

        expect(
          fixture.nativeElement.querySelector(
            '[data-testid="permissions-error"]',
          ),
        ).toBeNull();
      },
    );

    it(
      'should disable company switcher while permissions are loading',
      () => {
        permissionState.set(
          'loading',
        );

        fixture.detectChanges();

        const element:
          HTMLElement =
          fixture.nativeElement;

        const trigger =
          element.querySelector<HTMLButtonElement>(
            '[data-testid="company-switcher-trigger"]',
          );

        expect(
          trigger,
        ).not.toBeNull();

        expect(
          trigger?.disabled,
        ).toBe(true);
      },
    );


    it(
      'should enable company switcher when permissions are ready',
      () => {
        permissionState.set(
          'ready',
        );

        fixture.detectChanges();

        const element:
          HTMLElement =
          fixture.nativeElement;

        const trigger =
          element.querySelector<HTMLButtonElement>(
            '[data-testid="company-switcher-trigger"]',
          );

        expect(
          trigger,
        ).not.toBeNull();

        expect(
          trigger?.disabled,
        ).toBe(false);
      },
    );


    it(
      'should ignore company switch while permissions are loading',
      () => {
        permissionState.set(
          'loading',
        );

        fixture.detectChanges();

        component.switchCompany(
          2,
        );

        expect(
          companyContext.switchCompany,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      'should allow company switch when permissions are ready',
      () => {
        permissionState.set(
          'ready',
        );

        component.switchCompany(
          2,
        );

        expect(
          companyContext.switchCompany,
        ).toHaveBeenCalledTimes(1);

        expect(
          companyContext.switchCompany,
        ).toHaveBeenCalledWith(
          2,
        );
      },
    );


    it(
      'should ignore switch to already active company',
      () => {
        activeCompanyId.set(
          2,
        );

        component.switchCompany(
          2,
        );

        expect(
          companyContext.switchCompany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'should hide roles navigation without roles read permission',
      () => {
        const element:
          HTMLElement =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="roles-nav-item"]',
          ),
        ).toBeNull();
      },
    );


    it(
      'should show roles navigation with roles read company permission',
      () => {
        canReadRoles.set(
          true,
        );

        fixture.detectChanges();

        const element:
          HTMLElement =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="roles-nav-item"]',
          ),
        ).not.toBeNull();

        expect(
          permissions.canSignal,
        ).toHaveBeenCalledWith(
          PermissionCode.RolesRead,
          PermissionScope.Company,
        );
      },
    );

    it(
      'should show members navigation with members read permission',
      () => {
        canReadMembers.set(
          true,
        );

        fixture.detectChanges();


        const element:
          HTMLElement =
          fixture.nativeElement;


        expect(
          element.querySelector(
            '[data-testid="employees-group"]',
          ),
        ).not.toBeNull();

        expect(
          element.querySelector(
            '[data-testid="members-nav-item"]',
          ),
        ).not.toBeNull();

        expect(
          element.querySelector(
            '[data-testid="invite-nav-item"]',
          ),
        ).toBeNull();


        expect(
          permissions.canSignal,
        ).toHaveBeenCalledWith(
          PermissionCode.MembersRead,
        );
      },
    );


    it(
      'should hide members navigation when members read permission is lost',
      () => {
        canReadMembers.set(
          true,
        );

        fixture.detectChanges();


        expect(
          fixture.nativeElement
            .querySelector(
              '[data-testid="members-nav-item"]',
            ),
        ).not.toBeNull();


        canReadMembers.set(
          false,
        );

        fixture.detectChanges();


        expect(
          fixture.nativeElement
            .querySelector(
              '[data-testid="members-nav-item"]',
            ),
        ).toBeNull();
      },
    );

    it(
      'should show organizational units navigation with read permission',
      () => {
        canReadUnits.set(
          true,
        );

        fixture.detectChanges();


        const element:
          HTMLElement =
          fixture.nativeElement;


        expect(
          element.querySelector(
            '[data-testid="employees-group"]',
          ),
        ).not.toBeNull();

        expect(
          element.querySelector(
            '[data-testid="organizational-units-nav-item"]',
          ),
        ).not.toBeNull();


        expect(
          permissions.canSignal,
        ).toHaveBeenCalledWith(
          PermissionCode
            .OrganizationalUnitsRead,
        );
      },
    );


    it(
      'should hide organizational units navigation when permission is lost',
      () => {
        canReadUnits.set(
          true,
        );

        fixture.detectChanges();


        expect(
          fixture.nativeElement
            .querySelector(
              '[data-testid="organizational-units-nav-item"]',
            ),
        ).not.toBeNull();


        canReadUnits.set(
          false,
        );

        fixture.detectChanges();


        expect(
          fixture.nativeElement
            .querySelector(
              '[data-testid="organizational-units-nav-item"]',
            ),
        ).toBeNull();
      },
    );
  },
);