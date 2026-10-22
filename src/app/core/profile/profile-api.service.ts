import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api/api.config';
import type { MyProfile } from './profile.models';

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
    private readonly http = inject(HttpClient);

    getMyProfile(): Observable<MyProfile> {
        return this.http.get<MyProfile>(`${API_BASE_URL}/me/profile`);
    }
}
