export const OrganizationalUnitType = {
    Division: 'division',
    Department: 'department',
    Team: 'team',
    Group: 'group',
    Branch: 'branch',
} as const;


export type OrganizationalUnitType =
    typeof OrganizationalUnitType[
    keyof typeof OrganizationalUnitType
    ];


export interface OrganizationalUnit {
    id: number;
    company_id: number;

    parent_id:
    number | null;

    name: string;

    type:
    OrganizationalUnitType;

    is_active: boolean;

    created_at: string;
    updated_at: string;
}


export interface OrganizationalUnitCreate {
    name: string;

    type:
    OrganizationalUnitType;

    parent_id?:
    number | null;
}


export interface OrganizationalUnitUpdate {
    name?: string;

    type?:
    OrganizationalUnitType;

    parent_id?:
    number | null;

    is_active?: boolean;
}