import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CompanyContextService } from '../../core/company/company-context.service';

import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { toast } from '@spartan-ng/brain/sonner';
import { HlmToasterImports } from '@spartan-ng/helm/sonner';
import { HlmButtonImports } from '@spartan-ng/helm/button';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBell,
  lucideBriefcaseBusiness,
  lucideChevronsUpDown,
  lucideLayoutDashboard,
  lucideLogOut,
  lucideSettings2,
  lucideUserRound,
  lucideUserRoundPlus,
  lucideCheck,
  lucideLoaderCircle,
  lucideRefreshCw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';

import { PermissionCode } from '../../core/permissions/permission.models';
import { PermissionService } from '../../core/permissions/permission.service';


@Component({
  selector: 'app-app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    // RouterLinkActive,
    NgIcon,
    HlmSidebarImports,
    HlmDropdownMenuImports,
    HlmButtonImports,
    HlmToasterImports,
  ],
  providers: [
    provideIcons({
      lucideLayoutDashboard,
      lucideBriefcaseBusiness,
      lucideChevronsUpDown,
      lucideUserRound,
      lucideSettings2,
      lucideLogOut,
      lucideBell,
      lucideUserRoundPlus,
      lucideCheck,
      lucideLoaderCircle,
      lucideRefreshCw,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayout {
  readonly auth = inject(AuthService);

  readonly companyContext = inject(CompanyContextService);

  readonly permissions =
    inject(PermissionService);

  readonly canManageMembers =
    this.permissions.canSignal(
      PermissionCode.MembersManage,
    );

  private readonly router = inject(Router);


  retryPermissions(): void {
    this.permissions
      .initialize()
      .subscribe();
  }


  switchCompany(
    companyId: number,
  ): void {
    if (
      this.permissions.isLoading()
    ) {
      return;
    }

    const previousCompanyId =
      this.companyContext.activeCompanyId();

    if (
      previousCompanyId === companyId
    ) {
      return;
    }

    this.companyContext.switchCompany(
      companyId,
    );

    const company =
      this.companyContext.activeCompany();

    if (!company) {
      return;
    }

    toast.success(
      'Компания изменена',
      {
        description:
          `Активная компания: ${company.short_name
          || company.name
          }`,
      },
    );
  }


  logout(): void {
    this.auth.logout().subscribe({
      next: () => {
        this.companyContext.reset();

        void this.router.navigateByUrl(
          '/login',
        );
      },

      error: () => {
        this.companyContext.reset();

        void this.router.navigateByUrl(
          '/login',
        );
      },
    });
  }
}
