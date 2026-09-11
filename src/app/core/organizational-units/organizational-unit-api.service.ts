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
    OrganizationalUnit,
    OrganizationalUnitCreate,
    OrganizationalUnitUpdate,
} from './organizational-unit.models';


@Injectable({
    providedIn: 'root',
})
export class OrganizationalUnitApiService {
    private readonly http =
        inject(HttpClient);


    list(
        companyId: number,
    ): Observable<
        OrganizationalUnit[]
    > {
        return this.http.get<
            OrganizationalUnit[]
        >(
            `${API_BASE_URL}/companies/${companyId}/units`,
        );
    }


    get(
        companyId: number,
        unitId: number,
    ): Observable<
        OrganizationalUnit
    > {
        return this.http.get<
            OrganizationalUnit
        >(
            `${API_BASE_URL}/companies/${companyId}/units/${unitId}`,
        );
    }


    create(
        companyId: number,
        data:
            OrganizationalUnitCreate,
    ): Observable<
        OrganizationalUnit
    > {
        return this.http.post<
            OrganizationalUnit
        >(
            `${API_BASE_URL}/companies/${companyId}/units`,
            data,
        );
    }


    update(
        companyId: number,
        unitId: number,
        data:
            OrganizationalUnitUpdate,
    ): Observable<
        OrganizationalUnit
    > {
        return this.http.patch<
            OrganizationalUnit
        >(
            `${API_BASE_URL}/companies/${companyId}/units/${unitId}`,
            data,
        );
    }
}