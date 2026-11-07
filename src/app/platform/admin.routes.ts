import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: 'modules/gateway',
    data: { title: 'Gateway модулей' },
    loadComponent: () => import('./pages/gateway').then((m) => m.GatewayPage),
  },
  {
    path: 'modules/install-plans',
    data: { title: 'Планы установки' },
    loadComponent: () => import('./pages/install-plans').then((m) => m.InstallPlansPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'modules/installations' },
  { path: 'modules', pathMatch: 'full', redirectTo: 'modules/installations' },

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
    path: 'modules/packages',
    data: { title: 'Пакеты' },
    loadComponent: () => import('./pages/packages').then((m) => m.PackagesPage),
  },
  {
    path: 'modules/packages/:id',
    data: { title: 'Пакет' },
    loadComponent: () => import('./pages/packages').then((m) => m.PackagePage),
  },
  {
    path: 'modules/installations',
    data: { title: 'Установленные модули' },
    loadComponent: () => import('./pages/installations').then((m) => m.InstallationsPage),
  },
  {
    path: 'modules/installations/:id',
    data: { title: 'Модуль' },
    loadComponent: () => import('./pages/installations').then((m) => m.InstallationPage),
  },
  {
    path: 'modules/install-plans/:id',
    data: { title: 'План установки' },
    loadComponent: () => import('./pages/install-plan').then((m) => m.InstallPlanPage),
  },
  {
    path: 'modules/operations',
    data: { title: 'Операции' },
    loadComponent: () => import('./pages/installations').then((m) => m.OperationsPage),
  },
  {
    path: 'modules/hosts',
    data: { title: 'Deployment hosts' },
    loadComponent: () => import('./pages/hosts').then((m) => m.HostsPage),
  },
  {
    path: 'modules/runtime',
    data: { title: 'Runtime' },
    loadComponent: () => import('./pages/runtime').then((m) => m.RuntimesPage),
  },
  {
    path: 'modules/runtime/:id',
    data: { title: 'Runtime модуля' },
    loadComponent: () => import('./pages/runtime').then((m) => m.RuntimePage),
  },
  {
    path: 'modules/deployment-plans/:id',
    data: { title: 'Deployment-план' },
    loadComponent: () => import('./pages/runtime').then((m) => m.DeploymentPlanPage),
  },
];
