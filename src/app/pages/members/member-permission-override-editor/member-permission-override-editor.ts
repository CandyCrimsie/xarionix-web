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
    HlmBadgeImports,
} from '@spartan-ng/helm/badge';

import {
    HlmButtonImports,
} from '@spartan-ng/helm/button';

import {
    MembershipPermissionOverrideApiService,
} from '../../../core/members/membership-permission-override-api.service';

import {
    PermissionOverrideEffect,
} from '../../../core/members/membership-permission-override.models';

import type {
    MembershipPermissionOverride,
} from '../../../core/members/membership-permission-override.models';

import type {
    CompanyMemberSummary,
} from '../../../core/members/member.models';

import type {
    PermissionCatalogItem,
} from '../../../core/permissions/permission-catalog.models';

import {
    PermissionScope,
} from '../../../core/permissions/permission.models';

import type {
    EffectivePermissionsResponse,
} from '../../../core/permissions/permission.models';


type EditorState =
    | 'loading'
    | 'ready'
    | 'error';


type OverrideMode =
    | 'inherit'
    | 'allow'
    | 'deny';


interface OverrideDraft {
    mode: OverrideMode;

    scope:
    PermissionScope | null;
}


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
        'app-member-permission-override-editor',

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
        './member-permission-override-editor.html',

    styleUrl:
        './member-permission-override-editor.css',
})
export class MemberPermissionOverrideEditor {
    readonly member =
        input.required<
            CompanyMemberSummary
        >();

    readonly canManage =
        input(false);


    private readonly api =
        inject(
            MembershipPermissionOverrideApiService,
        );


    private readonly _catalog =
        signal<
            PermissionCatalogItem[]
        >([]);

    private readonly _overrides =
        signal<
            ReadonlyMap<
                number,
                MembershipPermissionOverride
            >
        >(
            new Map(),
        );

    private readonly _drafts =
        signal<
            ReadonlyMap<
                number,
                OverrideDraft
            >
        >(
            new Map(),
        );

    private readonly _effectiveScopes =
        signal<
            ReadonlyMap<
                string,
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

    private readonly _savingPermissionIds =
        signal<
            ReadonlySet<number>
        >(
            new Set(),
        );

    private readonly _rowErrors =
        signal<
            ReadonlyMap<
                number,
                string
            >
        >(
            new Map(),
        );

    private readonly _savedPermissionIds =
        signal<
            ReadonlySet<number>
        >(
            new Set(),
        );


    readonly state =
        this._state.asReadonly();


    readonly isReadOnly =
        computed(
            () =>
                !this.canManage()
                || !this.member().is_active,
        );


    readonly groups =
        computed<
            PermissionGroup[]
        >(
            () => {
                const grouped =
                    new Map<
                        string,
                        PermissionCatalogItem[]
                    >();


                for (
                    const permission
                    of this._catalog()
                ) {
                    const existing =
                        grouped.get(
                            permission.module,
                        );


                    if (existing) {
                        existing.push(
                            permission,
                        );

                        continue;
                    }


                    grouped.set(
                        permission.module,
                        [
                            permission,
                        ],
                    );
                }


                return Array.from(
                    grouped.entries(),
                )
                    .map(
                        ([
                            module,
                            permissions,
                        ]) => ({
                            module,

                            label:
                                this.moduleLabel(
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
                this._reloadVersion();

                const membershipId =
                    this.member().id;


                this.reset();


                const subscription =
                    forkJoin({
                        catalog:
                            this.api.catalog(
                                membershipId,
                            ),

                        overrides:
                            this.api.list(
                                membershipId,
                            ),

                        effective:
                            this.api.effective(
                                membershipId,
                            ),
                    })
                        .subscribe({
                            next: ({
                                catalog,
                                overrides,
                                effective,
                            }) => {
                                this.applyLoadedState(
                                    catalog,
                                    overrides,
                                    effective,
                                );
                            },

                            error: () => {
                                this._catalog.set(
                                    [],
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
            value =>
                value + 1,
        );
    }


    modeFor(
        permissionId: number,
    ): OverrideMode {
        return (
            this._drafts()
                .get(
                    permissionId,
                )
                ?.mode
            ?? 'inherit'
        );
    }


    scopeFor(
        permissionId: number,
    ): PermissionScope | null {
        return (
            this._drafts()
                .get(
                    permissionId,
                )
                ?.scope
            ?? null
        );
    }


    effectiveScopeFor(
        permission:
            PermissionCatalogItem,
    ): PermissionScope | null {
        return (
            this._effectiveScopes()
                .get(
                    permission.code,
                )
            ?? null
        );
    }


    changeMode(
        permission:
            PermissionCatalogItem,

        mode:
            OverrideMode,
    ): void {
        if (
            this.isReadOnly()
            || !permission.is_active
        ) {
            return;
        }


        const drafts =
            new Map(
                this._drafts(),
            );

        const current =
            drafts.get(
                permission.id,
            );


        drafts.set(
            permission.id,
            {
                mode,

                scope:
                    current?.scope
                    ?? this.defaultScope(
                        permission,
                    ),
            },
        );


        this._drafts.set(
            drafts,
        );

        this.markChanged(
            permission.id,
        );
    }


    changeScope(
        permission:
            PermissionCatalogItem,

        scope:
            PermissionScope,
    ): void {
        if (
            this.isReadOnly()
            || !permission.is_active
            || this.modeFor(
                permission.id,
            ) !== 'allow'
            || !permission
                .allowed_scopes
                .includes(scope)
        ) {
            return;
        }


        const drafts =
            new Map(
                this._drafts(),
            );


        drafts.set(
            permission.id,
            {
                mode:
                    'allow',

                scope,
            },
        );


        this._drafts.set(
            drafts,
        );

        this.markChanged(
            permission.id,
        );
    }


    isDirty(
        permissionId: number,
    ): boolean {
        const draft =
            this._drafts()
                .get(
                    permissionId,
                );

        if (!draft) {
            return false;
        }


        const existing =
            this._overrides()
                .get(
                    permissionId,
                );


        if (
            draft.mode
            === 'inherit'
        ) {
            return (
                existing
                !== undefined
            );
        }


        if (
            draft.mode
            === 'deny'
        ) {
            return (
                existing === undefined
                || existing.effect
                !== PermissionOverrideEffect.Deny
            );
        }


        return (
            existing === undefined
            || existing.effect
            !== PermissionOverrideEffect.Allow
            || existing.scope
            !== draft.scope
        );
    }


    isSaving(
        permissionId: number,
    ): boolean {
        return this
            ._savingPermissionIds()
            .has(
                permissionId,
            );
    }


    rowError(
        permissionId: number,
    ): string | null {
        return (
            this._rowErrors()
                .get(
                    permissionId,
                )
            ?? null
        );
    }


    isSaved(
        permissionId: number,
    ): boolean {
        return this
            ._savedPermissionIds()
            .has(
                permissionId,
            );
    }


    savePermission(
        permission:
            PermissionCatalogItem,
    ): void {
        if (
            this.isReadOnly()
            || !permission.is_active
            || !this.isDirty(
                permission.id,
            )
            || this.isSaving(
                permission.id,
            )
        ) {
            return;
        }


        const draft =
            this._drafts()
                .get(
                    permission.id,
                );

        if (!draft) {
            return;
        }


        this.startSaving(
            permission.id,
        );


        if (
            draft.mode
            === 'inherit'
        ) {
            this.api
                .remove(
                    this.member().id,
                    permission.id,
                )
                .subscribe({
                    next: () => {
                        const overrides =
                            new Map(
                                this._overrides(),
                            );

                        overrides.delete(
                            permission.id,
                        );

                        this._overrides.set(
                            overrides,
                        );

                        this.refreshEffective(
                            permission.id,
                        );
                    },

                    error: error => {
                        this.failSaving(
                            permission.id,
                            error,
                        );
                    },
                });

            return;
        }


        if (
            draft.mode
            === 'deny'
        ) {
            this.api
                .set(
                    this.member().id,
                    permission.id,
                    {
                        effect:
                            PermissionOverrideEffect
                                .Deny,

                        scope:
                            null,
                    },
                )
                .subscribe({
                    next: override => {
                        this.applySavedOverride(
                            override,
                        );
                    },

                    error: error => {
                        this.failSaving(
                            permission.id,
                            error,
                        );
                    },
                });

            return;
        }


        if (
            draft.scope
            === null
        ) {
            this.failSaving(
                permission.id,
                null,
            );

            return;
        }


        this.api
            .set(
                this.member().id,
                permission.id,
                {
                    effect:
                        PermissionOverrideEffect
                            .Allow,

                    scope:
                        draft.scope,
                },
            )
            .subscribe({
                next: override => {
                    this.applySavedOverride(
                        override,
                    );
                },

                error: error => {
                    this.failSaving(
                        permission.id,
                        error,
                    );
                },
            });
    }


    scopeLabel(
        scope:
            PermissionScope,
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


    private applyLoadedState(
        catalog:
            PermissionCatalogItem[],

        overrides:
            MembershipPermissionOverride[],

        effective:
            EffectivePermissionsResponse,
    ): void {
        const overridesByPermission =
            new Map<
                number,
                MembershipPermissionOverride
            >();


        for (
            const override
            of overrides
        ) {
            overridesByPermission.set(
                override.permission_id,
                override,
            );
        }


        const drafts =
            new Map<
                number,
                OverrideDraft
            >();


        for (
            const permission
            of catalog
        ) {
            const override =
                overridesByPermission.get(
                    permission.id,
                );

            const defaultScope =
                this.defaultScope(
                    permission,
                );


            if (!override) {
                drafts.set(
                    permission.id,
                    {
                        mode:
                            'inherit',

                        scope:
                            defaultScope,
                    },
                );

                continue;
            }


            if (
                override.effect
                === PermissionOverrideEffect.Deny
            ) {
                drafts.set(
                    permission.id,
                    {
                        mode:
                            'deny',

                        scope:
                            defaultScope,
                    },
                );

                continue;
            }


            drafts.set(
                permission.id,
                {
                    mode:
                        'allow',

                    scope:
                        override.scope
                        ?? defaultScope,
                },
            );
        }


        this._catalog.set(
            catalog,
        );

        this._overrides.set(
            overridesByPermission,
        );

        this._drafts.set(
            drafts,
        );

        this.setEffectivePermissions(
            effective,
        );

        this._state.set(
            'ready',
        );
    }


    private applySavedOverride(
        override:
            MembershipPermissionOverride,
    ): void {
        const overrides =
            new Map(
                this._overrides(),
            );

        overrides.set(
            override.permission_id,
            override,
        );

        this._overrides.set(
            overrides,
        );


        this.refreshEffective(
            override.permission_id,
        );
    }


    private refreshEffective(
        permissionId: number,
    ): void {
        this.api
            .effective(
                this.member().id,
            )
            .subscribe({
                next: effective => {
                    this.setEffectivePermissions(
                        effective,
                    );

                    this.finishSaving(
                        permissionId,
                    );
                },

                error: () => {
                    this.finishSaving(
                        permissionId,
                    );

                    const errors =
                        new Map(
                            this._rowErrors(),
                        );

                    errors.set(
                        permissionId,
                        (
                            'Изменение сохранено, '
                            + 'но не удалось обновить '
                            + 'итоговые права. '
                            + 'Переоткройте редактор.'
                        ),
                    );

                    this._rowErrors.set(
                        errors,
                    );
                },
            });
    }


    private setEffectivePermissions(
        effective:
            EffectivePermissionsResponse,
    ): void {
        const scopes =
            new Map<
                string,
                PermissionScope
            >();


        for (
            const [
                code,
                scope,
            ]
            of Object.entries(
                effective.scopes,
            )
        ) {
            if (
                scope === undefined
            ) {
                continue;
            }

            scopes.set(
                code,
                scope,
            );
        }


        this._effectiveScopes.set(
            scopes,
        );
    }


    private startSaving(
        permissionId: number,
    ): void {
        const saving =
            new Set(
                this._savingPermissionIds(),
            );

        saving.add(
            permissionId,
        );

        this._savingPermissionIds.set(
            saving,
        );


        const errors =
            new Map(
                this._rowErrors(),
            );

        errors.delete(
            permissionId,
        );

        this._rowErrors.set(
            errors,
        );


        const saved =
            new Set(
                this._savedPermissionIds(),
            );

        saved.delete(
            permissionId,
        );

        this._savedPermissionIds.set(
            saved,
        );
    }


    private finishSaving(
        permissionId: number,
    ): void {
        const saving =
            new Set(
                this._savingPermissionIds(),
            );

        saving.delete(
            permissionId,
        );

        this._savingPermissionIds.set(
            saving,
        );


        const saved =
            new Set(
                this._savedPermissionIds(),
            );

        saved.add(
            permissionId,
        );

        this._savedPermissionIds.set(
            saved,
        );
    }


    private failSaving(
        permissionId: number,
        error: unknown,
    ): void {
        const saving =
            new Set(
                this._savingPermissionIds(),
            );

        saving.delete(
            permissionId,
        );

        this._savingPermissionIds.set(
            saving,
        );


        const errors =
            new Map(
                this._rowErrors(),
            );

        errors.set(
            permissionId,
            this.saveErrorMessage(
                error,
            ),
        );

        this._rowErrors.set(
            errors,
        );
    }


    private markChanged(
        permissionId: number,
    ): void {
        const errors =
            new Map(
                this._rowErrors(),
            );

        errors.delete(
            permissionId,
        );

        this._rowErrors.set(
            errors,
        );


        const saved =
            new Set(
                this._savedPermissionIds(),
            );

        saved.delete(
            permissionId,
        );

        this._savedPermissionIds.set(
            saved,
        );
    }


    private defaultScope(
        permission:
            PermissionCatalogItem,
    ): PermissionScope | null {
        return (
            SCOPE_ORDER.find(
                scope =>
                    permission
                        .allowed_scopes
                        .includes(scope),
            )
            ?? null
        );
    }


    private moduleLabel(
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


    private saveErrorMessage(
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
                    'Право управления ролями '
                    + 'изменилось'
                );
            }

            if (
                error.status === 404
            ) {
                return (
                    'Сотрудник или permission '
                    + 'больше не существует'
                );
            }

            if (
                error.status === 409
            ) {
                return (
                    'Сотрудник или permission '
                    + 'сейчас неактивен'
                );
            }

            if (
                error.status === 400
            ) {
                return (
                    'Недопустимая настройка '
                    + 'permission override'
                );
            }
        }


        return (
            'Не удалось сохранить '
            + 'индивидуальное право'
        );
    }


    private reset(): void {
        this._catalog.set([]);

        this._overrides.set(
            new Map(),
        );

        this._drafts.set(
            new Map(),
        );

        this._effectiveScopes.set(
            new Map(),
        );

        this._savingPermissionIds.set(
            new Set(),
        );

        this._rowErrors.set(
            new Map(),
        );

        this._savedPermissionIds.set(
            new Set(),
        );

        this._state.set(
            'loading',
        );
    }
}