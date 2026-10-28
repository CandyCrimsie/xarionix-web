import type { MapMarkerAppearance } from './models/map.models';
import { mapMarkerIconSvg } from './map-marker.config';

export const MAP_TEXT_FONT = ['Golos Text', 'sans-serif'];
export const MAP_FONT_FACES = { 'Golos Text': [{ url: '/assets/map/GolosText.ttf' }] };
export const MAP_LABEL_LAYOUT = { 'text-font': MAP_TEXT_FONT, 'text-size': 13, 'text-anchor': 'top' as const, 'text-offset': [0, 1.65] as [number, number] };

function color(value: string): string {
    return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#465366';
}
function opacity(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

export function labelHaloColor(value: string): string {
    const hex = color(value).slice(1);
    const [r, g, b] = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    return r * .299 + g * .587 + b * .114 > 150 ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.9)';
}

export function markerMetrics(marker: MapMarkerAppearance) {
    const size = { small: 26, normal: 32, large: 40 }[marker.marker_size] ?? 32;
    return { size, width: marker.marker_shape === 'pill' ? Math.round(size * 1.5) : size, padding: 4 };
}

export function markerImageKey(marker: MapMarkerAppearance, selected = false): string {
    // Full canonical signature avoids hash collisions. Text and overall opacity
    // are separate symbol/paint properties and do not generate new textures.
    const { size, width } = markerMetrics(marker);
    return 'map-marker:' + JSON.stringify([
        marker.icon_name, color(marker.icon_color), opacity(marker.icon_opacity),
        marker.background_enabled, color(marker.background_color), opacity(marker.background_opacity),
        marker.border_enabled, color(marker.border_color), marker.border_width, opacity(marker.border_opacity),
        marker.marker_shape, size, width, selected,
    ]);
}

export function markerSvg(marker: MapMarkerAppearance, selected = false): string {
    const { size, width, padding } = markerMetrics(marker);
    const outline = marker.marker_shape !== 'icon' && marker.border_enabled ? Math.max(0, Math.min(8, marker.border_width)) : 0;
    const inset = outline / 2;
    const radius = marker.marker_shape === 'rounded' ? 7 : size / 2;
    const background = marker.background_enabled && marker.marker_shape !== 'icon';
    const symbol = mapMarkerIconSvg(marker.icon_name)?.replaceAll('currentColor', color(marker.icon_color)) ?? '';
    const iconSize = size * 0.75;
    const halo = selected ? `<rect x="1" y="1" width="${width + 6}" height="${size + 6}" rx="${radius + 4}" fill="#7B85DC" fill-opacity="0.18" stroke="#7B85DC" stroke-opacity="0.5"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 8}" height="${size + 8}" viewBox="0 0 ${width + 8} ${size + 8}">${halo}<g transform="translate(${padding} ${padding})"><rect x="${inset}" y="${inset}" width="${width - outline}" height="${size - outline}" rx="${radius}" fill="${background ? color(marker.background_color) : 'none'}" fill-opacity="${opacity(marker.background_opacity)}" stroke="${outline ? color(marker.border_color) : 'none'}" stroke-width="${outline}" stroke-opacity="${opacity(marker.border_opacity)}"/><g opacity="${opacity(marker.icon_opacity)}" transform="translate(${(width - iconSize) / 2} ${(size - iconSize) / 2}) scale(${iconSize / 24})">${symbol}</g></g></svg>`;
}

export function markerDataUrl(marker: MapMarkerAppearance, selected = false): string {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markerSvg(marker, selected));
}

export function createMarkerElement(marker: MapMarkerAppearance, selected = false): HTMLElement {
    const root = document.createElement('div');
    const image = document.createElement('img');
    image.src = markerDataUrl(marker, selected);
    image.alt = '';
    root.style.opacity = String(opacity(marker.marker_opacity));
    const metrics = markerMetrics(marker);
    root.style.position = 'absolute';
    root.style.width = `${metrics.width + 8}px`;
    root.style.height = `${metrics.size + 8}px`;
    root.append(image);
    if (marker.label_text) {
        const label = document.createElement('span');
        label.textContent = marker.label_text;
        Object.assign(label.style, { position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', font: '13px "Golos Text", sans-serif', color: color(marker.text_color), opacity: String(opacity(marker.text_opacity)), textShadow: `0 0 1px ${labelHaloColor(marker.text_color)}` });
        root.append(label);
    }
    return root;
}

export async function rasterizeMarker(marker: MapMarkerAppearance, pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1), selected = false): Promise<ImageData> {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Marker image could not be decoded'));
        img.src = markerDataUrl(marker, selected);
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * pixelRatio;
    canvas.height = img.naturalHeight * pixelRatio;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
}
