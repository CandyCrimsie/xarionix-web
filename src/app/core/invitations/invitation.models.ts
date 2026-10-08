import type {
    User,
} from '../auth/auth.models';


export type InvitationScope =
    | 'mine'
    | 'all';


export type InvitationStatus =
    | 'pending'
    | 'accepted'
    | 'expired'
    | 'revoked';


export interface CompanyInvitation {
    id: number;
    company_id: number;
    token_prefix: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
    status: InvitationStatus;
    created_by_username: string;
}


export interface CompanyInvitationCreate {
    expires_in_hours?: number;
}


export interface CompanyInvitationCreated
    extends CompanyInvitation {
    token: string;
}


export interface PublicInvitation {
    company: {
        name: string;
        short_name: string | null;
    };
    expires_at: string;
    status: InvitationStatus;
}


export interface InvitationNewUserAccept {
    username: string;
    password: string;
}


export interface InvitationAcceptance {
    user: User;
    company_id: number;
}
