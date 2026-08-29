import { Routes } from '@angular/router';

import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { AppLayout } from './layouts/app-layout/app-layout';

import { Login } from './pages/login/login';
import { Home } from './pages/home/home';

import { authGuard } from './core/auth/auth-guard';
import { guestGuard } from './core/auth/guest-guard';


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
            }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];