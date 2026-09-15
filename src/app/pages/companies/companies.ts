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
    lucideBuilding2,
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
    CompanyApiService,
} from '../../core/company/company-api.service';

import {
    CompanyContextService,
} from '../../core/company/company-context.service';

import type {
    CompanyTreeNode,
} from '../../core/company/company.models';

import {
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';


type CompaniesState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';


interface CompanyTreeRow {
    company:
    CompanyTreeNode;

    depth:
    number;
}


@Component({
    selector:
        'app-companies',

    imports: [
        NgIcon,
        HlmBadgeImports,
        HlmButtonImports,
        HlmTableImports,
    ],

    providers: [
        provideIcons({
            lucideBuilding2,
            lucideLoaderCircle,
            lucideRefreshCw,
        }),
    ],

    templateUrl:
        './companies.html',

    styleUrl:
        './companies.css',
})
export class Companies {
    private readonly companyApi =
        inject(
            CompanyApiService,
        );

    private readonly companyContext =
        inject(
            CompanyContextService,
        );

    private readonly permissions =
        inject(
            PermissionService,
        );


    private readonly _tree =
        signal<
            CompanyTreeNode | null
        >(
            null,
        );

    private readonly _state =
        signal<CompaniesState>(
            'idle',
        );

    private readonly _reloadVersion =
        signal(0);


    readonly tree =
        this._tree.asReadonly();

    readonly state =
        this._state.asReadonly();


    readonly rows =
        computed(
            () => {
                const tree =
                    this._tree();

                if (tree === null) {
                    return [];
                }

                return this.flattenTree(
                    tree,
                );
            },
        );


    constructor() {
        effect(
            onCleanup => {
                /*
                 * retry() меняет эту signal,
                 * поэтому effect запускается
                 * повторно.
                 */
                this._reloadVersion();


                /*
                 * activeCompanyId() — signal.
                 * При переключении компании
                 * дерево перечитается автоматически.
                 */
                const companyId =
                    this.companyContext
                        .activeCompanyId();


                const canRead =
                    this.permissions.can(
                        PermissionCode
                            .CompaniesRead,

                        PermissionScope
                            .Company,
                    );


                if (
                    companyId === null
                    || !canRead
                ) {
                    this.reset();

                    return;
                }


                this._tree.set(
                    null,
                );

                this._state.set(
                    'loading',
                );


                const subscription =
                    this.companyApi
                        .getTree(
                            companyId,
                        )
                        .subscribe({
                            next: tree => {
                                this._tree.set(
                                    tree,
                                );

                                this._state.set(
                                    'ready',
                                );
                            },

                            error: () => {
                                this._tree.set(
                                    null,
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
        this._reloadVersion
            .update(
                version =>
                    version + 1,
            );
    }


    private reset(): void {
        this._tree.set(
            null,
        );

        this._state.set(
            'idle',
        );
    }


    private flattenTree(
        root: CompanyTreeNode,
    ): CompanyTreeRow[] {
        const rows:
            CompanyTreeRow[] = [];


        const visit = (
            company:
                CompanyTreeNode,

            depth:
                number,
        ): void => {
            rows.push({
                company,
                depth,
            });


            for (
                const child
                of company.children
            ) {
                visit(
                    child,
                    depth + 1,
                );
            }
        };


        visit(
            root,
            0,
        );


        return rows;
    }
}