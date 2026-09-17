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
    CompanyApiService,
} from './company-api.service';

import type {
    Company,
    CompanyActivationRequest,
    CompanyChildCreate,
    CompanyMoveRequest,
    CompanyTreeNode,
    CompanyUpdate,
    CompanyRootCreate
} from './company.models';


describe(
    'CompanyApiService',
    () => {
        let service:
            CompanyApiService;


        const http = {
            get:
                vi.fn(),

            post:
                vi.fn(),

            patch:
                vi.fn(),
        };


        const company:
            Company = {
            id: 10,

            parent_id:
                null,

            name:
                'Xarionix Telecom',

            short_name:
                'XAR',

            is_active:
                true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        beforeEach(() => {
            vi.clearAllMocks();


            TestBed
                .configureTestingModule({
                    providers: [
                        CompanyApiService,

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
                    CompanyApiService,
                );
        });


        it(
            'should get company',
            async () => {
                http.get
                    .mockReturnValue(
                        of(company),
                    );


                const result =
                    await firstValueFrom(
                        service.get(
                            company.id,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    (
                        `${API_BASE_URL}`
                        + `/companies/${company.id}`
                    ),
                );


                expect(
                    result,
                ).toEqual(
                    company,
                );
            },
        );


        it(
            'should get company tree',
            async () => {
                const tree:
                    CompanyTreeNode = {
                    ...company,

                    children: [
                        {
                            ...company,

                            id:
                                11,

                            parent_id:
                                company.id,

                            name:
                                'Branch',

                            children:
                                [],
                        },
                    ],
                };


                http.get
                    .mockReturnValue(
                        of(tree),
                    );


                const result =
                    await firstValueFrom(
                        service.getTree(
                            company.id,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    (
                        `${API_BASE_URL}`
                        + `/companies/${company.id}/tree`
                    ),
                );


                expect(
                    result,
                ).toEqual(
                    tree,
                );
            },
        );

        it(
            'should create independent root company',
            async () => {
                const data:
                    CompanyRootCreate = {
                    name:
                        'Second Company',

                    short_name:
                        'SECOND',
                };


                const rootCompany:
                    Company = {
                    ...company,

                    id:
                        20,

                    parent_id:
                        null,

                    name:
                        data.name,

                    short_name:
                        data.short_name,
                };


                http.post
                    .mockReturnValue(
                        of(rootCompany),
                    );


                const result =
                    await firstValueFrom(
                        service.createRoot(
                            data,
                        ),
                    );


                expect(
                    http.post,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies`,
                    data,
                );


                expect(
                    result,
                ).toEqual(
                    rootCompany,
                );
            },
        );

        it(
            'should create child company',
            async () => {
                const data:
                    CompanyChildCreate = {
                    name:
                        'Regional Branch',

                    short_name:
                        'REG',
                };


                const child:
                    Company = {
                    ...company,

                    id:
                        11,

                    parent_id:
                        company.id,

                    name:
                        data.name,

                    short_name:
                        data.short_name,
                };


                http.post
                    .mockReturnValue(
                        of(child),
                    );


                const result =
                    await firstValueFrom(
                        service.createChild(
                            company.id,
                            data,
                        ),
                    );


                expect(
                    http.post,
                ).toHaveBeenCalledWith(
                    (
                        `${API_BASE_URL}`
                        + `/companies/${company.id}/children`
                    ),
                    data,
                );


                expect(
                    result,
                ).toEqual(
                    child,
                );
            },
        );


        it(
            'should update company metadata',
            async () => {
                const data:
                    CompanyUpdate = {
                    name:
                        'Renamed Company',

                    short_name:
                        null,
                };


                http.patch
                    .mockReturnValue(
                        of(company),
                    );


                const result =
                    await firstValueFrom(
                        service.update(
                            company.id,
                            data,
                        ),
                    );


                expect(
                    http.patch,
                ).toHaveBeenCalledWith(
                    (
                        `${API_BASE_URL}`
                        + `/companies/${company.id}`
                    ),
                    data,
                );


                expect(
                    result,
                ).toEqual(
                    company,
                );
            },
        );


        it(
            'should move company inside tree',
            async () => {
                const rootCompanyId =
                    10;

                const targetCompanyId =
                    12;


                const data:
                    CompanyMoveRequest = {
                    parent_id:
                        11,
                };


                http.patch
                    .mockReturnValue(
                        of(company),
                    );


                const result =
                    await firstValueFrom(
                        service.move(
                            rootCompanyId,
                            targetCompanyId,
                            data,
                        ),
                    );


                expect(
                    http.patch,
                ).toHaveBeenCalledWith(
                    (
                        `${API_BASE_URL}`
                        + `/companies/${rootCompanyId}`
                        + `/tree/${targetCompanyId}`
                        + '/parent'
                    ),
                    data,
                );


                expect(
                    result,
                ).toEqual(
                    company,
                );
            },
        );


        it(
            'should update company activation state',
            async () => {
                const rootCompanyId =
                    10;

                const targetCompanyId =
                    11;


                const data:
                    CompanyActivationRequest = {
                    is_active:
                        false,
                };


                http.patch
                    .mockReturnValue(
                        of({
                            ...company,

                            id:
                                targetCompanyId,

                            is_active:
                                false,
                        }),
                    );


                const result =
                    await firstValueFrom(
                        service.setActivation(
                            rootCompanyId,
                            targetCompanyId,
                            data,
                        ),
                    );


                expect(
                    http.patch,
                ).toHaveBeenCalledWith(
                    (
                        `${API_BASE_URL}`
                        + `/companies/${rootCompanyId}`
                        + `/tree/${targetCompanyId}`
                        + '/activation'
                    ),
                    data,
                );


                expect(
                    result.is_active,
                ).toBe(false);
            },
        );
    },
);