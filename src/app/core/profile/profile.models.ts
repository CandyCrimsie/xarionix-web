export interface EmployeeDetails {
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
    /** Read-only fallback for historical records; never parse it into names. */
    full_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    date_of_birth?: string | null;
}

export function employeeDisplayName(employee: EmployeeDetails, fallback = ''): string {
    return [employee.first_name, employee.last_name].filter(Boolean).join(' ')
        || employee.full_name || fallback;
}

export interface MyProfile extends EmployeeDetails {
    user_id: number;
    username: string;
    company_id: number;
    company_name: string;
    account_created_at: string;
    joined_at: string;
}
