import { afterRenderEffect, ChangeDetectionStrategy, Component, ElementRef, input, model, output, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowLeft, lucideInfo, lucideLoaderCircle, lucideMove, lucidePencil, lucideRoute, lucideTrash2 } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import type { InstallationBoundary } from '../../map-installation-boundaries';
import { INSTALLATION_STYLES, installationLabel } from '../../map-line-styles';
import type { InstallationMethod, MapBoundaryEdit } from '../../models/map.models';

/** Presentation only: the parent retains the frozen route, concurrency token and request. */
@Component({
    selector: 'app-map-installation-boundary-menu',
    imports: [NgIcon, HlmButtonImports, HlmFieldImports, HlmCollapsibleImports, HlmRadioGroupImports, HlmSelectImports, HlmSeparatorImports, HlmTooltipImports],
    providers: [provideIcons({ lucideArrowDown, lucideArrowLeft, lucideInfo, lucideLoaderCircle, lucideMove, lucidePencil, lucideRoute, lucideTrash2 })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'block min-w-0' },
    templateUrl: './map-installation-boundary-menu.html',
})
export class MapInstallationBoundaryMenu {
    readonly boundary = input.required<InstallationBoundary>();
    readonly saving = input(false);
    readonly error = input<string | null>(null);
    readonly method = model<InstallationMethod>('unknown');
    readonly saveRequested = output<MapBoundaryEdit>();
    readonly moveRequested = output<void>();
    readonly cancelRequested = output<void>();
    readonly action = signal<'menu' | 'set' | 'remove'>('menu');
    readonly infoExpanded = signal(false);
    readonly keep = signal<'previous' | 'next' | null>(null);
    readonly styles = INSTALLATION_STYLES;
    readonly label = installationLabel;
    private readonly firstAction = viewChild<ElementRef<HTMLButtonElement>>('firstAction');
    private readonly backAction = viewChild<ElementRef<HTMLButtonElement>>('backAction');

    constructor() {
        afterRenderEffect(() => {
            // A state switch removes its clicked button. Keep keyboard focus inside
            // the Spartan overlay instead of leaving it on the document body.
            const target = this.action() === 'menu' ? this.firstAction() : this.backAction();
            target?.nativeElement.focus({ preventScroll: true });
        });
    }

    selectKeep(value: unknown): void {
        if (value === 'previous' || value === 'next') this.keep.set(value);
    }

    confirmRemove(): void {
        const keep = this.keep();
        if (keep && !this.saving()) this.saveRequested.emit({ operation: 'remove', keep });
    }
}
