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
});
