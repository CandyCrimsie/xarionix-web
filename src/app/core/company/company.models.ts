export interface Company {
    id: number;

    parent_id: number | null;

    name: string;
    short_name: string | null;

    is_active: boolean;

    created_at: string;
    updated_at: string;
}