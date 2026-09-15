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
    InstallationState,
} from './setup.models';

import type {
    SetupInitializeRequest,
    SetupInitializeResponse,
    SetupStatusResponse,
} from './setup.models';

import {
    SetupApiService,
} from './setup-api.service';


describe(
    'SetupApiService',
    () => {
        let service:
            SetupApiService;


        const http = {
            get:
                vi.fn(),

            post:
                vi.fn(),
        };


        beforeEach(
            () => {
                vi.clearAllMocks();


                TestBed
                    .configureTestingModule({
                        providers: [
                            SetupApiService,

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
                        SetupApiService,
                    );
            },
        );


        it(
            'should get installation status',
            async () => {
                const response:
                    SetupStatusResponse = {
                    state:
                        InstallationState
                            .Ready,

                    setup_allowed:
                        true,

                    has_users:
                        false,

                    has_companies:
                        false,

                    has_memberships:
                        false,

                    has_administrator:
                        false,
                };


                http.get
                    .mockReturnValue(
                        of(
                            response,
                        ),
                    );


                const result =
                    await firstValueFrom(
                        service.status(),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/setup/status`,
                );

                expect(
                    result,
                ).toEqual(
                    response,
                );
            },
        );


        it(
            'should initialize installation',
            async () => {
                const request:
                    SetupInitializeRequest = {
                    company: {
                        name:
                            'Xarionix Telecom',

                        short_name:
                            'Xarionix',
                    },

                    administrator: {
                        username:
                            'admin',

                        password:
                            'strong-password',
                    },
                };


                const response:
                    SetupInitializeResponse = {
                    state:
                        InstallationState
                            .Installed,

                    company_id:
                        1,

                    company_name:
                        'Xarionix Telecom',

                    user_id:
                        1,

                    username:
                        'admin',

                    membership_id:
                        1,

                    administrator_role_id:
                        1,
                };


                http.post
                    .mockReturnValue(
                        of(
                            response,
                        ),
                    );


                const result =
                    await firstValueFrom(
                        service.initialize(
                            request,
                        ),
                    );


                expect(
                    http.post,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/setup/initialize`,
                    request,
                );

                expect(
                    result,
                ).toEqual(
                    response,
                );
            },
        );
    },
);