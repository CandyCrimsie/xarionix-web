import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MapLibreLoaderService } from './maplibre-loader.service';


describe('MapLibreLoaderService', () => {
    let service: MapLibreLoaderService;

    beforeEach(() => {
        document.head
            .querySelector('link[data-xarionix-maplibre]')
            ?.remove();
        TestBed.configureTestingModule({});
        service = TestBed.inject(MapLibreLoaderService);
    });

    afterEach(() => {
        document.head
            .querySelector('link[data-xarionix-maplibre]')
            ?.remove();
    });

    it('loads the stylesheet and module once, on demand', async () => {
        expect(
            document.head.querySelector('link[data-xarionix-maplibre]'),
        ).toBeNull();

        const firstLoad = service.load();
        const secondLoad = service.load();
        const stylesheet = document.head.querySelector<HTMLLinkElement>(
            'link[data-xarionix-maplibre]',
        );

        expect(firstLoad).toBe(secondLoad);
        expect(stylesheet?.getAttribute('href')).toBe(
            '/assets/maplibre/maplibre-gl.css',
        );
        expect(
            document.head.querySelectorAll('link[data-xarionix-maplibre]'),
        ).toHaveLength(1);

        stylesheet?.dispatchEvent(new Event('load'));
        const mapLibre = await firstLoad;
        expect(mapLibre.Map).toBeTypeOf('function');
        expect(mapLibre.getWorkerUrl()).toBe(
            '/assets/maplibre/maplibre-gl-worker.mjs',
        );
    });
});
