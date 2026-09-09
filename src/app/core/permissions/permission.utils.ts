import {
    PermissionScope,
} from './permission.models';


export const PERMISSION_SCOPE_RANK:
    Readonly<
        Record<
            PermissionScope,
            number
        >
    > = {
    [PermissionScope.Self]: 10,

    [PermissionScope.OwnUnit]: 20,

    [PermissionScope.OwnUnitTree]: 30,

    [PermissionScope.Company]: 40,
};


export function getPermissionScopeRank(
    scope: PermissionScope,
): number {
    return PERMISSION_SCOPE_RANK[
        scope
    ];
}


export function isScopeAtLeast(
    actualScope: PermissionScope,
    minimumScope: PermissionScope,
): boolean {
    return (
        getPermissionScopeRank(
            actualScope,
        )
        >=
        getPermissionScopeRank(
            minimumScope,
        )
    );
}