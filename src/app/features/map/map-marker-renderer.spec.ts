import { describe, it, expect } from 'vitest';
import { createDefaultMapMarker, pickMarkerAppearance, MAP_MARKER_ICONS } from './map-marker.config';
import { APPROVED_MAP_ICONS } from './icons/map-icons';
import { markerSvg, markerImageKey, markerMetrics, createMarkerElement, MAP_FONT_FACES } from './map-marker-renderer';

describe('Shared map renderer', () => {
    const appearance = pickMarkerAppearance(createDefaultMapMarker());
    it.each(['map-house', 'network-node', 'cabinet', 'splice', 'pole', 'chamber', 'equipment', 'note'])('renders approved geometry %s in the same 32 CSS-pixel metrics', icon => {
        const svg = markerSvg({ ...appearance, icon_name: icon });
        expect(svg).toContain('stroke-width="1.7"');
        expect(svg).toContain('stroke-linecap="round"');
        expect(markerMetrics({ ...appearance, icon_name: icon }).size).toBe(32);
        expect(svg).not.toContain('undefined');
    });
    it('preserves old Lucide meanings instead of aliasing their IDs to unrelated shapes', () => {
        expect(MAP_MARKER_ICONS.some(icon => icon.value === 'house')).toBe(true);
        expect(markerSvg({ ...appearance, icon_name: 'house' })).not.toBe(markerSvg({ ...appearance, icon_name: 'map-house' }));
    });
    it('reuses image resources for different labels and overall opacity, but not different geometry', () => {
        expect(markerImageKey(appearance)).toBe(markerImageKey({ ...appearance, label_text: 'Другая подпись', marker_opacity: .2 }));
        expect(markerImageKey(appearance)).not.toBe(markerImageKey({ ...appearance, border_width: 2 }));
        expect(markerImageKey(appearance)).not.toBe(markerImageKey({ ...appearance, icon_name: 'cabinet' }));
    });
    it('uses literal text and trusted SVG for a single drag preview', () => {
        const node = createMarkerElement({ ...appearance, label_text: '<img src=x onerror=alert(1)>' }, true);
        expect(node.querySelectorAll('img')).toHaveLength(1);
        expect(node.querySelector('span')?.textContent).toBe('<img src=x onerror=alert(1)>');
        expect(node.querySelector('span')?.style.top).toBe('100%');
        expect(node.querySelector('img')?.src).toContain('data:image/svg+xml');
        expect(node.style.width).toBe('40px');
        expect(node.style.height).toBe('40px');
        expect(node.style.position).toBe('absolute');
    });
    it('does not retain a disabled one-pixel border or accept an arbitrary SVG payload', () => {
        expect(markerSvg({ ...appearance, border_enabled: false })).toContain('stroke-width="0"');
        expect(markerSvg({ ...appearance, icon_name: '<svg onload=alert(1)>' })).not.toContain('onload');
    });
    it('declares a local font-file list in MapLibre font-faces format', () => {
        expect(MAP_FONT_FACES['Golos Text']).toEqual([{ url: '/assets/map/GolosText.ttf' }]);
    });
});
