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
    UnitMembership,
    UnitMembershipCreate,
    UnitMembershipUpdate,
} from './unit-membership.models';


@Injectable({
    providedIn: 'root',
})
export class UnitMembershipApiService {
    private readonly http =
        inject(HttpClient);


    list(
        membershipId: number,
    ): Observable<
        UnitMembership[]
    > {
        return this.http.get<
            UnitMembership[]
        >(
            `${API_BASE_URL}/company-memberships/${membershipId}/units`,
        );
    }


    get(
        membershipId: number,
        unitMembershipId: number,
    ): Observable<
        UnitMembership
    > {
        return this.http.get<
            UnitMembership
        >(
            `${API_BASE_URL}/company-memberships/${membershipId}/units/${unitMembershipId}`,
        );
    }


    create(
        membershipId: number,
        data:
            UnitMembershipCreate,
    ): Observable<
        UnitMembership
    > {
        return this.http.post<
            UnitMembership
        >(
            `${API_BASE_URL}/company-memberships/${membershipId}/units`,
            data,
        );
    }


    update(
        membershipId: number,
        unitMembershipId: number,
        data:
            UnitMembershipUpdate,
    ): Observable<
        UnitMembership
    > {
        return this.http.patch<
            UnitMembership
        >(
            `${API_BASE_URL}/company-memberships/${membershipId}/units/${unitMembershipId}`,
            data,
        );
    }
}