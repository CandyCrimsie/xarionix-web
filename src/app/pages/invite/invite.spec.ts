import { signal } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CompanyContextService } from '../../core/company/company-context.service';
import { InvitationApiService } from '../../core/invitations/invitation-api.service';
import type {
  CompanyInvitation,
  CompanyInvitationCreated,
} from '../../core/invitations/invitation.models';

import {
  PermissionCode,
  PermissionScope,
} from '../../core/permissions/permission.models';
import { PermissionService } from '../../core/permissions/permission.service';
import { Invite } from './invite';


const pendingInvitation: CompanyInvitation = {
  id: 5,
  company_id: 1,
  token_prefix: 'abc12345',
  expires_at: '2026-10-10T12:00:00Z',
  accepted_at: null,
  revoked_at: null,
  created_at: '2026-10-08T12:00:00Z',
  updated_at: '2026-10-08T12:00:00Z',
  status: 'pending',
  created_by_username: 'admin',
};


describe('Invite', () => {
  let component: Invite;
  let fixture: ComponentFixture<Invite>;

  const canManage = signal(true);
  const activeCompanyId = signal<number | null>(1);

  const invitationApi = {
    getPolicy: vi.fn(() => of({
      default_expire_hours: 18,
      max_expire_hours: 96,
    })),
    list: vi.fn(() => of([pendingInvitation])),
    create: vi.fn(),
    revoke: vi.fn(),
  };

  const companyContext = {
    activeCompanyId: activeCompanyId.asReadonly(),
  };

  const permissions = {
    canSignal: vi.fn(() => canManage.asReadonly()),
  };


  beforeEach(async () => {
    vi.clearAllMocks();
    canManage.set(true);
    activeCompanyId.set(1);
    invitationApi.list.mockReturnValue(
      of([pendingInvitation]),
    );
    invitationApi.getPolicy.mockReturnValue(of({
      default_expire_hours: 18,
      max_expire_hours: 96,
    }));

    await TestBed.configureTestingModule({
      imports: [Invite],
      providers: [
        {
          provide: InvitationApiService,
          useValue: invitationApi,
        },
        {
          provide: CompanyContextService,
          useValue: companyContext,
        },
        {
          provide: PermissionService,
          useValue: permissions,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Invite);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });


  it('should load my invitations for active company', () => {
    expect(permissions.canSignal).toHaveBeenCalledWith(
      PermissionCode.MembersManage,
      PermissionScope.Company,
    );
    expect(invitationApi.list).toHaveBeenCalledWith(1, 'mine');
    expect(component.state()).toBe('ready');
    expect(component.invitations()).toEqual([pendingInvitation]);
  });


  it('should use backend invitation expiration policy', () => {
    expect(invitationApi.getPolicy).toHaveBeenCalledTimes(1);
    expect(component.invitationPolicy()).toEqual({
      default_expire_hours: 18,
      max_expire_hours: 96,
    });
    expect(component.createExpiresHours()).toBe(18);

    component.resetCreate();

    expect(component.createExpiresHours()).toBe(18);
  });


  it('should validate expiration against backend maximum', () => {
    component.createExpiresHours.set(97);

    component.createInvitation();

    expect(invitationApi.create).not.toHaveBeenCalled();
    expect(component.createError()).toBe(
      'Укажите срок от 1 до 96 часов',
    );
  });


  it('should hide controls and avoid loading without permission', () => {
    canManage.set(false);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(
      element.querySelector('[data-testid="create-invite-action"]'),
    ).toBeNull();
    expect(component.state()).toBe('idle');
    expect(component.invitations()).toEqual([]);
  });


  it('should load all invitations after switching tabs', () => {
    component.selectScope('all');
    fixture.detectChanges();

    expect(invitationApi.list).toHaveBeenLastCalledWith(1, 'all');
  });


  it('should expose loading, error and retry states', () => {
    const loading = new Subject<CompanyInvitation[]>();
    invitationApi.list.mockReturnValue(loading);

    component.retry();
    fixture.detectChanges();

    expect(component.state()).toBe('loading');

    loading.error(new Error('network'));
    fixture.detectChanges();

    expect(component.state()).toBe('error');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="invitations-retry"]',
      ),
    ).not.toBeNull();

    invitationApi.list.mockReturnValue(of([]));
    component.retry();
    fixture.detectChanges();

    expect(component.state()).toBe('ready');
  });


  it('should create an invitation and expose its one-time link', () => {
    const created: CompanyInvitationCreated = {
      ...pendingInvitation,
      token: 'raw-secret-token',
    };

    invitationApi.create.mockReturnValue(of(created));
    component.createExpiresHours.set(24);

    component.createInvitation();

    expect(invitationApi.create).toHaveBeenCalledWith(
      1,
      { expires_in_hours: 24 },
    );
    expect(component.createdLink()).toBe(
      `${window.location.origin}/invite#raw-secret-token`,
    );
    expect(component.createdLink()).not.toContain(
      '/invite/raw-secret-token',
    );
    expect(component.createSaving()).toBe(false);
  });


  it('should copy the newly-created invitation link', async () => {
    const writeText = vi.fn(() => Promise.resolve());

    Object.defineProperty(
      navigator,
      'clipboard',
      {
        configurable: true,
        value: { writeText },
      },
    );

    component.createdLink.set('https://erp.test/invite#token');

    await component.copyCreatedLink();

    expect(writeText).toHaveBeenCalledWith(
      'https://erp.test/invite#token',
    );
    expect(component.linkCopied()).toBe(true);
  });


  it('should revoke a pending invitation and reload the list', () => {
    invitationApi.revoke.mockReturnValue(of({
      ...pendingInvitation,
      status: 'revoked',
    }));

    component.revokeInvitation(pendingInvitation);
    fixture.detectChanges();

    expect(invitationApi.revoke).toHaveBeenCalledWith(1, 5);
    expect(invitationApi.list).toHaveBeenCalledTimes(2);
    expect(component.revokingId()).toBeNull();
  });


  it('should keep create errors separate from list refresh', () => {
    invitationApi.create.mockReturnValue(
      throwError(() => new Error('network')),
    );

    component.createInvitation();

    expect(component.createError()).toBe(
      'Не удалось создать приглашение',
    );
    expect(component.createSaving()).toBe(false);
  });

  it('submits employee details from the actual Spartan dialog form and prevents duplicate submissions', async () => {
    const pending = new Subject<CompanyInvitationCreated>();
    invitationApi.create.mockReturnValue(pending);
    fixture.nativeElement.querySelector('[data-testid="create-invite-action"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    for (const [testId, value] of [
      ['invitation-first-name', '  Иван  '],
      ['invitation-last-name', '  Иванов  '],
      ['invitation-middle-name', '  Иванович  '],
      ['invitation-email', 'ivan@example.com'],
      ['invitation-phone', '+7 (999) 123-45-67'],
    ]) {
      const input = dialog.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const birthDate = dialog.querySelector<HTMLInputElement>('#invitation-birth-date')!;
    birthDate.value = '15.07.1992';
    birthDate.dispatchEvent(new Event('input', { bubbles: true }));
    birthDate.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    fixture.detectChanges();
    const form = dialog.querySelector<HTMLFormElement>('[data-testid="create-invite-form"]')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(invitationApi.create).toHaveBeenCalledExactlyOnceWith(1, {
      expires_in_hours: 18, first_name: 'Иван', last_name: 'Иванов', middle_name: 'Иванович', email: 'ivan@example.com',
      phone_number: '+79991234567', date_of_birth: '1992-07-15',
    });
    expect(dialog.querySelector<HTMLButtonElement>('[data-testid="create-invite-submit"]')!.type).toBe('submit');
  });

  it('rejects invalid personal details without calling the API', () => {
    component.createEmail.set('invalid');
    component.createInvitation();
    expect(invitationApi.create).not.toHaveBeenCalled();
    expect(component.createError()).toBe('Укажите корректный email');
    component.createEmail.set('');
    component.createDateOfBirth.set('2999-01-01');
    component.createInvitation();
    expect(invitationApi.create).not.toHaveBeenCalled();
    expect(component.createError()).toBe('Дата рождения не может быть в будущем');
  });

  it('clears employee details and ignores a late creation response after changing company', () => {
    const pending = new Subject<CompanyInvitationCreated>();
    invitationApi.create.mockReturnValue(pending);
    component.createFirstName.set('Иван');
    component.createLastName.set('Иванов');
    component.createMiddleName.set('Иванович');
    component.createEmail.set('ivan@example.com');
    component.createInvitation();
    activeCompanyId.set(2);
    fixture.detectChanges();
    pending.next({ ...pendingInvitation, token: 'old-company-secret' });
    expect(component.createFirstName()).toBe('');
    expect(component.createLastName()).toBe('');
    expect(component.createMiddleName()).toBe('');
    expect(component.createEmail()).toBe('');
    expect(component.createdLink()).toBeNull();
  });

  it('does not issue another POST when the completed link dialog is submitted again', () => {
    invitationApi.create.mockReturnValue(of({ ...pendingInvitation, token: 'one-time-link' }));
    component.createInvitation();
    component.createInvitation();
    expect(invitationApi.create).toHaveBeenCalledOnce();
  });

  async function openCreateDialog(): Promise<HTMLElement> {
    fixture.nativeElement.querySelector('[data-testid="create-invite-action"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return document.body.querySelector<HTMLElement>('[role="dialog"]')!;
  }

  it('uses a Spartan birthday picker with month/year dropdowns, an empty value and an 18-year focus anchor', async () => {
    const dialog = await openCreateDialog();
    const input = dialog.querySelector<HTMLInputElement>('#invitation-birth-date')!;
    expect(dialog.querySelector('input[name="fullName"]')).toBeNull();
    expect(dialog.querySelectorAll('input[maxlength="100"]').length).toBe(3);
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe('дд.ММ.гггг');
    expect(input.value).toBe('');
    expect(component.defaultBirthDateFocus.getFullYear()).toBe(new Date().getFullYear() - 18);
    const trigger = dialog.querySelector<HTMLButtonElement>('[aria-label="Открыть календарь"]')!;
    expect(trigger.type).toBe('button');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const calendar = document.body.querySelector<HTMLElement>('hlm-calendar')!;
    expect(calendar).not.toBeNull();
    expect(calendar.querySelectorAll('hlm-select').length).toBe(2);
    expect(calendar.querySelector('[aria-label="Предыдущий месяц"]')).not.toBeNull();
    expect(calendar.querySelector('th')?.textContent?.trim()).toBe('Пн');
    expect(calendar.querySelectorAll('button[brnCalendarCellButton]').length).toBeGreaterThan(27);
    expect(invitationApi.create).not.toHaveBeenCalled();
    const day = calendar.querySelector<HTMLButtonElement>('button[brnCalendarCellButton]:not([disabled])')!;
    day.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.createDateOfBirth()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(invitationApi.create).not.toHaveBeenCalled();
  });

  it('does not treat invalid manual birthday text as an empty optional value', async () => {
    const dialog = await openCreateDialog();
    const input = dialog.querySelector<HTMLInputElement>('#invitation-birth-date')!;
    input.value = '31.02.1992';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(invitationApi.create).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('Укажите дату рождения в формате дд.ММ.гггг');
    expect(input.value).toBe('31.02.1992');
    // Clearing invalid text intentionally is allowed, not a permanent error.
    dialog.querySelector<HTMLButtonElement>('[aria-label="Очистить дату"]')!.click();
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(component.birthDateError()).toBeNull();
    invitationApi.create.mockReturnValue(of({ ...pendingInvitation, token: 'without-birthday' }));
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(invitationApi.create).toHaveBeenCalledExactlyOnceWith(1, { expires_in_hours: 18 });
  });

  it('commits typed dates with Enter without submitting the invitation and disables the picker while saving', async () => {
    const dialog = await openCreateDialog();
    const input = dialog.querySelector<HTMLInputElement>('#invitation-birth-date')!;
    input.value = '29.02.2000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    fixture.detectChanges();
    expect(enter.defaultPrevented).toBe(true);
    expect(component.createDateOfBirth()).toBe('2000-02-29');
    expect(invitationApi.create).not.toHaveBeenCalled();
    invitationApi.create.mockReturnValue(new Subject<CompanyInvitationCreated>());
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(invitationApi.create).toHaveBeenCalledExactlyOnceWith(1, { expires_in_hours: 18, date_of_birth: '2000-02-29' });
    expect(input.disabled).toBe(true);
    expect(dialog.querySelector<HTMLButtonElement>('[aria-label="Открыть календарь"]')!.disabled).toBe(true);
  });

  it('rejects a future typed birthday before requesting creation', async () => {
    const dialog = await openCreateDialog();
    const input = dialog.querySelector<HTMLInputElement>('#invitation-birth-date')!;
    input.value = '01.01.2999';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(invitationApi.create).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('Дата рождения не может быть в будущем');
  });

  it.each(['31.02.1992', '15.07.1992'])('clears even uncommitted date text on company changes: %s', async value => {
    const dialog = await openCreateDialog();
    const input = dialog.querySelector<HTMLInputElement>('#invitation-birth-date')!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    activeCompanyId.set(2);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialog.querySelector<HTMLInputElement>('#invitation-birth-date')!.value).toBe('');
    expect(component.createDateOfBirth()).toBe('');
    expect(component.birthDateError()).toBeNull();
  });
});
