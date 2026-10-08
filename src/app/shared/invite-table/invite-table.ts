import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBan,
  lucideCheck,
  lucideClock3,
  lucideLoaderCircle,
  lucideX,
} from '@ng-icons/lucide';

import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';

import type {
  CompanyInvitation,
  InvitationStatus,
} from '../../core/invitations/invitation.models';


@Component({
  selector: 'app-invite-table',
  imports: [
    DatePipe,
    NgIcon,
    HlmBadgeImports,
    HlmButtonImports,
    HlmTableImports,
  ],
  providers: [
    provideIcons({
      lucideBan,
      lucideCheck,
      lucideClock3,
      lucideLoaderCircle,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-table.html',
  styleUrl: './invite-table.css',
})
export class InviteTable {
  readonly invitations =
    input<readonly CompanyInvitation[]>([]);

  readonly canManage = input(false);

  readonly revokingId = input<number | null>(null);

  readonly revokeRequested =
    output<CompanyInvitation>();


  protected getStatusVariant(
    status: InvitationStatus,
  ): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
      case 'accepted':
        return 'default';

      case 'pending':
        return 'secondary';

      case 'expired':
        return 'outline';

      case 'revoked':
        return 'destructive';
    }
  }


  protected getStatusLabel(
    status: InvitationStatus,
  ): string {
    switch (status) {
      case 'accepted':
        return 'Принято';

      case 'pending':
        return 'Ожидает';

      case 'expired':
        return 'Истекло';

      case 'revoked':
        return 'Отозвано';
    }
  }
}
