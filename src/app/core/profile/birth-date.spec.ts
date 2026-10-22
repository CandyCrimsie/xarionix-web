import { describe, expect, it } from 'vitest';
import { birthDateToIso, formatBirthDate, parseBirthDate } from './birth-date';
import { employeeDisplayName } from './profile.models';

describe('birth date and employee name formatting', () => {
    it('round-trips the local calendar date without shifting a day in UTC', () => {
        const date = parseBirthDate('15.07.1992')!;
        expect(date.getFullYear()).toBe(1992);
        expect(date.getMonth()).toBe(6);
        expect(date.getDate()).toBe(15);
        expect(birthDateToIso(date)).toBe('1992-07-15');
        expect(formatBirthDate(date)).toBe('15.07.1992');
        expect(birthDateToIso(parseBirthDate('01.01.0001')!)).toBe('0001-01-01');
    });

    it.each(['31.02.1992', '29.02.1991', '01.13.1992', '00.01.1992', '01.01.0000', '1992-07-15', '7/15/1992', '1.1.1992', 'bad'])
        ('rejects nonexistent and ambiguous dates: %s', value => expect(parseBirthDate(value)).toBeNull());

    it('accepts a leap day and surrounding whitespace', () => {
        expect(birthDateToIso(parseBirthDate(' 29.02.2000 ')!)).toBe('2000-02-29');
    });

    it('uses structured first and last names, never parses legacy names or includes a patronymic in the short name', () => {
        expect(employeeDisplayName({ first_name: 'Иван', last_name: 'Иванов', middle_name: 'Иванович', full_name: 'Legacy' })).toBe('Иван Иванов');
        expect(employeeDisplayName({ full_name: 'Неразделённое старое имя' })).toBe('Неразделённое старое имя');
        expect(employeeDisplayName({ first_name: 'Анна Мария', last_name: 'Де ла Крус' })).toBe('Анна Мария Де ла Крус');
        expect(employeeDisplayName({}, 'login')).toBe('login');
    });
});
