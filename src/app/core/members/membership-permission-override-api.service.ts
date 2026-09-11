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
    EffectivePermissionsResponse,
} from '../permissions/permission.models';

import type {
    PermissionCatalogItem,
} from '../permissions/permission-catalog.models';

import type {
    MembershipPermissionOverride,
    MembershipPermissionOverrideUpdate,
} from './membership-permission-override.models';


@Injectable({
    providedIn: 'root',
})
export class MembershipPermissionOverrideApiService {
    private readonly http =
        inject(HttpClient);


    list(
        membershipId: number,
    ): Observable<
        MembershipPermissionOverride[]
    > {
        return this.http.get<
            MembershipPermissionOverride[]
        >(
            `${API_BASE_URL}/members/${membershipId}/permission-overrides`,
        );
    }


    catalog(
        membershipId: number,
    ): Observable<
        PermissionCatalogItem[]
    > {
        return this.http.get<
            PermissionCatalogItem[]
        >(
            `${API_BASE_URL}/members/${membershipId}/permission-overrides/catalog`,
        );
    }


    effective(
        membershipId: number,
    ): Observable<
        EffectivePermissionsResponse
    > {
        return this.http.get<
            EffectivePermissionsResponse
        >(
            `${API_BASE_URL}/members/${membershipId}/permission-overrides/effective`,
        );
    }


    set(
        membershipId: number,
        permissionId: number,
        data:
            MembershipPermissionOverrideUpdate,
    ): Observable<
        MembershipPermissionOverride
    > {
        return this.http.put<
            MembershipPermissionOverride
        >(
            `${API_BASE_URL}/members/${membershipId}/permission-overrides/${permissionId}`,
            data,
        );
    }


    remove(
        membershipId: number,
        permissionId: number,
    ): Observable<void> {
        return this.http.delete<void>(
            `${API_BASE_URL}/members/${membershipId}/permission-overrides/${permissionId}`,
        );
    }
}