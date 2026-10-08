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
    lucidePower,
    lucidePowerOff,
    lucideMoveRight,
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

import {
    HlmAlertDialogImports,
} from '@spartan-ng/helm/alert-dialog';

import {
    HlmNativeSelectImports,
} from '@spartan-ng/helm/native-select';

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
        HlmAlertDialogImports,
        HlmNativeSelectImports,
    ],

    providers: [
        provideIcons({
            lucideBuilding2,
            lucideLoaderCircle,
            lucideRefreshCw,
            lucidePlus,
            lucidePencil,
            lucidePower,
            lucidePowerOff,
            lucideMoveRight,
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


    readonly activationSavingCompanyId =
        signal<number | null>(
            null,
        );

    readonly activationError =
        signal<string | null>(
            null,
        );


    readonly movingCompany =
        signal<CompanyTreeNode | null>(
            null,
        );

    readonly moveParentId =
        signal<number | null>(
            null,
        );

    readonly moveSaving =
        signal(false);

    readonly moveError =
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


    readonly moveParentOptions =
        computed(
            () => {
                const company =
                    this.movingCompany();


                if (company === null) {
                    return [];
                }


                const unavailableIds =
                    this.getSubtreeIds(
                        company,
                    );


                return this.rows()
                    .filter(
                        row =>
                            !unavailableIds.has(
                                row.company.id,
                            ),
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


    startMove(
        company: CompanyTreeNode,
    ): void {
        this.movingCompany.set(
            company,
        );

        this.moveParentId.set(
            company.parent_id,
        );

        this.moveSaving.set(
            false,
        );

        this.moveError.set(
            null,
        );
    }


    resetMoveForm(): void {
        this.movingCompany.set(
            null,
        );

        this.moveParentId.set(
            null,
        );

        this.moveSaving.set(
            false,
        );

        this.moveError.set(
            null,
        );
    }


    setMoveParent(
        value: string | null | undefined,
    ): void {
        if (!value) {
            this.moveParentId.set(
                null,
            );

            return;
        }


        const parentId =
            Number(value);


        this.moveParentId.set(
            Number.isInteger(parentId)
                && parentId > 0
                ? parentId
                : null,
        );

        this.moveError.set(
            null,
        );
    }


    getMoveParentLabel(
        row: CompanyTreeRow,
    ): string {
        return (
            '\u00a0\u00a0'.repeat(
                row.depth,
            )
            + row.company.name
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


    setCompanyActivation(
        company: CompanyTreeNode,
        isActive: boolean,
        dialog?: BrnDialog,
    ): void {
        const rootCompanyId =
            this.companyContext
                .activeCompanyId();


        if (
            rootCompanyId === null
            || this.activationSavingCompanyId()
                !== null
            || !this.canManageCompanies()
            || (
                company.id
                === rootCompanyId
                && !isActive
            )
        ) {
            return;
        }


        this.activationSavingCompanyId.set(
            company.id,
        );

        this.activationError.set(
            null,
        );


        this.companyApi
            .setActivation(
                rootCompanyId,
                company.id,
                {
                    is_active:
                        isActive,
                },
            )
            .subscribe({
                next: () => {
                    this.activationSavingCompanyId.set(
                        null,
                    );

                    dialog?.close({});


                    this.retry();


                    /*
                     * Деактивированные компании
                     * должны сразу исчезнуть
                     * из company switcher.
                     *
                     * PATCH уже выполнен, поэтому
                     * ошибка refresh не должна
                     * провоцировать повторный запрос.
                     */
                    this.companyContext
                        .loadAvailableCompanies()
                        .subscribe({
                            error: () => {
                                // Activation уже сохранена.
                            },
                        });
                },

                error: error => {
                    this.activationSavingCompanyId.set(
                        null,
                    );

                    this.activationError.set(
                        this.getActivationError(
                            error,
                            isActive,
                        ),
                    );
                },
            });
    }


    clearActivationError(): void {
        this.activationError.set(
            null,
        );
    }


    moveCompany(
        dialog: BrnDialog,
    ): void {
        const rootCompanyId =
            this.companyContext
                .activeCompanyId();

        const company =
            this.movingCompany();

        const parentId =
            this.moveParentId();


        if (
            rootCompanyId === null
            || company === null
            || this.moveSaving()
            || !this.canManageCompanies()
        ) {
            return;
        }


        if (
            company.id
            === rootCompanyId
        ) {
            this.moveError.set(
                'Корневую компанию нельзя перемещать',
            );

            return;
        }


        if (parentId === null) {
            this.moveError.set(
                'Выберите новую родительскую компанию',
            );

            return;
        }


        this.moveSaving.set(
            true,
        );

        this.moveError.set(
            null,
        );


        this.companyApi
            .move(
                rootCompanyId,
                company.id,
                {
                    parent_id:
                        parentId,
                },
            )
            .subscribe({
                next: () => {
                    this.resetMoveForm();

                    dialog.close({});


                    this.retry();
                },

                error: error => {
                    this.moveSaving.set(
                        false,
                    );

                    this.moveError.set(
                        this.getMoveError(
                            error,
                        ),
                    );
                },
            });
    }


    private getMoveError(
        error: unknown,
    ): string {
        if (
            error
            instanceof HttpErrorResponse
        ) {
            if (
                error.status === 400
            ) {
                return (
                    'Корневую компанию нельзя перемещать'
                );
            }


            if (
                error.status === 403
            ) {
                return (
                    'Недостаточно прав для перемещения компании'
                );
            }


            if (
                error.status === 404
            ) {
                return (
                    'Компания или новый родитель недоступны в текущем дереве'
                );
            }


            if (
                error.status === 409
            ) {
                const detail =
                    typeof error.error
                    ?.detail === 'string'
                        ? error.error.detail
                        : '';


                if (
                    detail.includes(
                        'inactive',
                    )
                ) {
                    return (
                        'Нельзя переместить активную компанию под отключённую'
                    );
                }


                return (
                    'Нельзя переместить компанию внутрь её дочерней ветки'
                );
            }
        }


        return (
            'Не удалось переместить компанию'
        );
    }


    private getActivationError(
        error: unknown,
        isActive: boolean,
    ): string {
        if (
            error
            instanceof HttpErrorResponse
        ) {
            if (
                error.status === 403
            ) {
                return (
                    'Недостаточно прав для изменения статуса компании'
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
                error.status === 400
                && !isActive
            ) {
                return (
                    'Текущую корневую компанию нельзя отключить'
                );
            }


            if (
                error.status === 409
                && isActive
            ) {
                return (
                    'Сначала активируйте родительскую компанию'
                );
            }
        }


        return isActive
            ? 'Не удалось активировать компанию'
            : 'Не удалось отключить компанию';
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


    private getSubtreeIds(
        root: CompanyTreeNode,
    ): Set<number> {
        const ids =
            new Set<number>();


        const visit = (
            company:
                CompanyTreeNode,
        ): void => {
            ids.add(
                company.id,
            );


            for (
                const child
                of company.children
            ) {
                visit(
                    child,
                );
            }
        };


        visit(
            root,
        );


        return ids;
    }
}
