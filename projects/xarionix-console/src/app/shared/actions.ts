import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { Observable, Subscription } from 'rxjs';
import { toast } from '@spartan-ng/brain/sonner';
import { UI } from './ui';
import { ErrorBox } from './feedback';
import { coreError, CoreError } from '../core/errors';
import { RequestScope } from '../core/scope';
import { RolePicker } from './role-picker';

export type FormValues = Record<string, string | number | boolean | string[]>;
export interface FormField {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'number'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'role'
    | 'roles'
    | 'password';
  required?: boolean;
  max?: number;
  min?: number;
  pattern?: string;
  help?: string;
  options?: { value: string; label: string }[];
  initial?: string | number | boolean | string[];
}
export interface ActionForm {
  title: string;
  description: string;
  fields?: FormField[];
  confirm?: boolean;
  destructive?: boolean;
  submitLabel?: string;
  execute: (values: FormValues) => Observable<unknown>;
  success?: string;
  done?: (result: unknown) => void;
}
@Injectable({ providedIn: 'root' })
export class Actions {
  readonly current = signal<ActionForm | null>(null);
  open(form: ActionForm): void {
    this.current.set(form);
  }
}
@Component({
  selector: 'console-actions',
  imports: [UI, HlmDialogImports, HlmAlertDialogImports, ErrorBox, RolePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (actions.current(); as action) {
      @if (action.confirm) {
        <hlm-alert-dialog
          [state]="'open'"
          [disableClose]="saving()"
          (stateChanged)="$event === 'closed' && close()"
        >
          <hlm-alert-dialog-content *hlmAlertDialogPortal>
            <hlm-alert-dialog-header
              ><h2 hlmAlertDialogTitle>{{ action.title }}</h2>
              <p hlmAlertDialogDescription>{{ action.description }}</p></hlm-alert-dialog-header
            >
            <console-error [error]="error()" />
            <hlm-alert-dialog-footer
              ><button hlmBtn variant="outline" [disabled]="saving()" (click)="close()">
                Отмена</button
              ><button
                hlmBtn
                [variant]="action.destructive ? 'destructive' : 'default'"
                [disabled]="saving() || !!error()?.mfa"
                (click)="submit()"
              >
                {{ saving() ? 'Сохранение…' : action.submitLabel || 'Подтвердить' }}
              </button></hlm-alert-dialog-footer
            >
          </hlm-alert-dialog-content>
        </hlm-alert-dialog>
      } @else {
        <hlm-dialog
          [state]="'open'"
          [disableClose]="saving()"
          (stateChanged)="$event === 'closed' && close()"
        >
          <hlm-dialog-content *hlmDialogPortal [showCloseButton]="!saving()" class="sm:max-w-lg">
            <hlm-dialog-header
              ><h2 hlmDialogTitle>{{ action.title }}</h2>
              <p hlmDialogDescription>{{ action.description }}</p></hlm-dialog-header
            >
            <form (ngSubmit)="submit()" class="contents">
              <hlm-field-group class="max-h-[60dvh] overflow-y-auto pr-1">
                @for (field of action.fields; track field.key) {
                  <hlm-field>
                    <label hlmFieldLabel [for]="'console-field-' + field.key">{{
                      field.label
                    }}</label>
                    @switch (field.type) {
                      @case ('role') {
                        <console-role-picker
                          [selected]="roleValues(field.key)"
                          [multiple]="false"
                          [disabled]="saving()"
                          (selectedChange)="values[field.key] = $event"
                        />
                      }
                      @case ('roles') {
                        <console-role-picker
                          [selected]="roleValues(field.key)"
                          [disabled]="saving()"
                          (selectedChange)="values[field.key] = $event"
                        />
                      }
                      @case ('select') {
                        <hlm-select
                          [value]="values[field.key]"
                          (valueChange)="set(field.key, $event)"
                          [disabled]="saving()"
                        >
                          <hlm-select-trigger
                            class="w-full"
                            [buttonId]="'console-field-' + field.key"
                            ><hlm-select-value placeholder="Выберите значение"
                          /></hlm-select-trigger>
                          <hlm-select-content *hlmSelectPortal>
                            @for (option of field.options; track option.value) {
                              <hlm-select-item [value]="option.value">{{
                                option.label
                              }}</hlm-select-item>
                            }
                          </hlm-select-content>
                        </hlm-select>
                      }
                      @case ('checkbox') {
                        <hlm-checkbox
                          [inputId]="'console-field-' + field.key"
                          [checked]="values[field.key] === true"
                          (checkedChange)="set(field.key, $event)"
                          [disabled]="saving()"
                          [aria-label]="field.label"
                        />
                      }
                      @case ('textarea') {
                        <textarea
                          hlmTextarea
                          [id]="'console-field-' + field.key"
                          [name]="field.key"
                          [(ngModel)]="values[field.key]"
                          [disabled]="saving()"
                          [maxlength]="field.max || 1000"
                          rows="3"
                        ></textarea>
                      }
                      @default {
                        <input
                          hlmInput
                          [id]="'console-field-' + field.key"
                          [name]="field.key"
                          [type]="field.type || 'text'"
                          [(ngModel)]="values[field.key]"
                          [required]="!!field.required"
                          [disabled]="saving()"
                          [min]="field.min ?? 0"
                          [max]="field.max ?? 1000000"
                          [maxlength]="field.max ?? 512"
                          [pattern]="field.pattern || '.*'"
                        />
                      }
                    }
                    @if (field.help) {
                      <p hlmFieldDescription>{{ field.help }}</p>
                    }
                    @if (fieldErrors()[field.key]) {
                      <p class="text-xs text-destructive" role="alert">
                        {{ fieldErrors()[field.key] }}
                      </p>
                    }
                  </hlm-field>
                }
              </hlm-field-group>
              <console-error [error]="error()" />
              <hlm-dialog-footer
                ><button
                  hlmBtn
                  variant="outline"
                  type="button"
                  [disabled]="saving()"
                  (click)="close()"
                >
                  Отмена</button
                ><button hlmBtn type="submit" [disabled]="saving() || !!error()?.mfa">
                  {{ saving() ? 'Сохранение…' : action.submitLabel || 'Сохранить' }}
                </button></hlm-dialog-footer
              >
            </form>
          </hlm-dialog-content>
        </hlm-dialog>
      }
    }
  `,
})
export class ActionDialogs {
  readonly actions = inject(Actions);
  private readonly scope = inject(RequestScope);
  readonly saving = signal(false);
  readonly error = signal<CoreError | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});
  values: FormValues = {};
  private request?: Subscription;
  constructor() {
    effect(() => {
      const form = this.actions.current();
      this.values = Object.fromEntries(
        (form?.fields ?? []).map((f) => [f.key, f.initial ?? (f.type === 'checkbox' ? false : '')]),
      );
      this.error.set(null);
      this.fieldErrors.set({});
      this.saving.set(false);
    });
    effect(() => {
      this.scope.epoch();
      this.request?.unsubscribe();
      this.actions.current.set(null);
      this.saving.set(false);
    });
  }
  set(key: string, value: unknown): void {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      this.values[key] = value;
  }
  roleValues(key: string): string[] {
    const value = this.values[key];
    return Array.isArray(value) ? value : [];
  }
  close(): void {
    if (!this.saving()) this.actions.current.set(null);
  }
  submit(): void {
    const form = this.actions.current();
    if (!form || this.saving()) return;
    const errors: Record<string, string> = {};
    for (const field of form.fields ?? []) {
      const value = this.values[field.key];
      if (
        field.required &&
        (field.type === 'checkbox' ? value !== true : !String(value ?? '').trim())
      )
        errors[field.key] = 'Обязательное поле';
      if (
        field.type === 'number' &&
        (!Number.isFinite(Number(value)) ||
          Number(value) < (field.min ?? 0) ||
          Number(value) > (field.max ?? 1000000))
      )
        errors[field.key] = 'Проверьте числовое значение';
      if (field.pattern && !new RegExp(`^(?:${field.pattern})$`).test(String(value)))
        errors[field.key] = 'Неверный формат';
    }
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.request = form.execute(this.values).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.actions.current.set(null);
          toast.success(form.success ?? 'Изменения сохранены');
          form.done?.(result);
        },
        error: (error) => {
          const e = coreError(error);
          this.error.set(e);
          this.fieldErrors.set(e.fields);
          this.saving.set(false);
        },
        complete: () => this.saving.set(false),
      });
    } catch (error) {
      this.error.set(coreError(error));
      this.saving.set(false);
    }
  }
}
