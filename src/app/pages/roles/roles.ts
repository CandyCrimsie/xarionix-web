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
    lucidePlus,
    lucidePencil,
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

import {
    FormsModule,
} from '@angular/forms';

import {
    HttpErrorResponse,
} from '@angular/common/http';

import {
    HlmDialogImports,
} from '@spartan-ng/helm/dialog';

import {
    HlmFieldImports,
} from '@spartan-ng/helm/field';

import {
    HlmInputImports,
} from '@spartan-ng/helm/input';

import type {
    BrnDialog,
} from '@spartan-ng/brain/dialog';


type RolesState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';


@Component({
    selector: 'app-roles',

    imports: [
        NgIcon,
        FormsModule,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
        HlmBadgeImports,
        HlmButtonImports,
        HlmTableImports,
    ],

    providers: [
        provideIcons({
            lucideLoaderCircle,
            lucideRefreshCw,
            lucidePlus,
            lucidePencil
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


    readonly canManageRoles =
        this.permissions.canSignal(
            PermissionCode.RolesManage,
            PermissionScope.Company,
        );


    readonly createName =
        signal('');

    readonly createDescription =
        signal('');

    readonly creating =
        signal(false);

    readonly createError =
        signal<string | null>(
            null,
        );


    readonly selectedRole =
        signal<Role | null>(
            null,
        );

    readonly editName =
        signal('');

    readonly editDescription =
        signal('');

    readonly editActive =
        signal(true);

    readonly updating =
        signal(false);

    readonly editError =
        signal<string | null>(
            null,
        );


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


    createRole(
        dialog: BrnDialog,
    ): void {
        if (
            this.creating()
            || !this.canManageRoles()
        ) {
            return;
        }

        const name =
            this.createName().trim();

        const descriptionValue =
            this.createDescription().trim();

        if (!name) {
            this.createError.set(
                'Укажите название роли',
            );

            return;
        }

        if (name.length > 100) {
            this.createError.set(
                'Название роли не должно превышать 100 символов',
            );

            return;
        }

        if (
            descriptionValue.length > 500
        ) {
            this.createError.set(
                'Описание не должно превышать 500 символов',
            );

            return;
        }

        this.creating.set(true);
        this.createError.set(null);

        this.roleApi
            .create({
                name,

                description:
                    descriptionValue
                    || null,
            })
            .subscribe({
                next: () => {
                    this.creating.set(false);

                    this.resetCreateForm();

                    dialog.close({});

                    /*
                     * Не добавляем response вручную
                     * в _roles.
                     *
                     * Повторная загрузка гарантирует,
                     * что список соответствует именно
                     * текущему company context.
                     */
                    this.retry();
                },

                error: error => {
                    this.creating.set(false);

                    this.createError.set(
                        this.getCreateRoleError(
                            error,
                        ),
                    );
                },
            });
    }


    resetCreateForm(): void {
        this.createName.set('');
        this.createDescription.set('');
        this.createError.set(null);
    }


    openEditRole(
        role: Role,
    ): void {
        if (
            !this.canManageRoles()
            || role.is_system
        ) {
            return;
        }

        this.selectedRole.set(
            role,
        );

        this.editName.set(
            role.name,
        );

        this.editDescription.set(
            role.description ?? '',
        );

        this.editActive.set(
            role.is_active,
        );

        this.editError.set(
            null,
        );
    }


    updateRole(
        dialog: BrnDialog,
    ): void {
        const role =
            this.selectedRole();

        if (
            !role
            || role.is_system
            || this.updating()
            || !this.canManageRoles()
        ) {
            return;
        }


        const name =
            this.editName().trim();

        const descriptionValue =
            this.editDescription().trim();


        if (!name) {
            this.editError.set(
                'Укажите название роли',
            );

            return;
        }

        if (name.length > 100) {
            this.editError.set(
                'Название роли не должно превышать 100 символов',
            );

            return;
        }

        if (
            descriptionValue.length > 500
        ) {
            this.editError.set(
                'Описание не должно превышать 500 символов',
            );

            return;
        }


        this.updating.set(
            true,
        );

        this.editError.set(
            null,
        );


        this.roleApi
            .update(
                role.id,
                {
                    name,

                    description:
                        descriptionValue
                        || null,

                    is_active:
                        this.editActive(),
                },
            )
            .subscribe({
                next: () => {
                    this.updating.set(
                        false,
                    );

                    this.resetEditForm();

                    dialog.close({});

                    this.retry();
                },

                error: error => {
                    this.updating.set(
                        false,
                    );

                    this.editError.set(
                        this.getEditRoleError(
                            error,
                        ),
                    );
                },
            });
    }


    setEditActive(
        event: Event,
    ): void {
        const input = event.target as HTMLInputElement;

        this.editActive.set(
            input.checked,
        );
    }


    resetEditForm(): void {
        this.selectedRole.set(
            null,
        );

        this.editName.set('');
        this.editDescription.set('');

        this.editActive.set(
            true,
        );

        this.editError.set(
            null,
        );
    }


    private getEditRoleError(
        error: unknown,
    ): string {
        if (
            error instanceof
            HttpErrorResponse
            && error.status === 409
        ) {
            const detail =
                typeof error.error?.detail
                    === 'string'
                    ? error.error.detail
                    : null;

            if (
                detail ===
                'System role is managed by the system'
            ) {
                return (
                    'Системную роль нельзя изменять'
                );
            }

            return (
                'Роль с таким названием '
                + 'уже существует'
            );
        }

        return 'Не удалось изменить роль';
    }


    private getCreateRoleError(
        error: unknown,
    ): string {
        if (
            error instanceof
            HttpErrorResponse
            && error.status === 409
        ) {
            return (
                'Роль с таким названием '
                + 'уже существует'
            );
        }

        return 'Не удалось создать роль';
    }


    private reset(): void {
        this._roles.set([]);

        this._state.set(
            'idle',
        );
    }
}