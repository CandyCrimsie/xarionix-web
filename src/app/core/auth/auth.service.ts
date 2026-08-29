import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, of, switchMap, tap, catchError, throwError, map, shareReplay } from 'rxjs';

import { API_BASE_URL } from '../api/api.config';
import { AuthState, LoginRequest, TokenResponse, User } from './auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly authUrl = `${API_BASE_URL}/auth`;

  private readonly _accessToken = signal<string | null>(null);

  private readonly _user = signal<User | null>(null);

  private readonly _state = signal<AuthState>('loading');


  readonly accessToken = this._accessToken.asReadonly();

  readonly user = this._user.asReadonly();

  readonly state = this._state.asReadonly();

  private refreshRequest: Observable<TokenResponse> | null = null;


  readonly isAuthenticated = computed(
    () => this._state() === 'authenticated',
  );

  readonly isLoading = computed(
    () => this._state() === 'loading',
  );


  login(
    credentials: LoginRequest,
  ): Observable<User> {
    this._state.set('loading');

    return this.http.post<TokenResponse>(
      `${this.authUrl}/login`,
      credentials,
      {
        withCredentials: true,
      }
    ).pipe(
      tap(response => {
        this._accessToken.set(
          response.access_token,
        );
      }),

      switchMap(() => this.loadUser()),

      catchError(error => {
        this.clearLocalState();

        return throwError(() => error);
      }),
    );
  }


  refresh(): Observable<TokenResponse> {
    if (this.refreshRequest) {
      return this.refreshRequest;
    }

    this.refreshRequest = this.http.post<TokenResponse>(
      `${this.authUrl}/refresh`,
      null,
      {
        withCredentials: true,
      },
    ).pipe(
      tap(response => {
        this._accessToken.set(
          response.access_token,
        );
      }),

      finalize(() => {
        this.refreshRequest = null;
      }),

      shareReplay({
        bufferSize: 1,
        refCount: false,
      }),
    );

    return this.refreshRequest;
  }


  loadUser(): Observable<User> {
    return this.http.get<User>(
      `${this.authUrl}/me`,
    ).pipe(
      tap(user => {
        this._user.set(user);
        this._state.set('authenticated');
      }),
    );
  }


  logout(): Observable<void> {
    if (!this._accessToken()) {
      this.clearLocalState();

      return of(undefined);
    }

    return this.http.post<void>(
      `${this.authUrl}/logout`,
      null,
      {
        withCredentials: true,
      },
    ).pipe(
      finalize(() => {
        this.clearLocalState();
      }),
    );
  }


  invalidateLocalSession(): void {
    this.clearLocalState();
  }

  private clearLocalState(): void {
    this._accessToken.set(null);
    this._user.set(null);
    this._state.set('anonymous');
  }


  initialize(): Observable<void> {
    this._state.set('loading');

    return this.refresh().pipe(
      switchMap(() => this.loadUser()),

      map(() => undefined),

      catchError(() => {
        this.clearLocalState();

        return of(undefined);
      }),
    );
  }
}