import {
    Component,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';

import {
    HttpErrorResponse,
} from '@angular/common/http';

import {
    NgIcon,
    provideIcons,
} from '@ng-icons/core';

import {
    lucideLoaderCircle,
    lucideRefreshCw,
} from '@ng-icons/lucide';

import {
    HlmBadgeImports,
} from '@spartan-ng/helm/badge';

import {
    HlmButtonImports,
} from '@spartan-ng/helm/button';

import {
    RoleDelegationApiService,
} from '../../../core/roles/role-delegation-api.service';

import type {
    RoleDelegation,
} from '../../../core/roles/role-delegation.models';

import type {
    Role,
} from '../../../core/roles/role.models';


type EditorState =
    | 'loading'
    | 'ready'
    | 'error';


@Component({
    selector:
        'app-role-delegation-editor',

    imports: [
        NgIcon,
        HlmBadgeImports,
        HlmButtonImports,
    ],

    providers: [
        provideIcons({
            lucideLoaderCircle,
            lucideRefreshCw,
        }),
    ],

    templateUrl:
        './role-delegation-editor.html',

    styleUrl:
        './role-delegation-editor.css',
})
export class RoleDelegationEditor {
    readonly role =
        input.required<Role>();

    readonly roles =
        input.required<
            readonly Role[]
        >();

    readonly canManage =
        input(false);


    private readonly delegationApi =
        inject(
            RoleDelegationApiService,
        );


    private readonly _delegatedRoleIds =
        signal<
            ReadonlySet<number>
        >(
            new Set(),
        );

    private readonly _state =
        signal<EditorState>(
            'loading',
        );

    private readonly _reloadVersion =
        signal(0);


    readonly state =
        this._state.asReadonly();

    readonly saving =
        signal(false);

    readonly saveError =
        signal<string | null>(
            null,
        );

    readonly saved =
        signal(false);


    readonly isReadOnly =
        computed(
            () =>
                this.role().is_system
                || !this.role().is_active
                || !this.canManage(),
        );


    readonly candidateRoles =
        computed(
            () =>
                [...this.roles()]
                    .sort(
                        (
                            left,
                            right,
                        ) =>
                            left.name
                                .localeCompare(
                                    right.name,
                                ),
                    ),
        );


    constructor() {
        effect(
            onCleanup => {
                const roleId =
                    this.role().id;

                this._reloadVersion();


                this._state.set(
                    'loading',
                );

                this._delegatedRoleIds.set(
                    new Set(),
                );

                this.saveError.set(
                    null,
                );

                this.saved.set(
                    false,
                );


                const subscription =
                    this.delegationApi
                        .list(
                            roleId,
                        )
                        .subscribe({
                            next:
                                delegations => {
                                    this.setDelegations(
                                        delegations,
                                    );

                                    this._state.set(
                                        'ready',
                                    );
                                },

                            error: () => {
                                this._delegatedRoleIds
                                    .set(
                                        new Set(),
                                    );

                                this._state.set(
                                    'error',
                                );
                            },
                        });


                onCleanup(
                    () => {
                        subscription
                            .unsubscribe();
                    },
                );
            },
        );
    }


    retry(): void {
        this._reloadVersion.update(
            version =>
                version + 1,
        );
    }


    isDelegated(
        roleId: number,
    ): boolean {
        return this
            ._delegatedRoleIds()
            .has(
                roleId,
            );
    }


    canToggleRole(
        role: Role,
    ): boolean {
        if (
            this.isReadOnly()
        ) {
            return false;
        }

        /*
         * Активную роль можно
         * включить/выключить.
         */
        if (role.is_active) {
            return true;
        }

        /*
         * Если delegation уже ведёт
         * на ставшую неактивной роль,
         * разрешаем её убрать.
         *
         * Повторно включить такую роль
         * уже нельзя.
         */
        return this.isDelegated(
            role.id,
        );
    }


    toggleRole(
        role: Role,
        enabled: boolean,
    ): void {
        if (
            this.isReadOnly()
        ) {
            return;
        }


        const currentlyDelegated =
            this.isDelegated(
                role.id,
            );


        if (
            enabled
            && !role.is_active
            && !currentlyDelegated
        ) {
            return;
        }


        const delegatedRoleIds =
            new Set(
                this._delegatedRoleIds(),
            );


        if (enabled) {
            delegatedRoleIds.add(
                role.id,
            );
        } else {
            delegatedRoleIds.delete(
                role.id,
            );
        }


        this._delegatedRoleIds.set(
            delegatedRoleIds,
        );

        this.saved.set(
            false,
        );

        this.saveError.set(
            null,
        );
    }


    saveDelegations(): void {
        if (
            this.isReadOnly()
            || this.saving()
        ) {
            return;
        }


        const role =
            this.role();

        const assignableRoleIds =
            Array.from(
                this._delegatedRoleIds(),
            )
                .sort(
                    (
                        left,
                        right,
                    ) =>
                        left - right,
                );


        this.saving.set(
            true,
        );

        this.saved.set(
            false,
        );

        this.saveError.set(
            null,
        );


        this.delegationApi
            .replace(
                role.id,
                {
                    assignable_role_ids:
                        assignableRoleIds,
                },
            )
            .subscribe({
                next: delegations => {
                    this.saving.set(
                        false,
                    );

                    this.setDelegations(
                        delegations,
                    );

                    this.saved.set(
                        true,
                    );
                },

                error: error => {
                    this.saving.set(
                        false,
                    );

                    this.saveError.set(
                        this.getSaveError(
                            error,
                        ),
                    );
                },
            });
    }


    private setDelegations(
        delegations:
            RoleDelegation[],
    ): void {
        this._delegatedRoleIds.set(
            new Set(
                delegations.map(
                    delegation =>
                        delegation
                            .assignable_role_id,
                ),
            ),
        );
    }


    private getSaveError(
        error: unknown,
    ): string {
        if (
            error instanceof
            HttpErrorResponse
        ) {
            if (
                error.status === 409
            ) {
                if (
                    error.error?.detail
                    === 'Role is inactive'
                ) {
                    return (
                        'Нельзя изменять '
                        + 'делегирование '
                        + 'отключённой роли'
                    );
                }

                if (
                    error.error?.detail
                    === (
                        'System role is '
                        + 'managed by the system'
                    )
                ) {
                    return (
                        'Делегирование '
                        + 'системной роли '
                        + 'управляется системой'
                    );
                }
            }

            if (
                error.status === 400
            ) {
                return (
                    'Список доступных ролей '
                    + 'изменился. Обновите '
                    + 'редактор и повторите попытку'
                );
            }
        }

        return (
            'Не удалось сохранить '
            + 'настройки делегирования'
        );
    }
}