import {
    Component,
    inject,
    signal,
} from '@angular/core';

import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';

import {
    NgIcon,
    provideIcons,
} from '@ng-icons/core';

import {
    lucideAlertTriangle,
    lucideLoaderCircle,
    lucideRefreshCw,
    lucideSettings,
} from '@ng-icons/lucide';

import {
    HlmButtonImports,
} from '@spartan-ng/helm/button';

import {
    HlmFieldImports,
} from '@spartan-ng/helm/field';

import {
    HlmInputImports,
} from '@spartan-ng/helm/input';

import {
    SetupStateService,
} from '../../core/setup/setup-state.service';

import {
    HttpErrorResponse,
} from '@angular/common/http';

import {
    Router,
} from '@angular/router';

import {
    finalize,
    map,
    switchMap,
} from 'rxjs';

import {
    SetupApiService,
} from '../../core/setup/setup-api.service';


@Component({
    selector:
        'app-setup',

    imports: [
        ReactiveFormsModule,
        NgIcon,
        HlmButtonImports,
        HlmFieldImports,
        HlmInputImports,
    ],

    providers: [
        provideIcons({
            lucideAlertTriangle,
            lucideLoaderCircle,
            lucideRefreshCw,
            lucideSettings,
        }),
    ],

    templateUrl:
        './setup.html',

    styleUrl:
        './setup.css',
})
export class Setup {
    private readonly formBuilder =
        inject(
            FormBuilder,
        );


    private readonly setupApi =
        inject(
            SetupApiService,
        );


    private readonly router =
        inject(
            Router,
        );


    readonly setupState =
        inject(
            SetupStateService,
        );


    readonly refreshing =
        signal(false);


    readonly isSubmitting =
        signal(false);


    readonly submitError =
        signal<string | null>(
            null,
        );


    readonly form =
        this.formBuilder
            .nonNullable
            .group({
                companyName: [
                    '',
                    [
                        Validators.required,
                        Validators.maxLength(
                            255,
                        ),
                    ],
                ],

                companyShortName: [
                    '',
                    [
                        Validators.maxLength(
                            100,
                        ),
                    ],
                ],
            });


    submit(): void {
        if (
            this.isSubmitting()
        ) {
            return;
        }


        this.form.controls
            .companyName
            .setValue(
                this.form.controls
                    .companyName
                    .value
                    .trim(),
            );

        this.form.controls
            .companyShortName
            .setValue(
                this.form.controls
                    .companyShortName
                    .value
                    .trim(),
            );


        this.form
            .updateValueAndValidity();


        if (
            this.form.invalid
        ) {
            this.form
                .markAllAsTouched();

            return;
        }


        const value =
            this.form
                .getRawValue();


        this.submitError.set(
            null,
        );

        this.isSubmitting.set(
            true,
        );


        this.setupApi
            .initialize({
                company: {
                    name:
                        value.companyName,

                    short_name:
                        value.companyShortName
                        || null,
                },
            })
            .pipe(
                /*
                 * После initialize обязательно
                 * перечитываем installation state.
                 */
                switchMap(
                    () =>
                        this.setupState
                            .refresh(),
                ),

                map(
                    () => {
                        if (
                            !this.setupState
                                .isInstalled()
                        ) {
                            throw new Error(
                                'Installation status was not confirmed',
                            );
                        }
                    },
                ),

                finalize(
                    () => {
                        this.isSubmitting.set(
                            false,
                        );
                    },
                ),
            )
            .subscribe({
                next: () => {
                    /*
                     * Пароля администратора
                     * frontend не знает.
                     *
                     * После установки пользователь
                     * входит credentials из .env.
                     */
                    void this.router
                        .navigateByUrl(
                            '/login',
                        );
                },

                error: error => {
                    this.handleSubmitError(
                        error,
                    );
                },
            });
    }


    retryStatus(): void {
        if (
            this.refreshing()
        ) {
            return;
        }


        this.refreshing.set(
            true,
        );


        this.setupState
            .refresh()
            .subscribe({
                complete: () => {
                    this.refreshing.set(
                        false,
                    );


                    /*
                     * Состояние могло быть
                     * исправлено вручную.
                     *
                     * Если ERP теперь установлена,
                     * initial bootstrap уже не
                     * выполнялся для этой вкладки,
                     * поэтому ведём пользователя
                     * на обычный login.
                     */
                    if (
                        this.setupState
                            .isInstalled()
                    ) {
                        void this.router
                            .navigateByUrl(
                                '/login',
                            );
                    }
                },
            });
    }


    hasPasswordMismatch():
        boolean {
        return (
            this.form
                .hasError(
                    'passwordMismatch',
                )
            && (
                this.form.controls
                    .passwordConfirm
                    .touched
                || this.form.controls
                    .passwordConfirm
                    .dirty
            )
        );
    }


    private handleSubmitError(
        error: unknown,
    ): void {
        /*
         * Installation уже завершилась,
         * но automatic login не удался.
         *
         * Повторно POST /setup/initialize
         * делать нельзя.
         *
         * /login уже разрешён, потому что
         * installation state = INSTALLED.
         */
        if (
            this.setupState
                .isInstalled()
        ) {
            void this.router
                .navigateByUrl(
                    '/login',
                );

            return;
        }


        /*
         * refresh installation status
         * уже перевёл UI в соответствующий
         * fail-closed экран.
         */
        if (
            this.setupState
                .hasError()
            || this.setupState
                .isInconsistent()
        ) {
            return;
        }


        if (
            error instanceof
            HttpErrorResponse
        ) {
            if (
                error.status === 409
            ) {
                /*
                 * Например, два installer
                 * request одновременно.
                 *
                 * Backend защищён advisory lock
                 * и один из запросов получит 409.
                 *
                 * Перечитываем реальное состояние.
                 */
                this.setupState
                    .refresh()
                    .subscribe({
                        complete:
                            () => {
                                if (
                                    this.setupState
                                        .isInstalled()
                                ) {
                                    void this.router
                                        .navigateByUrl(
                                            '/login',
                                        );

                                    return;
                                }


                                if (
                                    this.setupState
                                        .isSetupRequired()
                                ) {
                                    this.submitError
                                        .set(
                                            (
                                                'Состояние установки изменилось. '
                                                + 'Повторите попытку.'
                                            ),
                                        );
                                }
                            },
                    });

                return;
            }


            if (
                error.status === 422
            ) {
                this.submitError.set(
                    (
                        'Сервер отклонил параметры '
                        + 'первоначальной настройки. '
                        + 'Проверьте введённые данные.'
                    ),
                );

                return;
            }
        }


        this.submitError.set(
            (
                'Не удалось завершить '
                + 'первоначальную настройку. '
                + 'Попробуйте ещё раз.'
            ),
        );
    }
}