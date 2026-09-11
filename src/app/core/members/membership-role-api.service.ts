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
    Role,
} from '../roles/role.models';

import type {
    MembershipRolesUpdate,
} from './membership-role.models';


@Injectable({
    providedIn: 'root',
})
export class MembershipRoleApiService {
    private readonly http =
        inject(HttpClient);


    list(
        membershipId: number,
    ): Observable<Role[]> {
        return this.http.get<Role[]>(
            `${API_BASE_URL}/members/${membershipId}/roles`,
        );
    }


    listAssignable(
        membershipId: number,
    ): Observable<Role[]> {
        return this.http.get<Role[]>(
            `${API_BASE_URL}/members/${membershipId}/roles/assignable`,
        );
    }


    replace(
        membershipId: number,
        data: MembershipRolesUpdate,
    ): Observable<Role[]> {
        return this.http.put<Role[]>(
            `${API_BASE_URL}/members/${membershipId}/roles`,
            data,
        );
    }
}