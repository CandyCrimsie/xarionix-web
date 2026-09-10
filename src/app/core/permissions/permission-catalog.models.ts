import {
    PermissionCode,
    PermissionScope,
} from './permission.models';


export interface PermissionCatalogItem {
    id: number;

    code: PermissionCode;
    name: string;
    module: string;

    description: string | null;

    is_active: boolean;

    allowed_scopes:
    PermissionScope[];
}