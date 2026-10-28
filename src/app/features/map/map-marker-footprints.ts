import type { Map as LibreMap } from 'maplibre-gl';
import type { MapMarkerAppearance } from './models/map.models';
import { markerMetrics } from './map-marker-renderer';
import type { MarkerFootprint, ScreenPoint } from './map-line-clipping';

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
export class MarkerFootprintCache {
  private readonly glyphs = new Map<string, Bounds | null>();
  clear() {
    this.glyphs.clear();
  }
  footprint(
    map: LibreMap,
    center: ScreenPoint,
    appearance: MapMarkerAppearance,
    imageKey: string,
    selected: boolean,
  ): MarkerFootprint | null {
    if (appearance.marker_opacity <= 0) return null;
    const { size, width } = markerMetrics(appearance);
    if (selected)
      return {
        center,
        width: width + 6,
        height: size + 6,
        radius: appearance.marker_shape === 'rounded' ? 10 : size / 2 + 3,
      };
    if (
      appearance.marker_shape !== 'icon' &&
      ((appearance.background_enabled && appearance.background_opacity > 0) ||
        (appearance.border_enabled && appearance.border_opacity > 0 && appearance.border_width > 0))
    ) {
      return {
        center,
        width,
        height: size,
        radius: appearance.marker_shape === 'rounded' ? 7 : size / 2,
      };
    }
    if (!appearance.icon_name || appearance.icon_opacity <= 0) return null;
    const geometryKey = `${appearance.icon_name}:${appearance.marker_size}:${appearance.marker_shape}:${appearance.icon_opacity}`;
    if (!this.glyphs.has(geometryKey)) {
      const image = map.getImage?.(imageKey)?.data as unknown as
        { width: number; height: number; data: Uint8Array } | undefined;
      if (image?.data) {
        let left = image.width,
          top = image.height,
          right = -1,
          bottom = -1;
        for (let y = 0; y < image.height; y++)
          for (let x = 0; x < image.width; x++)
            if (image.data[(y * image.width + x) * 4 + 3] > 0) {
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
        if (this.glyphs.size >= 1024) this.glyphs.delete(this.glyphs.keys().next().value!);
        this.glyphs.set(
          geometryKey,
          right >= left
            ? {
                left,
                top,
                right: right + 1,
                bottom: bottom + 1,
                width: image.width,
                height: image.height,
              }
            : null,
        );
      }
    }
    const bounds = this.glyphs.get(geometryKey);
    if (bounds === null) return null;
    if (!bounds) return { center, width: size * 0.75, height: size * 0.75, radius: 2 };
    const scale = (width + 8) / bounds.width;
    return {
      center: {
        x: center.x + ((bounds.left + bounds.right) / 2 - bounds.width / 2) * scale,
        y: center.y + ((bounds.top + bounds.bottom) / 2 - bounds.height / 2) * scale,
      },
      width: (bounds.right - bounds.left) * scale,
      height: (bounds.bottom - bounds.top) * scale,
      radius: 1.5,
    };
  }
}
