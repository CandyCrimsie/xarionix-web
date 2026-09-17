export const InstallationState = {
    Ready:
        'ready',

    Installed:
        'installed',

    Inconsistent:
        'inconsistent',
} as const;


export type InstallationState =
    typeof InstallationState[
    keyof typeof InstallationState
    ];


export interface SetupStatusResponse {
    state:
    InstallationState;

    setup_allowed:
    boolean;

    has_users:
    boolean;

    has_companies:
    boolean;

    has_memberships:
    boolean;

    has_administrator:
    boolean;
}


export interface SetupCompanyCreate {
    name:
    string;

    short_name:
    string | null;
}


export interface SetupInitializeRequest {
    company:
    SetupCompanyCreate;
}


export interface SetupInitializeResponse {
    state:
    InstallationState;

    company_id:
    number;

    company_name:
    string;

    user_id:
    number;

    username:
    string;

    membership_id:
    number;

    administrator_role_id:
    number;
}