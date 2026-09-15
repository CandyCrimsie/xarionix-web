import {
    Component,
    inject,
    signal,
} from '@angular/core';

import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
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
    throwError,
} from 'rxjs';

import {
    AuthService,
} from '../../core/auth/auth.service';

import {
    CompanyContextService,
} from '../../core/company/company-context.service';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    SetupApiService,
} from '../../core/setup/setup-api.service';


const passwordsMatchValidator:
    ValidatorFn = (
        control:
            AbstractControl,
    ): ValidationErrors | null => {
        const password =
            control.get(
                'password',
            )?.value;

        const passwordConfirm =
            control.get(
                'passwordConfirm',
            )?.value;


        if (
            !password
            || !passwordConfirm
        ) {
            return null;
        }


        return password
            === passwordConfirm
            ? null
            : {
                passwordMismatch:
                    true,
            };
    };


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


    private readonly auth =
        inject(
            AuthService,
        );


    private readonly companyContext =
        inject(
            CompanyContextService,
        );


    private readonly permissions =
        inject(
            PermissionService,
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
            .group(
                {
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

                    username: [
                        '',
                        [
                            Validators.required,
                            Validators.minLength(
                                3,
                            ),
                            Validators.maxLength(
                                64,
                            ),
                        ],
                    ],

                    password: [
                        '',
                        [
                            Validators.required,
                            Validators.minLength(
                                8,
                            ),
                            Validators.maxLength(
                                128,
                            ),
                        ],
                    ],

                    passwordConfirm: [
                        '',
                        [
                            Validators.required,
                            Validators.minLength(
                                8,
                            ),
                            Validators.maxLength(
                                128,
                            ),
                        ],
                    ],
                },
                {
                    validators: [
                        passwordsMatchValidator,
                    ],
                },
            );


    submit(): void {
        if (
            this.isSubmitting()
        ) {
            return;
        }


        /*
         * Backend сам нормализует эти
         * значения, но лучше синхронизировать
         * форму до validation и отправки.
         *
         * Password намеренно НЕ trim-им.
         */
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

        this.form.controls
            .username
            .setValue(
                this.form.controls
                    .username
                    .value
                    .trim()
                    .toLowerCase(),
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


        const password =
            value.password;


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

                administrator: {
                    username:
                        value.username,

                    password,
                },
            })
            .pipe(
                /*
                 * Не доверяем одному только
                 * initialize response.
                 *
                 * Перечитываем публичный
                 * installation status.
                 */
                switchMap(
                    response =>
                        this.setupState
                            .refresh()
                            .pipe(
                                map(
                                    () =>
                                        response,
                                ),
                            ),
                ),


                switchMap(
                    response => {
                        /*
                         * Status refresh сам
                         * fail-closed.
                         *
                         * Поэтому продолжать
                         * authentication можно
                         * только после реального
                         * INSTALLED.
                         */
                        if (
                            !this.setupState
                                .isInstalled()
                        ) {
                            return throwError(
                                () =>
                                    new Error(
                                        'Installation status was not confirmed',
                                    ),
                            );
                        }


                        /*
                         * Используем username
                         * из backend response:
                         * backend уже применил
                         * canonical normalization.
                         */
                        return this.auth
                            .login({
                                username:
                                    response.username,

                                password,
                            });
                    },
                ),


                switchMap(
                    () =>
                        this.companyContext
                            .initialize(),
                ),


                switchMap(
                    () =>
                        this.permissions
                            .initialize(),
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
                    void this.router
                        .navigateByUrl(
                            '/',
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