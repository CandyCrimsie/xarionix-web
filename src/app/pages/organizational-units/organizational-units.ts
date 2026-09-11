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
} from '../../core/organizational-units/organizational-unit.models';

import {
    PermissionCode,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';


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
    ],

    providers: [
        provideIcons({
            lucideLoaderCircle,
            lucideRefreshCw,
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

    readonly state =
        this._state.asReadonly();


    readonly rows =
        computed(
            () =>
                this.flattenUnits(
                    this._units(),
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


                this._units.set([]);

                this._state.set(
                    'loading',
                );


                const subscription =
                    this.unitApi
                        .list(
                            companyId,
                        )
                        .subscribe({
                            next: units => {
                                this._units.set(
                                    units,
                                );

                                this._state.set(
                                    'ready',
                                );
                            },

                            error: () => {
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
            version =>
                version + 1,
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


    private reset(): void {
        this._units.set([]);

        this._state.set(
            'idle',
        );
    }
}