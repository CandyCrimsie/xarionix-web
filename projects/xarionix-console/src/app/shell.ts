import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { Router, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { Session } from './core/session';
import { UI, ICONS } from './shared/ui';
import { ActionDialogs } from './shared/actions';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  permission?: string;
}
@Component({
  selector: 'console-shell',
  imports: [
    UI,
    RouterOutlet,
    RouterLinkActive,
    HlmSidebarImports,
    HlmDropdownMenuImports,
    ActionDialogs,
  ],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div hlmSidebarWrapper>
      <hlm-sidebar collapsible="icon">
        <div hlmSidebarHeader class="px-4 py-5">
          <a routerLink="/dashboard" class="flex items-center gap-3 font-semibold tracking-tight"
            ><span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm"
              >X</span
            ><span class="group-data-[collapsible=icon]:hidden"
              >Xarionix <span class="font-normal text-muted-foreground">Console</span></span
            ></a
          >
        </div>
        <div hlmSidebarContent>
          <div hlmSidebarGroup>
            <div hlmSidebarGroupLabel>Рабочее пространство</div>
            <ul hlmSidebarMenu>
              @for (item of main; track item.path) {
                <li hlmSidebarMenuItem>
                  <a
                    hlmSidebarMenuButton
                    [routerLink]="item.path"
                    routerLinkActive
                    #active="routerLinkActive"
                    [isActive]="active.isActive"
                    [tooltip]="item.label"
                    ><ng-icon [name]="item.icon" /><span>{{ item.label }}</span></a
                  >
                </li>
              }
            </ul>
          </div>
          @if (session.company(); as company) {
            <div hlmSidebarGroup>
              <div hlmSidebarGroupLabel class="truncate">{{ company.name }}</div>
              <ul hlmSidebarMenu>
                @for (item of companyNav(); track item.path) {
                  <li hlmSidebarMenuItem>
                    <a
                      hlmSidebarMenuButton
                      [routerLink]="item.path"
                      routerLinkActive
                      #active="routerLinkActive"
                      [isActive]="active.isActive"
                      [tooltip]="item.label"
                      ><ng-icon [name]="item.icon" /><span>{{ item.label }}</span></a
                    >
                  </li>
                }
              </ul>
            </div>
          }
          @if (session.admin() === 'allowed' || session.admin() === 'mfa') {
            <div hlmSidebarGroup>
              <div hlmSidebarGroupLabel>Платформа</div>
              <ul hlmSidebarMenu>
                @for (item of platform; track item.path) {
                  <li hlmSidebarMenuItem>
                    <a
                      hlmSidebarMenuButton
                      [routerLink]="item.path"
                      routerLinkActive
                      #active="routerLinkActive"
                      [isActive]="active.isActive"
                      [tooltip]="item.label"
                      ><ng-icon [name]="item.icon" /><span>{{ item.label }}</span></a
                    >
                  </li>
                }
              </ul>
            </div>
          }
        </div>
        <div hlmSidebarFooter>
          <a hlmSidebarMenuButton routerLink="/profile"
            ><ng-icon name="lucideUser" /><span>{{
              session.profile()?.display_name || 'Профиль'
            }}</span></a
          >
        </div>
      </hlm-sidebar>
      <main hlmSidebarInset class="min-w-0">
        <header
          class="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 sm:px-7"
        >
          <div class="flex min-w-0 items-center gap-3">
            <button hlmSidebarTrigger aria-label="Открыть навигацию"></button
            ><span class="text-sm text-muted-foreground">Платформа</span
            ><span class="text-muted-foreground/40">/</span
            ><span class="truncate text-sm font-medium">{{ title() }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button
              hlmBtn
              variant="ghost"
              size="icon"
              (click)="toggleTheme()"
              [hlmTooltip]="dark() ? 'Светлая тема' : 'Тёмная тема'"
              [attr.aria-label]="dark() ? 'Светлая тема' : 'Тёмная тема'"
            >
              <ng-icon [name]="dark() ? 'lucideSun' : 'lucideMoon'" />
            </button>
            <button
              hlmBtn
              variant="ghost"
              size="icon"
              [hlmDropdownMenuTrigger]="profileMenu"
              aria-label="Меню профиля"
            >
              <ng-icon name="lucideUser" />
            </button>
            <ng-template #profileMenu
              ><hlm-dropdown-menu
                ><a hlmDropdownMenuItem routerLink="/profile">Профиль</a
                ><hlm-dropdown-menu-separator /><button
                  hlmDropdownMenuItem
                  (click)="session.auth.logout()"
                >
                  <ng-icon name="lucideLogOut" />Выйти
                </button></hlm-dropdown-menu
              ></ng-template
            >
          </div>
        </header>
        <div class="mx-auto w-full max-w-7xl p-4 sm:p-7 lg:p-9">
          @if (session.auth.state() === 'expired') {
            <div class="mb-5 rounded-lg border p-4 text-sm">
              Сессия истекла.
              <button hlmBtn variant="link" (click)="session.auth.login(router.url)">
                Войти снова
              </button>
            </div>
          }
          @if (session.admin() === 'mfa') {
            <div
              class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4 text-sm"
            >
              <span>Для управления платформой требуется свежий вход с MFA.</span
              ><button
                hlmBtn
                variant="outline"
                size="sm"
                (click)="session.auth.login(router.url, true)"
              >
                Подтвердить MFA
              </button>
            </div>
          }
          <router-outlet />
        </div>
      </main>
    </div>
    <console-actions />
  `,
})
export class Shell {
  readonly session = inject(Session);
  readonly router = inject(Router);
  readonly dark = signal(document.documentElement.classList.contains('dark'));
  readonly main: NavItem[] = [
    { label: 'Обзор', path: '/dashboard', icon: 'lucideLayoutDashboard' },
    { label: 'Компании', path: '/companies', icon: 'lucideBuilding2' },
    { label: 'Мои заявки', path: '/company-requests', icon: 'lucideClipboard' },
  ];
  readonly platform: NavItem[] = [
    { label: 'Пользователи', path: '/platform/users', icon: 'lucideUsers' },
    { label: 'Компании', path: '/platform/companies', icon: 'lucideBuilding2' },
    { label: 'Заявки', path: '/platform/requests', icon: 'lucideClipboard' },
    { label: 'Администраторы', path: '/platform/admins', icon: 'lucideShieldCheck' },
    { label: 'Издатели', path: '/platform/publishers', icon: 'lucideKeyRound' },
    { label: 'Пакеты', path: '/platform/packages', icon: 'lucideFileBox' },
    { label: 'Установленные модули', path: '/platform/installations', icon: 'lucidePackage' },
    { label: 'Deployment hosts', path: '/platform/hosts', icon: 'lucideServer' },
    { label: 'Runtime', path: '/platform/runtime', icon: 'lucideActivity' },
    { label: 'Операции', path: '/platform/operations', icon: 'lucideRefreshCw' },
    { label: 'Аудит', path: '/platform/audit', icon: 'lucideClipboard' },
    { label: 'Настройки', path: '/platform/settings', icon: 'lucideSettings' },
  ];
  readonly companyNav = computed(() => {
    const id = this.session.company()?.id;
    return [
      {
        label: 'Компания',
        path: `/companies/${id}`,
        icon: 'lucideBuilding2',
        permission: 'core.company.read',
      },
      {
        label: 'Участники',
        path: `/companies/${id}/members`,
        icon: 'lucideUsers',
        permission: 'core.members.read',
      },
      {
        label: 'Сотрудники',
        path: `/companies/${id}/employees`,
        icon: 'lucideUser',
        permission: 'core.employees.read',
      },
      {
        label: 'Приглашения',
        path: `/companies/${id}/invitations`,
        icon: 'lucideClipboard',
        permission: 'core.invitations.manage',
      },
      {
        label: 'Роли и права',
        path: `/companies/${id}/roles`,
        icon: 'lucideShieldCheck',
        permission: 'core.roles.read',
      },
    ].filter((item) => this.session.can(item.permission));
  });
  readonly title = signal('Обзор');
  constructor() {
    effect(() => {
      if (this.session.auth.state() === 'expired')
        void this.router.navigate(['/login'], { queryParams: { returnTo: this.router.url } });
    });
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      let route = this.router.routerState.snapshot.root;
      while (route.firstChild) route = route.firstChild;
      this.title.set(String(route.data['title'] ?? 'Console'));
    });
  }
  toggleTheme(): void {
    this.dark.update((v) => !v);
    document.documentElement.classList.toggle('dark', this.dark());
    localStorage.setItem('xarionix.console.theme', this.dark() ? 'dark' : 'light');
  }
}
