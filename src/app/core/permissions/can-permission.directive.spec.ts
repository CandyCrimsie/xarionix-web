import {
    Component,
    signal,
} from '@angular/core';

import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    CanPermissionDirective,
} from './can-permission.directive';

import {
    PermissionCode,
    PermissionScope,
} from './permission.models';

import {
    PermissionService,
} from './permission.service';


@Component({
    imports: [
        CanPermissionDirective,
    ],

    template: `
    <button
      *appCan="
        permission;
        scope: minimumScope()
      "
      data-testid="protected-action"
    >
      Protected action
    </button>
  `,
})
class TestHost {
    permission =
        PermissionCode.MembersManage;

    minimumScope =
        signal<
            PermissionScope | undefined
        >(
            undefined,
        );
}


describe(
    'CanPermissionDirective',
    () => {
        let fixture:
            ComponentFixture<TestHost>;

        let component:
            TestHost;

        const allowed =
            signal(false);

        const permissions = {
            can: vi.fn(
                (
                    _permission:
                        PermissionCode,

                    _minimumScope?:
                        PermissionScope,
                ) =>
                    allowed(),
            ),
        };


        beforeEach(async () => {
            vi.clearAllMocks();

            allowed.set(false);

            await TestBed
                .configureTestingModule({
                    imports: [
                        TestHost,
                    ],

                    providers: [
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
                    TestHost,
                );

            component =
                fixture.componentInstance;

            fixture.detectChanges();
        });


        it(
            'should hide protected content when permission is denied',
            () => {
                expect(
                    getProtectedAction(),
                ).toBeNull();

                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.MembersManage,
                    undefined,
                );
            },
        );


        it(
            'should render protected content when permission is allowed',
            () => {
                allowed.set(true);

                fixture.detectChanges();

                expect(
                    getProtectedAction(),
                ).not.toBeNull();
            },
        );


        it(
            'should pass minimum scope to permission service',
            () => {
                component.minimumScope.set(
                    PermissionScope.OwnUnitTree,
                );

                fixture.detectChanges();

                expect(
                    permissions.can,
                ).toHaveBeenLastCalledWith(
                    PermissionCode.MembersManage,
                    PermissionScope.OwnUnitTree,
                );
            },
        );


        it(
            'should reactively remove content when permission is lost',
            () => {
                allowed.set(true);

                fixture.detectChanges();

                expect(
                    getProtectedAction(),
                ).not.toBeNull();


                allowed.set(false);

                fixture.detectChanges();

                expect(
                    getProtectedAction(),
                ).toBeNull();
            },
        );


        it(
            'should reactively restore content when permission is granted again',
            () => {
                expect(
                    getProtectedAction(),
                ).toBeNull();


                allowed.set(true);

                fixture.detectChanges();

                expect(
                    getProtectedAction(),
                ).not.toBeNull();


                allowed.set(false);

                fixture.detectChanges();

                expect(
                    getProtectedAction(),
                ).toBeNull();


                allowed.set(true);

                fixture.detectChanges();

                expect(
                    getProtectedAction(),
                ).not.toBeNull();
            },
        );


        function getProtectedAction():
            Element | null {
            return fixture
                .nativeElement
                .querySelector(
                    '[data-testid="protected-action"]',
                );
        }
    },
);