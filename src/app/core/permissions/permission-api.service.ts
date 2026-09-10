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
    PermissionCatalogItem,
} from './permission-catalog.models';


@Injectable({
    providedIn: 'root',
})
export class PermissionApiService {
    private readonly http =
        inject(HttpClient);


    list():
        Observable<
            PermissionCatalogItem[]
        > {
        return this.http.get<
            PermissionCatalogItem[]
        >(
            `${API_BASE_URL}/permissions`,
        );
    }
}