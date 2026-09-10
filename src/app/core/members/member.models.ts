import type {
    OrganizationalUnitType,
} from '../organizational-units/organizational-unit.models';


export interface CompanyMembership {
    id: number;

    user_id: number;
    company_id: number;

    is_active: boolean;

    created_at: string;
    updated_at: string;
}


export interface CompanyMemberSummary {
    id: number;

    user_id: number;
    username: string;
    user_is_active: boolean;

    company_id: number;

    is_active: boolean;

    primary_unit_id: number | null;
    primary_unit_name: string | null;

    primary_unit_type:
    OrganizationalUnitType | null;

    created_at: string;
    updated_at: string;
}


export interface CompanyMembershipCreate {
    user_id: number;

    primary_unit_id?: number | null;
}


export interface CompanyMembershipUpdate {
    is_active: boolean;
}