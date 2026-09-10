export interface RoleDelegation {
    id: number;

    manager_role_id: number;
    assignable_role_id: number;
}


export interface RoleDelegationsUpdate {
    assignable_role_ids: number[];
}