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
    RolePermission,
    RolePermissionsUpdate,
} from './role-permission.models';


@Injectable({
    providedIn: 'root',
})
export class RolePermissionApiService {
    private readonly http =
        inject(HttpClient);


    list(
        roleId: number,
    ): Observable<RolePermission[]> {
        return this.http.get<
            RolePermission[]
        >(
            `${API_BASE_URL}/roles/${roleId}/permissions`,
        );
    }


    replace(
        roleId: number,
        data: RolePermissionsUpdate,
    ): Observable<RolePermission[]> {
        return this.http.put<
            RolePermission[]
        >(
            `${API_BASE_URL}/roles/${roleId}/permissions`,
            data,
        );
    }
}