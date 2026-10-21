import { Injectable } from '@angular/core';


export type MapLibreModule = typeof import('maplibre-gl');

const MAPLIBRE_STYLESHEET_URL = '/assets/maplibre/maplibre-gl.css';
const MAPLIBRE_WORKER_URL = '/assets/maplibre/maplibre-gl-worker.mjs';
const MAPLIBRE_STYLESHEET_ATTRIBUTE = 'data-xarionix-maplibre';


@Injectable({ providedIn: 'root' })
export class MapLibreLoaderService {
    private modulePromise: Promise<MapLibreModule> | null = null;


    load(): Promise<MapLibreModule> {
        this.modulePromise ??= Promise.all([
            this.loadStylesheet(),
            import('maplibre-gl'),
        ])
            .then(([, mapLibre]) => {
                mapLibre.setWorkerUrl(MAPLIBRE_WORKER_URL);
                return mapLibre;
            })
            .catch(error => {
                this.modulePromise = null;
                throw error;
            });
        return this.modulePromise;
    }


    private loadStylesheet(): Promise<void> {
        const existing = document.head.querySelector<HTMLLinkElement>(
            `link[${MAPLIBRE_STYLESHEET_ATTRIBUTE}]`,
        );
        if (existing) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = MAPLIBRE_STYLESHEET_URL;
            link.setAttribute(MAPLIBRE_STYLESHEET_ATTRIBUTE, '');
            link.addEventListener('load', () => resolve(), { once: true });
            link.addEventListener(
                'error',
                () => {
                    link.remove();
                    this.modulePromise = null;
                    reject(new Error('MapLibre stylesheet failed to load'));
                },
                { once: true },
            );
            document.head.append(link);
        });
    }
}
