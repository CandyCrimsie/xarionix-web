export interface UnitMembership {
    id: number;

    company_membership_id:
    number;

    unit_id: number;

    is_primary: boolean;
    is_active: boolean;

    created_at: string;
    updated_at: string;
}


export interface UnitMembershipCreate {
    unit_id: number;

    is_primary?: boolean;
}


export interface UnitMembershipUpdate {
    is_primary?: boolean;
    is_active?: boolean;
}