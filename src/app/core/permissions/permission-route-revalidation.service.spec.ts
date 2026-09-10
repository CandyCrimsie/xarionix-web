import {
    TestBed,
} from '@angular/core/testing';

import {
    Router,
} from '@angular/router';

import {
    Subject,
} from 'rxjs';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    PermissionService,
} from './permission.service';

import {
    PermissionRouteRevalidationService,
} from './permission-route-revalidation.service';


describe(
    'PermissionRouteRevalidationService',
    () => {
        let service:
            PermissionRouteRevalidationService;

        const settled =
            new Subject<number>();

        const permissions = {
            companyPermissionsSettled$:
                settled.asObservable(),
        };

        const router = {
            url: '/invite',

            navigateByUrl:
                vi.fn()
                    .mockResolvedValue(true),
        };


        beforeEach(() => {
            vi.clearAllMocks();

            router.url = '/invite';

            TestBed.configureTestingModule({
                providers: [
                    PermissionRouteRevalidationService,

                    {
                        provide:
                            PermissionService,

                        useValue:
                            permissions,
                    },

                    {
                        provide: Router,
                        useValue: router,
                    },
                ],
            });

            service =
                TestBed.inject(
                    PermissionRouteRevalidationService,
                );
        });


        it(
            'should revalidate current route when company permissions settle',
            () => {
                service.start();

                settled.next(2);

                expect(
                    router.navigateByUrl,
                ).toHaveBeenCalledWith(
                    '/invite',
                    {
                        onSameUrlNavigation:
                            'reload',

                        replaceUrl: true,
                    },
                );
            },
        );


        it(
            'should start only once',
            () => {
                service.start();
                service.start();

                settled.next(2);

                expect(
                    router.navigateByUrl,
                ).toHaveBeenCalledTimes(1);
            },
        );
    },
);