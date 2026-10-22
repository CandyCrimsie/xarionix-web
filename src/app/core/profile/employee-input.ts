import type { EmployeeDetails } from './profile.models';

export function normalizeEmployeeInput(draft: {
    firstName: string; lastName: string; middleName: string;
    email: string; phoneNumber: string; dateOfBirth: string;
}): { data: Omit<EmployeeDetails, 'full_name'>; error: string | null } {
    const data: Omit<EmployeeDetails, 'full_name'> = {};
    for (const [field, value] of [
        ['first_name', draft.firstName], ['last_name', draft.lastName], ['middle_name', draft.middleName],
    ] as const) {
        const name = value.trim().replace(/\s+/g, ' ');
        if (name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) {
            return { data, error: 'Имя, фамилия и отчество: не более 100 символов в каждом поле, без управляющих символов' };
        }
        if (name) data[field] = name;
    }
    const email = draft.email.trim();
    const phone = draft.phoneNumber.replace(/[\s().-]/g, '');
    const birthDate = draft.dateOfBirth.trim();
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return { data, error: 'Укажите корректный email' };
    }
    if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) {
        return { data, error: 'Укажите номер телефона: от 7 до 15 цифр, можно с + в начале' };
    }
    if (birthDate) {
        const parsed = new Date(`${birthDate}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate < '0001-01-01'
            || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) {
            return { data, error: 'Укажите корректную дату рождения' };
        }
        if (birthDate > new Date().toISOString().slice(0, 10)) {
            return { data, error: 'Дата рождения не может быть в будущем' };
        }
    }
    if (email) data.email = email;
    if (phone) data.phone_number = phone;
    if (birthDate) data.date_of_birth = birthDate;
    return { data, error: null };
}
