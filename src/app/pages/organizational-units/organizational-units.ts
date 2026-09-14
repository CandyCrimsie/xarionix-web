import {
    Component,
    computed,
    effect,
    inject,
    signal,
} from '@angular/core';

import {
    NgIcon,
    provideIcons,
} from '@ng-icons/core';

import {
    lucideLoaderCircle,
    lucideRefreshCw,
    lucidePlus,
} from '@ng-icons/lucide';

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
    CompanyContextService,
} from '../../core/company/company-context.service';

import {
    OrganizationalUnitApiService,
} from '../../core/organizational-units/organizational-unit-api.service';

import {
    OrganizationalUnitType,
} from '../../core/organizational-units/organizational-unit.models';

import type {
    OrganizationalUnit,
    OrganizationalUnitUpdate,
} from '../../core/organizational-units/organizational-unit.models';

import {
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    HttpErrorResponse,
} from '@angular/common/http';

import {
    FormsModule,
} from '@angular/forms';

import {
    catchError,
    forkJoin,
    map,
    of,
} from 'rxjs';

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


type OrganizationalUnitsState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';


interface OrganizationalUnitRow {
    unit:
    OrganizationalUnit;

    depth:
    number;
}


@Component({
    selector:
        'app-organizational-units',

    imports: [
        NgIcon,
        HlmBadgeImports,
        HlmButtonImports,
        HlmTableImports,
        FormsModule,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],

    providers: [
        provideIcons({
            lucideLoaderCircle,
            lucideRefreshCw,
            lucidePlus,
        }),
    ],

    templateUrl:
        './organizational-units.html',

    styleUrl:
        './organizational-units.css',
})
export class OrganizationalUnits {
    private readonly unitApi =
        inject(
            OrganizationalUnitApiService,
        );

    private readonly companyContext =
        inject(
            CompanyContextService,
        );

    private readonly permissions =
        inject(
            PermissionService,
        );


    private readonly _units =
        signal<
            OrganizationalUnit[]
        >([]);

    private readonly _manageableUnits =
        signal<
            OrganizationalUnit[]
        >([]);

    private readonly _manageCatalogAvailable =
        signal(false);

    private readonly _state =
        signal<
            OrganizationalUnitsState
        >(
            'idle',
        );

    private readonly _reloadVersion =
        signal(0);


    readonly units =
        this._units.asReadonly();

    readonly manageableUnits =
        this._manageableUnits
            .asReadonly();

    readonly manageCatalogMessage =
        signal<string | null>(
            null,
        );

    readonly state =
        this._state.asReadonly();


    readonly rows =
        computed(
            () =>
                this.flattenUnits(
                    this._units(),
                ),
        );


    readonly canManageUnits =
        computed(
            () =>
                this.permissions.can(
                    PermissionCode
                        .OrganizationalUnitsManage,
                ),
        );


    readonly canManageTree =
        computed(
            () =>
                this.permissions.can(
                    PermissionCode
                        .OrganizationalUnitsManage,

                    PermissionScope
                        .OwnUnitTree,
                ),
        );


    readonly canManageCompany =
        computed(
            () =>
                this.permissions.can(
                    PermissionCode
                        .OrganizationalUnitsManage,

                    PermissionScope.Company,
                ),
        );


    readonly canCreateUnits =
        computed(
            () =>
                this._manageCatalogAvailable()
                && (
                    this.canManageCompany()
                    || (
                        this.canManageTree()
                        && this
                            ._manageableUnits()
                            .length > 0
                    )
                ),
        );


    constructor() {
        effect(
            onCleanup => {
                this._reloadVersion();


                const companyId =
                    this.companyContext
                        .activeCompanyId();

                const canRead =
                    this.permissions.can(
                        PermissionCode
                            .OrganizationalUnitsRead,
                    );


                if (
                    companyId === null
                    || !canRead
                ) {
                    this.reset();

                    return;
                }


                const canManage =
                    this.permissions.can(
                        PermissionCode
                            .OrganizationalUnitsManage,
                    );


                this._units.set([]);

                this._manageableUnits.set(
                    [],
                );

                this._manageCatalogAvailable.set(
                    false,
                );

                this.manageCatalogMessage.set(
                    null,
                );

                this._state.set(
                    'loading',
                );


                /*
                 * Ошибка manage catalog
                 * не должна ломать просмотр
                 * организационной структуры.
                 *
                 * В таком случае страница
                 * остаётся read-only.
                 */
                const manageable$ =
                    canManage
                        ? this.unitApi
                            .listManageable(
                                companyId,
                            )
                            .pipe(
                                map(
                                    units => ({
                                        available:
                                            true,

                                        units,

                                        message:
                                            null,
                                    }),
                                ),

                                catchError(
                                    error =>
                                        of({
                                            available:
                                                false,

                                            units:
                                                [],

                                            message:
                                                this
                                                    .getManageCatalogError(
                                                        error,
                                                    ),
                                        }),
                                ),
                            )
                        : of({
                            available:
                                false,

                            units:
                                [],

                            message:
                                null,
                        });


                const subscription =
                    forkJoin({
                        visible:
                            this.unitApi
                                .list(
                                    companyId,
                                ),

                        manageable:
                            manageable$,
                    })
                        .subscribe({
                            next: result => {
                                this._units.set(
                                    result.visible,
                                );

                                this._manageableUnits.set(
                                    result
                                        .manageable
                                        .units,
                                );

                                this._manageCatalogAvailable.set(
                                    result
                                        .manageable
                                        .available,
                                );

                                this.manageCatalogMessage.set(
                                    result
                                        .manageable
                                        .message,
                                );

                                this._state.set(
                                    'ready',
                                );
                            },

                            error: () => {
                                this._units.set(
                                    [],
                                );

                                this._manageableUnits.set(
                                    [],
                                );

                                this._manageCatalogAvailable.set(
                                    false,
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


    canEditUnit(
        unit:
            OrganizationalUnit,
    ): boolean {
        return (
            this.canManageUnits()
            && this._manageCatalogAvailable()
            && this
                ._manageableUnits()
                .some(
                    manageable =>
                        manageable.id
                        === unit.id,
                )
        );
    }


    startEdit(
        unit:
            OrganizationalUnit,
    ): void {
        if (
            !this.canEditUnit(
                unit,
            )
        ) {
            return;
        }


        this.editingUnit.set(
            unit,
        );

        this.editName.set(
            unit.name,
        );

        this.editType.set(
            unit.type,
        );

        /*
         * Не подставляем parent_id
         * автоматически.
         *
         * Он может находиться вне
         * manage scope пользователя.
         */
        this.editParentSelection.set(
            'unchanged',
        );

        this.editIsActive.set(
            unit.is_active,
        );

        this.updating.set(
            false,
        );

        this.editError.set(
            null,
        );
    }


    resetEditForm(): void {
        this.editingUnit.set(
            null,
        );

        this.editName.set('');

        this.editType.set(
            OrganizationalUnitType
                .Department,
        );

        this.editParentSelection.set(
            'unchanged',
        );

        this.editIsActive.set(
            true,
        );

        this.updating.set(
            false,
        );

        this.editError.set(
            null,
        );
    }


    currentParentLabel(
        unit:
            OrganizationalUnit,
    ): string {
        if (
            unit.parent_id === null
        ) {
            return 'Корень компании';
        }


        const parent =
            this._units()
                .find(
                    candidate =>
                        candidate.id
                        === unit.parent_id,
                )
            ?? this._manageableUnits()
                .find(
                    candidate =>
                        candidate.id
                        === unit.parent_id,
                );


        if (parent) {
            return parent.name;
        }


        return (
            `Подразделение #${unit.parent_id}`
            + ' (вне доступной области)'
        );
    }


    saveEdit(
        dialog:
            BrnDialog,
    ): void {
        const companyId =
            this.companyContext
                .activeCompanyId();

        const unit =
            this.editingUnit();


        if (
            companyId === null
            || unit === null
            || this.updating()
            || !this.canEditUnit(
                unit,
            )
        ) {
            return;
        }


        const name =
            this.editName()
                .trim();


        if (!name) {
            this.editError.set(
                'Укажите название подразделения',
            );

            return;
        }


        if (
            name.length > 255
        ) {
            this.editError.set(
                'Название не должно превышать 255 символов',
            );

            return;
        }


        const data:
            OrganizationalUnitUpdate = {};


        if (
            name !== unit.name
        ) {
            data.name =
                name;
        }


        if (
            this.editType()
            !== unit.type
        ) {
            data.type =
                this.editType();
        }


        if (
            this.editIsActive()
            !== unit.is_active
        ) {
            data.is_active =
                this.editIsActive();
        }


        const parentSelection =
            this.editParentSelection();


        if (
            parentSelection
            !== 'unchanged'
        ) {
            /*
             * Только COMPANY может
             * переносить unit в root.
             */
            if (
                parentSelection === null
                && !this.canManageCompany()
            ) {
                this.editError.set(
                    'Перемещение в корень компании недоступно',
                );

                return;
            }


            if (
                parentSelection !== null
                && !this
                    .editParentOptions()
                    .some(
                        candidate =>
                            candidate.id
                            === parentSelection,
                    )
            ) {
                this.editError.set(
                    'Выбранное родительское подразделение недоступно',
                );

                return;
            }


            data.parent_id =
                parentSelection;
        }


        /*
         * Ничего не изменилось.
         * PATCH делать незачем.
         */
        if (
            Object.keys(
                data,
            ).length === 0
        ) {
            this.resetEditForm();

            dialog.close({});

            return;
        }


        this.updating.set(
            true,
        );

        this.editError.set(
            null,
        );


        this.unitApi
            .update(
                companyId,
                unit.id,
                data,
            )
            .subscribe({
                next: () => {
                    this.updating.set(
                        false,
                    );

                    this.resetEditForm();

                    dialog.close({});

                    /*
                     * Перечитываем одновременно
                     * visible и manageable state.
                     */
                    this.retry();
                },

                error: error => {
                    this.updating.set(
                        false,
                    );

                    this.editError.set(
                        this.getUpdateError(
                            error,
                        ),
                    );
                },
            });
    }


    createUnit(
        dialog: BrnDialog,
    ): void {
        const companyId =
            this.companyContext
                .activeCompanyId();

        if (
            companyId === null
            || this.creating()
            || !this.canCreateUnits()
        ) {
            return;
        }


        const name =
            this.createName()
                .trim();

        const parentId =
            this.createParentId();


        if (!name) {
            this.createError.set(
                'Укажите название подразделения',
            );

            return;
        }


        if (
            name.length > 255
        ) {
            this.createError.set(
                'Название не должно превышать 255 символов',
            );

            return;
        }


        /*
         * OWN_UNIT_TREE не имеет права
         * создавать company root.
         */
        if (
            !this.canManageCompany()
            && parentId === null
        ) {
            this.createError.set(
                'Выберите родительское подразделение',
            );

            return;
        }


        /*
         * Не позволяем вручную отправить
         * unit вне manage scope.
         */
        if (
            parentId !== null
            && !this
                ._manageableUnits()
                .some(
                    unit =>
                        unit.id
                        === parentId,
                )
        ) {
            this.createError.set(
                'Родительское подразделение недоступно',
            );

            return;
        }


        this.creating.set(
            true,
        );

        this.createError.set(
            null,
        );


        this.unitApi
            .create(
                companyId,
                {
                    name,

                    type:
                        this.createType(),

                    parent_id:
                        parentId,
                },
            )
            .subscribe({
                next: () => {
                    this.creating.set(
                        false,
                    );

                    this.resetCreateForm();

                    dialog.close({});

                    this.retry();
                },

                error: error => {
                    this.creating.set(
                        false,
                    );

                    this.createError.set(
                        this.getCreateError(
                            error,
                        ),
                    );
                },
            });
    }


    resetCreateForm(): void {
        this.createName.set('');

        this.createType.set(
            OrganizationalUnitType
                .Department,
        );

        this.createParentId.set(
            null,
        );

        this.createError.set(
            null,
        );
    }


    private getDescendantIds(
        unitId: number,
        units:
            readonly OrganizationalUnit[],
    ): Set<number> {
        const childrenByParent =
            new Map<
                number,
                number[]
            >();


        for (
            const unit
            of units
        ) {
            if (
                unit.parent_id === null
            ) {
                continue;
            }


            const children =
                childrenByParent.get(
                    unit.parent_id,
                )
                ?? [];

            children.push(
                unit.id,
            );

            childrenByParent.set(
                unit.parent_id,
                children,
            );
        }


        const descendants =
            new Set<number>();

        const queue =
            [
                unitId,
            ];


        while (
            queue.length > 0
        ) {
            const parentId =
                queue.shift();

            if (
                parentId === undefined
            ) {
                break;
            }


            const children =
                childrenByParent.get(
                    parentId,
                )
                ?? [];


            for (
                const childId
                of children
            ) {
                if (
                    descendants.has(
                        childId,
                    )
                ) {
                    continue;
                }

                descendants.add(
                    childId,
                );

                queue.push(
                    childId,
                );
            }
        }


        return descendants;
    }


    private getManageCatalogError(
        error: unknown,
    ): string {
        if (
            error instanceof
            HttpErrorResponse
            && error.status === 403
        ) {
            return (
                'Право управления оргструктурой '
                + 'изменилось. Страница доступна '
                + 'только для просмотра.'
            );
        }

        return (
            'Не удалось загрузить область '
            + 'управления подразделениями. '
            + 'Редактирование временно отключено.'
        );
    }


    private getCreateError(
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
                    'У вас больше нет права '
                    + 'создавать подразделение'
                );
            }

            if (
                error.status === 404
            ) {
                return (
                    'Родительское подразделение '
                    + 'больше не входит '
                    + 'в доступную область'
                );
            }

            if (
                error.status === 400
            ) {
                return (
                    'Родительское подразделение '
                    + 'не найдено'
                );
            }

            if (
                error.status === 409
            ) {
                return (
                    'Невозможно использовать '
                    + 'выбранное родительское '
                    + 'подразделение'
                );
            }
        }


        return (
            'Не удалось создать подразделение'
        );
    }


    private getUpdateError(
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
                    'У вас больше нет права '
                    + 'изменять это подразделение'
                );
            }


            if (
                error.status === 404
            ) {
                return (
                    'Подразделение или новый родитель '
                    + 'больше не входит '
                    + 'в доступную область'
                );
            }


            if (
                error.status === 400
            ) {
                return (
                    'Выбранное родительское '
                    + 'подразделение не найдено'
                );
            }


            if (
                error.status === 409
            ) {
                return (
                    'Невозможно переместить подразделение: '
                    + 'проверьте организационную иерархию'
                );
            }
        }


        return (
            'Не удалось изменить подразделение'
        );
    }


    unitTypeLabel(
        type:
            OrganizationalUnitType,
    ): string {
        switch (type) {
            case OrganizationalUnitType.Division:
                return 'Дивизион';

            case OrganizationalUnitType.Department:
                return 'Отдел';

            case OrganizationalUnitType.Team:
                return 'Команда';

            case OrganizationalUnitType.Group:
                return 'Группа';

            case OrganizationalUnitType.Branch:
                return 'Филиал';
        }
    }


    private flattenUnits(
        units:
            OrganizationalUnit[],
    ): OrganizationalUnitRow[] {
        if (
            units.length === 0
        ) {
            return [];
        }


        const visibleIds =
            new Set(
                units.map(
                    unit =>
                        unit.id,
                ),
            );


        const childrenByParent =
            new Map<
                number,
                OrganizationalUnit[]
            >();


        for (
            const unit
            of units
        ) {
            if (
                unit.parent_id === null
            ) {
                continue;
            }


            const children =
                childrenByParent.get(
                    unit.parent_id,
                )
                ?? [];

            children.push(
                unit,
            );

            childrenByParent.set(
                unit.parent_id,
                children,
            );
        }


        for (
            const children
            of childrenByParent.values()
        ) {
            children.sort(
                (
                    left,
                    right,
                ) =>
                    left.name.localeCompare(
                        right.name,
                    ),
            );
        }


        /*
         * Если parent существует в компании,
         * но скрыт backend scope-ом,
         * visible unit становится root
         * отображаемого дерева.
         */
        const roots =
            units
                .filter(
                    unit =>
                        unit.parent_id === null
                        || !visibleIds.has(
                            unit.parent_id,
                        ),
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


        const rows:
            OrganizationalUnitRow[] =
            [];

        const visited =
            new Set<number>();


        const visit = (
            unit:
                OrganizationalUnit,

            depth:
                number,
        ): void => {
            if (
                visited.has(
                    unit.id,
                )
            ) {
                return;
            }

            visited.add(
                unit.id,
            );


            rows.push({
                unit,
                depth,
            });


            const children =
                childrenByParent.get(
                    unit.id,
                )
                ?? [];


            for (
                const child
                of children
            ) {
                visit(
                    child,
                    depth + 1,
                );
            }
        };


        for (
            const root
            of roots
        ) {
            visit(
                root,
                0,
            );
        }


        /*
         * Защита от повреждённых данных:
         * даже если hierarchy некорректна,
         * unit не исчезнет из UI.
         */
        for (
            const unit
            of units
        ) {
            if (
                !visited.has(
                    unit.id,
                )
            ) {
                visit(
                    unit,
                    0,
                );
            }
        }


        return rows;
    }


    readonly editingUnit =
        signal<
            OrganizationalUnit | null
        >(
            null,
        );


    readonly editName =
        signal('');

    readonly editType =
        signal<
            OrganizationalUnitType
        >(
            OrganizationalUnitType
                .Department,
        );

    readonly editParentSelection =
        signal<
            EditParentSelection
        >(
            'unchanged',
        );

    readonly editIsActive =
        signal(true);

    readonly updating =
        signal(false);

    readonly editError =
        signal<string | null>(
            null,
        );


    readonly editParentOptions =
        computed(
            () => {
                const unit =
                    this.editingUnit();

                if (!unit) {
                    return [];
                }


                const descendants =
                    this.getDescendantIds(
                        unit.id,
                        this._manageableUnits(),
                    );


                return this
                    ._manageableUnits()
                    .filter(
                        candidate =>
                            candidate.id
                            !== unit.id
                            && !descendants.has(
                                candidate.id,
                            ),
                    );
            },
        );


    readonly createName =
        signal('');

    readonly createType =
        signal<
            OrganizationalUnitType
        >(
            OrganizationalUnitType
                .Department,
        );

    readonly createParentId =
        signal<number | null>(
            null,
        );

    readonly creating =
        signal(false);

    readonly createError =
        signal<string | null>(
            null,
        );


    readonly unitTypeOptions = [
        {
            value:
                OrganizationalUnitType
                    .Division,

            label:
                'Дивизион',
        },
        {
            value:
                OrganizationalUnitType
                    .Department,

            label:
                'Отдел',
        },
        {
            value:
                OrganizationalUnitType
                    .Team,

            label:
                'Команда',
        },
        {
            value:
                OrganizationalUnitType
                    .Group,

            label:
                'Группа',
        },
        {
            value:
                OrganizationalUnitType
                    .Branch,

            label:
                'Филиал',
        },
    ] as const;


    private reset(): void {
        this._units.set([]);

        this._state.set(
            'idle',
        );

        this._manageableUnits.set(
            [],
        );

        this._manageCatalogAvailable.set(
            false,
        );

        this.manageCatalogMessage.set(
            null,
        );

        this.resetCreateForm();

        this.resetEditForm();
    }
}