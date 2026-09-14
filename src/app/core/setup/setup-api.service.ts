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
    SetupInitializeRequest,
    SetupInitializeResponse,
    SetupStatusResponse,
} from './setup.models';


@Injectable({
    providedIn:
        'root',
})
export class SetupApiService {
    private readonly http =
        inject(
            HttpClient,
        );


    status():
        Observable<
            SetupStatusResponse
        > {
        return this.http.get<
            SetupStatusResponse
        >(
            `${API_BASE_URL}/setup/status`,
        );
    }


    initialize(
        data:
            SetupInitializeRequest,
    ): Observable<
        SetupInitializeResponse
    > {
        return this.http.post<
            SetupInitializeResponse
        >(
            `${API_BASE_URL}/setup/initialize`,
            data,
        );
    }
}