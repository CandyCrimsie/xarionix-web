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
}


export interface SetupCompanyCreate {
    name:
    string;

    short_name:
    string | null;
}


export interface SetupAdministratorCreate {
    username:
    string;

    password:
    string;
}


export interface SetupInitializeRequest {
    company:
    SetupCompanyCreate;

    administrator:
    SetupAdministratorCreate;
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