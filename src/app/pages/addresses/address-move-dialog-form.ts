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
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';


export interface AddressMoveTarget {
    id: number | null;
    label: string;
    depth: number;
}


@Component({
    selector: 'app-address-move-dialog-form',
    host: { class: 'contents' },
    imports: [
        FormsModule,
        HlmAlertImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmSelectImports,
        HlmSpinnerImports,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './address-move-dialog-form.html',
})
export class AddressMoveDialogForm {
    readonly title = input.required<string>();
    readonly description = input.required<string>();
    readonly targets = input.required<AddressMoveTarget[]>();
    readonly targetId = input.required<number | null>();
    readonly saving = input.required<boolean>();
    readonly error = input.required<string | null>();

    readonly targetIdChange = output<number | null>();
    readonly saveRequested = output<void>();

    readonly targetToString = (key: string): string => {
        const id = key === 'root' ? null : Number(key);
        return this.targets().find(target => target.id === id)?.label ?? '';
    };


    selectedKey(): string {
        return this.targetId() === null ? 'root' : this.targetId()!.toString();
    }


    targetKey(target: AddressMoveTarget): string {
        return target.id === null ? 'root' : target.id.toString();
    }


    selectTarget(key: string | null | undefined): void {
        if (key === null || key === undefined) {
            return;
        }
        this.targetIdChange.emit(key === 'root' ? null : Number(key));
    }


    submit(): void {
        if (!this.saving()) {
            this.saveRequested.emit();
        }
    }
}
