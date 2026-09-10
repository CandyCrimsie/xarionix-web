import {
    inject,
    Injectable,
} from '@angular/core';

import {
    HttpClient,
} from '@angular/common/http';

import {
    Observable,
} from 'rxjs';

import {
    API_BASE_URL,
} from '../api/api.config';

import type {
    CompanyMemberSummary,
    CompanyMembership,
    CompanyMembershipCreate,
    CompanyMembershipUpdate,
} from './member.models';


@Injectable({
    providedIn: 'root',
})
export class MemberApiService {
    private readonly http =
        inject(HttpClient);


    list(
        companyId: number,
    ): Observable<
        CompanyMemberSummary[]
    > {
        return this.http.get<
            CompanyMemberSummary[]
        >(
            `${API_BASE_URL}/companies/${companyId}/members`,
        );
    }


    get(
        companyId: number,
        membershipId: number,
    ): Observable<
        CompanyMembership
    > {
        return this.http.get<
            CompanyMembership
        >(
            `${API_BASE_URL}/companies/${companyId}/members/${membershipId}`,
        );
    }


    create(
        companyId: number,
        data: CompanyMembershipCreate,
    ): Observable<
        CompanyMembership
    > {
        return this.http.post<
            CompanyMembership
        >(
            `${API_BASE_URL}/companies/${companyId}/members`,
            data,
        );
    }


    update(
        companyId: number,
        membershipId: number,
        data: CompanyMembershipUpdate,
    ): Observable<
        CompanyMembership
    > {
        return this.http.patch<
            CompanyMembership
        >(
            `${API_BASE_URL}/companies/${companyId}/members/${membershipId}`,
            data,
        );
    }
}