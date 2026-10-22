import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyContextService } from '../../core/company/company-context.service';
import { ProfileApiService } from '../../core/profile/profile-api.service';
import type { MyProfile } from '../../core/profile/profile.models';
import { Profile } from './profile';

describe('Profile', () => {
    let fixture: ComponentFixture<Profile>;
    const companyId = signal<number | null>(1);
    const api = { getMyProfile: vi.fn() };
    const profile: MyProfile = {
        user_id: 2, username: 'employee', company_id: 1, company_name: 'Company A',
        first_name: 'Иван', last_name: 'Иванов', middle_name: 'Иванович', email: 'ivan@example.com', phone_number: '+79991234567',
        date_of_birth: '1992-07-15', account_created_at: '2026-01-02T12:00:00Z', joined_at: '2026-10-22T12:00:00Z',
    };

    beforeEach(async () => {
        companyId.set(1);
        api.getMyProfile.mockReset().mockReturnValue(of(profile));
        await TestBed.configureTestingModule({
            imports: [Profile],
            providers: [
                { provide: ProfileApiService, useValue: api },
                { provide: CompanyContextService, useValue: { activeCompanyId: companyId.asReadonly() } },
            ],
        }).compileComponents();
    });

    function create(): void {
        fixture = TestBed.createComponent(Profile);
        fixture.detectChanges();
    }

    it('shows employee details and distinguishes account creation from joining the company', () => {
        create();
        expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Иван Иванов');
        expect(fixture.nativeElement.querySelector('[data-testid="employee-first-name"]').textContent).toBe('Иван');
        expect(fixture.nativeElement.querySelector('[data-testid="employee-last-name"]').textContent).toBe('Иванов');
        expect(fixture.nativeElement.querySelector('[data-testid="employee-middle-name"]').textContent).toBe('Иванович');
        expect(fixture.nativeElement.textContent).toContain(profile.email);
        expect(fixture.nativeElement.textContent).toContain(profile.phone_number);
        expect(fixture.nativeElement.querySelector('[data-testid="employee-birth-date"]').textContent).toBe('15.07.1992');
        expect(fixture.nativeElement.querySelector('[data-testid="profile-created-at"]').textContent).toContain('02.01.2026');
        expect(fixture.nativeElement.querySelector('[data-testid="profile-joined-at"]').textContent).toContain('22.10.2026');
        expect(fixture.nativeElement.querySelector('input')).toBeNull();
    });

    it('clears Company A data immediately and cancels its late response after switching to Company B', () => {
        const old = new Subject<MyProfile>();
        const latest = new Subject<MyProfile>();
        api.getMyProfile.mockReturnValueOnce(old).mockReturnValueOnce(latest);
        create();
        companyId.set(2);
        fixture.detectChanges();
        expect(old.observed).toBe(false);
        expect(fixture.nativeElement.textContent).not.toContain('ivan@example.com');
        old.next(profile);
        old.error(new Error('old failure'));
        latest.next({ ...profile, company_id: 2, company_name: 'Company B', email: 'work@example.org' });
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('work@example.org');
        expect(fixture.nativeElement.textContent).not.toContain('ivan@example.com');
        expect(fixture.componentInstance.state()).toBe('ready');
    });

    it('supports loading, error and retry without displaying stale personal details', () => {
        api.getMyProfile.mockReturnValueOnce(throwError(() => new Error('offline'))).mockReturnValue(of(profile));
        create();
        expect(fixture.nativeElement.querySelector('[data-testid="profile-error"]')).not.toBeNull();
        fixture.nativeElement.querySelector('[data-testid="profile-retry"]').click();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-testid="profile-details"]')).not.toBeNull();
    });

    it('handles legacy empty details and no selected company', () => {
        api.getMyProfile.mockReturnValue(of({ ...profile, first_name: null, last_name: null, middle_name: null,
            full_name: null, email: null, phone_number: null, date_of_birth: null }));
        create();
        expect(fixture.nativeElement.textContent).toContain('Не указано');
        expect(fixture.nativeElement.textContent).toContain('Не указана');
        companyId.set(null);
        fixture.detectChanges();
        expect(fixture.componentInstance.profile()).toBeNull();
        expect(fixture.nativeElement.textContent).toContain('Выберите компанию');
    });

    it('keeps a historical full name intact without guessing its parts', () => {
        api.getMyProfile.mockReturnValue(of({ ...profile, first_name: null, last_name: null, middle_name: null,
            full_name: 'Историческое неразделённое имя' }));
        create();
        expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Историческое неразделённое имя');
        expect(fixture.nativeElement.querySelector('[data-testid="employee-first-name"]').textContent).toBe('Не указано');
        expect(fixture.nativeElement.querySelector('[data-testid="employee-legacy-name"]').textContent).toBe('Историческое неразделённое имя');
    });
});
