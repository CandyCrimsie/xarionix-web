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

import {
    Role,
    RoleCreate,
    RoleUpdate,
} from './role.models';


@Injectable({
    providedIn: 'root',
})
export class RoleApiService {
    private readonly http =
        inject(HttpClient);


    list(): Observable<Role[]> {
        return this.http.get<Role[]>(
            `${API_BASE_URL}/roles`,
        );
    }


    get(
        roleId: number,
    ): Observable<Role> {
        return this.http.get<Role>(
            `${API_BASE_URL}/roles/${roleId}`,
        );
    }


    create(
        data: RoleCreate,
    ): Observable<Role> {
        return this.http.post<Role>(
            `${API_BASE_URL}/roles`,
            data,
        );
    }


    update(
        roleId: number,
        data: RoleUpdate,
    ): Observable<Role> {
        return this.http.patch<Role>(
            `${API_BASE_URL}/roles/${roleId}`,
            data,
        );
    }
}