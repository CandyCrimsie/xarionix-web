import {
    inject,
} from '@angular/core';

import {
    CanActivateFn,
    Router,
} from '@angular/router';

import {
    SetupStateService,
} from './setup-state.service';


export const setupGuard:
    CanActivateFn = () => {
        const setupState =
            inject(
                SetupStateService,
            );

        const router =
            inject(
                Router,
            );


        /*
         * Уже установленную ERP нельзя
         * снова открыть через /setup.
         */
        if (
            setupState.isInstalled()
        ) {
            return router.createUrlTree(
                [
                    '/',
                ],
            );
        }


        /*
         * READY:
         * покажем initial setup.
         *
         * INCONSISTENT:
         * позже покажем recovery UI.
         *
         * ERROR:
         * позже покажем ошибку status.
         */
        return true;
    };