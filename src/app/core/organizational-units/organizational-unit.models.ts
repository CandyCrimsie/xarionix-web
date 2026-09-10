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