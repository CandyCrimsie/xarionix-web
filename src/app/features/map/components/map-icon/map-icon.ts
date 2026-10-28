import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { mapMarkerIconSvg } from '../../map-marker.config';

/** Only repository-owned, allowlisted SVG; never accept SVG/HTML from users. */
@Component({
    selector: 'app-map-icon',
    templateUrl: './map-icon.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'inline-flex size-6 shrink-0 items-center justify-center', 'aria-hidden': 'true' },
})
export class MapIcon {
    readonly name = input.required<string | null>();
    private readonly sanitizer = inject(DomSanitizer);
    readonly svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(
        (mapMarkerIconSvg(this.name()) ?? '').replace('<svg ', '<svg class="block size-full shrink-0" '),
    ));
}
