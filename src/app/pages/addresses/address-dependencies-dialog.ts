import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, Subscription, take } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert } from '@ng-icons/lucide';
import { HlmAlertDialog, HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';

export interface AddressDependencyGroup {
    type: 'map_connection' | 'address_object' | 'building' | 'entrance' | 'location' | 'equipment' | 'restricted' | 'integrity';
    count?: number;
    message?: string;
    has_more?: boolean;
    items?: { id: number; name: string; medium: 'fiber' | 'utp'; source_name: string; target_name: string }[];
}
export interface AddressDependencyConflict {
    code: 'object_has_dependencies';
    message: string;
    object: { kind: string; id: number };
    dependencies: AddressDependencyGroup[];
}

@Component({
    selector: 'app-address-dependencies-dialog',
    imports: [HlmAlertDialogImports, HlmButtonImports, NgIcon],
    providers: [provideIcons({ lucideCircleAlert })],
    templateUrl: './address-dependencies-dialog.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressDependenciesDialog {
    private readonly dialogs = inject(Dialog);
    private readonly destroyRef = inject(DestroyRef);
    private waiting?: Subscription;
    readonly dialog = viewChild.required<HlmAlertDialog>('dialog');
    readonly conflict = signal<AddressDependencyConflict | null>(null);
    readonly returnFocus = signal<HTMLElement | boolean>(true);
    readonly labels: Record<AddressDependencyGroup['type'], string> = {
        map_connection: 'Сетевые соединения', address_object: 'Дочерние адресные объекты',
        building: 'Дома', entrance: 'Подъезды', location: 'Помещения и места размещения', equipment: 'Оборудование',
        restricted: 'Другие связи', integrity: 'Ограничение целостности',
    };

    show(conflict: AddressDependencyConflict, focus: HTMLElement | null): void {
        this.waiting?.unsubscribe();
        this.conflict.set(conflict);
        this.returnFocus.set(focus?.isConnected ? focus : true);
        if (this.dialog().stateComputed() === 'open') return;
        // Wait for the confirmation's real overlay disposal/focus restoration,
        // not an arbitrary timer. There is never a pair of active alert dialogs.
        const closing = this.dialogs.openDialogs.map(ref => ref.closed.pipe(take(1)));
        if (closing.length) {
            this.waiting = forkJoin(closing).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.dialog().open());
        } else this.dialog().open();
    }

    clear(): void {
        this.waiting?.unsubscribe();
        this.dialog().close({});
        this.conflict.set(null);
    }
}
