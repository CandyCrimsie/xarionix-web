import { Routes } from '@angular/router';
import { authGuard, companyGuard, adminGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/auth-page').then((m) => m.AuthPage) },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'auth/logged-out',
    loadComponent: () => import('./pages/auth-page').then((m) => m.AuthPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        data: { title: 'Обзор' },
        loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'profile',
        data: { title: 'Профиль' },
        loadComponent: () => import('./pages/profile').then((m) => m.ProfilePage),
      },
      {
        path: 'companies',
        data: { title: 'Компании' },
        loadComponent: () => import('./pages/companies').then((m) => m.CompaniesPage),
      },
      {
        path: 'companies/:companyId/members',
        canActivate: [companyGuard],
        data: { title: 'Участники', permission: 'core.members.read' },
        loadComponent: () => import('./pages/people').then((m) => m.MembersPage),
      },
      {
        path: 'companies/:companyId/employees',
        canActivate: [companyGuard],
        data: { title: 'Сотрудники', permission: 'core.employees.read' },
        loadComponent: () => import('./pages/people').then((m) => m.EmployeesPage),
      },
      {
        path: 'companies/:companyId/invitations',
        canActivate: [companyGuard],
        data: { title: 'Приглашения', permission: 'core.invitations.manage' },
        loadComponent: () => import('./pages/people').then((m) => m.InvitationsPage),
      },
      {
        path: 'companies/:companyId/roles',
        canActivate: [companyGuard],
        data: { title: 'Роли и права', permission: 'core.roles.read' },
        loadComponent: () => import('./pages/roles').then((m) => m.RolesPage),
      },
      {
        path: 'companies/:companyId',
        canActivate: [companyGuard],
        data: { title: 'Компания', permission: 'core.company.read' },
        loadComponent: () => import('./pages/companies').then((m) => m.CompanyPage),
      },
      {
        path: 'company-requests',
        data: { title: 'Мои заявки' },
        loadComponent: () => import('./pages/companies').then((m) => m.RequestsPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        canActivateChild: [adminGuard],
        loadChildren: () => import('./admin.routes').then((m) => m.adminRoutes),
      },
      { path: 'platform/users', redirectTo: '/admin/users', pathMatch: 'full' },
      { path: 'platform/admins', redirectTo: '/admin/admins', pathMatch: 'full' },
      { path: 'platform/settings', redirectTo: '/admin/settings', pathMatch: 'full' },
      { path: 'platform/audit', redirectTo: '/admin/audit', pathMatch: 'full' },
      { path: 'platform/companies', redirectTo: '/admin/companies', pathMatch: 'full' },
      { path: 'platform/requests', redirectTo: '/admin/requests', pathMatch: 'full' },
      { path: 'platform/publishers', redirectTo: '/admin/publishers', pathMatch: 'full' },
      { path: 'platform/publishers/:id', redirectTo: '/admin/publishers/:id', pathMatch: 'full' },
      { path: 'platform/packages', redirectTo: '/admin/modules/packages', pathMatch: 'full' },
      {
        path: 'platform/packages/:id',
        redirectTo: '/admin/modules/packages/:id',
        pathMatch: 'full',
      },
      {
        path: 'platform/installations',
        redirectTo: '/admin/modules/installations',
        pathMatch: 'full',
      },
      {
        path: 'platform/installations/:id',
        redirectTo: '/admin/modules/installations/:id',
        pathMatch: 'full',
      },
      {
        path: 'platform/install-plans/:id',
        redirectTo: '/admin/modules/install-plans/:id',
        pathMatch: 'full',
      },
      { path: 'platform/operations', redirectTo: '/admin/modules/operations', pathMatch: 'full' },
      { path: 'platform/hosts', redirectTo: '/admin/modules/hosts', pathMatch: 'full' },
      { path: 'platform/runtime', redirectTo: '/admin/modules/runtime', pathMatch: 'full' },
      { path: 'platform/runtime/:id', redirectTo: '/admin/modules/runtime/:id', pathMatch: 'full' },
      {
        path: 'platform/deployment-plans/:id',
        redirectTo: '/admin/modules/deployment-plans/:id',
        pathMatch: 'full',
      },
      {
        path: 'addresses',
        data: { title: 'Карта и адреса' },
        loadComponent: () => import('./erp/map-page').then((m) => m.PlatformErpMapPage),
      },
      {
        path: 'modules/hello-business',
        data: { title: 'Деловые записи' },
        loadComponent: () => import('./pages/hello-business').then((m) => m.HelloBusinessPage),
      },
      {
        path: 'modules',
        data: { title: 'Модули компании' },
        loadComponent: () => import('./pages/module-workspace').then((m) => m.ModuleWorkspacePage),
      },
      {
        path: 'unavailable',
        data: { title: 'Доступ' },
        loadComponent: () => import('./pages/unavailable').then((m) => m.UnavailablePage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
