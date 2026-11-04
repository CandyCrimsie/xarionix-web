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
        path: 'platform',
        canActivateChild: [adminGuard],
        children: [
          {
            path: 'users',
            data: { title: 'Пользователи' },
            loadComponent: () => import('./pages/platform').then((m) => m.PlatformUsersPage),
          },
          {
            path: 'admins',
            data: { title: 'Администраторы' },
            loadComponent: () => import('./pages/platform').then((m) => m.PlatformAdminsPage),
          },
          {
            path: 'settings',
            data: { title: 'Настройки' },
            loadComponent: () => import('./pages/platform').then((m) => m.PlatformSettingsPage),
          },
          {
            path: 'audit',
            data: { title: 'Аудит' },
            loadComponent: () => import('./pages/platform').then((m) => m.AuditPage),
          },
          {
            path: 'companies',
            data: { title: 'Компании платформы', platform: true },
            loadComponent: () => import('./pages/companies').then((m) => m.CompaniesPage),
          },
          {
            path: 'requests',
            data: { title: 'Заявки', platform: true },
            loadComponent: () => import('./pages/companies').then((m) => m.RequestsPage),
          },
          {
            path: 'publishers',
            data: { title: 'Издатели' },
            loadComponent: () => import('./pages/publishers').then((m) => m.PublishersPage),
          },
          {
            path: 'publishers/:id',
            data: { title: 'Издатель' },
            loadComponent: () => import('./pages/publishers').then((m) => m.PublisherPage),
          },
          {
            path: 'packages',
            data: { title: 'Пакеты' },
            loadComponent: () => import('./pages/packages').then((m) => m.PackagesPage),
          },
          {
            path: 'packages/:id',
            data: { title: 'Пакет' },
            loadComponent: () => import('./pages/packages').then((m) => m.PackagePage),
          },
          {
            path: 'installations',
            data: { title: 'Установленные модули' },
            loadComponent: () => import('./pages/installations').then((m) => m.InstallationsPage),
          },
          {
            path: 'installations/:id',
            data: { title: 'Модуль' },
            loadComponent: () => import('./pages/installations').then((m) => m.InstallationPage),
          },
          {
            path: 'install-plans/:id',
            data: { title: 'План установки' },
            loadComponent: () => import('./pages/install-plan').then((m) => m.InstallPlanPage),
          },
          {
            path: 'operations',
            data: { title: 'Операции' },
            loadComponent: () => import('./pages/installations').then((m) => m.OperationsPage),
          },
          {
            path: 'hosts',
            data: { title: 'Deployment hosts' },
            loadComponent: () => import('./pages/hosts').then((m) => m.HostsPage),
          },
          {
            path: 'runtime',
            data: { title: 'Runtime' },
            loadComponent: () => import('./pages/runtime').then((m) => m.RuntimesPage),
          },
          {
            path: 'runtime/:id',
            data: { title: 'Runtime модуля' },
            loadComponent: () => import('./pages/runtime').then((m) => m.RuntimePage),
          },
          {
            path: 'deployment-plans/:id',
            data: { title: 'Deployment-план' },
            loadComponent: () => import('./pages/runtime').then((m) => m.DeploymentPlanPage),
          },
        ],
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
