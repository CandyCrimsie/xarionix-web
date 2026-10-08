import { signal } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import {
  ActivatedRoute,
  convertToParamMap,
  Router,
} from '@angular/router';

import {
  of,
  Subject,
  throwError,
} from 'rxjs';

import {
  HttpErrorResponse,
} from '@angular/common/http';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { CompanyContextService } from '../../core/company/company-context.service';
import { InvitationApiService } from '../../core/invitations/invitation-api.service';
import type { PublicInvitation } from '../../core/invitations/invitation.models';
import { InvitationAcceptance } from './invitation-acceptance';


const pendingInvitation: PublicInvitation = {
  company: {
    name: 'Main Company',
    short_name: 'MAIN',
  },
  expires_at: '2026-10-10T12:00:00Z',
  status: 'pending',
};


describe('InvitationAcceptance', () => {
  let component: InvitationAcceptance;
  let fixture: ComponentFixture<InvitationAcceptance>;

  const authenticated = signal(false);
  const currentUser = signal<{
    id: number;
    username: string;
    is_active: boolean;
    is_system_admin: boolean;
    created_at: string;
    updated_at: string;
  } | null>(null);

  const invitationApi = {
    getPublic: vi.fn(() => of(pendingInvitation)),
    acceptNew: vi.fn(),
    acceptExisting: vi.fn(),
  };

  const auth = {
    isAuthenticated: authenticated.asReadonly(),
    user: currentUser.asReadonly(),
  };

  const companyContext = {
    loadAvailableCompanies: vi.fn(() => of([])),
  };

  const router = {
    navigateByUrl: vi.fn(() => Promise.resolve(true)),
  };


  beforeEach(async () => {
    vi.clearAllMocks();
    authenticated.set(false);
    currentUser.set(null);
    invitationApi.getPublic.mockReturnValue(
      of(pendingInvitation),
    );
    companyContext.loadAvailableCompanies.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [InvitationAcceptance],
      providers: [
        {
          provide: InvitationApiService,
          useValue: invitationApi,
        },
        {
          provide: AuthService,
          useValue: auth,
        },
        {
          provide: CompanyContextService,
          useValue: companyContext,
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                token: 'public-token',
              }),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(
      InvitationAcceptance,
    );
    component = fixture.componentInstance;
    fixture.detectChanges();
  });


  it('should validate token and render company details', () => {
    expect(invitationApi.getPublic).toHaveBeenCalledWith(
      'public-token',
    );
    expect(component.state()).toBe('ready');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="invitation-company-name"]',
      ).textContent,
    ).toContain('Main Company');
  });


  it('should expose validation error and retry', () => {
    invitationApi.getPublic.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 404,
      })),
    );

    component.loadInvitation();
    fixture.detectChanges();

    expect(component.state()).toBe('error');
    expect(component.errorMessage()).toBe(
      'Приглашение не найдено',
    );

    invitationApi.getPublic.mockReturnValue(
      of(pendingInvitation),
    );
    component.loadInvitation();

    expect(component.state()).toBe('ready');
  });


  it('should accept invitation for a new user and navigate to login', () => {
    invitationApi.acceptNew.mockReturnValue(of({
      user: {},
      company_id: 1,
    }));

    component.form.setValue({
      username: '  Employee  ',
      password: 'password123',
      confirmPassword: 'password123',
    });

    component.submitNewUser();

    expect(invitationApi.acceptNew).toHaveBeenCalledWith(
      'public-token',
      {
        username: 'employee',
        password: 'password123',
      },
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });


  it('should reject mismatched passwords without calling API', () => {
    component.form.setValue({
      username: 'employee',
      password: 'password123',
      confirmPassword: 'password456',
    });

    component.submitNewUser();

    expect(invitationApi.acceptNew).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Пароли не совпадают');
  });


  it('should let authenticated user join and refresh company switcher', () => {
    authenticated.set(true);
    currentUser.set({
      id: 9,
      username: 'existing-user',
      is_active: true,
      is_system_admin: false,
      created_at: '',
      updated_at: '',
    });
    invitationApi.acceptExisting.mockReturnValue(of({
      user: currentUser(),
      company_id: 2,
    }));

    component.acceptExisting();

    expect(invitationApi.acceptExisting).toHaveBeenCalledWith(
      'public-token',
    );
    expect(
      companyContext.loadAvailableCompanies,
    ).toHaveBeenCalledTimes(1);
    expect(component.state()).toBe('accepted');
  });


  it('should not retry acceptance when switcher refresh fails', () => {
    authenticated.set(true);
    currentUser.set({
      id: 9,
      username: 'existing-user',
      is_active: true,
      is_system_admin: false,
      created_at: '',
      updated_at: '',
    });
    invitationApi.acceptExisting.mockReturnValue(of({
      user: currentUser(),
      company_id: 2,
    }));
    companyContext.loadAvailableCompanies.mockReturnValue(
      throwError(() => new Error('refresh failed')),
    );

    component.acceptExisting();

    expect(invitationApi.acceptExisting).toHaveBeenCalledTimes(1);
    expect(component.state()).toBe('accepted');
    expect(component.errorMessage()).toBeNull();
  });


  it('should preserve loading state until validation completes', () => {
    const response = new Subject<PublicInvitation>();
    invitationApi.getPublic.mockReturnValue(response);

    component.loadInvitation();

    expect(component.state()).toBe('loading');

    response.next(pendingInvitation);
    response.complete();

    expect(component.state()).toBe('ready');
  });
});
