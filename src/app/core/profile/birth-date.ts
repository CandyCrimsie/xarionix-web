/** Local calendar dates: never serialize a birthday via a UTC timezone conversion. */
export function birthDateToIso(date: Date): string {
    return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatBirthDate(date: Date): string {
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).padStart(4, '0')}`;
}

export function parseBirthDate(value: string): Date | null {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
    if (!match) return null;
    const [, day, month, year] = match.map(Number);
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return year >= 1 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        ? date : null;
}
