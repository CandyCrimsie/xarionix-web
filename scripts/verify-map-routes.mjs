// Real MapLibre/WebGL regression extension. API and raster traffic stay local.
// MAP_VERIFY_ROUTES=1 node scripts/verify-map-stage25172.mjs
import assert from 'node:assert/strict';

export async function installRouteFixtures(page, state) {
    let markerId = 9000, connectionId = 9000, token = 1, conflictNext = false;
    const requests = [];
    const endpoint = marker => ({ kind: 'marker', id: marker.id, name: marker.name, latitude: marker.latitude, longitude: marker.longitude });
    await page.route('**/api/v1/map/connections/*/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== 'POST' || !/\/(split|route-objects|installation-boundaries|detach)$/.test(path)) return route.fallback();
        const id = Number(path.split('/')[5]), data = route.request().postDataJSON();
        const original = state.getLines().find(line => line.id === id);
        requests.push({ path, payload: data });
        if (conflictNext) { conflictNext = false; return route.fulfill({ status: 409, json: { detail: { code: 'stale_version', message: 'Трасса изменена другим пользователем. Обновите её.' } } }); }
        assert.equal(data.expected_version, original.version);
        assert.equal(data.expected_geometry_token, original.geometry_token);
        const point = data.position && [data.position.longitude, data.position.latitude];
        const points = original.geometry.coordinates;
        const methods = original.installation_methods ?? points.slice(1).map(() => 'unknown');
        const geometryToken = () => (++token).toString(16).padStart(64, '0');
        const changed = { ...original, version: original.version + 1, geometry_token: geometryToken() };
        const persist = (...lines) => state.setLines([...state.getLines().filter(line => line.id !== id), ...lines]);
        if (path.endsWith('/split')) {
            const marker = { ...state.markers[1], ...data.marker, id: markerId++, point_type: data.marker.point_type ?? 'splice', latitude: point[1], longitude: point[0], visibility: original.visibility, owner_user_id: original.owner_user_id };
            const before = [...points.slice(0, data.segment_index + 1), point], after = [point, ...points.slice(data.segment_index + 1)];
            const first = { ...changed, target: endpoint(marker), vertices: before.slice(1, -1), installation_methods: methods.slice(0, data.segment_index + 1), geometry: { type: 'LineString', coordinates: before } };
            const second = { ...original, id: connectionId++, source: endpoint(marker), vertices: after.slice(1, -1), installation_methods: methods.slice(data.segment_index), geometry: { type: 'LineString', coordinates: after }, version: 1, geometry_token: geometryToken() };
            persist(first, second); state.markers.push(marker);
            return route.fulfill({ status: 201, json: { marker, connections: [first, second] } });
        }
        if (path.endsWith('/installation-boundaries')) {
            const coordinates = [...points.slice(0, data.segment_index + 1), point, ...points.slice(data.segment_index + 1)];
            const nextMethods = [...methods.slice(0, data.segment_index + 1), methods[data.segment_index], ...methods.slice(data.segment_index + 1)];
            for (let i = data.segment_index + 1; i < (data.until === 'next_vertex' ? data.segment_index + 2 : nextMethods.length); i++) nextMethods[i] = data.installation_after;
            Object.assign(changed, { vertices: coordinates.slice(1, -1), geometry: { type: 'LineString', coordinates }, installation_methods: nextMethods });
            persist(changed); return route.fulfill({ json: changed });
        }
        if (path.endsWith('/detach')) {
            const id = Number(path.split('/').at(-2)), marker = state.markers.find(marker => marker.id === id);
            marker.route_attachment = null;
            changed.route_objects = original.route_objects.filter(item => item.marker_id !== id);
            persist(changed); return route.fulfill({ json: { marker, connection: changed } });
        }
        const marker = { ...state.markers[1], ...data.marker, id: markerId++, latitude: point[1], longitude: point[0], visibility: original.visibility, owner_user_id: original.owner_user_id,
            route_attachment: { connection_id: original.id, name: original.name, version: changed.version, geometry_token: changed.geometry_token, segment_index: data.segment_index, fraction: data.fraction } };
        changed.route_objects = [...(original.route_objects ?? []), { marker_id: marker.id, name: marker.name, point_type: marker.point_type, latitude: point[1], longitude: point[0], segment_index: data.segment_index, fraction: data.fraction, state: 'on_route' }];
        persist(changed); state.markers.push(marker);
        return route.fulfill({ status: 201, json: { marker, connection: changed } });
    });
    return { ...state, requests, failNext: () => { conflictNext = true; } };
}

export async function verifyMapRoutes(page, screenshot, fixture) {
    const component = fn => page.evaluate(fn);
    // Drop only the synthetic 1000-point performance fixture from the older
    // check; all original markers and successfully created nodes are retained.
    fixture.markers.splice(0, fixture.markers.length, ...fixture.markers.filter(marker => marker.id < 1000 || marker.id >= 9000));
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        c.connectionDialog().close({}); c.closePopup(); c.retryViewport();
        c.map.jumpTo({ center: [38.247, 55.5782], zoom: 17, pitch: 0, bearing: 0 });
    });
    await page.waitForTimeout(800);
    const plus = page.getByTestId('insert-splice-hover');
    const hover = async (id, segment = 0, fraction = .5) => {
        const location = await page.evaluate(({ id, segment, fraction }) => {
            const c = window.ng.getComponent(document.querySelector('app-address-map'));
            const line = c.connections().find(line => line.id === id), points = line.geometry.coordinates;
            const a = c.map.project(points[segment]), b = c.map.project(points[segment + 1]);
            const rect = c.map.getContainer().getBoundingClientRect();
            return { x: rect.x + a.x + (b.x - a.x) * fraction, y: rect.y + a.y + (b.y - a.y) * fraction };
        }, { id, segment, fraction });
        await page.mouse.move(location.x, location.y);
        await plus.waitFor({ state: 'visible' });
        return location;
    };
    // Add a box through the same atomic split, not a hard-coded splice dialog.
    await hover(9000, 1, .55); await plus.click();
    await page.getByTestId('route-node-fiber_box').waitFor();
    assert.equal(await page.getByTestId('route-node-odf').count(), 1);
    await screenshot('route-object-menu');
    await page.getByTestId('route-node-fiber_box').click();
    await page.getByTestId('map-marker-dialog').waitFor();
    await page.getByTestId('marker-name').fill('Бокс на магистрали');
    const frozen = await component(() => window.ng.getComponent(document.querySelector('app-address-map')).spliceTarget().point.position);
    await page.mouse.move(20, 20);
    await page.getByTestId('save-map-marker').click();
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    const boxRequest = fixture.requests.at(-1);
    assert(boxRequest.path.endsWith('/split')); assert.equal(boxRequest.payload.marker.point_type, 'fiber_box');
    assert.deepEqual([boxRequest.payload.position.longitude, boxRequest.payload.position.latitude], frozen);
    // Pass-through chamber: same line ID/endpoints/geometry; one saved anchor.
    await hover(9000, 1, .45); await plus.click();
    await page.getByTestId('route-place-chamber').click();
    await page.getByTestId('map-marker-dialog').waitFor();
    await page.getByTestId('marker-name').fill('Колодец без разрыва кабеля');
    const before = structuredClone(fixture.getLines().find(line => line.id === 9000));
    await screenshot('pass-through-editor');
    await page.getByTestId('save-map-marker').click();
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    const chamber = fixture.markers.at(-1), after = fixture.getLines().find(line => line.id === 9000);
    assert.equal(chamber.point_type, 'chamber'); assert.deepEqual(after.geometry, before.geometry);
    assert.deepEqual(after.source, before.source); assert.deepEqual(after.target, before.target);
    assert.equal(chamber.route_attachment.connection_id, after.id);
    // Independent method boundary; the graph and marker count stay intact.
    const count = fixture.markers.length, routes = fixture.getLines().length;
    await hover(9001, 0, .5); await plus.click(); await page.getByTestId('route-installation-boundary').click();
    await page.getByTestId('installation-boundary-dialog').waitFor();
    assert((await page.locator('[aria-label="Протяжённость участка"]').innerText()).includes('До конца трассы'));
    await component(() => window.ng.getComponent(document.querySelector('app-address-map')).boundaryMethod.set('duct'));
    await screenshot('installation-boundary');
    await page.getByTestId('save-installation-boundary').click();
    await page.getByTestId('installation-boundary-dialog').waitFor({ state: 'detached' });
    assert.equal(fixture.markers.length, count); assert.equal(fixture.getLines().length, routes);
    assert(fixture.getLines().find(line => line.id === 9001).installation_methods.includes('duct'));
    // Conflict does not close the editor or discard user input; cancel writes nothing.
    await hover(9001, 1, .55); await plus.click(); await page.getByTestId('route-place-pole').click();
    await page.getByTestId('marker-name').fill('Несохранённая опора'); fixture.failNext();
    await page.getByTestId('save-map-marker').click();
    await page.getByTestId('map-marker-dialog').getByRole('alert').waitFor();
    assert.equal(await page.getByTestId('marker-name').inputValue(), 'Несохранённая опора');
    assert.equal(fixture.markers.length, count);
    await component(() => window.ng.getComponent(document.querySelector('app-address-map')).markerDialog().close({}));
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });

    const originalLines = fixture.getLines();
    const housePoint = [38.245099, 55.577276];
    fixture.setLines([...originalLines, ...[[38.244,55.5785],[38.246,55.576],[38.2465,55.578]].map((start,i) => ({
        ...originalLines[0], id: 8100+i, vertices: [], installation_methods: ['aerial'], medium: i === 1 ? 'utp' : 'fiber',
        geometry: { type:'LineString',coordinates:[start,housePoint] },
    })), ...['unknown', 'aerial', 'duct', 'direct_buried', 'facade', 'indoor'].map((method, i) => {
        const start = [38.243, 55.5756 + i * .00045], middle = [38.2448, start[1] + .0001], end = [38.247, start[1]];
        return { ...originalLines[0], id: 8000 + i, medium: i % 2 ? 'utp' : 'fiber', status: ['active', 'planned', 'construction', 'inactive'][i % 4], vertices: [middle], installation_methods: [method, method], geometry: { type: 'LineString', coordinates: [start, middle, end] } };
    })]);
    const rendering = await component(async () => {
        const c = window.ng.getComponent(document.querySelector('app-address-map')), map = c.map;
        c.closePopup(); c.spliceController.clear();
        const main = c.connections().find(line => line.id === 9001);
        const methods = ['unknown', 'aerial', 'duct', 'direct_buried', 'facade', 'indoor'];
        c.retryViewport();
        map.jumpTo({ center: [38.246, 55.5773], zoom: 16, bearing: 20, pitch: 25 });
        await new Promise(resolve => setTimeout(resolve, 900));
        const layers = map.getStyle().layers.map(layer => layer.id);
        const styleLayers = layers.filter(id => id.startsWith('connection-method-'));
        const hit = map.getSource('xarionix-connection-hits').serialize().data;
        const rendered = map.getSource('xarionix-connections').serialize().data;
        const result = { styleLayers, allMethods: new Set(rendered.features.map(feature => feature.properties.installation_method)).size,
            belowMarkers: styleLayers.every(id => layers.indexOf(id) < layers.indexOf('building-clusters')),
            fullHitGeometry: JSON.stringify(hit.features.find(feature => feature.id === main.id).geometry) === JSON.stringify(main.geometry),
            dash: methods.map(method => map.getPaintProperty('connection-method-' + method, 'line-dasharray')) };
        return result;
    });
    assert.equal(rendering.styleLayers.length, 6); assert.equal(rendering.allMethods, 6); assert(rendering.belowMarkers && rendering.fullHitGeometry);
    const toggle = page.getByTestId('map-legend-toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await screenshot('mixed-methods');
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();

    // Pixel-level proof on the real heterogeneous raster. Capture a WebGL
    // frame in its render callback (preserveDrawingBuffer is deliberately off).
    await page.mouse.move(20,20);
    const clipping = await component(async () => {
        const c = window.ng.getComponent(document.querySelector('app-address-map')), map = c.map;
        map.jumpTo({ center: [38.245099, 55.577276], zoom: 18, pitch: 0, bearing: 0 });
        await new Promise(resolve => setTimeout(resolve, 800));
        const saved = c.markers().find(marker => marker.id === 7), lines = c.connections();
        const frame = () => new Promise(resolve => {
            map.once('render', () => {
                const canvas = map.getCanvas(), p = map.project([saved.longitude, saved.latitude]);
                const footprint = c.connectionFootprints().find(f => Math.hypot(f.center.x-p.x,f.center.y-p.y) < 4);
                // Check the actual glyph/container interior, not transparent
                // outer padding where a cable is expected to be visible.
                const size = Math.floor(Math.min(20,footprint.width-4,footprint.height-4));
                const scale = canvas.width / canvas.clientWidth, out = document.createElement('canvas'); out.width = size * scale; out.height = size * scale;
                const ctx = out.getContext('2d'); ctx.drawImage(canvas, (p.x - size/2) * scale, (p.y - size/2) * scale, out.width, out.height, 0, 0, out.width, out.height);
                resolve(Array.from(ctx.getImageData(0, 0, out.width, out.height).data));
            }); map.triggerRepaint();
        });
        const results = [];
        for (const [shape, background] of [['circle', .3], ['rounded', .2], ['pill', .3], ['icon', 0]]) {
            c.markers.update(markers => markers.map(marker => marker.id === 7 ? { ...marker, marker_shape: shape, background_enabled: background > 0, background_opacity: background, border_enabled: false } : marker));
            await new Promise(resolve => setTimeout(resolve, 450));
            c.connectionLayer.setConnections(lines, 1); await new Promise(resolve => setTimeout(resolve, 350)); const withLine = await frame();
            const ids = ['connection-selected-halo',...['unknown','aerial','duct','direct_buried','facade','indoor'].map(method=>'connection-method-'+method)];
            const opacity = ids.map(id=>map.getPaintProperty(id,'line-opacity'));
            // Hide only cable paint, retaining text placement, hit-testing
            // and marker layout so the comparison cannot move labels.
            for(const id of ids) map.setPaintProperty(id,'line-opacity',0);
            await new Promise(resolve => setTimeout(resolve, 350)); const without = await frame();
            const changed = withLine.filter((value, index) => Math.abs(value - without[index]) > 2).length;
            results.push({ shape, changedPixels: changed / 4 });
            ids.forEach((id,index)=>map.setPaintProperty(id,'line-opacity',opacity[index]));
        }
        c.markers.update(markers => markers.map(marker => marker.id === 7 ? saved : marker));
        return results;
    });
    assert(clipping.every(result => result.changedPixels === 0), JSON.stringify(clipping));
    await screenshot('transparent-marker-clipping');
    return { genericBoxSplit: true, passThroughWithoutSplit: true, boundaryWithoutNode: true, frozenPosition: frozen,
        conflictRetainsForm: true, rendering, clipping };
}
