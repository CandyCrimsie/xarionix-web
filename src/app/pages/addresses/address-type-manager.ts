import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
    signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { toast } from '@spartan-ng/brain/sonner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideArrowLeft,
    lucideInfo,
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


type ManagerMode = 'list' | 'create' | 'edit' | 'info';


interface AddressTypeGroup {
    category: AddressTypeCategory;
    label: string;
    types: AddressType[];
}


const CATEGORY_GROUP_LABELS: Readonly<Record<AddressTypeCategory, string>> = {
    country: 'Страны',
    region: 'Регионы',
    locality: 'Населённые пункты',
    area: 'Районы и округа',
    territory: 'Территории',
    thoroughfare: 'Улицы и проезды',
};


const CATEGORY_SORT_BASE: Readonly<Record<AddressTypeCategory, number>> = {
    country: 10,
    region: 20,
    locality: 30,
    area: 60,
    territory: 70,
    thoroughfare: 80,
};


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
    providers: [provideIcons({
        lucideArrowLeft,
        lucideInfo,
        lucidePencil,
        lucidePlus,
        lucideTrash2,
    })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './address-type-manager.html',
})
export class AddressTypeManager {
    private readonly addressApi: AddressApiService;

    readonly types = input.required<AddressType[]>();
    readonly typeCreated = output<AddressType>();
    readonly typeUpdated = output<AddressType>();
    readonly typeDeleted = output<number>();

    readonly mode = signal<ManagerMode>('list');
    readonly editing = signal<AddressType | null>(null);
    readonly name = signal('');
    readonly shortName = signal('');
    readonly category = signal<AddressTypeCategory>('territory');
    readonly saving = signal(false);
    readonly deletingId = signal<number | null>(null);
    readonly error = signal<string | null>(null);

    readonly categories = ADDRESS_TYPE_CATEGORIES;
    readonly categoryToString = (category: AddressTypeCategory): string => (
        ADDRESS_TYPE_CATEGORY_LABELS[category]
    );
    readonly groups = computed<AddressTypeGroup[]>(() => (
        ADDRESS_TYPE_CATEGORIES
            .map(category => ({
                category,
                label: CATEGORY_GROUP_LABELS[category],
                types: this.types()
                    .filter(item => item.category === category)
                    .sort((left, right) => (
                        left.sort_order - right.sort_order
                        || left.name.localeCompare(right.name, 'ru')
                        || left.id - right.id
                    )),
            }))
            .filter(group => group.types.length > 0)
    ));
    readonly preview = computed(() => {
        const prefix = this.shortName().trim().replace(/\s+/g, ' ');
        return prefix ? `${prefix} Берёзка` : 'Берёзка';
    });


    constructor(addressApi: AddressApiService) {
        this.addressApi = addressApi;
    }


    categoryLabel(category: AddressTypeCategory): string {
        return ADDRESS_TYPE_CATEGORY_LABELS[category];
    }


    startCreate(): void {
        this.editing.set(null);
        this.mode.set('create');
        this.name.set('');
        this.shortName.set('');
        this.category.set('territory');
        this.error.set(null);
    }


    startEdit(addressType: AddressType): void {
        if (addressType.is_system) {
            return;
        }
        this.editing.set(addressType);
        this.mode.set('edit');
        this.name.set(addressType.name);
        this.shortName.set(addressType.short_name ?? '');
        this.category.set(addressType.category);
        this.error.set(null);
    }


    showInfo(): void {
        this.error.set(null);
        this.mode.set('info');
    }


    showList(): void {
        if (this.saving()) {
            return;
        }
        this.mode.set('list');
        this.editing.set(null);
        this.error.set(null);
    }


    selectCategory(category: AddressTypeCategory | null | undefined): void {
        if (category && this.mode() === 'create') {
            this.category.set(category);
        }
    }


    updateName(event: Event): void {
        this.name.set((event.target as HTMLInputElement).value);
    }


    updateShortName(event: Event): void {
        this.shortName.set((event.target as HTMLInputElement).value);
    }


    save(): void {
        if (this.saving()) {
            return;
        }
        const name = this.name().trim().replace(/\s+/g, ' ');
        const shortName = this.shortName().trim().replace(/\s+/g, ' ');
        if (!name) {
            this.error.set('Укажите название типа');
            return;
        }

        this.saving.set(true);
        this.error.set(null);
        const editing = this.editing();
        const request = editing
            ? this.addressApi.updateType(editing.id, {
                name,
                short_name: shortName || null,
            })
            : this.addressApi.createType({
                name,
                short_name: shortName || null,
                category: this.category(),
                sort_order: this.nextSortOrder(this.category()),
            });
        request.subscribe({
            next: saved => {
                this.saving.set(false);
                this.mode.set('list');
                this.editing.set(null);
                if (editing) {
                    this.typeUpdated.emit(saved);
                    toast.success('Тип адресного объекта изменён', {
                        description: saved.name,
                    });
                } else {
                    this.typeCreated.emit(saved);
                    toast.success('Тип адресного объекта создан', {
                        description: saved.name,
                    });
                }
            },
            error: error => {
                this.saving.set(false);
                const message = this.apiError(error, 'Не удалось сохранить тип');
                this.error.set(message);
                toast.error('Тип адресного объекта не сохранён', {
                    description: message,
                });
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
                toast.success('Тип адресного объекта удалён', {
                    description: addressType.name,
                });
            },
            error: error => {
                this.deletingId.set(null);
                const message = this.apiError(error, 'Не удалось удалить тип');
                this.error.set(message);
                toast.error('Тип адресного объекта не удалён', {
                    description: message,
                });
            },
        });
    }


    private nextSortOrder(category: AddressTypeCategory): number {
        const existing = this.types()
            .filter(item => item.category === category)
            .map(item => item.sort_order);
        return existing.length > 0
            ? Math.max(...existing) + 1
            : CATEGORY_SORT_BASE[category];
    }


    private apiError(error: unknown, fallback: string): string {
        if (error instanceof HttpErrorResponse && error.status === 409) {
            const detail = error.error?.detail;
            if (detail === 'Address record has dependent data') {
                return 'Тип используется адресными объектами и не может быть удалён';
            }
            if (detail === 'System address type is protected') {
                return 'Системный тип нельзя изменить или удалить';
            }
            return 'Тип с таким кодом уже существует';
        }
        return fallback;
    }
}
