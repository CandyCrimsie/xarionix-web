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
    lucidePlus,
    lucidePencil,
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

import {
    AuthService,
} from '../../core/auth/auth.service';


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
        FormsModule,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],

    providers: [
        provideIcons({
            lucideBuilding2,
            lucideLoaderCircle,
            lucideRefreshCw,
            lucidePlus,
            lucidePencil,
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

    private readonly auth =
        inject(
            AuthService,
        );

    private readonly _reloadVersion =
        signal(0);


    readonly tree =
        this._tree.asReadonly();

    readonly state =
        this._state.asReadonly();


    readonly createName =
        signal('');

    readonly createShortName =
        signal('');

    readonly creating =
        signal(false);

    readonly createError =
        signal<string | null>(
            null,
        );


    readonly rootCreateName =
        signal('');

    readonly rootCreateShortName =
        signal('');

    readonly rootCreating =
        signal(false);

    readonly rootCreateError =
        signal<string | null>(
            null,
        );


    readonly editingCompany =
        signal<CompanyTreeNode | null>(
            null,
        );

    readonly editName =
        signal('');

    readonly editShortName =
        signal('');

    readonly editSaving =
        signal(false);

    readonly editError =
        signal<string | null>(
            null,
        );


    readonly canCreateRootCompany =
        computed(
            () =>
                this.auth.user()
                    ?.is_system_admin
                === true,
        );


    readonly canManageCompanies =
        computed(
            () =>
                this.permissions.can(
                    PermissionCode
                        .CompaniesManage,

                    PermissionScope
                        .Company,
                ),
        );


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


    resetCreateForm(): void {
        this.createName.set(
            '',
        );

        this.createShortName.set(
            '',
        );

        this.creating.set(
            false,
        );

        this.createError.set(
            null,
        );
    }


    resetRootCreateForm(): void {
        this.rootCreateName.set(
            '',
        );

        this.rootCreateShortName.set(
            '',
        );

        this.rootCreating.set(
            false,
        );

        this.rootCreateError.set(
            null,
        );
    }


    startEdit(
        company: CompanyTreeNode,
    ): void {
        this.editingCompany.set(
            company,
        );

        this.editName.set(
            company.name,
        );

        this.editShortName.set(
            company.short_name ?? '',
        );

        this.editSaving.set(
            false,
        );

        this.editError.set(
            null,
        );
    }


    resetEditForm(): void {
        this.editingCompany.set(
            null,
        );

        this.editName.set(
            '',
        );

        this.editShortName.set(
            '',
        );

        this.editSaving.set(
            false,
        );

        this.editError.set(
            null,
        );
    }


    createRoot(
        dialog: BrnDialog,
    ): void {
        if (
            this.rootCreating()
            || !this.canCreateRootCompany()
        ) {
            return;
        }


        const name =
            this.rootCreateName()
                .trim();

        const shortName =
            this.rootCreateShortName()
                .trim();


        if (!name) {
            this.rootCreateError.set(
                'Укажите название компании',
            );

            return;
        }


        if (name.length > 255) {
            this.rootCreateError.set(
                'Название не должно превышать 255 символов',
            );

            return;
        }


        if (
            shortName.length > 100
        ) {
            this.rootCreateError.set(
                'Короткое название не должно превышать 100 символов',
            );

            return;
        }


        this.rootCreating.set(
            true,
        );

        this.rootCreateError.set(
            null,
        );


        this.companyApi
            .createRoot({
                name,

                short_name:
                    shortName || null,
            })
            .subscribe({
                next: () => {
                    this.resetRootCreateForm();

                    dialog.close({});


                    /*
                     * Root-компания не входит
                     * в дерево текущей компании.
                     *
                     * Поэтому tree перечитывать
                     * не нужно.
                     *
                     * Обновляем только список
                     * доступных пользователю
                     * компаний для switcher.
                     */
                    this.companyContext
                        .loadAvailableCompanies()
                        .subscribe({
                            error: () => {
                                /*
                                 * Компания уже создана.
                                 *
                                 * Ошибка обновления
                                 * switcher не должна
                                 * превращаться в ошибку
                                 * создания и провоцировать
                                 * повторный POST.
                                 */
                            },
                        });
                },

                error: error => {
                    this.rootCreating.set(
                        false,
                    );

                    this.rootCreateError.set(
                        this.getRootCreateError(
                            error,
                        ),
                    );
                },
            });
    }


    createChild(
        dialog: BrnDialog,
    ): void {
        const companyId =
            this.companyContext
                .activeCompanyId();


        if (
            companyId === null
            || this.creating()
            || !this.canManageCompanies()
        ) {
            return;
        }


        const name =
            this.createName()
                .trim();

        const shortName =
            this.createShortName()
                .trim();


        if (!name) {
            this.createError.set(
                'Укажите название компании',
            );

            return;
        }


        if (name.length > 255) {
            this.createError.set(
                'Название не должно превышать 255 символов',
            );

            return;
        }


        if (
            shortName.length > 100
        ) {
            this.createError.set(
                'Короткое название не должно превышать 100 символов',
            );

            return;
        }


        this.creating.set(
            true,
        );

        this.createError.set(
            null,
        );


        this.companyApi
            .createChild(
                companyId,
                {
                    name,

                    short_name:
                        shortName || null,
                },
            )
            .subscribe({
                next: () => {
                    this.resetCreateForm();

                    dialog.close({});


                    /*
                     * Обновляем дерево текущей компании.
                     */
                    this.retry();


                    /*
                     * Создатель получил membership
                     * в новой дочерней компании,
                     * поэтому она должна сразу
                     * появиться в company switcher.
                     */
                    this.companyContext
                        .loadAvailableCompanies()
                        .subscribe({
                            error: () => {
                                /*
                                 * Компания уже создана.
                                 * Ошибка refresh switcher
                                 * не должна провоцировать
                                 * повторный POST.
                                 */
                            },
                        });
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


    saveCompanyMetadata(
        dialog: BrnDialog,
    ): void {
        const rootCompanyId =
            this.companyContext
                .activeCompanyId();

        const company =
            this.editingCompany();


        if (
            rootCompanyId === null
            || company === null
            || this.editSaving()
            || !this.canManageCompanies()
        ) {
            return;
        }


        const name =
            this.editName()
                .trim();

        const shortName =
            this.editShortName()
                .trim();


        if (!name) {
            this.editError.set(
                'Укажите название компании',
            );

            return;
        }


        if (name.length > 255) {
            this.editError.set(
                'Название не должно превышать 255 символов',
            );

            return;
        }


        if (
            shortName.length > 100
        ) {
            this.editError.set(
                'Короткое название не должно превышать 100 символов',
            );

            return;
        }


        this.editSaving.set(
            true,
        );

        this.editError.set(
            null,
        );


        this.companyApi
            .updateMetadata(
                rootCompanyId,
                company.id,
                {
                    name,

                    short_name:
                        shortName || null,
                },
            )
            .subscribe({
                next: () => {
                    this.resetEditForm();

                    dialog.close({});


                    /*
                     * Обновляем дерево,
                     * чтобы сразу показать
                     * новое название.
                     */
                    this.retry();


                    /*
                     * Компания может присутствовать
                     * в company switcher.
                     *
                     * Поэтому обновляем и список
                     * доступных компаний.
                     */
                    this.companyContext
                        .loadAvailableCompanies()
                        .subscribe({
                            error: () => {
                                /*
                                 * Metadata уже сохранена.
                                 * Ошибка refresh switcher
                                 * не должна провоцировать
                                 * повторный PATCH.
                                 */
                            },
                        });
                },

                error: error => {
                    this.editSaving.set(
                        false,
                    );

                    this.editError.set(
                        this.getEditError(
                            error,
                        ),
                    );
                },
            });
    }


    private getEditError(
        error: unknown,
    ): string {
        if (
            error
            instanceof HttpErrorResponse
        ) {
            if (
                error.status === 403
            ) {
                return (
                    'Недостаточно прав для изменения компании'
                );
            }


            if (
                error.status === 404
            ) {
                return (
                    'Компания недоступна в текущем дереве'
                );
            }


            if (
                error.status === 422
            ) {
                return (
                    'Проверьте введённые данные'
                );
            }
        }


        return (
            'Не удалось сохранить изменения'
        );
    }


    private getCreateError(
        error: unknown,
    ): string {
        if (
            error
            instanceof HttpErrorResponse
        ) {
            if (
                error.status === 422
            ) {
                return (
                    'Проверьте введённые данные'
                );
            }


            if (
                error.status === 404
            ) {
                return (
                    'Текущая компания недоступна'
                );
            }


            if (
                error.status === 500
            ) {
                return (
                    'Не удалось подготовить новую компанию'
                );
            }
        }


        return (
            'Не удалось создать компанию'
        );
    }


    private getRootCreateError(
        error: unknown,
    ): string {
        if (
            error
            instanceof HttpErrorResponse
        ) {
            if (
                error.status === 403
            ) {
                return (
                    'Требуются права системного администратора'
                );
            }


            if (
                error.status === 422
            ) {
                return (
                    'Проверьте введённые данные'
                );
            }


            if (
                error.status === 500
            ) {
                return (
                    'Не удалось подготовить новую компанию'
                );
            }
        }


        return (
            'Не удалось создать независимую компанию'
        );
    }


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