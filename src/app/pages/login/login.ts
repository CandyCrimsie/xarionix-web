import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly auth = inject(AuthService);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly route = inject(ActivatedRoute);

  readonly form = this.formBuilder.nonNullable.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(64),
      ],
    ],

    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(128),
      ]
    ]
  });


  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    this.auth.login(
      this.form.getRawValue(),
    ).pipe(
      finalize(() => {
        this.isSubmitting.set(false);
      }),
    ).subscribe({
      next: () => {
        const returnUrl =
          this.route.snapshot.queryParamMap.get(
            'returnUrl',
          );

        const target =
          returnUrl?.startsWith('/')
            ? returnUrl
            : '/';

        void this.router.navigateByUrl(target);
      },

      error: (error: HttpErrorResponse) => {
        this.handleLoginError(error);
      },
    });
  }


  private handleLoginError(
    error: HttpErrorResponse,
  ): void {
    if (error.status === 401) {
      this.errorMessage.set(
        'Неверное имя пользователя или пароль',
      );

      return;
    }

    if (error.status === 403) {
      this.errorMessage.set(
        'Учетная запись заблокирована',
      );

      return;
    }

    this.errorMessage.set(
      'Не удалось выполнить вход. Попробуйте ещё раз.',
    );

    return;
  }
}
