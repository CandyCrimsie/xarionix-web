export const PermissionCode = {
    CompaniesRead: 'companies.read',
    CompaniesManage: 'companies.manage',

    OrganizationalUnitsRead:
        'organizational_units.read',

    OrganizationalUnitsManage:
        'organizational_units.manage',

    MembersRead: 'members.read',
    MembersManage: 'members.manage',

    RolesRead: 'roles.read',
    RolesManage: 'roles.manage',
    RolesAssign: 'roles.assign',

    TasksRead: 'tasks.read',
    TasksCreate: 'tasks.create',
    TasksUpdate: 'tasks.update',
    TasksDelete: 'tasks.delete',
    TasksAssign: 'tasks.assign',
    TasksClose: 'tasks.close',
} as const;


export type PermissionCode =
    typeof PermissionCode[
    keyof typeof PermissionCode
    ];


export const PermissionScope = {
    Self: 'self',
    OwnUnit: 'own_unit',
    OwnUnitTree: 'own_unit_tree',
    Company: 'company',
} as const;


export type PermissionScope =
    typeof PermissionScope[
    keyof typeof PermissionScope
    ];


export interface EffectivePermissionsResponse {
    permissions: PermissionCode[];

    scopes: Partial<
        Record<
            PermissionCode,
            PermissionScope
        >
    >;
}


export type PermissionState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';
