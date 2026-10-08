import {
  ChangeDetectionStrategy,
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
  HttpErrorResponse,
} from '@angular/common/http';

import { DatePipe } from '@angular/common';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBuilding2,
  lucideCheck,
  lucideLoaderCircle,
  lucideRefreshCw,
} from '@ng-icons/lucide';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';

import { AuthService } from '../../core/auth/auth.service';
import { CompanyContextService } from '../../core/company/company-context.service';
import { InvitationApiService } from '../../core/invitations/invitation-api.service';
import type { PublicInvitation } from '../../core/invitations/invitation.models';


type PublicInvitationState =
  | 'loading'
  | 'ready'
  | 'error'
  | 'accepted';


@Component({
  selector: 'app-invitation-acceptance',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NgIcon,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
  ],
  providers: [
    provideIcons({
      lucideBuilding2,
      lucideCheck,
      lucideLoaderCircle,
      lucideRefreshCw,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invitation-acceptance.html',
  styleUrl: './invitation-acceptance.css',
})
export class InvitationAcceptance {
  private readonly invitationApi =
    inject(InvitationApiService);

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly auth = inject(AuthService);

  private readonly token =
    this.route.snapshot.paramMap.get('token') ?? '';

  readonly state = signal<PublicInvitationState>('loading');
  readonly invitation = signal<PublicInvitation | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly submitting = signal(false);

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
      ],
    ],
    confirmPassword: [
      '',
      [Validators.required],
    ],
  });


  constructor() {
    this.loadInvitation();
  }


  loadInvitation(): void {
    if (!this.token) {
      this.state.set('error');
      this.errorMessage.set('Приглашение не найдено');
      return;
    }

    this.state.set('loading');
    this.errorMessage.set(null);

    this.invitationApi
      .getPublic(this.token)
      .subscribe({
        next: invitation => {
          this.invitation.set(invitation);
          this.state.set('ready');
        },
        error: error => {
          this.invitation.set(null);
          this.state.set('error');
          this.errorMessage.set(
            this.getLoadError(error),
          );
        },
      });
  }


  submitNewUser(): void {
    if (
      this.form.invalid
      || this.submitting()
      || this.invitation()?.status !== 'pending'
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    if (value.password !== value.confirmPassword) {
      this.errorMessage.set('Пароли не совпадают');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.invitationApi
      .acceptNew(
        this.token,
        {
          username: value.username.trim().toLowerCase(),
          password: value.password,
        },
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl('/login');
        },
        error: error => {
          this.submitting.set(false);
          this.errorMessage.set(
            this.getAcceptanceError(error),
          );
        },
      });
  }


  acceptExisting(): void {
    if (
      this.submitting()
      || !this.auth.isAuthenticated()
      || this.invitation()?.status !== 'pending'
    ) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.invitationApi
      .acceptExisting(this.token)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.state.set('accepted');

          this.companyContext
            .loadAvailableCompanies()
            .subscribe({
              error: () => {
                // Membership уже создан: не повторяем acceptance.
              },
            });
        },
        error: error => {
          this.submitting.set(false);
          this.errorMessage.set(
            this.getAcceptanceError(error),
          );
        },
      });
  }


  private getLoadError(error: unknown): string {
    if (
      error instanceof HttpErrorResponse
      && error.status === 404
    ) {
      return 'Приглашение не найдено';
    }

    return 'Не удалось проверить приглашение';
  }


  private getAcceptanceError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 410) {
        return 'Срок действия приглашения истёк или оно было отозвано';
      }

      if (error.status === 409) {
        const detail =
          typeof error.error?.detail === 'string'
            ? error.error.detail
            : '';

        if (detail.includes('already a member')) {
          return 'Вы уже состоите в этой компании';
        }

        if (detail.includes('username')) {
          return 'Пользователь с таким именем уже существует';
        }

        return 'Приглашение уже было использовано';
      }
    }

    return 'Не удалось принять приглашение';
  }
}
