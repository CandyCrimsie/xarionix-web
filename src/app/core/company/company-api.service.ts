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
    Company,
    CompanyActivationRequest,
    CompanyChildCreate,
    CompanyMoveRequest,
    CompanyTreeNode,
    CompanyUpdate,
} from './company.models';


@Injectable({
    providedIn: 'root',
})
export class CompanyApiService {
    private readonly http =
        inject(HttpClient);


    get(
        companyId: number,
    ): Observable<Company> {
        return this.http.get<Company>(
            `${API_BASE_URL}/companies/${companyId}`,
        );
    }


    getTree(
        companyId: number,
    ): Observable<CompanyTreeNode> {
        return this.http.get<
            CompanyTreeNode
        >(
            `${API_BASE_URL}/companies/${companyId}/tree`,
        );
    }


    createChild(
        companyId: number,
        data: CompanyChildCreate,
    ): Observable<Company> {
        return this.http.post<Company>(
            `${API_BASE_URL}/companies/${companyId}/children`,
            data,
        );
    }


    update(
        companyId: number,
        data: CompanyUpdate,
    ): Observable<Company> {
        return this.http.patch<Company>(
            `${API_BASE_URL}/companies/${companyId}`,
            data,
        );
    }


    move(
        rootCompanyId: number,
        targetCompanyId: number,
        data: CompanyMoveRequest,
    ): Observable<Company> {
        return this.http.patch<Company>(
            (
                `${API_BASE_URL}`
                + `/companies/${rootCompanyId}`
                + `/tree/${targetCompanyId}`
                + '/parent'
            ),
            data,
        );
    }


    setActivation(
        rootCompanyId: number,
        targetCompanyId: number,
        data: CompanyActivationRequest,
    ): Observable<Company> {
        return this.http.patch<Company>(
            (
                `${API_BASE_URL}`
                + `/companies/${rootCompanyId}`
                + `/tree/${targetCompanyId}`
                + '/activation'
            ),
            data,
        );
    }
}