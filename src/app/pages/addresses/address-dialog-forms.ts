import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

import type {
    AddressType,
    Entrance,
} from '../../core/addresses/address.models';


@Component({
    selector: 'app-address-object-dialog-form',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        HlmAlertImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
        HlmSelectImports,
        HlmSpinnerImports,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './address-object-dialog-form.html',
})
export class AddressObjectDialogForm {
    readonly editing = input.required<boolean>();
    readonly parentName = input<string | null>(null);
    readonly types = input.required<AddressType[]>();
    readonly typeId = input.required<number | null>();
    readonly name = input.required<string>();
    readonly saving = input.required<boolean>();
    readonly error = input.required<string | null>();

    readonly typeToString = (typeId: number): string =>
        this.types().find(type => type.id === typeId)?.name ?? '';

    readonly typeIdChange = output<number>();
    readonly nameChange = output<string>();
    readonly saveRequested = output<void>();

    selectType(typeId: number | null | undefined): void {
        if (typeId !== null && typeId !== undefined) {
            this.typeIdChange.emit(typeId);
        }
    }
}


@Component({
    selector: 'app-building-dialog-form',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './building-dialog-form.html',
})
export class BuildingDialogForm {
    readonly editing = input.required<boolean>();
    readonly addressObjectName = input.required<string>();
    readonly number = input.required<string>();
    readonly corpus = input.required<string>();
    readonly structure = input.required<string>();
    readonly latitude = input.required<string>();
    readonly longitude = input.required<string>();
    readonly saving = input.required<boolean>();
    readonly error = input.required<string | null>();

    readonly numberChange = output<string>();
    readonly corpusChange = output<string>();
    readonly structureChange = output<string>();
    readonly latitudeChange = output<string>();
    readonly longitudeChange = output<string>();
    readonly saveRequested = output<void>();
}


@Component({
    selector: 'app-entrance-dialog-form',
    imports: [
        FormsModule,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <hlm-dialog-header>
            <h3 hlmDialogTitle>{{ editing() ? 'Изменение подъезда' : 'Новый подъезд' }}</h3>
        </hlm-dialog-header>

        <hlm-field>
            <label hlmFieldLabel for="entrance-number">Номер</label>
            <input
                hlmInput
                id="entrance-number"
                maxlength="20"
                data-testid="entrance-number"
                [ngModel]="number()"
                (ngModelChange)="numberChange.emit($event)" />
        </hlm-field>

        @if (error(); as message) {
        <p class="text-sm text-destructive" data-testid="entrance-error">{{ message }}</p>
        }

        <hlm-dialog-footer>
            <button
                hlmBtn
                variant="outline"
                type="button"
                hlmDialogClose
                data-testid="entrance-cancel"
                [disabled]="saving()">
                Отмена
            </button>
            <button
                hlmBtn
                type="button"
                data-testid="entrance-submit"
                [disabled]="saving()"
                (click)="saveRequested.emit()">
                Сохранить
            </button>
        </hlm-dialog-footer>
    `,
})
export class EntranceDialogForm {
    readonly editing = input.required<boolean>();
    readonly number = input.required<string>();
    readonly saving = input.required<boolean>();
    readonly error = input.required<string | null>();

    readonly numberChange = output<string>();
    readonly saveRequested = output<void>();
}


@Component({
    selector: 'app-location-dialog-form',
    imports: [
        FormsModule,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <hlm-dialog-header>
            <h3 hlmDialogTitle>{{ editing() ? 'Изменение помещения' : 'Новое помещение' }}</h3>
        </hlm-dialog-header>

        <hlm-field-group>
            <hlm-field>
                <label hlmFieldLabel for="location-entrance">Подъезд</label>
                <select
                    id="location-entrance"
                    class="h-9 rounded-md border bg-background px-3 text-sm"
                    data-testid="location-entrance"
                    [ngModel]="entranceId()"
                    (ngModelChange)="entranceIdChange.emit($event === null ? null : +$event)">
                    <option [ngValue]="null">Без подъезда</option>
                    @for (entrance of entrances(); track entrance.id) {
                    <option [ngValue]="entrance.id">Подъезд {{ entrance.number }}</option>
                    }
                </select>
            </hlm-field>
            <div class="grid gap-4 sm:grid-cols-[8rem_1fr]">
                <hlm-field>
                    <label hlmFieldLabel for="location-floor">Этаж</label>
                    <input
                        hlmInput
                        id="location-floor"
                        maxlength="20"
                        data-testid="location-floor"
                        [ngModel]="floor()"
                        (ngModelChange)="floorChange.emit($event)" />
                </hlm-field>
                <hlm-field>
                    <label hlmFieldLabel for="location-name">Название</label>
                    <input
                        hlmInput
                        id="location-name"
                        maxlength="255"
                        data-testid="location-name"
                        [ngModel]="name()"
                        (ngModelChange)="nameChange.emit($event)" />
                </hlm-field>
            </div>
            <hlm-field>
                <label hlmFieldLabel for="location-description">Описание</label>
                <textarea
                    id="location-description"
                    class="min-h-24 rounded-md border bg-background p-3 text-sm"
                    maxlength="5000"
                    [ngModel]="description()"
                    (ngModelChange)="descriptionChange.emit($event)"></textarea>
            </hlm-field>
        </hlm-field-group>

        @if (error(); as message) {
        <p class="text-sm text-destructive" data-testid="location-error">{{ message }}</p>
        }

        <hlm-dialog-footer>
            <button
                hlmBtn
                variant="outline"
                type="button"
                hlmDialogClose
                data-testid="location-cancel"
                [disabled]="saving()">
                Отмена
            </button>
            <button
                hlmBtn
                type="button"
                data-testid="location-submit"
                [disabled]="saving()"
                (click)="saveRequested.emit()">
                Сохранить
            </button>
        </hlm-dialog-footer>
    `,
})
export class LocationDialogForm {
    readonly editing = input.required<boolean>();
    readonly entrances = input.required<Entrance[]>();
    readonly entranceId = input.required<number | null>();
    readonly floor = input.required<string>();
    readonly name = input.required<string>();
    readonly description = input.required<string>();
    readonly saving = input.required<boolean>();
    readonly error = input.required<string | null>();

    readonly entranceIdChange = output<number | null>();
    readonly floorChange = output<string>();
    readonly nameChange = output<string>();
    readonly descriptionChange = output<string>();
    readonly saveRequested = output<void>();
}
