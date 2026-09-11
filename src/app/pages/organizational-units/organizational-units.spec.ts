import {
    signal,
} from '@angular/core';

import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
    of,
    throwError,
} from 'rxjs';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    CompanyContextService,
} from '../../core/company/company-context.service';

import {
    OrganizationalUnitApiService,
} from '../../core/organizational-units/organizational-unit-api.service';

import {
    OrganizationalUnitType,
} from '../../core/organizational-units/organizational-unit.models';

import type {
    OrganizationalUnit,
} from '../../core/organizational-units/organizational-unit.models';

import {
    PermissionCode,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    OrganizationalUnits,
} from './organizational-units';


describe(
    'OrganizationalUnits',
    () => {
        let fixture:
            ComponentFixture<
                OrganizationalUnits
            >;

        let component:
            OrganizationalUnits;


        const activeCompanyId =
            signal<number | null>(
                1,
            );

        const canReadUnits =
            signal(true);


        const support:
            OrganizationalUnit = {
            id: 4,
            company_id: 1,
            parent_id: null,

            name:
                'Support',

            type:
                OrganizationalUnitType
                    .Department,

            is_active:
                true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const supportL1:
            OrganizationalUnit = {
            id: 5,
            company_id: 1,
            parent_id: 4,

            name:
                'Support L1',

            type:
                OrganizationalUnitType
                    .Team,

            is_active:
                true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const unitApi = {
            list:
                vi.fn(),
        };


        const companyContext = {
            activeCompanyId:
                activeCompanyId
                    .asReadonly(),
        };


        const permissions = {
            can:
                vi.fn(
                    (
                        permission:
                            PermissionCode,
                    ) =>
                    (
                        permission
                        === PermissionCode
                            .OrganizationalUnitsRead
                        && canReadUnits()
                    ),
                ),
        };


        beforeEach(async () => {
            vi.clearAllMocks();

            activeCompanyId.set(
                1,
            );

            canReadUnits.set(
                true,
            );


            unitApi.list
                .mockReturnValue(
                    of([
                        support,
                        supportL1,
                    ]),
                );


            await TestBed
                .configureTestingModule({
                    imports: [
                        OrganizationalUnits,
                    ],

                    providers: [
                        {
                            provide:
                                OrganizationalUnitApiService,

                            useValue:
                                unitApi,
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
                    OrganizationalUnits,
                );

            component =
                fixture.componentInstance;

            fixture.detectChanges();
        });


        it(
            'should load units for active company',
            () => {
                expect(
                    unitApi.list,
                ).toHaveBeenCalledWith(
                    1,
                );

                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.units(),
                ).toEqual([
                    support,
                    supportL1,
                ]);
            },
        );


        it(
            'should build visible hierarchy',
            () => {
                const rows =
                    component.rows();


                expect(
                    rows.map(
                        row => ({
                            id:
                                row.unit.id,

                            depth:
                                row.depth,
                        }),
                    ),
                ).toEqual([
                    {
                        id: 4,
                        depth: 0,
                    },
                    {
                        id: 5,
                        depth: 1,
                    },
                ]);


                const childRow =
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="organizational-unit-row-5"]',
                        );


                expect(
                    childRow?.getAttribute(
                        'data-depth',
                    ),
                ).toBe(
                    '1',
                );
            },
        );


        it(
            'should treat unit with hidden parent as visible root',
            () => {
                const scopedUnit:
                    OrganizationalUnit = {
                    ...supportL1,

                    parent_id:
                        999,
                };


                unitApi.list
                    .mockReturnValue(
                        of([
                            scopedUnit,
                        ]),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.rows(),
                ).toEqual([
                    {
                        unit:
                            scopedUnit,

                        depth:
                            0,
                    },
                ]);
            },
        );


        it(
            'should clear units when permission is lost',
            () => {
                canReadUnits.set(
                    false,
                );

                fixture.detectChanges();


                expect(
                    component.units(),
                ).toEqual([]);

                expect(
                    component.state(),
                ).toBe(
                    'idle',
                );
            },
        );


        it(
            'should reload units after company switch',
            () => {
                const secondCompanyUnit:
                    OrganizationalUnit = {
                    ...support,

                    id: 14,
                    company_id: 2,

                    name:
                        'Marketing',
                };


                unitApi.list
                    .mockReturnValue(
                        of([
                            secondCompanyUnit,
                        ]),
                    );


                activeCompanyId.set(
                    2,
                );

                fixture.detectChanges();


                expect(
                    unitApi.list,
                ).toHaveBeenLastCalledWith(
                    2,
                );

                expect(
                    component.units(),
                ).toEqual([
                    secondCompanyUnit,
                ]);
            },
        );


        it(
            'should show error and retry',
            () => {
                unitApi.list
                    .mockReturnValue(
                        throwError(
                            () =>
                                new Error(
                                    'Request failed',
                                ),
                        ),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'error',
                );


                unitApi.list
                    .mockReturnValue(
                        of([
                            support,
                        ]),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.units(),
                ).toEqual([
                    support,
                ]);
            },
        );
    },
);