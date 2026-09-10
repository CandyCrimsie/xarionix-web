import { Routes } from '@angular/router';

import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { AppLayout } from './layouts/app-layout/app-layout';

import { Login } from './pages/login/login';
import { Home } from './pages/home/home';
import { Invite } from './pages/invite/invite';
import { Forbidden } from './pages/forbidden/forbidden';
import { Roles } from './pages/roles/roles';

import { authGuard } from './core/auth/auth-guard';
import { guestGuard } from './core/auth/guest-guard';
import { permissionGuard } from './core/permissions/permission-guard';

import {
    PermissionCode,
    PermissionScope
} from './core/permissions/permission.models';



export const routes: Routes = [
    {
        path: 'login',
        canActivate: [
            guestGuard,
        ],
        component: AuthLayout,
        children: [
            {
                path: '',
                component: Login
            }
        ]
    },
    {
        path: '',
        canActivate: [
            authGuard,
        ],
        component: AppLayout,
        children: [
            {
                path: '',
                component: Home
            },
            {
                path: 'invite',

                canActivate: [
                    permissionGuard(
                        PermissionCode.MembersManage,
                    ),
                ],
                runGuardsAndResolvers: 'always',
                component: Invite,
            },
            {
                path: 'roles',

                canActivate: [
                    permissionGuard(
                        PermissionCode.RolesRead,
                        PermissionScope.Company,
                    ),
                ],

                runGuardsAndResolvers:
                    'always',

                component: Roles,
            },
            {
                path: 'forbidden',
                component: Forbidden
            }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];