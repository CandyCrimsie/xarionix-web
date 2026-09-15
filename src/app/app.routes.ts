import {
    Routes,
} from '@angular/router';

import {
    AuthLayout,
} from './layouts/auth-layout/auth-layout';

import {
    AppLayout,
} from './layouts/app-layout/app-layout';

import {
    Home,
} from './pages/home/home';

import {
    Forbidden,
} from './pages/forbidden/forbidden';

import {
    authGuard,
} from './core/auth/auth-guard';

import {
    guestGuard,
} from './core/auth/guest-guard';

import {
    installationGuard,
} from './core/setup/installation-guard';

import {
    setupGuard,
} from './core/setup/setup-guard';

import {
    permissionGuard,
} from './core/permissions/permission-guard';

import {
    PermissionCode,
    PermissionScope,
} from './core/permissions/permission.models';


export const routes:
    Routes = [
        {
            path:
                'setup',

            canActivate: [
                setupGuard,
            ],

            loadComponent:
                () =>
                    import(
                        './pages/setup/setup'
                    )
                        .then(
                            module =>
                                module.Setup,
                        ),
        },
        {
            path:
                'login',

            canActivate: [
                installationGuard,
                guestGuard,
            ],

            component:
                AuthLayout,

            children: [
                {
                    path:
                        '',

                    loadComponent:
                        () =>
                            import(
                                './pages/login/login'
                            )
                                .then(
                                    module =>
                                        module.Login,
                                ),
                },
            ],
        },
        {
            path:
                '',

            canActivate: [
                installationGuard,
                authGuard,
            ],

            component:
                AppLayout,

            children: [
                {
                    path:
                        '',

                    /*
                     * Главная страница маленькая
                     * и является primary landing,
                     * поэтому оставляем eager.
                     */
                    component:
                        Home,
                },

                {
                    path:
                        'invite',

                    canActivate: [
                        permissionGuard(
                            PermissionCode
                                .MembersManage,
                        ),
                    ],

                    runGuardsAndResolvers:
                        'always',

                    loadComponent:
                        () =>
                            import(
                                './pages/invite/invite'
                            )
                                .then(
                                    module =>
                                        module.Invite,
                                ),
                },

                {
                    path:
                        'members',

                    canActivate: [
                        permissionGuard(
                            PermissionCode
                                .MembersRead,
                        ),
                    ],

                    runGuardsAndResolvers:
                        'always',

                    loadComponent:
                        () =>
                            import(
                                './pages/members/members'
                            )
                                .then(
                                    module =>
                                        module.Members,
                                ),
                },

                {
                    path:
                        'companies',

                    canActivate: [
                        permissionGuard(
                            PermissionCode
                                .CompaniesRead,

                            PermissionScope
                                .Company,
                        ),
                    ],

                    runGuardsAndResolvers:
                        'always',

                    loadComponent:
                        () =>
                            import(
                                './pages/companies/companies'
                            )
                                .then(
                                    module =>
                                        module.Companies,
                                ),
                },

                {
                    path:
                        'organizational-units',

                    canActivate: [
                        permissionGuard(
                            PermissionCode
                                .OrganizationalUnitsRead,
                        ),
                    ],

                    runGuardsAndResolvers:
                        'always',

                    loadComponent:
                        () =>
                            import(
                                './pages/organizational-units/organizational-units'
                            )
                                .then(
                                    module =>
                                        module.OrganizationalUnits,
                                ),
                },

                {
                    path:
                        'roles',

                    canActivate: [
                        permissionGuard(
                            PermissionCode
                                .RolesRead,

                            PermissionScope
                                .Company,
                        ),
                    ],

                    runGuardsAndResolvers:
                        'always',

                    loadComponent:
                        () =>
                            import(
                                './pages/roles/roles'
                            )
                                .then(
                                    module =>
                                        module.Roles,
                                ),
                },

                {
                    path:
                        'forbidden',

                    component:
                        Forbidden,
                },
            ],
        },
        {
            path:
                '**',

            redirectTo:
                '',
        },
    ];