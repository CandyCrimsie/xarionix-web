import {
    Component,
    effect,
    inject,
    signal,
} from '@angular/core';

import {
    HlmBadgeImports,
} from '@spartan-ng/helm/badge';

import {
    HlmButtonImports,
} from '@spartan-ng/helm/button';

import {
    HlmTableImports,
} from '@spartan-ng/helm/table';

import {
    NgIcon,
    provideIcons,
} from '@ng-icons/core';

import {
    lucideLoaderCircle,
    lucideRefreshCw,
} from '@ng-icons/lucide';

import {
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    RoleApiService,
} from '../../core/roles/role-api.service';

import type {
    Role,
} from '../../core/roles/role.models';


type RolesState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';


@Component({
    selector: 'app-roles',

    imports: [
        NgIcon,

        HlmBadgeImports,
        HlmButtonImports,
        HlmTableImports,
    ],

    providers: [
        provideIcons({
            lucideLoaderCircle,
            lucideRefreshCw,
        }),
    ],

    templateUrl: './roles.html',
    styleUrl: './roles.css',
})
export class Roles {
    private readonly roleApi =
        inject(RoleApiService);

    private readonly permissions =
        inject(PermissionService);

    private readonly _roles =
        signal<Role[]>([]);

    private readonly _state =
        signal<RolesState>(
            'idle',
        );

    private readonly _reloadVersion =
        signal(0);


    readonly roles =
        this._roles.asReadonly();

    readonly state =
        this._state.asReadonly();


    constructor() {
        effect(onCleanup => {
            /*
             * Делает retry частью reactive
             * dependency effect.
             */
            this._reloadVersion();

            /*
             * can() сам учитывает:
             *
             * - active company
             * - loaded company
             * - permission state
             * - minimum scope
             */
            const canReadRoles =
                this.permissions.can(
                    PermissionCode.RolesRead,
                    PermissionScope.Company,
                );

            /*
             * При company switch PermissionService
             * сразу становится fail-closed.
             *
             * Старые роли компании здесь же
             * удаляются из UI.
             */
            if (!canReadRoles) {
                this.reset();

                return;
            }


            this._roles.set([]);

            this._state.set(
                'loading',
            );


            const subscription =
                this.roleApi
                    .list()
                    .subscribe({
                        next: roles => {
                            this._roles.set(
                                roles,
                            );

                            this._state.set(
                                'ready',
                            );
                        },

                        error: () => {
                            this._roles.set([]);

                            this._state.set(
                                'error',
                            );
                        },
                    });


            /*
             * Если пока GET /roles работает
             * компания поменяется, предыдущий
             * HTTP request будет отменён.
             */
            onCleanup(() => {
                subscription.unsubscribe();
            });
        });
    }


    retry(): void {
        this._reloadVersion.update(
            version =>
                version + 1,
        );
    }


    private reset(): void {
        this._roles.set([]);

        this._state.set(
            'idle',
        );
    }
}