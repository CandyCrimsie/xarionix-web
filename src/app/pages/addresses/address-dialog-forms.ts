import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert } from '@ng-icons/lucide';
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
import {
    normalizeCoordinateScalar,
    parseCoordinatePair,
    type CoordinatePair,
} from '../../core/addresses/coordinate-input';


@Component({
    selector: 'app-address-object-dialog-form',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        NgIcon,
        HlmAlertImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
        HlmSelectImports,
        HlmSpinnerImports,
    ],
    providers: [provideIcons({ lucideCircleAlert })],
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

    submit(): void {
        if (!this.saving()) {
            this.saveRequested.emit();
        }
    }
}


@Component({
    selector: 'app-building-dialog-form',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        NgIcon,
        HlmAlertImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],
    providers: [provideIcons({ lucideCircleAlert })],
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
    readonly coordinatePairChange = output<CoordinatePair>();
    readonly coordinateInputError = output<string>();
    readonly saveRequested = output<void>();

    normalizeScalar(value: string): string {
        return normalizeCoordinateScalar(value) ?? value;
    }

    handleCoordinatePaste(
        event: ClipboardEvent,
        field: 'latitude' | 'longitude',
    ): void {
        const pasted = event.clipboardData?.getData('text')?.trim() ?? '';
        if (!pasted) {
            return;
        }
        const pair = parseCoordinatePair(pasted);
        if (pair) {
            event.preventDefault();
            this.coordinatePairChange.emit(pair);
            return;
        }
        const scalar = normalizeCoordinateScalar(pasted);
        if (scalar !== null) {
            event.preventDefault();
            if (field === 'latitude') {
                this.latitudeChange.emit(scalar);
            } else {
                this.longitudeChange.emit(scalar);
            }
            return;
        }
        if (/[,;\s]/.test(pasted)) {
            event.preventDefault();
            this.coordinateInputError.emit(
                'Не удалось однозначно распознать координаты',
            );
        }
    }

    submit(): void {
        if (!this.saving()) {
            this.saveRequested.emit();
        }
    }
}


@Component({
    selector: 'app-entrance-dialog-form',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        NgIcon,
        HlmAlertImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],
    providers: [provideIcons({ lucideCircleAlert })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './entrance-dialog-form.html',
})
export class EntranceDialogForm {
    readonly editing = input.required<boolean>();
    readonly number = input.required<string>();
    readonly saving = input.required<boolean>();
    readonly error = input.required<string | null>();

    readonly numberChange = output<string>();
    readonly saveRequested = output<void>();

    submit(): void {
        if (!this.saving()) {
            this.saveRequested.emit();
        }
    }
}


@Component({
    selector: 'app-location-dialog-form',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        NgIcon,
        HlmAlertImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
    ],
    providers: [provideIcons({ lucideCircleAlert })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './location-dialog-form.html',
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

    submit(): void {
        if (!this.saving()) {
            this.saveRequested.emit();
        }
    }
}
