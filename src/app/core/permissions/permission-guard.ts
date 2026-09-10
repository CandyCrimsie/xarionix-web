import {
    inject,
} from '@angular/core';

import {
    CanActivateFn,
    Router,
} from '@angular/router';

import {
    PermissionCode,
    PermissionScope,
} from './permission.models';

import {
    PermissionService,
} from './permission.service';


export function permissionGuard(
    permission: PermissionCode,
    minimumScope?: PermissionScope,
): CanActivateFn {
    return () => {
        const permissions =
            inject(PermissionService);

        const router =
            inject(Router);

        if (
            permissions.can(
                permission,
                minimumScope,
            )
        ) {
            return true;
        }

        return router.createUrlTree(
            ['/forbidden'],
        );
    };
}