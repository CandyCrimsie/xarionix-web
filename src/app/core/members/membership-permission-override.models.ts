import type {
    PermissionScope,
} from '../permissions/permission.models';


export const PermissionOverrideEffect = {
    Allow: 'allow',
    Deny: 'deny',
} as const;


export type PermissionOverrideEffect =
    typeof PermissionOverrideEffect[
    keyof typeof PermissionOverrideEffect
    ];


export interface MembershipPermissionOverride {
    id: number;

    company_membership_id: number;
    permission_id: number;

    effect:
    PermissionOverrideEffect;

    scope:
    PermissionScope | null;
}


export type MembershipPermissionOverrideUpdate =
    | {
        effect:
        typeof PermissionOverrideEffect.Allow;

        scope:
        PermissionScope;
    }
    | {
        effect:
        typeof PermissionOverrideEffect.Deny;

        scope:
        null;
    };