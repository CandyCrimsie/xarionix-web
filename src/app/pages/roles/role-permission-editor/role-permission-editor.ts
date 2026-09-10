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
    forkJoin,
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
    HlmButtonImports,
} from '@spartan-ng/helm/button';

import {
    PermissionApiService,
} from '../../../core/permissions/permission-api.service';

import type {
    PermissionCatalogItem,
} from '../../../core/permissions/permission-catalog.models';

import {
    PermissionScope,
} from '../../../core/permissions/permission.models';

import {
    RolePermissionApiService,
} from '../../../core/roles/role-permission-api.service';

import type {
    RolePermission,
} from '../../../core/roles/role-permission.models';

import type {
    Role,
} from '../../../core/roles/role.models';


type EditorState =
    | 'loading'
    | 'ready'
    | 'error';


interface PermissionGroup {
    module: string;
    label: string;

    permissions:
    PermissionCatalogItem[];
}


const SCOPE_ORDER:
    PermissionScope[] = [
        PermissionScope.Self,
        PermissionScope.OwnUnit,
        PermissionScope.OwnUnitTree,
        PermissionScope.Company,
    ];


@Component({
    selector:
        'app-role-permission-editor',

    imports: [
        NgIcon,
        HlmButtonImports,
    ],

    providers: [
        provideIcons({
            lucideLoaderCircle,
            lucideRefreshCw,
        }),
    ],

    templateUrl:
        './role-permission-editor.html',

    styleUrl:
        './role-permission-editor.css',
})
export class RolePermissionEditor {
    readonly role =
        input.required<Role>();

    readonly canManage =
        input(false);


    private readonly permissionApi =
        inject(PermissionApiService);

    private readonly rolePermissionApi =
        inject(RolePermissionApiService);


    private readonly _catalog =
        signal<
            PermissionCatalogItem[]
        >([]);

    private readonly _assignments =
        signal<
            ReadonlyMap<
                number,
                PermissionScope
            >
        >(
            new Map(),
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
                || !this.canManage(),
        );


    readonly groups =
        computed<
            PermissionGroup[]
        >(
            () => {
                const groups =
                    new Map<
                        string,
                        PermissionCatalogItem[]
                    >();

                for (
                    const permission
                    of this._catalog()
                ) {
                    const existing =
                        groups.get(
                            permission.module,
                        );

                    if (existing) {
                        existing.push(
                            permission,
                        );

                        continue;
                    }

                    groups.set(
                        permission.module,
                        [
                            permission,
                        ],
                    );
                }

                return Array.from(
                    groups.entries(),
                ).map(
                    ([
                        module,
                        permissions,
                    ]) => ({
                        module,

                        label:
                            this.getModuleLabel(
                                module,
                            ),

                        permissions,
                    }),
                );
            },
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

                this._catalog.set([]);

                this._assignments.set(
                    new Map(),
                );

                this.saveError.set(
                    null,
                );

                this.saved.set(
                    false,
                );


                const subscription =
                    forkJoin({
                        catalog:
                            this.permissionApi
                                .list(),

                        assigned:
                            this.rolePermissionApi
                                .list(
                                    roleId,
                                ),
                    })
                        .subscribe({
                            next: ({
                                catalog,
                                assigned,
                            }) => {
                                this._catalog.set(
                                    catalog,
                                );

                                this.setAssignments(
                                    assigned,
                                );

                                this._state.set(
                                    'ready',
                                );
                            },

                            error: () => {
                                this._catalog.set(
                                    [],
                                );

                                this._assignments.set(
                                    new Map(),
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


    isAssigned(
        permissionId: number,
    ): boolean {
        return this._assignments()
            .has(
                permissionId,
            );
    }


    scopeFor(
        permissionId: number,
    ): PermissionScope | null {
        return (
            this._assignments()
                .get(
                    permissionId,
                )
            ?? null
        );
    }


    togglePermission(
        permission:
            PermissionCatalogItem,

        enabled: boolean,
    ): void {
        if (
            this.isReadOnly()
            || !permission.is_active
        ) {
            return;
        }


        const assignments =
            new Map(
                this._assignments(),
            );


        if (!enabled) {
            assignments.delete(
                permission.id,
            );

            this._assignments.set(
                assignments,
            );

            this.markChanged();

            return;
        }


        if (
            assignments.has(
                permission.id,
            )
        ) {
            return;
        }


        const defaultScope =
            this.getDefaultScope(
                permission,
            );

        if (
            defaultScope === null
        ) {
            return;
        }


        assignments.set(
            permission.id,
            defaultScope,
        );

        this._assignments.set(
            assignments,
        );

        this.markChanged();
    }


    changeScope(
        permission:
            PermissionCatalogItem,

        scope: PermissionScope,
    ): void {
        if (
            this.isReadOnly()
            || !permission.is_active
            || !this.isAssigned(
                permission.id,
            )
            || !permission
                .allowed_scopes
                .includes(
                    scope,
                )
        ) {
            return;
        }


        const assignments =
            new Map(
                this._assignments(),
            );

        assignments.set(
            permission.id,
            scope,
        );

        this._assignments.set(
            assignments,
        );

        this.markChanged();
    }


    savePermissions(): void {
        if (
            this.isReadOnly()
            || this.saving()
        ) {
            return;
        }


        const role =
            this.role();


        const permissions =
            Array.from(
                this._assignments()
                    .entries(),
            )
                .sort(
                    (
                        [leftId],
                        [rightId],
                    ) =>
                        leftId - rightId,
                )
                .map(
                    ([
                        permissionId,
                        scope,
                    ]) => ({
                        permission_id:
                            permissionId,

                        scope,
                    }),
                );


        this.saving.set(
            true,
        );

        this.saveError.set(
            null,
        );

        this.saved.set(
            false,
        );


        this.rolePermissionApi
            .replace(
                role.id,
                {
                    permissions,
                },
            )
            .subscribe({
                next: result => {
                    this.saving.set(
                        false,
                    );

                    this.setAssignments(
                        result,
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


    scopeLabel(
        scope: PermissionScope,
    ): string {
        switch (scope) {
            case PermissionScope.Self:
                return 'Только свои';

            case PermissionScope.OwnUnit:
                return 'Свой отдел';

            case PermissionScope.OwnUnitTree:
                return (
                    'Свой отдел и подотделы'
                );

            case PermissionScope.Company:
                return 'Вся компания';
        }
    }


    private setAssignments(
        permissions:
            RolePermission[],
    ): void {
        const assignments =
            new Map<
                number,
                PermissionScope
            >();

        for (
            const permission
            of permissions
        ) {
            assignments.set(
                permission.permission_id,
                permission.scope,
            );
        }

        this._assignments.set(
            assignments,
        );
    }


    private getDefaultScope(
        permission:
            PermissionCatalogItem,
    ): PermissionScope | null {
        return (
            SCOPE_ORDER.find(
                scope =>
                    permission
                        .allowed_scopes
                        .includes(
                            scope,
                        ),
            )
            ?? null
        );
    }


    private markChanged(): void {
        this.saved.set(
            false,
        );

        this.saveError.set(
            null,
        );
    }


    private getModuleLabel(
        module: string,
    ): string {
        switch (module) {
            case 'companies':
                return 'Компании';

            case 'organizational_units':
                return (
                    'Организационная структура'
                );

            case 'members':
                return 'Сотрудники';

            case 'roles':
                return 'Роли';

            case 'tasks':
                return 'Задачи';

            default:
                return module;
        }
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
                return (
                    'Системную роль '
                    + 'нельзя изменять'
                );
            }

            if (
                error.status === 400
            ) {
                return (
                    'Набор доступных прав '
                    + 'изменился. Обновите '
                    + 'редактор и повторите попытку'
                );
            }
        }

        return (
            'Не удалось сохранить '
            + 'права роли'
        );
    }
}