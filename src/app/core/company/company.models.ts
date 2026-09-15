export interface Company {
    id: number;

    parent_id: number | null;

    name: string;
    short_name: string | null;

    is_active: boolean;

    created_at: string;
    updated_at: string;
}


export interface CompanyTreeNode
    extends Company {
    children: CompanyTreeNode[];
}


export interface CompanyChildCreate {
    name: string;

    short_name: string | null;
}


export interface CompanyUpdate {
    name?: string;

    short_name?: string | null;
}


export interface CompanyMoveRequest {
    parent_id: number;
}


export interface CompanyActivationRequest {
    is_active: boolean;
}