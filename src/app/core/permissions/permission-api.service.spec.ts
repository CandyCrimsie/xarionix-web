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
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    API_BASE_URL,
} from '../api/api.config';

import {
    PermissionCode,
    PermissionScope,
} from './permission.models';

import type {
    PermissionCatalogItem,
} from './permission-catalog.models';

import {
    PermissionApiService,
} from './permission-api.service';


describe(
    'PermissionApiService',
    () => {
        let service:
            PermissionApiService;

        const http = {
            get:
                vi.fn(),
        };


        const permission:
            PermissionCatalogItem = {
            id: 10,

            code:
                PermissionCode.MembersManage,

            name:
                'Manage members',

            module:
                'members',

            description:
                'Manage company members',

            is_active:
                true,

            allowed_scopes: [
                PermissionScope.OwnUnit,
                PermissionScope.OwnUnitTree,
                PermissionScope.Company,
            ],
        };


        beforeEach(() => {
            vi.clearAllMocks();

            TestBed.configureTestingModule({
                providers: [
                    PermissionApiService,

                    {
                        provide:
                            HttpClient,

                        useValue:
                            http,
                    },
                ],
            });

            service =
                TestBed.inject(
                    PermissionApiService,
                );
        });


        it(
            'should list permission catalog',
            async () => {
                http.get.mockReturnValue(
                    of([
                        permission,
                    ]),
                );

                const result =
                    await firstValueFrom(
                        service.list(),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/permissions`,
                );

                expect(
                    result,
                ).toEqual([
                    permission,
                ]);
            },
        );
    },
);