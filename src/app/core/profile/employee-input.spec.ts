import { describe, expect, it } from 'vitest';
import { normalizeEmployeeInput } from './employee-input';

const empty = { firstName: '', lastName: '', middleName: '', email: '', phoneNumber: '', dateOfBirth: '' };

describe('employee input', () => {
    it('normalizes names and formatted phones without inventing a country code', () => {
        expect(normalizeEmployeeInput({
            firstName: '  Иван ', lastName: ' Иванов  ', middleName: ' Иванович ', email: ' ivan@example.com ',
            phoneNumber: '+7 (999) 123-45-67', dateOfBirth: '1992-07-15',
        })).toEqual({ error: null, data: {
            first_name: 'Иван', last_name: 'Иванов', middle_name: 'Иванович', email: 'ivan@example.com',
            phone_number: '+79991234567', date_of_birth: '1992-07-15',
        } });
        expect(normalizeEmployeeInput({ ...empty, phoneNumber: '8 (999) 123-45-67' }).data.phone_number).toBe('89991234567');
    });

    it('keeps optional fields optional', () => {
        expect(normalizeEmployeeInput(empty)).toEqual({ data: {}, error: null });
    });

    it.each([
        { firstName: 'x'.repeat(101) }, { lastName: 'x'.repeat(101) }, { middleName: 'x'.repeat(101) },
        { firstName: 'Name\u0000' }, { email: 'bad' }, { phoneNumber: '123' },
        { phoneNumber: '+7abc9991234567' }, { dateOfBirth: '1992-02-30' },
        { dateOfBirth: '2999-01-01' }, { dateOfBirth: 'not a date' },
    ])('rejects invalid data before a request: %o', invalid => {
        expect(normalizeEmployeeInput({ ...empty, ...invalid }).error).not.toBeNull();
    });
});
