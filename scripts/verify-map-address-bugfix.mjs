// Browser regressions for binding / deletion. All API and raster traffic is
// intercepted by the common fixture. PostgreSQL coverage is in the backend.
import assert from 'node:assert/strict';

export async function installAddressFixtures(page, { markers, house, objects }) {
    const houses = [structuredClone(house), { ...house, id: 43, number: '55', full_address: 'г. Раменское, ул. Гагарина, д. 55 без координат', latitude: null, longitude: null }];
    const state = { active: false, requests: [], houses, markers, objects };
    await page.route('**/api/v1/**', async route => {
        if (!state.active) return route.fallback();
        const path = new URL(route.request().url()).pathname, method = route.request().method();
        if (path === '/api/v1/buildings/42' && method === 'DELETE') return route.fulfill({ status: 409, json: { detail: {
            code: 'object_has_dependencies', message: 'Невозможно удалить дом', object: { kind: 'building', id: 42 },
            dependencies: [{ type: 'map_connection', count: 2, items: [
                { id: 128, name: 'Магистраль', medium: 'fiber', source_name: 'Узел A', target_name: 'Дом 53' },
                { id: 42, name: 'Абонентская линия', medium: 'utp', source_name: 'Шкаф Ш-02', target_name: 'Дом 53' },
            ] }, { type: 'entrance', count: 2 }, { type: 'location', count: 3 }, { type: 'restricted', message: 'Есть недоступные связанные записи.' }],
        } } });
        if (path === '/api/v1/addresses/search') return route.fulfill({ json: { items: [{ kind: 'building', building: houses[1], full_address: houses[1].full_address }], total: 1, limit: 20, offset: 0 } });
        if (/^\/api\/v1\/buildings\/\d+$/.test(path)) return route.fulfill({ json: houses.find(h => h.id === Number(path.split('/').at(-1))) });
        if (path === '/api/v1/address-objects/12/buildings') return route.fulfill({ json: houses });
        if (path === '/api/v1/map/buildings') return route.fulfill({ json: { type: 'FeatureCollection', features: houses.filter(h => h.latitude !== null).map(h => ({
            type: 'Feature', id: h.id, geometry: { type: 'Point', coordinates: [h.longitude, h.latitude] }, properties: { id: h.id, address_object_id: 12, number: h.number, full_address: h.full_address },
        })) } });
        if (/^\/api\/v1\/map\/markers\/\d+$/.test(path) && method === 'PATCH') {
            const id = Number(path.split('/').at(-1)), data = route.request().postDataJSON(), marker = markers.find(marker => marker.id === id);
            state.requests.push({ method, id, payload: data });
            assert.equal(data.expected_version, marker.version);
            Object.assign(marker, data, { version: marker.version + 1 });
            if (marker.building_link_role === 'represents') {
                const building = houses.find(h => h.id === marker.building_id);
                if (data.building_position) Object.assign(building, data.building_position);
                marker.latitude = building.latitude; marker.longitude = building.longitude; marker.building_full_address = building.full_address;
            }
            return route.fulfill({ json: marker });
        }
        if (path === '/api/v1/map/markers' && method === 'POST') { state.requests.push({ method, payload: route.request().postDataJSON() }); return route.fulfill({ status: 500, json: { detail: 'Editing must not POST' } }); }
        return route.fallback();
    });
    return state;
}

export async function verifyAddressFixes(page, screenshot, state) {
    state.active = true;
    state.markers.splice(0, state.markers.length, ...state.markers.filter(marker => marker.id < 1000));
    const component = fn => page.evaluate(fn);
    await page.getByTestId('close-address-map').click();
    await page.getByTestId('address-map').waitFor({ state: 'detached' });
    await page.evaluate(({ object, house }) => {
        const c = window.ng.getComponent(document.querySelector('app-addresses'));
        c.selectedObject.set(object); c.buildings.set([house]); c.selectBuilding(house);
    }, { object: state.objects[1], house: state.houses[0] });
    for (const method of ['button', 'backdrop', 'escape']) {
        await page.getByTestId('building-actions').click(); await page.getByTestId('delete-building-action').click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить', exact: true }).click();
        const dialog = page.getByTestId('address-dependency-dialog'); await dialog.waitFor();
        assert.equal(await page.getByRole('alertdialog').count(), 1);
        assert((await dialog.innerText()).includes('Оптическая линия №128'));
        assert.equal(await dialog.locator('button').count(), 1);
        assert.equal(await page.getByTestId('address-action-error').count(), 0);
        assert.equal(await page.locator('[data-sonner-toast][data-type="error"]').count(), 0);
        if (method === 'button') { await screenshot('delete-dependencies'); await page.getByTestId('close-address-dependencies').click(); }
        if (method === 'backdrop') await page.mouse.click(20, 20);
        if (method === 'escape') await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'detached' });
        await page.waitForFunction(() => document.activeElement?.closest('[data-testid="building-actions"]') !== null);
    }
    // Keep the parent's initial house snapshot unpositioned. A successful
    // canonical mutation must update it and dismiss the old coordinate panel.
    await page.evaluate(house => {
        const c = window.ng.getComponent(document.querySelector('app-addresses')); c.selectBuilding(house);
    }, state.houses[1]);
    await page.getByTestId('open-address-map').click();
    await page.waitForFunction(() => { const element = document.querySelector('app-address-map'); const c = element && window.ng.getComponent(element); return c?.state() === 'ready' && c.markers().some(m=>m.id===10); });
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        c.map.jumpTo({ center: [38.246, 55.577], zoom: 16 }); c.startEditMarker(c.markers().find(m => m.id === 10));
    });
    await page.getByTestId('map-marker-dialog').waitFor();
    await page.locator('app-building-address-picker input').fill('55 без координат');
    await page.getByRole('option', { name: state.houses[1].full_address, exact: true }).click();
    await page.getByTestId('save-map-marker').click(); await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    assert.equal(state.requests.at(-1).method, 'PATCH'); assert.equal(state.requests.at(-1).id, 10);
    assert.equal(state.requests.at(-1).payload.building_link_role, 'reference');
    assert.equal(state.houses[1].latitude, null, 'An informational binding must not move the house');
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map')); c.startEditMarker(c.markers().find(m => m.id === 10));
    });
    await page.getByTestId('map-marker-dialog').waitFor();
    await component(() => window.ng.getComponent(document.querySelector('app-map-marker-editor')).selectPointType('building'));
    await page.getByTestId('choose-marker-point').click();
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    const p = await component(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')), rect = c.map.getContainer().getBoundingClientRect(), p = c.map.project([38.2475,55.5778]); return { x: rect.x+p.x,y:rect.y+p.y }; });
    await page.mouse.click(p.x,p.y); await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
    await page.getByTestId('map-marker-dialog').waitFor();
    await page.locator('hlm-field').filter({ has: page.locator('label', { hasText: /^Связь с домом$/ }) }).locator('hlm-select-trigger').click();
    await page.getByRole('option', { name: 'Основная метка дома', exact: true }).click();
    await screenshot('primary-binding');
    await page.getByTestId('save-map-marker').click(); await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    const payload = state.requests.at(-1).payload;
    assert.equal(state.requests.at(-1).id,10); assert.equal(payload.building_link_role,'represents');
    assert(Math.abs(payload.building_position.latitude-55.5778)<.00001);
    assert(Math.abs(state.houses[1].longitude-38.2475)<.00001);
    await page.waitForFunction(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        return !c.coordinateNotice() && c.selectedBuilding()?.latitude !== null && c.markers().some(marker => marker.id === 10 && marker.building_link_role === 'represents');
    });
    const sources = await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        return { standard:c.map.getSource('xarionix-buildings').serialize().data.features.filter(f=>f.properties.id===43).length,
            selected:c.map.getSource('xarionix-selected-building').serialize().data.features.filter(f=>f.properties.id===43).length,
            custom:c.map.getSource('xarionix-custom-markers').serialize().data.features.filter(f=>f.properties.id===10).length,
            notice:c.coordinateNotice(),placing:c.placingMarker(),editing:c.editingMarker() };
    });
    assert.equal(sources.standard+sources.selected+sources.custom,1);
    assert.equal(sources.notice,null); assert.equal(sources.placing,false); assert.equal(sources.editing,null);
    assert.equal(state.requests.filter(r=>r.method==='POST').length,0);
    await screenshot('canonical-house');
    return { singleConflictDialog: true, closeButton: true, backdrop: true, escape: true, focusRestored: true,
        patchPreservesId: true, canonicalPosition: payload.building_position, sources };
}
