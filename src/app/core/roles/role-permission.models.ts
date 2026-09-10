import {
    PermissionCode,
    PermissionScope,
} from '../permissions/permission.models';


export interface RolePermission {
    permission_id: number;

    code: PermissionCode;
    name: string;
    module: string;

    description: string | null;

    is_active: boolean;

    scope: PermissionScope;
}


export interface RolePermissionAssignment {
    permission_id: number;

    scope: PermissionScope;
}


export interface RolePermissionsUpdate {
    permissions:
    RolePermissionAssignment[];
}