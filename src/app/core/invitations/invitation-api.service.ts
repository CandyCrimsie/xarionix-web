import {
    inject,
    Injectable,
} from '@angular/core';

import {
    HttpClient,
    HttpParams,
} from '@angular/common/http';

import type {
    Observable,
} from 'rxjs';

import {
    API_BASE_URL,
} from '../api/api.config';

import type {
    CompanyInvitation,
    CompanyInvitationCreate,
    CompanyInvitationCreated,
    InvitationAcceptance,
    InvitationNewUserAccept,
    InvitationScope,
    PublicInvitation,
} from './invitation.models';


@Injectable({
    providedIn: 'root',
})
export class InvitationApiService {
    private readonly http =
        inject(HttpClient);


    list(
        companyId: number,
        scope: InvitationScope,
    ): Observable<CompanyInvitation[]> {
        return this.http.get<CompanyInvitation[]>(
            (
                `${API_BASE_URL}`
                + `/companies/${companyId}`
                + '/invitations'
            ),
            {
                params:
                    new HttpParams()
                        .set('scope', scope),
            },
        );
    }


    create(
        companyId: number,
        data: CompanyInvitationCreate,
    ): Observable<CompanyInvitationCreated> {
        return this.http.post<CompanyInvitationCreated>(
            (
                `${API_BASE_URL}`
                + `/companies/${companyId}`
                + '/invitations'
            ),
            data,
        );
    }


    revoke(
        companyId: number,
        invitationId: number,
    ): Observable<CompanyInvitation> {
        return this.http.post<CompanyInvitation>(
            (
                `${API_BASE_URL}`
                + `/companies/${companyId}`
                + `/invitations/${invitationId}`
                + '/revoke'
            ),
            null,
        );
    }


    getPublic(
        token: string,
    ): Observable<PublicInvitation> {
        return this.http.get<PublicInvitation>(
            `${API_BASE_URL}/invitations/${encodeURIComponent(token)}`,
        );
    }


    acceptNew(
        token: string,
        data: InvitationNewUserAccept,
    ): Observable<InvitationAcceptance> {
        return this.http.post<InvitationAcceptance>(
            (
                `${API_BASE_URL}/invitations/`
                + `${encodeURIComponent(token)}/accept`
            ),
            data,
        );
    }


    acceptExisting(
        token: string,
    ): Observable<InvitationAcceptance> {
        return this.http.post<InvitationAcceptance>(
            (
                `${API_BASE_URL}/invitations/`
                + `${encodeURIComponent(token)}`
                + '/accept-existing'
            ),
            null,
        );
    }
}
