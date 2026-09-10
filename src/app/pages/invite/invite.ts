import {
  ChangeDetectionStrategy,
  Component,
  inject
} from '@angular/core';

import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideMoreHorizontal,
  lucidePlus,
} from '@ng-icons/lucide';

import { InviteTable } from '../../shared/invite-table/invite-table';

import { PermissionCode } from '../../core/permissions/permission.models';
import { PermissionService } from '../../core/permissions/permission.service';


@Component({
  selector: 'app-invite',
  imports: [
    NgIcon,
    HlmTabsImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    InviteTable
  ],
  providers: [
    provideIcons({
      lucideMoreHorizontal,
      lucidePlus,
    })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite.html',
  styleUrl: './invite.css',
})
export class Invite {
  private readonly permissions =
    inject(PermissionService);

  readonly canCreateInvite =
    this.permissions.canSignal(
      PermissionCode.MembersManage,
    );


  protected _invites = [
    {
      id: 1,
      code: '0a0f35d0e576459c',
      created: '2026-01-01 00:00:00',
      expired: '2026-01-01 00:05:00',
      status: 'success',
      owner: 'Реутский Д.А.',
      host: '10.110.5.61',
      device: 'Windows 10',
    },
  ];
}
