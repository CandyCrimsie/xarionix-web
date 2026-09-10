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
    RoleDelegation,
    RoleDelegationsUpdate,
} from './role-delegation.models';


@Injectable({
    providedIn: 'root',
})
export class RoleDelegationApiService {
    private readonly http =
        inject(HttpClient);


    list(
        roleId: number,
    ): Observable<RoleDelegation[]> {
        return this.http.get<
            RoleDelegation[]
        >(
            `${API_BASE_URL}/roles/${roleId}/delegations`,
        );
    }


    replace(
        roleId: number,
        data: RoleDelegationsUpdate,
    ): Observable<RoleDelegation[]> {
        return this.http.put<
            RoleDelegation[]
        >(
            `${API_BASE_URL}/roles/${roleId}/delegations`,
            data,
        );
    }
}