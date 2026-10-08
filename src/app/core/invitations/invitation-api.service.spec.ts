import {
    TestBed,
} from '@angular/core/testing';

import {
    provideHttpClient,
} from '@angular/common/http';

import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';

import {
    InvitationApiService,
} from './invitation-api.service';


describe(
    'InvitationApiService',
    () => {
        let service:
            InvitationApiService;

        let http:
            HttpTestingController;


        beforeEach(() => {
            TestBed.configureTestingModule({
                providers: [
                    provideHttpClient(),
                    provideHttpClientTesting(),
                ],
            });

            service = TestBed.inject(
                InvitationApiService,
            );

            http = TestBed.inject(
                HttpTestingController,
            );
        });


        afterEach(() => {
            http.verify();
        });


        it(
            'should use company-scoped management endpoints',
            () => {
                service.list(7, 'mine').subscribe();

                const listRequest = http.expectOne(
                    '/api/v1/companies/7/invitations?scope=mine',
                );

                expect(listRequest.request.method).toBe('GET');
                listRequest.flush([]);


                service.create(
                    7,
                    { expires_in_hours: 24 },
                ).subscribe();

                const createRequest = http.expectOne(
                    '/api/v1/companies/7/invitations',
                );

                expect(createRequest.request.method).toBe('POST');
                expect(createRequest.request.body).toEqual({
                    expires_in_hours: 24,
                });
                createRequest.flush({});


                service.revoke(7, 11).subscribe();

                const revokeRequest = http.expectOne(
                    '/api/v1/companies/7/invitations/11/revoke',
                );

                expect(revokeRequest.request.method).toBe('POST');
                revokeRequest.flush({});
            },
        );


        it(
            'should use public and authenticated acceptance endpoints',
            () => {
                service.getPublic('a/b').subscribe();

                const validationRequest = http.expectOne(
                    '/api/v1/invitations/a%2Fb',
                );

                expect(validationRequest.request.method).toBe('GET');
                validationRequest.flush({});


                service.acceptNew(
                    'token',
                    {
                        username: 'employee',
                        password: 'password123',
                    },
                ).subscribe();

                const newUserRequest = http.expectOne(
                    '/api/v1/invitations/token/accept',
                );

                expect(newUserRequest.request.method).toBe('POST');
                expect(newUserRequest.request.body).toEqual({
                    username: 'employee',
                    password: 'password123',
                });
                newUserRequest.flush({});


                service.acceptExisting('token').subscribe();

                const existingRequest = http.expectOne(
                    '/api/v1/invitations/token/accept-existing',
                );

                expect(existingRequest.request.method).toBe('POST');
                existingRequest.flush({});
            },
        );
    },
);
