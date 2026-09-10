export interface Role {
    id: number;
    company_id: number;

    name: string;
    description: string | null;

    is_system: boolean;
    is_active: boolean;

    created_at: string;
    updated_at: string;
}


export interface RoleCreate {
    name: string;

    description?:
    string | null;
}


export interface RoleUpdate {
    name?: string;

    description?:
    string | null;

    is_active?:
    boolean;
}