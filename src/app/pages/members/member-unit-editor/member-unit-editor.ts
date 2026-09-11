import {
    Component,
    computed,
    effect,
    inject,
    input,
    output,
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
    OrganizationalUnitApiService,
} from '../../../core/organizational-units/organizational-unit-api.service';

import {
    OrganizationalUnitType,
} from '../../../core/organizational-units/organizational-unit.models';

import type {
    OrganizationalUnit,
} from '../../../core/organizational-units/organizational-unit.models';

import {
    UnitMembershipApiService,
} from '../../../core/members/unit-membership-api.service';

import type {
    UnitMembership,
} from '../../../core/members/unit-membership.models';

import type {
    CompanyMemberSummary,
} from '../../../core/members/member.models';


type EditorState =
    | 'loading'
    | 'ready'
    | 'error';


interface UnitCatalogLoadResult {
    available: boolean;

    units:
    OrganizationalUnit[];

    message:
    string | null;
}


@Component({
    selector:
        'app-member-unit-editor',

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
        './member-unit-editor.html',

    styleUrl:
        './member-unit-editor.css',
})
export class MemberUnitEditor {
    readonly member =
        input.required<
            CompanyMemberSummary
        >();

    readonly canManage =
        input(false);

    readonly canReadUnits =
        input(false);

    /*
     * Backend позволяет снять primary
     * только COMPANY-manager.
     */
    readonly canRemovePrimary =
        input(false);


    /*
     * На следующем этапе Members
     * подпишется на это событие
     * и обновит primary-unit summary.
     */
    readonly changed =
        output<void>();


    private readonly unitApi =
        inject(
            OrganizationalUnitApiService,
        );

    private readonly membershipApi =
        inject(
            UnitMembershipApiService,
        );


    private readonly _assignments =
        signal<
            UnitMembership[]
        >([]);

    private readonly _units =
        signal<
            OrganizationalUnit[]
        >([]);

    private readonly _catalogAvailable =
        signal(false);

    private readonly _state =
        signal<EditorState>(
            'loading',
        );

    private readonly _reloadVersion =
        signal(0);


    readonly assignments =
        this._assignments.asReadonly();

    readonly units =
        this._units.asReadonly();

    readonly state =
        this._state.asReadonly();


    readonly selectedUnitId =
        signal<number | null>(
            null,
        );

    readonly catalogMessage =
        signal<string | null>(
            null,
        );

    readonly mutating =
        signal(false);

    readonly mutationError =
        signal<string | null>(
            null,
        );

    readonly mutationSuccess =
        signal<string | null>(
            null,
        );


    readonly canEdit =
        computed(
            () =>
                this.canManage()
                && this.canReadUnits()
                && this._catalogAvailable(),
        );


    readonly availableUnits =
        computed(
            () => {
                const assignedIds =
                    new Set(
                        this._assignments()
                            .map(
                                assignment =>
                                    assignment.unit_id,
                            ),
                    );


                return this._units()
                    .filter(
                        unit =>
                            unit.is_active
                            && !assignedIds.has(
                                unit.id,
                            ),
                    );
            },
        );


    constructor() {
        effect(
            onCleanup => {
                this._reloadVersion();

                const member =
                    this.member();

                const canReadUnits =
                    this.canReadUnits();


                this.resetState();


                const catalog$ =
                    canReadUnits
                        ? this.unitApi
                            .list(
                                member.company_id,
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
                                                this.getCatalogError(
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
                                (
                                    'У вас нет права '
                                    + 'просматривать '
                                    + 'организационную структуру. '
                                    + 'Назначения доступны '
                                    + 'только для просмотра.'
                                ),
                        });


                const subscription =
                    forkJoin({
                        assignments:
                            this.membershipApi
                                .list(
                                    member.id,
                                ),

                        catalog:
                            catalog$,
                    })
                        .subscribe({
                            next: result => {
                                this._assignments.set(
                                    result.assignments,
                                );

                                this._units.set(
                                    result.catalog.units,
                                );

                                this._catalogAvailable.set(
                                    result.catalog.available,
                                );

                                this.catalogMessage.set(
                                    result.catalog.message,
                                );

                                this._state.set(
                                    'ready',
                                );
                            },

                            error: () => {
                                this._assignments.set(
                                    [],
                                );

                                this._units.set(
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


    unitFor(
        unitId: number,
    ): OrganizationalUnit | null {
        return (
            this._units()
                .find(
                    unit =>
                        unit.id
                        === unitId,
                )
            ?? null
        );
    }


    selectUnit(
        unitId: number | null,
    ): void {
        if (
            unitId !== null
            && !this.availableUnits()
                .some(
                    unit =>
                        unit.id
                        === unitId,
                )
        ) {
            return;
        }


        this.selectedUnitId.set(
            unitId,
        );

        this.clearMutationMessage();
    }


    onUnitSelectionChange(
        event: Event,
    ): void {
        const value = (event.target as HTMLSelectElement).value;

        this.selectUnit(
            value
                ? Number(value)
                : null,
        );
    }


    addSelected(
        isPrimary: boolean,
    ): void {
        const unitId =
            this.selectedUnitId();


        if (
            !this.canEdit()
            || this.mutating()
            || unitId === null
        ) {
            return;
        }


        this.startMutation();


        this.membershipApi
            .create(
                this.member().id,
                {
                    unit_id:
                        unitId,

                    is_primary:
                        isPrimary,
                },
            )
            .subscribe({
                next: () => {
                    this.refreshAfterMutation(
                        isPrimary
                            ? (
                                'Основное подразделение '
                                + 'изменено'
                            )
                            : (
                                'Подразделение '
                                + 'добавлено'
                            ),

                        true,
                    );
                },

                error: error => {
                    this.failMutation(
                        error,
                    );
                },
            });
    }


    setPrimary(
        assignment:
            UnitMembership,
    ): void {
        if (
            !this.canSetPrimary(
                assignment,
            )
            || this.mutating()
        ) {
            return;
        }


        this.startMutation();


        this.membershipApi
            .update(
                this.member().id,
                assignment.id,
                {
                    is_primary:
                        true,
                },
            )
            .subscribe({
                next: () => {
                    this.refreshAfterMutation(
                        'Основное подразделение изменено',
                    );
                },

                error: error => {
                    this.failMutation(
                        error,
                    );
                },
            });
    }


    toggleActive(
        assignment:
            UnitMembership,
    ): void {
        if (
            !this.canToggleActive(
                assignment,
            )
            || this.mutating()
        ) {
            return;
        }


        const activate =
            !assignment.is_active;


        this.startMutation();


        this.membershipApi
            .update(
                this.member().id,
                assignment.id,
                {
                    is_active:
                        activate,
                },
            )
            .subscribe({
                next: () => {
                    this.refreshAfterMutation(
                        activate
                            ? (
                                'Назначение активировано'
                            )
                            : (
                                'Назначение отключено'
                            ),
                    );
                },

                error: error => {
                    this.failMutation(
                        error,
                    );
                },
            });
    }


    canSetPrimary(
        assignment:
            UnitMembership,
    ): boolean {
        if (
            !this.canEdit()
            || assignment.is_primary
        ) {
            return false;
        }


        const unit =
            this.unitFor(
                assignment.unit_id,
            );


        return (
            unit !== null
            && unit.is_active
        );
    }


    canToggleActive(
        assignment:
            UnitMembership,
    ): boolean {
        if (
            !this.canEdit()
        ) {
            return false;
        }


        /*
         * OWN_UNIT / OWN_UNIT_TREE
         * не могут снять primary.
         */
        if (
            assignment.is_active
            && assignment.is_primary
            && !this.canRemovePrimary()
        ) {
            return false;
        }


        /*
         * Реактивировать assignment
         * можно только в активный unit.
         */
        if (
            !assignment.is_active
        ) {
            const unit =
                this.unitFor(
                    assignment.unit_id,
                );

            return (
                unit !== null
                && unit.is_active
            );
        }


        return true;
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


    private refreshAfterMutation(
        successMessage: string,
        clearSelection = false,
    ): void {
        this.membershipApi
            .list(
                this.member().id,
            )
            .subscribe({
                next: assignments => {
                    this._assignments.set(
                        assignments,
                    );

                    if (
                        clearSelection
                    ) {
                        this.selectedUnitId.set(
                            null,
                        );
                    }

                    this.mutating.set(
                        false,
                    );

                    this.mutationSuccess.set(
                        successMessage,
                    );

                    this.changed.emit();
                },

                error: () => {
                    this.mutating.set(
                        false,
                    );

                    this.mutationError.set(
                        (
                            'Изменение сохранено, '
                            + 'но не удалось обновить '
                            + 'список подразделений. '
                            + 'Повторно откройте редактор.'
                        ),
                    );

                    /*
                     * Изменение в backend уже произошло,
                     * поэтому parent summary всё равно
                     * необходимо обновить.
                     */
                    this.changed.emit();
                },
            });
    }


    private startMutation(): void {
        this.mutating.set(
            true,
        );

        this.clearMutationMessage();
    }


    private failMutation(
        error: unknown,
    ): void {
        this.mutating.set(
            false,
        );

        this.mutationError.set(
            this.getMutationError(
                error,
            ),
        );
    }


    private clearMutationMessage(): void {
        this.mutationError.set(
            null,
        );

        this.mutationSuccess.set(
            null,
        );
    }


    private getCatalogError(
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
                    'Право просмотра '
                    + 'организационной структуры '
                    + 'изменилось. Назначения '
                    + 'доступны только для просмотра.'
                );
            }
        }


        return (
            'Не удалось загрузить список '
            + 'доступных подразделений. '
            + 'Редактирование отключено.'
        );
    }


    private getMutationError(
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
                    + 'изменять это назначение.'
                );
            }

            if (
                error.status === 404
            ) {
                return (
                    'Сотрудник или подразделение '
                    + 'больше не входит в доступную '
                    + 'вам область.'
                );
            }

            if (
                error.status === 409
            ) {
                return (
                    'Сотрудник уже назначен '
                    + 'в это подразделение.'
                );
            }
        }


        return (
            'Не удалось изменить '
            + 'подразделение сотрудника'
        );
    }


    private resetState(): void {
        this._assignments.set(
            [],
        );

        this._units.set(
            [],
        );

        this._catalogAvailable.set(
            false,
        );

        this.selectedUnitId.set(
            null,
        );

        this.catalogMessage.set(
            null,
        );

        this.mutating.set(
            false,
        );

        this.clearMutationMessage();

        this._state.set(
            'loading',
        );
    }
}