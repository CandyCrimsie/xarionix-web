import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import type {
  CompanyInvitation,
  InvitationStatus,
} from '../../core/invitations/invitation.models';

import { InviteTable } from './invite-table';


function invitation(
  id: number,
  status: InvitationStatus,
): CompanyInvitation {
  return {
    id,
    company_id: 1,
    token_prefix: `token${id}`,
    expires_at: '2026-10-10T12:00:00Z',
    accepted_at:
      status === 'accepted'
        ? '2026-10-09T12:00:00Z'
        : null,
    revoked_at:
      status === 'revoked'
        ? '2026-10-09T12:00:00Z'
        : null,
    created_at: '2026-10-08T12:00:00Z',
    updated_at: '2026-10-08T12:00:00Z',
    status,
    created_by_username: 'admin',
  };
}


describe('InviteTable', () => {
  let component: InviteTable;
  let fixture: ComponentFixture<InviteTable>;


  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteTable],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteTable);
    component = fixture.componentInstance;
  });


  it('should render all invitation status variants', () => {
    fixture.componentRef.setInput(
      'invitations',
      [
        invitation(1, 'pending'),
        invitation(2, 'accepted'),
        invitation(3, 'expired'),
        invitation(4, 'revoked'),
      ],
    );
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Ожидает');
    expect(element.textContent).toContain('Принято');
    expect(element.textContent).toContain('Истекло');
    expect(element.textContent).toContain('Отозвано');
    expect(element.textContent).not.toContain('Хост');
    expect(element.textContent).not.toContain('Устройство');
  });


  it('should show revoke only for pending invitations with permission', () => {
    fixture.componentRef.setInput('canManage', true);
    fixture.componentRef.setInput(
      'invitations',
      [
        invitation(1, 'pending'),
        invitation(2, 'accepted'),
      ],
    );
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(
      element.querySelector('[data-testid="revoke-invitation-1"]'),
    ).not.toBeNull();
    expect(
      element.querySelector('[data-testid="revoke-invitation-2"]'),
    ).toBeNull();
  });


  it('should hide invitation actions without permission', () => {
    fixture.componentRef.setInput('canManage', false);
    fixture.componentRef.setInput(
      'invitations',
      [invitation(1, 'pending')],
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="revoke-invitation-1"]',
      ),
    ).toBeNull();
  });
});
