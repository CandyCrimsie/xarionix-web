import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { EmployeeDetails as Details } from '../../core/profile/profile.models';

@Component({
    selector: 'app-employee-details',
    imports: [DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <dl class="grid min-w-0 gap-5 sm:grid-cols-2">
            <div class="min-w-0">
                <dt class="text-sm text-muted-foreground">Фамилия</dt>
                <dd class="mt-1 break-words font-medium" data-testid="employee-last-name">{{ details().last_name || 'Не указана' }}</dd>
            </div>
            <div class="min-w-0">
                <dt class="text-sm text-muted-foreground">Имя</dt>
                <dd class="mt-1 break-words font-medium" data-testid="employee-first-name">{{ details().first_name || 'Не указано' }}</dd>
            </div>
            <div class="min-w-0">
                <dt class="text-sm text-muted-foreground">Отчество</dt>
                <dd class="mt-1 break-words" data-testid="employee-middle-name">{{ details().middle_name || 'Не указано' }}</dd>
            </div>
            @if (details().full_name && !details().first_name && !details().last_name && !details().middle_name) {
            <div class="min-w-0 sm:col-span-2">
                <dt class="text-sm text-muted-foreground">ФИО (старые данные)</dt>
                <dd class="mt-1 break-words" data-testid="employee-legacy-name">{{ details().full_name }}</dd>
            </div>
            }
            <div class="min-w-0">
                <dt class="text-sm text-muted-foreground">Email</dt>
                <dd class="mt-1 break-words" data-testid="employee-email">{{ details().email || 'Не указан' }}</dd>
            </div>
            <div class="min-w-0">
                <dt class="text-sm text-muted-foreground">Номер телефона</dt>
                <dd class="mt-1 break-words" data-testid="employee-phone">{{ details().phone_number || 'Не указан' }}</dd>
            </div>
            <div class="min-w-0">
                <dt class="text-sm text-muted-foreground">Дата рождения</dt>
                <dd class="mt-1" data-testid="employee-birth-date">{{ birthDate() ? (birthDate() | date:'dd.MM.yyyy':'UTC') : 'Не указана' }}</dd>
            </div>
        </dl>
    `,
})
export class EmployeeDetails {
    readonly details = input.required<Details>();
    // A birthday is a calendar date, not local midnight converted to UTC.
    readonly birthDate = computed(() => this.details().date_of_birth
        ? `${this.details().date_of_birth}T00:00:00Z`
        : null);
}
