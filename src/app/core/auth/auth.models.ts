export interface LoginRequest {
    username: string;
    password: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface User {
    id: number;
    username: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export type AuthState =
    | 'loading'
    | 'authenticated'
    | 'anonymous';