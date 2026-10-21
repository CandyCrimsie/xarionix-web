import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    inject,
    input,
    signal,
    viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle, lucideTriangleAlert } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';

import type { CoordinatePair } from '../../../../core/addresses/coordinate-input';
import {
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM,
    MAP_SESSION_REFRESH_MARGIN_SECONDS,
    MAP_SOURCE_ID,
    YANDEX_LOGO_URL,
    YANDEX_MAPS_TERMS_URL,
    YANDEX_MAPS_URL,
} from '../../map.config';
import { MapDataService } from '../../services/map-data.service';
import {
    MapLibreLoaderService,
    type MapLibreModule,
} from '../../services/maplibre-loader.service';


type MapInstance = import('maplibre-gl').Map;
type MapMarker = import('maplibre-gl').Marker;
type RasterTileSource = import('maplibre-gl').RasterTileSource;


@Component({
    selector: 'app-map-coordinate-picker',
    imports: [NgIcon, HlmAlertImports],
    providers: [provideIcons({ lucideLoaderCircle, lucideTriangleAlert })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './map-coordinate-picker.html',
    styleUrl: './map-coordinate-picker.css',
})
export class MapCoordinatePicker implements AfterViewInit {
    private readonly mapData = inject(MapDataService);
    private readonly mapLibreLoader = inject(MapLibreLoaderService);
    private readonly destroyRef = inject(DestroyRef);

    readonly latitude = input('');
    readonly longitude = input('');
    readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly selectedCoordinates = signal<CoordinatePair | null>(null);
    readonly yandexMapsUrl = signal(YANDEX_MAPS_URL);
    readonly yandexLogoUrl = YANDEX_LOGO_URL;
    readonly yandexTermsUrl = YANDEX_MAPS_TERMS_URL;

    private map: MapInstance | null = null;
    private marker: MapMarker | null = null;
    private mapLibre: MapLibreModule | null = null;
    private destroyed = false;
    private sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null;


    constructor() {
        this.destroyRef.onDestroy(() => {
            this.destroyed = true;
            this.marker?.remove();
            this.map?.remove();
            if (this.sessionRefreshTimer !== null) {
                clearTimeout(this.sessionRefreshTimer);
            }
        });
    }


    ngAfterViewInit(): void {
        void this.initialize();
    }


    private async initialize(): Promise<void> {
        try {
            const [mapLibre, session] = await Promise.all([
                this.mapLibreLoader.load(),
                firstValueFrom(this.mapData.createTileSession()),
            ]);
            if (this.destroyed) {
                return;
            }
            this.mapLibre = mapLibre;
            const initial = this.initialCoordinates();
            const map = new mapLibre.Map({
                container: this.mapContainer().nativeElement,
                center: initial
                    ? [Number(initial.longitude), Number(initial.latitude)]
                    : DEFAULT_MAP_CENTER,
                zoom: initial ? 16 : DEFAULT_MAP_ZOOM,
                minZoom: session.min_zoom,
                maxZoom: session.max_zoom,
                attributionControl: false,
                style: {
                    version: 8,
                    sources: {
                        [MAP_SOURCE_ID]: {
                            type: 'raster',
                            tiles: [session.tile_url_template],
                            tileSize: session.tile_size,
                            minzoom: session.min_zoom,
                            maxzoom: session.max_zoom,
                            attribution: '© Яндекс',
                        },
                    },
                    layers: [{
                        id: 'yandex-map-layer',
                        type: 'raster',
                        source: MAP_SOURCE_ID,
                    }],
                },
            });
            this.map = map;
            map.addControl(new mapLibre.NavigationControl(), 'top-right');
            map.on('load', () => {
                this.loading.set(false);
                this.scheduleSessionRefresh(session.expires_at);
                this.updateExternalMapLink();
                if (initial) {
                    this.setMarker(
                        Number(initial.longitude),
                        Number(initial.latitude),
                    );
                }
            });
            map.on('click', event => {
                this.setMarker(event.lngLat.lng, event.lngLat.lat);
            });
            map.on('moveend', () => this.updateExternalMapLink());
        } catch (error) {
            if (this.destroyed) {
                return;
            }
            this.loading.set(false);
            this.error.set(
                error instanceof HttpErrorResponse && error.status === 503
                    ? 'Карта не настроена на сервере'
                    : 'Не удалось загрузить карту',
            );
        }
    }


    private initialCoordinates(): CoordinatePair | null {
        if (!this.latitude().trim() || !this.longitude().trim()) {
            return null;
        }
        const latitude = Number(this.latitude().replace(',', '.'));
        const longitude = Number(this.longitude().replace(',', '.'));
        if (
            !Number.isFinite(latitude)
            || latitude < -90
            || latitude > 90
            || !Number.isFinite(longitude)
            || longitude < -180
            || longitude > 180
        ) {
            return null;
        }
        return {
            latitude: latitude.toFixed(7).replace(/0+$/, '').replace(/\.$/, ''),
            longitude: longitude.toFixed(7).replace(/0+$/, '').replace(/\.$/, ''),
        };
    }


    private setMarker(longitude: number, latitude: number): void {
        if (!this.map || !this.mapLibre) {
            return;
        }
        if (!this.marker) {
            this.marker = new this.mapLibre.Marker({ draggable: true })
                .setLngLat([longitude, latitude])
                .addTo(this.map);
            this.marker.on('dragend', () => {
                const position = this.marker?.getLngLat();
                if (position) {
                    this.setSelectedCoordinates(position.lng, position.lat);
                }
            });
        } else {
            this.marker.setLngLat([longitude, latitude]);
        }
        this.setSelectedCoordinates(longitude, latitude);
    }


    private setSelectedCoordinates(longitude: number, latitude: number): void {
        this.selectedCoordinates.set({
            latitude: latitude.toFixed(7).replace(/0+$/, '').replace(/\.$/, ''),
            longitude: longitude.toFixed(7).replace(/0+$/, '').replace(/\.$/, ''),
        });
    }


    private scheduleSessionRefresh(expiresAt: number): void {
        if (this.sessionRefreshTimer !== null) {
            clearTimeout(this.sessionRefreshTimer);
        }
        const delay = Math.max(
            1000,
            (expiresAt - Math.floor(Date.now() / 1000)
                - MAP_SESSION_REFRESH_MARGIN_SECONDS) * 1000,
        );
        this.sessionRefreshTimer = setTimeout(() => {
            this.sessionRefreshTimer = null;
            void this.refreshTileSession();
        }, delay);
    }


    private async refreshTileSession(): Promise<void> {
        try {
            const session = await firstValueFrom(this.mapData.createTileSession());
            if (this.destroyed || !this.map) {
                return;
            }
            const source = this.map.getSource(MAP_SOURCE_ID) as RasterTileSource | undefined;
            source?.setTiles([session.tile_url_template]);
            this.scheduleSessionRefresh(session.expires_at);
        } catch {
            if (!this.destroyed) {
                this.error.set('Сессия карты истекла. Закройте окно и попробуйте снова.');
            }
        }
    }


    private updateExternalMapLink(): void {
        if (!this.map) {
            return;
        }
        const center = this.map.getCenter();
        this.yandexMapsUrl.set(
            `${YANDEX_MAPS_URL}?ll=${center.lng.toFixed(6)}%2C${center.lat.toFixed(6)}`
            + `&z=${this.map.getZoom().toFixed(2)}`,
        );
    }
}
