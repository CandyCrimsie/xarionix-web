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


export const installationGuard:
    CanActivateFn = () => {
        const setupState =
            inject(
                SetupStateService,
            );

        const router =
            inject(
                Router,
            );


        if (
            setupState.isInstalled()
        ) {
            return true;
        }


        /*
         * READY, INCONSISTENT,
         * status error и любой другой
         * fail-closed state не должны
         * открывать обычную ERP.
         */
        return router.createUrlTree(
            [
                '/setup',
            ],
        );
    };