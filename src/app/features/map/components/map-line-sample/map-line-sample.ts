import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { InstallationMethod, MapConnection } from '../../models/map.models';
import {
  CONNECTION_COLORS,
  CONNECTION_STATUSES,
  INSTALLATION_STYLES,
  svgDash,
} from '../../map-line-styles';

@Component({
  selector: 'app-map-line-sample',
  templateUrl: './map-line-sample.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex h-4 w-12 shrink-0 items-center', 'aria-hidden': 'true' },
})
export class MapLineSample {
  readonly medium = input<MapConnection['medium']>('fiber');
  readonly method = input<InstallationMethod>('unknown');
  readonly status = input<MapConnection['status']>('active');
  readonly color = computed(() => CONNECTION_COLORS[this.medium()]);
  readonly style = computed(() => {
    const method = INSTALLATION_STYLES.find((item) => item.value === this.method())!;
    const status = CONNECTION_STATUSES.find((item) => item.value === this.status())!;
    return { width: method.width, dash: svgDash(method), opacity: status.opacity };
  });
}
