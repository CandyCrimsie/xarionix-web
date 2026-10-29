import assert from 'node:assert/strict';

// Extends the existing real-MapLibre browser runner; all data stays local.
export async function installWorkspaceFixtures(page, data) {
    const state = { active: false, layers: [], memberships: new Map(), passports: new Map(), preferences: new Map(), reads: 0, writes: 0, failPassport: false };
    const defaults = () => ({ schema_version: 1, show_buildings: true, show_infrastructure: true, show_personal: true, point_types: [], point_types_enabled: false, visible_layer_ids: [], include_unassigned: true, medium: 'all', status: 'all', installation: 'all', connection_mode: 'viewport' });
    const company = route => Number(route.request().headers()['x-company-id'] || 1);
    const members = (kind, id) => state.memberships.get(`${kind}:${id}`) || [];
    const selected = (url, kind, record) => {
        if (url.searchParams.get('point_types_enabled') === 'true' && !url.searchParams.getAll('point_types').includes(kind === 'building' ? 'building' : record.point_type)) return false;
        const assigned = members(kind, record.id), ids = url.searchParams.getAll('layer_ids').map(Number);
        return url.searchParams.get('layers_active') !== 'true' || assigned.some(id => ids.includes(id)) || (!assigned.length && url.searchParams.get('include_unassigned') !== 'false');
    };
    await page.route('**/api/v1/map/**', async route => {
        const url = new URL(route.request().url()), path = url.pathname.slice(7), method = route.request().method();
        if (path === '/map/preferences') {
            const key = company(route), current = state.preferences.get(key) || { version: 0, settings: defaults(), notice: null };
            if (method === 'PUT') {
                const request = route.request().postDataJSON();
                if (request.expected_version !== current.version) return route.fulfill({ status: 409, json: { detail: { code: 'version_conflict', message: 'Настройки изменены' } } });
                state.writes++; state.preferences.set(key, { ...current, version: current.version + 1, settings: request.settings });
            }
            return route.fulfill({ json: state.preferences.get(key) || current });
        }
        if (!state.active) return route.fallback();
        if (path === '/map/layers') {
            if (method === 'POST') state.layers.push({ ...route.request().postDataJSON(), id: 101 + state.layers.length, version: 1 });
            return route.fulfill({ json: method === 'POST' ? state.layers.at(-1) : state.layers });
        }
        const layerMatch = path.match(/^\/map\/layers\/(\d+)(\/members)?$/);
        if (layerMatch) {
            const id = Number(layerMatch[1]), layer = state.layers.find(value => value.id === id);
            if (method === 'DELETE') { state.layers = state.layers.filter(value => value.id !== id); for (const [key, ids] of state.memberships) state.memberships.set(key, ids.filter(value => value !== id)); return route.fulfill({ status: 204 }); }
            const payload = route.request().postDataJSON();
            if (layerMatch[2]) {
                const key = `${payload.target.kind}:${payload.target.id}`, old = state.memberships.get(key) || [];
                state.memberships.set(key, payload.present ? [...new Set([...old, id])] : old.filter(value => value !== id));
            } else Object.assign(layer, payload);
            layer.version++; return route.fulfill({ json: layer });
        }
        const passportMatch = path.match(/^\/map\/passports\/(building|marker|connection)\/(\d+)$/);
        if (passportMatch) {
            const kind = passportMatch[1], id = Number(passportMatch[2]), key = `${kind}:${id}`;
            const source = kind === 'building' ? data.house : kind === 'marker' ? data.markers.find(item => item.id === id) : data.getLines().find(item => item.id === id);
            const initial = { entity: { ...source, kind, company_name: 'Xarionix — проверка карты', point_type: kind === 'connection' ? 'connection' : kind === 'building' ? 'building' : source.point_type,
                name: source.name || source.full_address, version: source.version ?? null, status: source.status ?? null, installation_methods: source.installation_methods || ['unknown', 'duct'] },
                version: 0, can_manage: true, notice: null,
                data: { inventory_number: null, purpose: null, note: null, commissioned_on: null, operational_status: null, specs: { kind: kind === 'building' ? 'building' : ['pole', 'cabinet'].includes(source.point_type) ? source.point_type : 'general' } } };
            const record = state.passports.get(key) || initial;
            if (method === 'PUT') {
                if (state.failPassport) { state.failPassport = false; return route.fulfill({ status: 409, json: { detail: { code: 'version_conflict', message: 'Объект изменён в другой вкладке. Введённый текст сохранён.' } } }); }
                const request = route.request().postDataJSON(); Object.assign(record, { data: request.data, version: record.version + 1 });
                for (const field of ['name', 'description', 'status']) if (field in request) { record.entity[field] = request[field]; source[field] = request[field]; }
                record.entity.version = (record.entity.version || 0) + 1; source.version = record.entity.version; state.passports.set(key, record);
            }
            return route.fulfill({ json: { ...record, layers: state.layers.filter(layer => members(kind, id).includes(layer.id)) } });
        }
        if (path === '/map/connections' && method === 'GET') {
            state.reads++;
            const kind = url.searchParams.get('endpoint_kind'), id = Number(url.searchParams.get('endpoint_id'));
            return route.fulfill({ json: data.getLines().filter(record => selected(url, 'connection', record) && (!kind || [record.source, record.target].some(end => end.kind === kind && end.id === id))) });
        }
        if (path === '/map/markers' && method === 'GET') return route.fulfill({ json: data.markers.filter(record => selected(url, record.building_link_role === 'represents' ? 'building' : 'marker', record.building_link_role === 'represents' ? { ...record, id: record.building_id } : record)) });
        if (path === '/map/buildings') return route.fulfill({ json: { type: 'FeatureCollection', features: selected(url, 'building', data.house) ? [{ type: 'Feature', id: data.house.id, properties: data.house, geometry: { type: 'Point', coordinates: [data.house.longitude, data.house.latitude] } }] : [] } });
        return route.fallback();
    });
    state.activate = () => { state.active = true; data.setLines([structuredClone(data.line)]); };
    return state;
}

export async function verifyMapWorkspace(page, screenshot, fixture) {
    const evaluate = callback => page.evaluate(callback);
    const component = () => window.ng.getComponent(document.querySelector('app-address-map'));
    fixture.activate();
    await evaluate(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); c.workspace.reloadLayers(); c.retryViewport(); });
    await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).connections().length > 0);
    // Real top popovers: only one, keyboard/outside closing, not bottom duplicates.
    await page.getByTestId('map-filters-toggle').click(); await page.getByTestId('map-filters').waitFor();
    await screenshot('workspace-filters');
    await page.getByTestId('map-layers-toggle').click(); await page.getByTestId('map-layers').waitFor();
    await page.getByTestId('map-filters').waitFor({ state: 'detached' });
    await page.getByTestId('create-map-layer').click(); await page.getByTestId('map-layer-editor').waitFor();
    await page.getByRole('textbox', { name: 'Название', exact: true }).fill('Проект Север');
    await page.getByTestId('save-map-layer').click(); await page.getByTestId('map-layer-editor').waitFor({ state: 'detached' });
    assert.equal(fixture.layers.length, 1);
    await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).activePanel.set(null));
    // Same map and camera through several portal moves; nested Escape only closes top layer.
    await evaluate(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); window.__workspaceMap = c.map; c.map.jumpTo({ center: [38.246, 55.577], zoom: 15.5, bearing: 17, pitch: 12 }); });
    const camera = await evaluate(() => { const m = window.__workspaceMap; return [m.getCenter().lng, m.getCenter().lat, m.getZoom(), m.getBearing(), m.getPitch()]; });
    for (let round = 0; round < 3; round++) {
        await page.getByRole('button', { name: 'Развернуть карту', exact: true }).click();
        assert.equal(await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).expanded()), true);
        await page.getByTestId('map-legend-toggle').click();
        await screenshot(round === 0 ? 'workspace-expanded-legend' : `workspace-expanded-${round}`);
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
        assert.equal(await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).expanded()), true);
        if (round === 0) {
            await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).openPassport({ kind: 'marker', id: 8 }));
            await page.getByTestId('map-passport').waitFor(); await screenshot('workspace-passport-view');
            await page.keyboard.press('Escape'); await page.getByTestId('map-passport').waitFor({ state: 'detached' });
            assert.equal(await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).expanded()), true);
        }
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !window.ng.getComponent(document.querySelector('app-address-map')).expanded());
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Развернуть карту');
        assert.equal(await evaluate(() => window.__workspaceMap === window.ng.getComponent(document.querySelector('app-address-map')).map), true);
    }
    const afterCamera = await evaluate(() => { const m = window.__workspaceMap; return [m.getCenter().lng, m.getCenter().lat, m.getZoom(), m.getBearing(), m.getPitch()]; });
    afterCamera.forEach((value, index) => assert(Math.abs(value - camera[index]) < 1e-8));
    // Passport draft survives API conflict; membership uses same object and layer versions.
    await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).openPassport({ kind: 'marker', id: 8 }));
    await page.getByTestId('edit-map-passport').click();
    await page.getByRole('textbox', { name: 'Примечание', exact: true }).fill('Проверенный узел проекта Север');
    fixture.failPassport = true; await page.getByTestId('save-map-passport').click();
    await page.getByRole('alert').filter({ hasText: 'Объект изменён' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Примечание', exact: true }).inputValue(), 'Проверенный узел проекта Север');
    await screenshot('workspace-passport-conflict');
    await page.getByTestId('save-map-passport').click(); await page.getByTestId('edit-map-passport').waitFor();
    await page.getByTestId('map-passport').getByText('Проект Север', { exact: true }).click();
    await page.waitForFunction(() => !window.ng.getComponent(document.querySelector('app-map-passport')).membershipSaving());
    assert.deepEqual(fixture.memberships.get('marker:8'), [101]);
    await page.getByTestId('map-passport').getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByTestId('map-passport').waitFor({ state: 'detached' });
    // All off really empties SQL-filtered sources, and doesn't resurrect selected house.
    await evaluate(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); c.workspace.update({ visible_layer_ids: [], include_unassigned: false }); });
    await page.waitForFunction(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); return c.markers().length === 0 && c.viewportBuildings.features.length === 0 && c.connections().length === 0; });
    await screenshot('workspace-all-off');
    await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).workspace.update({ visible_layer_ids: [101], include_unassigned: true }));
    await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).connections().length > 0);
    // Hidden unloads sources/references; pan does not read cable geometry; enable reads afresh.
    await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).requestConnectionMode('hidden'));
    await page.waitForFunction(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); return c.connections().length === 0; });
    const reads = fixture.reads;
    await evaluate(() => { const m = window.__workspaceMap; m.jumpTo({ center: [38.2464, 55.5774], zoom: 15.4 }); });
    await page.waitForTimeout(650); assert.equal(fixture.reads, reads);
    assert.equal(await evaluate(() => window.__workspaceMap.queryRenderedFeatures({ layers: ['connection-hit-target'] }).length), 0);
    await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).showBuildingPopup([38.245099,55.577276], 42, 'Дом 53'));
    await page.waitForTimeout(200); assert.equal(fixture.reads, reads);
    await page.getByRole('button', { name: 'Показать связи', exact: true }).click();
    await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).connections().length === 1);
    assert(fixture.reads > reads);
    assert.equal(await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).workspace.settings().connection_mode), 'object');
    await screenshot('workspace-object-mode');
    await evaluate(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); c.closePopup(); c.requestConnectionMode('viewport'); });
    // Narrow embedded canvas and independent top panels, no horizontal page overflow.
    await page.setViewportSize({ width: 860, height: 950 });
    await page.getByTestId('map-filters-toggle').click(); await page.getByTestId('map-filters').waitFor(); await screenshot('workspace-narrow');
    assert.equal(await evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.keyboard.press('Escape'); await page.setViewportSize({ width: 1440, height: 1000 });
    // Preferences are server restored by runner's existing close/reopen/reload sequence.
    await evaluate(() => window.ng.getComponent(document.querySelector('app-address-map')).workspace.update({ medium: 'fiber' }));
    await page.waitForTimeout(650);
    assert.equal(fixture.preferences.get(1).settings.medium, 'fiber');
    return { cameraPreserved: true, sameMapInstance: true, nestedEscape: true, layerCreated: true, membership: [101], hiddenGeometryReads: 0, allOffEmpty: true, passportConflictDraftKept: true, preferenceWrites: fixture.writes, narrowOverflow: false };
}
