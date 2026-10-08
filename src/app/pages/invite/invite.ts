import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideLoaderCircle,
  lucidePlus,
  lucideRefreshCw,
} from '@ng-icons/lucide';

import { InviteTable } from '../../shared/invite-table/invite-table';
import { CompanyContextService } from '../../core/company/company-context.service';
import { InvitationApiService } from '../../core/invitations/invitation-api.service';

import type {
  CompanyInvitation,
  InvitationScope,
} from '../../core/invitations/invitation.models';

import {
  PermissionCode,
  PermissionScope,
} from '../../core/permissions/permission.models';

import { PermissionService } from '../../core/permissions/permission.service';


type InvitationListState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';


@Component({
  selector: 'app-invite',
  imports: [
    FormsModule,
    NgIcon,
    HlmTabsImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    InviteTable,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideCopy,
      lucideLoaderCircle,
      lucidePlus,
      lucideRefreshCw,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite.html',
  styleUrl: './invite.css',
})
export class Invite {
  private readonly invitationApi =
    inject(InvitationApiService);

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly permissions =
    inject(PermissionService);

  private readonly reloadVersion = signal(0);


  readonly canManageInvitations =
    this.permissions.canSignal(
      PermissionCode.MembersManage,
      PermissionScope.Company,
    );

  readonly scope = signal<InvitationScope>('mine');

  readonly invitations = signal<CompanyInvitation[]>([]);

  readonly state = signal<InvitationListState>('idle');

  readonly createExpiresHours = signal(72);
  readonly createSaving = signal(false);
  readonly createError = signal<string | null>(null);
  readonly createdLink = signal<string | null>(null);
  readonly linkCopied = signal(false);
  readonly revokingId = signal<number | null>(null);
  readonly revokeError = signal<string | null>(null);


  constructor() {
    effect(onCleanup => {
      this.reloadVersion();

      const companyId =
        this.companyContext.activeCompanyId();

      const scope = this.scope();

      if (
        companyId === null
        || !this.canManageInvitations()
      ) {
        this.invitations.set([]);
        this.state.set('idle');
        return;
      }

      this.state.set('loading');
      this.revokeError.set(null);

      const subscription =
        this.invitationApi
          .list(companyId, scope)
          .subscribe({
            next: invitations => {
              this.invitations.set(invitations);
              this.state.set('ready');
            },
            error: () => {
              this.invitations.set([]);
              this.state.set('error');
            },
          });

      onCleanup(() => subscription.unsubscribe());
    });
  }


  selectScope(scope: InvitationScope): void {
    this.scope.set(scope);
  }


  retry(): void {
    this.reloadVersion.update(
      version => version + 1,
    );
  }


  resetCreate(): void {
    this.createExpiresHours.set(72);
    this.createSaving.set(false);
    this.createError.set(null);
    this.createdLink.set(null);
    this.linkCopied.set(false);
  }


  createInvitation(): void {
    const companyId =
      this.companyContext.activeCompanyId();

    const expiresInHours =
      Number(this.createExpiresHours());

    if (
      companyId === null
      || this.createSaving()
      || !this.canManageInvitations()
    ) {
      return;
    }

    if (
      !Number.isInteger(expiresInHours)
      || expiresInHours < 1
      || expiresInHours > 720
    ) {
      this.createError.set(
        'Укажите срок от 1 до 720 часов',
      );
      return;
    }

    this.createSaving.set(true);
    this.createError.set(null);

    this.invitationApi
      .create(
        companyId,
        { expires_in_hours: expiresInHours },
      )
      .subscribe({
        next: invitation => {
          this.createSaving.set(false);
          this.createdLink.set(
            `${window.location.origin}/invite/${invitation.token}`,
          );
          this.linkCopied.set(false);
          this.retry();
        },
        error: error => {
          this.createSaving.set(false);
          this.createError.set(
            this.getCreateError(error),
          );
        },
      });
  }


  async copyCreatedLink(): Promise<void> {
    const link = this.createdLink();

    if (link === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      this.linkCopied.set(true);
    } catch {
      this.createError.set(
        'Не удалось скопировать ссылку',
      );
    }
  }


  revokeInvitation(
    invitation: CompanyInvitation,
  ): void {
    const companyId =
      this.companyContext.activeCompanyId();

    if (
      companyId === null
      || invitation.status !== 'pending'
      || this.revokingId() !== null
      || !this.canManageInvitations()
    ) {
      return;
    }

    this.revokingId.set(invitation.id);
    this.revokeError.set(null);

    this.invitationApi
      .revoke(companyId, invitation.id)
      .subscribe({
        next: () => {
          this.revokingId.set(null);
          this.retry();
        },
        error: () => {
          this.revokingId.set(null);
          this.revokeError.set(
            'Не удалось отозвать приглашение',
          );
        },
      });
  }


  private getCreateError(error: unknown): string {
    if (
      error instanceof HttpErrorResponse
      && error.status === 422
    ) {
      return 'Проверьте срок действия приглашения';
    }

    if (
      error instanceof HttpErrorResponse
      && error.status === 403
    ) {
      return 'Недостаточно прав для создания приглашения';
    }

    return 'Не удалось создать приглашение';
  }
}
