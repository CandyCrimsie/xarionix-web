import type { FeatureCollection, LineString, Point } from 'geojson';
import type { GeoJSONSource, Map as LibreMap, MapMouseEvent } from 'maplibre-gl';
import type { MapConnection, MapConnectionDraft } from './models/map.models';
import { MAP_TEXT_FONT } from './map-marker-renderer';

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });
export const CONNECTION_SOURCE = 'xarionix-connections';
export const ROUTE_DRAFT_SOURCE = 'xarionix-route-draft';
export const ROUTE_VERTICES_SOURCE = 'xarionix-route-vertices';
export const CONNECTION_HIT_LAYER = 'connection-hit-target';
export const CONNECTION_COLORS = { fiber: '#5A67D8', utp: '#16888A' } as const;
export const CONNECTION_STATUSES = [
    { value: 'planned', label: 'Планируется', opacity: 1, dash: [2, 2], svgDash: '5 5' },
    { value: 'construction', label: 'Строится', opacity: 1, dash: [4, 2, .5, 2], svgDash: '10 5 1.25 5' },
    { value: 'active', label: 'Активно', opacity: 1, dash: null, svgDash: null },
    { value: 'inactive', label: 'Неактивно', opacity: .4, dash: null, svgDash: null },
] as const;

export function routeCoordinates(draft: MapConnectionDraft): [number, number][] | null {
    if (!draft.source || !draft.target || draft.source.longitude === null || draft.source.latitude === null || draft.target.longitude === null || draft.target.latitude === null) return null;
    return [[draft.source.longitude, draft.source.latitude], ...draft.vertices, [draft.target.longitude, draft.target.latitude]];
}

export function connectionLabel(connection: Pick<MapConnection, 'medium' | 'fiber_count' | 'category'>): string {
    return connection.medium === 'fiber' ? 'FO' + (connection.fiber_count ? ` · ${connection.fiber_count} волокна` : '') : 'UTP' + (connection.category ? ' · ' + connection.category : '');
}

export class MapConnectionLayer {
    private editing = false;
    private dragging: number | null = null;
    private clickHandlers: { layer: string; handler: (event: MapMouseEvent & { features?: GeoJSON.Feature[] }) => void }[] = [];
    private readonly move = (event: MapMouseEvent) => {
        if (this.dragging !== null) this.onVertexMove(this.dragging, [event.lngLat.lng, event.lngLat.lat]);
    };
    private readonly up = () => {
        if (this.dragging === null) return;
        this.dragging = null;
        this.map.dragPan.enable();
        this.map.getCanvas().style.cursor = '';
    };
    private readonly down = (event: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
        if (!this.editing) return;
        const index = Number(event.features?.[0]?.properties?.['index']);
        if (!Number.isInteger(index)) return;
        event.preventDefault();
        this.dragging = index;
        this.onVertexStart(index);
        this.map.dragPan.disable();
        this.map.getCanvas().style.cursor = 'grabbing';
    };

    constructor(private readonly map: LibreMap,
        private readonly onSelect: (id: number, coordinate: [number, number]) => void,
        private readonly onVertexStart: (index: number) => void,
        private readonly onVertexMove: (index: number, coordinate: [number, number]) => void,
    ) {
        if (map.getSource(CONNECTION_SOURCE)) return;
        map.addSource(CONNECTION_SOURCE, { type: 'geojson', data: empty() });
        map.addSource(ROUTE_DRAFT_SOURCE, { type: 'geojson', data: empty() });
        map.addSource(ROUTE_VERTICES_SOURCE, { type: 'geojson', data: empty() });
        map.addLayer({ id: 'connection-selected-halo', type: 'line', source: CONNECTION_SOURCE,
            filter: ['==', ['get', 'id'], -1], paint: { 'line-color': ['get', 'color'], 'line-width': 8, 'line-opacity': 0.17 } });
        for (const style of CONNECTION_STATUSES) {
            const status = style.value;
            const id = 'connection-' + status;
            map.addLayer({ id, type: 'line', source: CONNECTION_SOURCE, filter: ['==', ['get', 'status'], status],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': style.opacity,
                    ...(style.dash ? { 'line-dasharray': [...style.dash] } : {}) } });
        }
        map.addLayer({ id: CONNECTION_HIT_LAYER, type: 'line', source: CONNECTION_SOURCE,
            paint: { 'line-width': 18, 'line-opacity': 0 } });
        const handler = (event: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
            if (!this.editing) this.onSelect(Number(event.features?.[0]?.properties?.['id']), [event.lngLat.lng, event.lngLat.lat]);
        };
        this.clickHandlers.push({ layer: CONNECTION_HIT_LAYER, handler });
        map.on('click', CONNECTION_HIT_LAYER, handler);
        map.addLayer({ id: 'connection-labels', type: 'symbol', source: CONNECTION_SOURCE, minzoom: 14,
            layout: { 'symbol-placement': 'line', 'text-field': ['get', 'label'], 'text-font': MAP_TEXT_FONT, 'text-size': 11, 'text-offset': [0, -0.8] },
            paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
        map.addLayer({ id: 'route-draft-line', type: 'line', source: ROUTE_DRAFT_SOURCE,
            paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1] } });
        map.addLayer({ id: 'route-edit-vertices', type: 'circle', source: ROUTE_VERTICES_SOURCE,
            paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#5A67D8', 'circle-stroke-width': 2 } });
        map.on('mousedown', 'route-edit-vertices', this.down);
        map.on('mousemove', this.move);
        map.on('mouseup', this.up);
    }

    setConnections(connections: MapConnection[], selectedId: number | null) {
        const data: FeatureCollection<LineString> = { type: 'FeatureCollection', features: connections.flatMap(line => line.geometry ? [{
            type: 'Feature' as const, id: line.id, geometry: line.geometry,
            properties: { id: line.id, color: CONNECTION_COLORS[line.medium], status: line.status, label: connectionLabel(line) },
        }] : []) };
        (this.map.getSource(CONNECTION_SOURCE) as GeoJSONSource)?.setData(data);
        this.map.setFilter('connection-selected-halo', ['==', ['get', 'id'], selectedId ?? -1]);
    }

    setDraft(draft: MapConnectionDraft | null, editing = false) {
        this.editing = editing;
        if (!editing) this.up();
        const coordinates = draft ? routeCoordinates(draft) : null;
        const line: FeatureCollection<LineString> = { type: 'FeatureCollection', features: coordinates ? [{
            type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { color: draft?.medium === 'utp' ? '#16888A' : '#5A67D8' },
        }] : [] };
        const vertices: FeatureCollection<Point> = { type: 'FeatureCollection', features: draft && editing ? draft.vertices.map((coordinates, index) => ({
            type: 'Feature', id: index, geometry: { type: 'Point', coordinates }, properties: { index },
        })) : [] };
        (this.map.getSource(ROUTE_DRAFT_SOURCE) as GeoJSONSource)?.setData(line);
        (this.map.getSource(ROUTE_VERTICES_SOURCE) as GeoJSONSource)?.setData(vertices);
    }

    destroy() {
        this.up();
        this.map.off('mousedown', 'route-edit-vertices', this.down);
        this.map.off('mousemove', this.move);
        this.map.off('mouseup', this.up);
        for (const { layer, handler } of this.clickHandlers) this.map.off('click', layer, handler);
        this.clickHandlers = [];
    }
}
