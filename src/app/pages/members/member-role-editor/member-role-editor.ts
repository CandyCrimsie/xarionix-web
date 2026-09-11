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
    catchError,
    forkJoin,
    map,
    of,
} from 'rxjs';

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
    MembershipRoleApiService,
} from '../../../core/members/membership-role-api.service';

import type {
    CompanyMemberSummary,
} from '../../../core/members/member.models';

import type {
    Role,
} from '../../../core/roles/role.models';


type EditorState =
    | 'loading'
    | 'ready'
    | 'error';


interface AssignmentLoadResult {
    available: boolean;
    roles: Role[];
    message: string | null;
}


@Component({
    selector: 'app-member-role-editor',

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
        './member-role-editor.html',

    styleUrl:
        './member-role-editor.css',
})
export class MemberRoleEditor {
    readonly member =
        input.required<
            CompanyMemberSummary
        >();

    readonly canAssign =
        input(false);


    private readonly roleApi =
        inject(
            MembershipRoleApiService,
        );


    private readonly _roles =
        signal<Role[]>([]);

    private readonly _assignableRoleIds =
        signal<
            ReadonlySet<number>
        >(
            new Set(),
        );

    private readonly _initialRoleIds =
        signal<
            ReadonlySet<number>
        >(
            new Set(),
        );

    private readonly _selectedRoleIds =
        signal<
            ReadonlySet<number>
        >(
            new Set(),
        );

    private readonly _assignmentAvailable =
        signal(false);

    private readonly _state =
        signal<EditorState>(
            'loading',
        );

    private readonly _reloadVersion =
        signal(0);


    readonly roles =
        this._roles.asReadonly();

    readonly state =
        this._state.asReadonly();

    readonly assignmentMessage =
        signal<string | null>(
            null,
        );

    readonly saving =
        signal(false);

    readonly saveError =
        signal<string | null>(
            null,
        );

    readonly saved =
        signal(false);


    readonly canEditTarget =
        computed(
            () =>
                this.canAssign()
                && this.member().is_active
                && this._assignmentAvailable(),
        );


    readonly hasChanges =
        computed(
            () =>
                !this.setsEqual(
                    this._initialRoleIds(),
                    this._selectedRoleIds(),
                ),
        );


    constructor() {
        effect(
            onCleanup => {
                this._reloadVersion();

                const member =
                    this.member();

                const canAssign =
                    this.canAssign();


                this.resetState();


                const currentRoles$ =
                    this.roleApi.list(
                        member.id,
                    );


                const assignment$ =
                    (
                        canAssign
                        && member.is_active
                    )
                        ? this.roleApi
                            .listAssignable(
                                member.id,
                            )
                            .pipe(
                                map(
                                    roles => ({
                                        available:
                                            true,

                                        roles,

                                        message:
                                            roles.length
                                                === 0
                                                ? (
                                                    'Для ваших ролей '
                                                    + 'не настроено '
                                                    + 'делегирование ролей'
                                                )
                                                : null,
                                    }),
                                ),

                                catchError(
                                    error =>
                                        of({
                                            available:
                                                false,

                                            roles:
                                                [],

                                            message:
                                                this.getAssignableError(
                                                    error,
                                                ),
                                        }),
                                ),
                            )
                        : of({
                            available:
                                false,

                            roles:
                                [],

                            message:
                                !member.is_active
                                    ? (
                                        'Доступ сотрудника '
                                        + 'в компанию отключён. '
                                        + 'Роли доступны только '
                                        + 'для просмотра.'
                                    )
                                    : (
                                        'У вас нет права '
                                        + 'назначать роли. '
                                        + 'Роли доступны только '
                                        + 'для просмотра.'
                                    ),
                        });


                const subscription =
                    forkJoin({
                        currentRoles:
                            currentRoles$,

                        assignment:
                            assignment$,
                    })
                        .subscribe({
                            next: result => {
                                this.applyLoadResult(
                                    result.currentRoles,
                                    result.assignment,
                                );
                            },

                            error: () => {
                                this._roles.set([]);

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


    isSelected(
        roleId: number,
    ): boolean {
        return this
            ._selectedRoleIds()
            .has(roleId);
    }


    isAssignable(
        roleId: number,
    ): boolean {
        return this
            ._assignableRoleIds()
            .has(roleId);
    }


    canToggle(
        role: Role,
    ): boolean {
        if (
            !this.canEditTarget()
            || !this.isAssignable(
                role.id,
            )
        ) {
            return false;
        }


        if (role.is_active) {
            return true;
        }


        /*
         * Неактивную роль нельзя
         * назначить заново.
         *
         * Но если она уже назначена,
         * её разрешено снять.
         */
        return this
            ._initialRoleIds()
            .has(role.id);
    }


    toggleRole(
        role: Role,
        selected: boolean,
    ): void {
        if (
            !this.canToggle(role)
        ) {
            return;
        }


        const selectedIds =
            new Set(
                this._selectedRoleIds(),
            );


        if (selected) {
            selectedIds.add(
                role.id,
            );
        } else {
            selectedIds.delete(
                role.id,
            );
        }


        this._selectedRoleIds.set(
            selectedIds,
        );

        this.saved.set(false);
        this.saveError.set(null);
    }


    save(): void {
        if (
            !this.canEditTarget()
            || !this.hasChanges()
            || this.saving()
        ) {
            return;
        }


        const roleIds =
            Array.from(
                this._selectedRoleIds(),
            )
                .sort(
                    (
                        left,
                        right,
                    ) =>
                        left - right,
                );


        this.saving.set(true);
        this.saved.set(false);
        this.saveError.set(null);


        this.roleApi
            .replace(
                this.member().id,
                {
                    role_ids:
                        roleIds,
                },
            )
            .subscribe({
                next: roles => {
                    const roleIds =
                        new Set(
                            roles.map(
                                role =>
                                    role.id,
                            ),
                        );


                    this._initialRoleIds.set(
                        roleIds,
                    );

                    this._selectedRoleIds.set(
                        new Set(roleIds),
                    );


                    this.mergeRoles(
                        roles,
                    );


                    this.saving.set(false);
                    this.saved.set(true);
                },

                error: error => {
                    this.saving.set(false);

                    this.saveError.set(
                        this.getSaveError(
                            error,
                        ),
                    );
                },
            });
    }


    private applyLoadResult(
        currentRoles: Role[],
        assignment:
            AssignmentLoadResult,
    ): void {
        const currentIds =
            new Set(
                currentRoles.map(
                    role =>
                        role.id,
                ),
            );

        const assignableIds =
            new Set(
                assignment.roles.map(
                    role =>
                        role.id,
                ),
            );


        const rolesById =
            new Map<
                number,
                Role
            >();


        for (
            const role
            of currentRoles
        ) {
            rolesById.set(
                role.id,
                role,
            );
        }

        for (
            const role
            of assignment.roles
        ) {
            rolesById.set(
                role.id,
                role,
            );
        }


        const roles =
            Array.from(
                rolesById.values(),
            )
                .sort(
                    (
                        left,
                        right,
                    ) =>
                        left.name.localeCompare(
                            right.name,
                        ),
                );


        this._roles.set(
            roles,
        );

        this._initialRoleIds.set(
            currentIds,
        );

        this._selectedRoleIds.set(
            new Set(
                currentIds,
            ),
        );

        this._assignableRoleIds.set(
            assignableIds,
        );

        this._assignmentAvailable.set(
            assignment.available,
        );

        this.assignmentMessage.set(
            assignment.message,
        );

        this._state.set(
            'ready',
        );
    }


    private mergeRoles(
        roles: Role[],
    ): void {
        const rolesById =
            new Map<
                number,
                Role
            >();


        for (
            const role
            of this._roles()
        ) {
            rolesById.set(
                role.id,
                role,
            );
        }

        for (
            const role
            of roles
        ) {
            rolesById.set(
                role.id,
                role,
            );
        }


        this._roles.set(
            Array.from(
                rolesById.values(),
            )
                .sort(
                    (
                        left,
                        right,
                    ) =>
                        left.name.localeCompare(
                            right.name,
                        ),
                ),
        );
    }


    private resetState(): void {
        this._roles.set([]);

        this._assignableRoleIds.set(
            new Set(),
        );

        this._initialRoleIds.set(
            new Set(),
        );

        this._selectedRoleIds.set(
            new Set(),
        );

        this._assignmentAvailable.set(
            false,
        );

        this.assignmentMessage.set(
            null,
        );

        this.saveError.set(null);
        this.saved.set(false);

        this._state.set(
            'loading',
        );
    }


    private getAssignableError(
        error: unknown,
    ): string {
        if (
            error instanceof
            HttpErrorResponse
        ) {
            if (
                error.status === 403
                || error.status === 404
            ) {
                return (
                    'Сотрудник находится вне '
                    + 'доступной вам области '
                    + 'назначения ролей. '
                    + 'Роли доступны только '
                    + 'для просмотра.'
                );
            }

            if (
                error.status === 409
            ) {
                return (
                    'Доступ сотрудника '
                    + 'в компанию отключён. '
                    + 'Роли доступны только '
                    + 'для просмотра.'
                );
            }
        }


        return (
            'Не удалось определить роли, '
            + 'доступные для назначения. '
            + 'Редактирование отключено.'
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
                error.status === 403
            ) {
                return (
                    'Права назначения ролей '
                    + 'изменились. Обновите '
                    + 'редактор и повторите попытку.'
                );
            }

            if (
                error.status === 404
            ) {
                return (
                    'Сотрудник больше не входит '
                    + 'в доступную область '
                    + 'назначения ролей.'
                );
            }

            if (
                error.status === 409
            ) {
                return (
                    'Доступ сотрудника '
                    + 'в компанию отключён.'
                );
            }

            if (
                error.status === 400
            ) {
                return (
                    'Список ролей изменился. '
                    + 'Обновите редактор '
                    + 'и повторите попытку.'
                );
            }
        }


        return (
            'Не удалось сохранить '
            + 'роли сотрудника'
        );
    }


    private setsEqual(
        left:
            ReadonlySet<number>,

        right:
            ReadonlySet<number>,
    ): boolean {
        if (
            left.size
            !== right.size
        ) {
            return false;
        }


        for (
            const value
            of left
        ) {
            if (
                !right.has(value)
            ) {
                return false;
            }
        }


        return true;
    }
}