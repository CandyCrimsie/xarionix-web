import type { FeatureCollection, LineString, Point } from 'geojson';
import type {
  GeoJSONSource,
  Map as LibreMap,
  MapMouseEvent,
  ExpressionSpecification,
} from 'maplibre-gl';
import type { MapConnection, MapConnectionDraft } from './models/map.models';
import { MAP_TEXT_FONT } from './map-marker-renderer';
import {
  CONNECTION_COLORS,
  CONNECTION_SELECTED_COLOR,
  CONNECTION_STATUSES,
  INSTALLATION_STYLES,
  installationMethods,
} from './map-line-styles';
import {
  clipRoute,
  FootprintIndex,
  occludedInterval,
  type MarkerFootprint,
  type ScreenPoint,
} from './map-line-clipping';
export { CONNECTION_COLORS, CONNECTION_STATUSES } from './map-line-styles';

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });
export const CONNECTION_SOURCE = 'xarionix-connections';
export const CONNECTION_HIT_SOURCE = 'xarionix-connection-hits';
export const CONNECTION_HALO_SOURCE = 'xarionix-connection-halos';
export const ROUTE_DRAFT_SOURCE = 'xarionix-route-draft';
export const ROUTE_VERTICES_SOURCE = 'xarionix-route-vertices';
export const CONNECTION_HIT_LAYER = 'connection-hit-target';
export const CONNECTION_MAIN_LAYER = 'connection-method-unknown';

export function routeCoordinates(draft: MapConnectionDraft): [number, number][] | null {
  if (
    !draft.source ||
    !draft.target ||
    draft.source.longitude === null ||
    draft.source.latitude === null ||
    draft.target.longitude === null ||
    draft.target.latitude === null
  )
    return null;
  return [
    [draft.source.longitude, draft.source.latitude],
    ...draft.vertices,
    [draft.target.longitude, draft.target.latitude],
  ];
}
export function connectionLabel(
  connection: Pick<MapConnection, 'medium' | 'fiber_count' | 'category'>,
): string {
  return connection.medium === 'fiber'
    ? 'FO' + (connection.fiber_count ? ` · ${connection.fiber_count} волокна` : '')
    : 'UTP' + (connection.category ? ' · ' + connection.category : '');
}

export class MapConnectionLayer {
  private editing = false;
  private dragging: number | null = null;
  private connections: MapConnection[] = [];
  private selected: number | null = null;
  private hovered: number | null = null;
  private frame: number | null = null;
  private draft: MapConnectionDraft | null = null;
  private draftConnectionId: number | null = null;
  private footprintIndex: FootprintIndex | null = null;
  private haloIndex: FootprintIndex | null = null;
  private featureIds: { id: string; connection: number }[] = [];
  private readonly styledStates = new Map<string, number>();
  private readonly before: string | undefined;
  private readonly up = () => {
    if (this.dragging === null) return;
    this.dragging = null;
    this.map.dragPan.enable();
    this.map.getCanvas().style.cursor = '';
  };
  private readonly move = (event: MapMouseEvent) => {
    if (this.dragging !== null)
      this.onVertexMove(this.dragging, [event.lngLat.lng, event.lngLat.lat]);
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
  private readonly click = (event: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
    if (this.editing) return;
    const markerLayers = [
      'building-points',
      'selected-building-marker',
      'custom-marker-points',
    ].filter((id) => this.map.getLayer(id));
    if (
      typeof this.map.queryRenderedFeatures === 'function' &&
      markerLayers.length &&
      this.map.queryRenderedFeatures(event.point, { layers: markerLayers }).length
    )
      return;
    this.onSelect(Number(event.features?.[0]?.properties?.['id']), [
      event.lngLat.lng,
      event.lngLat.lat,
    ]);
  };
  private readonly hover = (event: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
    const id = this.editing ? null : Number(event.features?.[0]?.properties?.['id']);
    if (id === this.hovered) return;
    this.hovered = id;
    this.applyStates();
  };
  private readonly leave = () => {
    this.hovered = null;
    this.applyStates();
  };
  private readonly sourceChanged = (event: { sourceId?: string }) => {
    if (
      event.sourceId &&
      ['xarionix-buildings', 'xarionix-custom-markers', 'xarionix-selected-building'].includes(
        event.sourceId,
      )
    )
      this.refreshClipping();
  };

  constructor(
    private readonly map: LibreMap,
    private readonly onSelect: (id: number, coordinate: [number, number]) => void,
    private readonly onVertexStart: (index: number) => void,
    private readonly onVertexMove: (index: number, coordinate: [number, number]) => void,
    private readonly footprints: () => MarkerFootprint[] = () => [],
  ) {
    this.before = map.getLayer('building-clusters') ? 'building-clusters' : undefined;
    if (map.getSource(CONNECTION_SOURCE)) return;
    for (const source of [
      CONNECTION_SOURCE,
      CONNECTION_HIT_SOURCE,
      CONNECTION_HALO_SOURCE,
      ROUTE_DRAFT_SOURCE,
      ROUTE_VERTICES_SOURCE,
    ])
      map.addSource(source, { type: 'geojson', data: empty() });
    const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];
    const hovered: ExpressionSpecification = ['boolean', ['feature-state', 'hovered'], false];
    const [firstStatus, ...otherStatuses] = CONNECTION_STATUSES;
    const opacity: ExpressionSpecification = [
      'match',
      ['get', 'status'],
      firstStatus.value,
      firstStatus.opacity,
      ...otherStatuses.flatMap((status) => [status.value, status.opacity]),
      1,
    ];
    map.addLayer(
      {
        id: 'connection-selected-halo',
        type: 'line',
        source: CONNECTION_HALO_SOURCE,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': CONNECTION_SELECTED_COLOR,
          'line-width': 8,
          'line-blur': 0.8,
          'line-opacity': ['get', 'opacity'],
        },
      },
      this.before,
    );
    for (const source of [CONNECTION_SOURCE, ROUTE_DRAFT_SOURCE])
      for (const method of INSTALLATION_STYLES) {
        const extra: ExpressionSpecification = ['case', selected, 0.9, hovered, 0.6, 0];
        const width: ExpressionSpecification = [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          ['+', method.width * 0.7, extra],
          16,
          ['+', method.width, extra],
          20,
          ['+', method.width * 1.1, extra],
        ];
        map.addLayer(
          {
            id:
              (source === CONNECTION_SOURCE ? 'connection-method-' : 'route-draft-method-') +
              method.value,
            type: 'line',
            source,
            filter: ['==', ['get', 'installation_method'], method.value],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': ['case', selected, CONNECTION_SELECTED_COLOR, ['get', 'color']],
              'line-width': width,
              'line-opacity': opacity,
              ...(method.dash ? { 'line-dasharray': method.dash } : {}),
              'line-color-transition': { duration: 140 },
              'line-width-transition': { duration: 140 },
            },
          },
          this.before,
        );
      }
    map.addLayer(
      {
        id: CONNECTION_HIT_LAYER,
        type: 'line',
        source: CONNECTION_HIT_SOURCE,
        paint: { 'line-width': 18, 'line-opacity': 0 },
      },
      this.before,
    );
    map.addLayer(
      {
        id: 'connection-labels',
        type: 'symbol',
        source: CONNECTION_HIT_SOURCE,
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-font': MAP_TEXT_FONT,
          'text-size': 10,
          'text-offset': [0, -0.9],
        },
        paint: {
          'text-color': ['get', 'color'],
          'text-halo-color': 'rgba(15,23,42,.75)',
          'text-halo-width': 0.8,
          'text-opacity': 0.9,
        },
      },
      this.before,
    );
    map.addLayer({
      id: 'route-edit-vertices',
      type: 'circle',
      source: ROUTE_VERTICES_SOURCE,
      paint: {
        'circle-radius': 4,
        'circle-color': '#EAF4FF',
        'circle-stroke-color': CONNECTION_COLORS.fiber,
        'circle-stroke-width': 1.5,
      },
    });
    map.on('click', CONNECTION_HIT_LAYER, this.click);
    map.on('mousemove', CONNECTION_HIT_LAYER, this.hover);
    map.on('mouseleave', CONNECTION_HIT_LAYER, this.leave);
    map.on('mousedown', 'route-edit-vertices', this.down);
    map.on('mousemove', this.move);
    map.on('mouseup', this.up);
    map.on('move', this.refreshClipping);
    map.on('resize', this.refreshClipping);
    map.on('sourcedata', this.sourceChanged);
  }

  setConnections(connections: MapConnection[], selectedId: number | null) {
    this.connections = connections;
    this.selected = selectedId;
    const hits: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: connections.flatMap((line) =>
        line.geometry
          ? [
              {
                type: 'Feature' as const,
                id: line.id,
                geometry: line.geometry,
                properties: {
                  id: line.id,
                  color: CONNECTION_COLORS[line.medium],
                  label: connectionLabel(line),
                },
              },
            ]
          : [],
      ),
    };
    (this.map.getSource(CONNECTION_HIT_SOURCE) as GeoJSONSource)?.setData(hits);
    this.refreshClipping();
  }
  readonly refreshClipping = () => {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  };
  private render() {
    const canvas = this.map.getCanvas(),
      footprints = this.footprints(),
      index = new FootprintIndex(
        footprints,
        canvas.clientWidth || 1600,
        canvas.clientHeight || 1000,
      );
    this.footprintIndex = index;
    // The wider soft halo needs its own cut, not a wider gap in the cable.
    this.haloIndex = new FootprintIndex(
      footprints,
      canvas.clientWidth || 1600,
      canvas.clientHeight || 1000,
      4.8,
    );
    const features: GeoJSON.Feature<LineString>[] = [];
    this.featureIds = [];
    for (const line of this.connections) {
      if (!line.geometry || line.id === this.draftConnectionId) continue;
      const points = line.geometry.coordinates,
        methods = installationMethods(line.vertices, line.installation_methods);
      for (let start = 0; start < methods.length;) {
        let end = start + 1;
        while (end < methods.length && methods[end] === methods[start]) end++;
        const run = points.slice(start, end + 1);
        const pieces =
          typeof this.map.project === 'function' && typeof this.map.unproject === 'function'
            ? clipRoute(run, this.map, index)
            : [run];
        pieces.forEach((coordinates, piece) => {
          const id = `${line.id}:${start}:${piece}`;
          this.featureIds.push({ id, connection: line.id });
          features.push({
            type: 'Feature',
            id,
            geometry: { type: 'LineString', coordinates },
            properties: {
              id: line.id,
              color: CONNECTION_COLORS[line.medium],
              status: line.status,
              installation_method: methods[start],
            },
          });
        });
        start = end;
      }
    }
    (this.map.getSource(CONNECTION_SOURCE) as GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features,
    });
    const liveIds = new Set(this.featureIds.map((feature) => feature.id));
    for (const id of this.styledStates.keys())
      if (!liveIds.has(id)) {
        this.map.removeFeatureState?.({ source: CONNECTION_SOURCE, id });
        this.styledStates.delete(id);
      }
    const draftFeatures: GeoJSON.Feature<LineString>[] = [];
    const draftPoints = this.draft ? routeCoordinates(this.draft) : null;
    if (draftPoints && this.draft) {
      const methods = installationMethods(this.draft.vertices, this.draft.installation_methods);
      for (let start = 0; start < methods.length;) {
        let end = start + 1;
        while (end < methods.length && methods[end] === methods[start]) end++;
        const run = draftPoints.slice(start, end + 1),
          pieces = typeof this.map.project === 'function' ? clipRoute(run, this.map, index) : [run];
        for (const coordinates of pieces)
          draftFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates },
            properties: {
              color: CONNECTION_COLORS[this.draft.medium],
              status: this.draft.status,
              installation_method: methods[start],
            },
          });
        start = end;
      }
    }
    (this.map.getSource(ROUTE_DRAFT_SOURCE) as GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features: draftFeatures,
    });
    this.applyStates();
  }
  isOccluded(point: ScreenPoint): boolean {
    const index = this.footprintIndex;
    return !!index
      ?.candidates(point, point)
      .some((id) => occludedInterval(point, point, index.polygons[id]) !== null);
  }
  private applyStates() {
    // Updating a hovered cable must not invalidate every other feature's
    // state or retain states for discarded clipping fragments forever.
    for (const feature of this.featureIds) {
      const selected = feature.connection === this.selected,
        hovered = feature.connection === this.hovered;
      const state = Number(selected) + Number(hovered) * 2;
      if ((this.styledStates.get(feature.id) ?? 0) === state) continue;
      if (state) {
        this.map.setFeatureState?.(
          { source: CONNECTION_SOURCE, id: feature.id },
          { selected, hovered },
        );
        this.styledStates.set(feature.id, state);
      } else {
        this.map.removeFeatureState?.({ source: CONNECTION_SOURCE, id: feature.id });
        this.styledStates.delete(feature.id);
      }
    }
    const halos: GeoJSON.Feature<LineString>[] = [];
    for (const line of this.connections) {
      if (
        !line.geometry ||
        line.id === this.draftConnectionId ||
        (line.id !== this.selected && line.id !== this.hovered)
      )
        continue;
      const pieces =
        this.haloIndex && typeof this.map.project === 'function'
          ? clipRoute(line.geometry.coordinates, this.map, this.haloIndex)
          : [line.geometry.coordinates];
      for (const coordinates of pieces)
        halos.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates },
          properties: { opacity: line.id === this.selected ? 0.17 : 0.09 },
        });
    }
    (this.map.getSource(CONNECTION_HALO_SOURCE) as GeoJSONSource)?.setData({
      type: 'FeatureCollection',
      features: halos,
    });
  }
  setDraft(draft: MapConnectionDraft | null, editing = false, connectionId: number | null = null) {
    this.draft = draft;
    this.draftConnectionId = draft ? connectionId : null;
    this.editing = editing;
    if (!editing) this.up();
    if (editing) this.leave();
    const vertices: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features:
        draft && editing
          ? draft.vertices.map((coordinates, index) => ({
              type: 'Feature',
              id: index,
              geometry: { type: 'Point', coordinates },
              properties: { index },
            }))
          : [],
    };
    (this.map.getSource(ROUTE_VERTICES_SOURCE) as GeoJSONSource)?.setData(vertices);
    this.refreshClipping();
  }
  destroy() {
    this.up();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.map.off('click', CONNECTION_HIT_LAYER, this.click);
    this.map.off('mousemove', CONNECTION_HIT_LAYER, this.hover);
    this.map.off('mouseleave', CONNECTION_HIT_LAYER, this.leave);
    this.map.off('mousedown', 'route-edit-vertices', this.down);
    this.map.off('mousemove', this.move);
    this.map.off('mouseup', this.up);
    this.map.off('move', this.refreshClipping);
    this.map.off('resize', this.refreshClipping);
    this.map.off('sourcedata', this.sourceChanged);
    this.map.removeFeatureState?.({ source: CONNECTION_SOURCE });
    this.styledStates.clear();
  }
}
