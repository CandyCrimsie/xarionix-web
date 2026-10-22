import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Clipboard } from '@angular/cdk/clipboard';

import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { provideBrnCalendarI18n } from '@spartan-ng/brain/calendar';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideLoaderCircle,
  lucidePlus,
  lucideRefreshCw,
} from '@ng-icons/lucide';

import { InviteTable } from '../../shared/invite-table/invite-table';
import { CompanyContextService } from '../../core/company/company-context.service';
import { InvitationApiService } from '../../core/invitations/invitation-api.service';
import { normalizeEmployeeInput } from '../../core/profile/employee-input';
import { birthDateToIso, formatBirthDate, parseBirthDate } from '../../core/profile/birth-date';

import type {
  CompanyInvitation,
  InvitationPolicy,
  InvitationScope,
} from '../../core/invitations/invitation.models';

import {
  PermissionCode,
  PermissionScope,
} from '../../core/permissions/permission.models';

import { PermissionService } from '../../core/permissions/permission.service';


type InvitationListState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

const birthDateMonths = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const;


@Component({
  selector: 'app-invite',
  imports: [
    FormsModule,
    NgIcon,
    HlmTabsImports,
    HlmButtonImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmInputImports,
    HlmDatePickerImports,
    InviteTable,
  ],
  providers: [
    provideBrnCalendarI18n({
      months: () => [...birthDateMonths],
      formatMonth: month => birthDateMonths[month],
      formatHeader: (month, year) => `${birthDateMonths[month]} ${year}`,
      formatWeekdayName: day => ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][day],
      labelWeekday: day => ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][day],
      firstDayOfWeek: () => 1,
      labelPrevious: () => 'Предыдущий месяц',
      labelNext: () => 'Следующий месяц',
    }),
    provideIcons({
      lucideCheck,
      lucideCopy,
      lucideLoaderCircle,
      lucidePlus,
      lucideRefreshCw,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite.html',
  styleUrl: './invite.css',
})
export class Invite {
  private readonly destroyRef = inject(DestroyRef);
  private readonly clipboard = inject(Clipboard);
  private createRequestGeneration = 0;
  private previousCompanyId: number | null | undefined;
  private birthDateParseFailed = false;
  private readonly invitationApi =
    inject(InvitationApiService);

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly permissions =
    inject(PermissionService);

  private readonly reloadVersion = signal(0);


  readonly canManageInvitations =
    this.permissions.canSignal(
      PermissionCode.MembersManage,
      PermissionScope.Company,
    );

  readonly scope = signal<InvitationScope>('mine');

  readonly invitations = signal<CompanyInvitation[]>([]);

  readonly state = signal<InvitationListState>('idle');

  readonly invitationPolicy =
    signal<InvitationPolicy | null>(null);

  readonly policyLoading = signal(false);
  readonly policyError = signal(false);
  readonly createExpiresHours = signal<number | null>(null);
  readonly createFirstName = signal('');
  readonly createLastName = signal('');
  readonly createMiddleName = signal('');
  readonly createEmail = signal('');
  readonly createPhoneNumber = signal('');
  readonly createDateOfBirth = signal('');
  readonly birthDateSelection = signal<Date | null>(null);
  readonly birthDateError = signal<string | null>(null);
  readonly birthDateInputVersion = signal(0);
  readonly maxBirthDate = new Date();
  readonly defaultBirthDateFocus = (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date;
  })();
  readonly formatBirthDate = formatBirthDate;
  readonly parseBirthDate = (value: string): Date | null => {
    const date = parseBirthDate(value);
    this.birthDateParseFailed = date === null && value.trim() !== '';
    if (this.birthDateParseFailed) this.birthDateError.set('Укажите дату рождения в формате дд.ММ.гггг');
    return date;
  };
  readonly createSaving = signal(false);
  readonly createError = signal<string | null>(null);
  readonly createdLink = signal<string | null>(null);
  readonly linkCopied = signal(false);
  readonly linkCopying = signal(false);
  readonly linkCopyError = signal<string | null>(null);
  readonly revokingId = signal<number | null>(null);
  readonly revokeError = signal<string | null>(null);


  constructor() {
    this.loadInvitationPolicy();

    effect(onCleanup => {
      this.reloadVersion();

      const companyId =
        this.companyContext.activeCompanyId();

      const scope = this.scope();

      if (companyId !== this.previousCompanyId) {
        this.previousCompanyId = companyId;
        untracked(() => this.resetCreate());
      }

      if (
        companyId === null
        || !this.canManageInvitations()
      ) {
        untracked(() => this.resetCreate());
        this.invitations.set([]);
        this.state.set('idle');
        return;
      }

      this.state.set('loading');
      this.revokeError.set(null);

      const subscription =
        this.invitationApi
          .list(companyId, scope)
          .subscribe({
            next: invitations => {
              this.invitations.set(invitations);
              this.state.set('ready');
            },
            error: () => {
              this.invitations.set([]);
              this.state.set('error');
            },
          });

      onCleanup(() => subscription.unsubscribe());
    });
  }


  selectScope(scope: InvitationScope): void {
    this.scope.set(scope);
  }


  retry(): void {
    this.reloadVersion.update(
      version => version + 1,
    );
  }


  resetCreate(): void {
    this.createRequestGeneration += 1;
    this.createFirstName.set('');
    this.createLastName.set('');
    this.createMiddleName.set('');
    this.createEmail.set('');
    this.createPhoneNumber.set('');
    this.createDateOfBirth.set('');
    this.birthDateSelection.set(null);
    this.birthDateError.set(null);
    this.birthDateParseFailed = false;
    // Spartan intentionally retains invalid/uncommitted text independently of
    // ngModel. Recreate the input on reset so no previous company's draft leaks.
    this.birthDateInputVersion.update(version => version + 1);
    this.createExpiresHours.set(
      this.invitationPolicy()
        ?.default_expire_hours
      ?? null,
    );
    this.createSaving.set(false);
    this.createError.set(null);
    this.createdLink.set(null);
    this.linkCopied.set(false);
    this.linkCopying.set(false);
    this.linkCopyError.set(null);
  }


  createInvitation(): void {
    const companyId =
      this.companyContext.activeCompanyId();

    const policy = this.invitationPolicy();

    const expiresInHours = this.createExpiresHours();

    if (
      companyId === null
      || policy === null
      || expiresInHours === null
      || this.createSaving()
      || this.createdLink() !== null
      || !this.canManageInvitations()
    ) {
      return;
    }

    if (
      !Number.isInteger(expiresInHours)
      || expiresInHours < 1
      || expiresInHours > policy.max_expire_hours
    ) {
      this.createError.set(
        (
          'Укажите срок от 1 до '
          + `${policy.max_expire_hours} часов`
        ),
      );
      return;
    }

    if (this.birthDateError()) {
      this.createError.set(this.birthDateError());
      return;
    }
    const employee = normalizeEmployeeInput({
      firstName: this.createFirstName(), lastName: this.createLastName(), middleName: this.createMiddleName(),
      email: this.createEmail(),
      phoneNumber: this.createPhoneNumber(), dateOfBirth: this.createDateOfBirth(),
    });
    if (employee.error) {
      this.createError.set(employee.error);
      return;
    }
    const generation = ++this.createRequestGeneration;
    this.createSaving.set(true);
    this.createError.set(null);

    this.invitationApi
      .create(
        companyId,
        { expires_in_hours: expiresInHours, ...employee.data },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: invitation => {
          if (generation !== this.createRequestGeneration || companyId !== this.companyContext.activeCompanyId()
            || !this.canManageInvitations()) return;
          this.createSaving.set(false);
          this.createdLink.set(
            `${window.location.origin}/invite#${invitation.token}`,
          );
          this.linkCopied.set(false);
          this.retry();
        },
        error: error => {
          if (generation !== this.createRequestGeneration || companyId !== this.companyContext.activeCompanyId()
            || !this.canManageInvitations()) return;
          this.createSaving.set(false);
          this.createError.set(
            this.getCreateError(error),
          );
        },
      });
  }


  readBirthDateInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    const date = parseBirthDate(value);
    this.createDateOfBirth.set(date ? birthDateToIso(date) : '');
    this.birthDateError.set(value && !date ? 'Укажите дату рождения в формате дд.ММ.гггг' : null);
  }


  selectBirthDate(date: Date | null): void {
    this.birthDateSelection.set(date);
    this.createDateOfBirth.set(date ? birthDateToIso(date) : '');
    // Spartan keeps invalid typed text when committing null. It must not be
    // mistaken for an intentionally empty optional birthday.
    if (date || !this.birthDateParseFailed) this.birthDateError.set(null);
    this.birthDateParseFailed = false;
  }


  loadInvitationPolicy(): void {
    if (this.policyLoading()) {
      return;
    }

    this.policyLoading.set(true);
    this.policyError.set(false);

    this.invitationApi
      .getPolicy()
      .subscribe({
        next: policy => {
          this.invitationPolicy.set(policy);
          this.createExpiresHours.set(
            policy.default_expire_hours,
          );
          this.policyLoading.set(false);
        },
        error: () => {
          this.invitationPolicy.set(null);
          this.createExpiresHours.set(null);
          this.policyLoading.set(false);
          this.policyError.set(true);
        },
      });
  }


  async copyCreatedLink(input?: HTMLInputElement): Promise<void> {
    const link = this.createdLink();

    if (link === null || this.linkCopying()) {
      return;
    }

    const generation = this.createRequestGeneration;
    const isCurrent = () => !this.destroyRef.destroyed
      && generation === this.createRequestGeneration && link === this.createdLink();
    this.linkCopied.set(false);
    this.linkCopyError.set(null);
    this.linkCopying.set(true);

    try {
      let copied = false;
      try {
        // Async Clipboard is unavailable on HTTP LAN origins and may also be
        // denied on HTTPS. CDK's selection-based copy supports the former.
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
          copied = true;
        }
      } catch {
        // Try the synchronous fallback without logging the secret link.
      }
      if (!isCurrent()) return;
      if (!copied) copied = this.clipboard.copy(link);
      this.linkCopied.set(copied);
      if (!copied) {
        if (input?.isConnected && input.value === link) {
          input.focus();
          input.select();
        }
        this.linkCopyError.set('Браузер запретил автоматическое копирование. Скопируйте ссылку из поля вручную: Ctrl+C или через меню копирования.');
      }
    } finally {
      if (isCurrent()) this.linkCopying.set(false);
    }
  }


  revokeInvitation(
    invitation: CompanyInvitation,
  ): void {
    const companyId =
      this.companyContext.activeCompanyId();

    if (
      companyId === null
      || invitation.status !== 'pending'
      || this.revokingId() !== null
      || !this.canManageInvitations()
    ) {
      return;
    }

    this.revokingId.set(invitation.id);
    this.revokeError.set(null);

    this.invitationApi
      .revoke(companyId, invitation.id)
      .subscribe({
        next: () => {
          this.revokingId.set(null);
          this.retry();
        },
        error: () => {
          this.revokingId.set(null);
          this.revokeError.set(
            'Не удалось отозвать приглашение',
          );
        },
      });
  }


  private getCreateError(error: unknown): string {
    if (
      error instanceof HttpErrorResponse
      && error.status === 422
    ) {
      const fields: Record<string, string> = {
        first_name: 'Проверьте имя сотрудника', last_name: 'Проверьте фамилию сотрудника',
        middle_name: 'Проверьте отчество сотрудника', email: 'Укажите корректный email',
        phone_number: 'Укажите корректный номер телефона', date_of_birth: 'Укажите корректную дату рождения',
      };
      if (Array.isArray(error.error?.detail)) {
        for (const issue of error.error.detail) {
          const field = issue.loc?.at(-1);
          if (fields[field]) return fields[field];
        }
      }
      return 'Проверьте данные сотрудника и срок действия приглашения';
    }

    if (
      error instanceof HttpErrorResponse
      && error.status === 403
    ) {
      return 'Недостаточно прав для создания приглашения';
    }

    return 'Не удалось создать приглашение';
  }
}
