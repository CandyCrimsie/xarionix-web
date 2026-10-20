import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucidePencil,
    lucidePlus,
    lucideTrash2,
} from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

import { AddressApiService } from '../../core/addresses/address-api.service';
import {
    ADDRESS_TYPE_CATEGORIES,
    ADDRESS_TYPE_CATEGORY_LABELS,
} from '../../core/addresses/address-hierarchy';
import type {
    AddressType,
    AddressTypeCategory,
} from '../../core/addresses/address.models';


@Component({
    selector: 'app-address-type-manager',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        NgIcon,
        HlmAlertImports,
        HlmAlertDialogImports,
        HlmBadgeImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
        HlmSelectImports,
        HlmSpinnerImports,
    ],
    providers: [provideIcons({ lucidePencil, lucidePlus, lucideTrash2 })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './address-type-manager.html',
})
export class AddressTypeManager {
    private readonly addressApi: AddressApiService;

    readonly types = input.required<AddressType[]>();
    readonly typeCreated = output<AddressType>();
    readonly typeUpdated = output<AddressType>();
    readonly typeDeleted = output<number>();

    readonly editing = signal<AddressType | null>(null);
    readonly formVisible = signal(false);
    readonly name = signal('');
    readonly shortName = signal('');
    readonly category = signal<AddressTypeCategory>('territory');
    readonly sortOrder = signal('75');
    readonly saving = signal(false);
    readonly deletingId = signal<number | null>(null);
    readonly error = signal<string | null>(null);

    readonly categories = ADDRESS_TYPE_CATEGORIES;
    readonly categoryToString = (category: AddressTypeCategory): string => (
        ADDRESS_TYPE_CATEGORY_LABELS[category]
    );


    constructor(addressApi: AddressApiService) {
        this.addressApi = addressApi;
    }


    categoryLabel(category: AddressTypeCategory): string {
        return ADDRESS_TYPE_CATEGORY_LABELS[category];
    }


    startCreate(): void {
        this.editing.set(null);
        this.formVisible.set(true);
        this.name.set('');
        this.shortName.set('');
        this.category.set('territory');
        this.sortOrder.set('75');
        this.error.set(null);
    }


    startEdit(addressType: AddressType): void {
        if (addressType.is_system) {
            return;
        }
        this.editing.set(addressType);
        this.formVisible.set(true);
        this.name.set(addressType.name);
        this.shortName.set(addressType.short_name ?? '');
        this.category.set(addressType.category);
        this.sortOrder.set(addressType.sort_order.toString());
        this.error.set(null);
    }


    cancelForm(): void {
        if (this.saving()) {
            return;
        }
        this.formVisible.set(false);
        this.editing.set(null);
        this.error.set(null);
    }


    selectCategory(category: AddressTypeCategory | null | undefined): void {
        if (category && !this.editing()) {
            this.category.set(category);
        }
    }


    updateName(event: Event): void {
        this.name.set((event.target as HTMLInputElement).value);
    }


    updateShortName(event: Event): void {
        this.shortName.set((event.target as HTMLInputElement).value);
    }


    updateSortOrder(event: Event): void {
        this.sortOrder.set((event.target as HTMLInputElement).value);
    }


    save(): void {
        if (this.saving()) {
            return;
        }
        const name = this.name().trim().replace(/\s+/g, ' ');
        const shortName = this.shortName().trim().replace(/\s+/g, ' ');
        const sortOrder = Number(this.sortOrder());
        if (!name) {
            this.error.set('Укажите название типа');
            return;
        }
        if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
            this.error.set('Порядок сортировки должен быть целым числом от 0 до 10000');
            return;
        }

        this.saving.set(true);
        this.error.set(null);
        const editing = this.editing();
        const request = editing
            ? this.addressApi.updateType(editing.id, {
                name,
                short_name: shortName || null,
                sort_order: sortOrder,
            })
            : this.addressApi.createType({
                name,
                short_name: shortName || null,
                category: this.category(),
                sort_order: sortOrder,
            });
        request.subscribe({
            next: saved => {
                this.saving.set(false);
                this.formVisible.set(false);
                this.editing.set(null);
                if (editing) {
                    this.typeUpdated.emit(saved);
                } else {
                    this.typeCreated.emit(saved);
                }
            },
            error: error => {
                this.saving.set(false);
                this.error.set(this.apiError(error, 'Не удалось сохранить тип'));
            },
        });
    }


    deleteType(addressType: AddressType): void {
        if (addressType.is_system || this.deletingId() !== null) {
            return;
        }
        this.deletingId.set(addressType.id);
        this.error.set(null);
        this.addressApi.deleteType(addressType.id).subscribe({
            next: () => {
                this.deletingId.set(null);
                this.typeDeleted.emit(addressType.id);
                if (this.editing()?.id === addressType.id) {
                    this.cancelForm();
                }
            },
            error: error => {
                this.deletingId.set(null);
                this.error.set(this.apiError(error, 'Не удалось удалить тип'));
            },
        });
    }


    private apiError(error: unknown, fallback: string): string {
        if (error instanceof HttpErrorResponse) {
            if (error.status === 409) {
                const detail = error.error?.detail;
                if (detail === 'Address record has dependent data') {
                    return 'Тип используется адресными объектами и не может быть удалён';
                }
                if (detail === 'System address type is protected') {
                    return 'Системный тип нельзя изменить или удалить';
                }
                return 'Тип с таким кодом уже существует';
            }
        }
        return fallback;
    }
}
