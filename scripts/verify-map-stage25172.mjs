// Reproducible real-WebGL visual checks. No requests reach Yandex or a real API.
// npm start -- --port 4217 --host 127.0.0.1
// node scripts/verify-map-stage25172.mjs
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

const base = process.env.MAP_VISUAL_BASE_URL || 'http://127.0.0.1:4217';
const verifySplice = process.env.MAP_VERIFY_SPLICE === '1';
const out = new URL(verifySplice ? '../docs/verification/map-splice/' : '../docs/verification/stage25.17.2/', import.meta.url);
await mkdir(out, { recursive: true });
const date = '2026-10-28T00:00:00Z';
const appearance = { icon_name: 'map-house', label_text: 'Дом 53', icon_color: '#E3EAF3', icon_opacity: 1, text_color: '#E3EAF3', text_opacity: 1, background_enabled: true, background_color: '#222E3E', background_opacity: 1, border_enabled: true, border_color: '#3B485A', border_width: 1, border_opacity: 1, marker_opacity: 1, marker_size: 'normal', marker_shape: 'circle' };
const house = { id: 42, address_object_id: 12, number: '53', corpus: null, structure: null, latitude: 55.577276, longitude: 38.245099, full_address: 'г. Раменское, ул. Гагарина, д. 53', created_at: date, updated_at: date };
const marker = { ...appearance, id: 7, company_id: 1, owner_user_id: null, visibility: 'company', point_type: 'building', building_link_role: 'represents', building_id: 42, building_full_address: house.full_address, name: 'Дом 53', description: null, latitude: house.latitude, longitude: house.longitude, version: 1, can_manage: true, sync_building_coordinates: false, created_at: date, updated_at: date };
const objects = [
    { id: 11, parent_id: null, type_id: 1, type_code: 'city', type_category: 'locality', type_name: 'Город', type_short_name: 'г.', name: 'Раменское', created_at: date, updated_at: date },
    { id: 12, parent_id: 11, type_id: 2, type_code: 'street', type_category: 'thoroughfare', type_name: 'Улица', type_short_name: 'ул.', name: 'Гагарина', created_at: date, updated_at: date },
];
const node = { ...marker, id: 8, building_id: null, building_full_address: null, point_type: 'network_node', building_link_role: 'none', icon_name: 'network-node', name: 'Узел связи №1', label_text: 'Узел №1', longitude: 38.249, latitude: 55.5786 };
const end = p => ({ kind: p.id === 42 ? 'building' : 'marker', id: p.id, name: p.full_address || p.name, longitude: p.longitude, latitude: p.latitude });
const line = { id: 1, company_id: 1, owner_user_id: null, visibility: 'company', name: 'Магистраль Гагарина', description: 'Оптическая трасса до узла', source: end(house), target: end(node), medium: 'fiber', status: 'active', fiber_count: 24, category: null, vertices: [[38.2459, 55.578]], version: 1, created_at: date, updated_at: date, can_manage: true, length_m: 338.9, position_missing: false, geometry: { type: 'LineString', coordinates: [[house.longitude, house.latitude], [38.2459, 55.578], [node.longitude, node.latitude]] } };
const conflict = { code: 'building_binding_conflict', confirmation_token: 'mock-confirmation-bound-to-snapshot', snapshot: { marker: null, previous_building: null, target_building: { id: 42, address: house.full_address, position: { latitude: house.latitude, longitude: house.longitude, updated_at: date } }, previous_marker: { id: 7, name: 'Дом 53', version: 1 }, requested_name: 'Дом 53 — новый стиль', requested_position: null } };
line.geometry_token = 'a'.repeat(64);

// A local neutral street-grid raster, encoded without another graphics package.
function png() {
    const crc = bytes => { let c = -1; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
    const chunk = (type, data) => { const name = Buffer.from(type); const n = Buffer.alloc(4); n.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([n, name, data, sum]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(256); ihdr.writeUInt32BE(256, 4); ihdr[8] = 8; ihdr[9] = 6;
    const raw = Buffer.alloc(256 * (256 * 4 + 1));
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const i = y * 1025 + 1 + x * 4; const road = (x % 64 < 6 || y % 64 < 6); raw[i] = road ? 244 : 225; raw[i + 1] = road ? 245 : 231; raw[i + 2] = road ? 247 : 233; raw[i + 3] = 255; }
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const tile = png();
const browser = await chromium.launch({ executablePath: process.env.MAP_VISUAL_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'] });
const results = [];
try {
    for (const theme of ['light', 'dark']) for (const dpr of [1, 2]) {
        console.log('Verifying', theme, 'DPR', dpr);
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr, colorScheme: theme });
        const page = await context.newPage();
        const errors = []; const unknownApi = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error' && !message.text().includes('status of 409 (Conflict)')) errors.push(message.text()); });
        const markers = [structuredClone(marker), structuredClone(node), ...['cabinet','splice','pole','chamber','equipment','note'].map((icon, i) => ({ ...node, id: 10 + i, point_type: icon, icon_name: icon, name: ['Шкаф','Муфта','Опора','Колодец','Оборудование','Заметка'][i], label_text: ['Шкаф','Муфта','Опора','Колодец','Оборудование','Заметка'][i], visibility: icon === 'note' ? 'private' : 'company', owner_user_id: icon === 'note' ? 1 : null, longitude: 38.241 + (i % 3) * 0.003, latitude: 55.574 + Math.floor(i / 3) * 0.0013 }))];
        if (theme === 'light') for (const point of markers) Object.assign(point, { icon_color: '#465366', background_color: '#FFFFFF', border_color: '#DAE1EB', text_color: '#465366' });
        let styles = [{ id: 1, company_id: 1, owner_user_id: 1, version: 1, name: 'Мой спокойный стиль', appearance: { ...appearance, icon_name: 'network-node' }, created_at: date, updated_at: date }];
        let lines = [structuredClone(line)];
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith('/map/tiles/')) return route.fulfill({ contentType: 'image/png', body: tile });
            if (url.pathname.startsWith('/api/v1/')) {
                const path = url.pathname.slice(7); const method = route.request().method();
                let body;
                if (path === '/setup/status') body = { state: 'installed', setup_allowed: false, has_users: true, has_companies: true, has_memberships: true, has_administrator: true };
                else if (path === '/auth/refresh') body = { access_token: 'local-visual-test', token_type: 'bearer', expires_in: 600 };
                else if (path === '/auth/me') body = { id: 1, username: 'map-visual', is_active: true, is_system_admin: false, created_at: date, updated_at: date };
                else if (path === '/me/companies') body = [{ id: 1, name: 'Xarionix — проверка карты', short_name: 'Xarionix', is_active: true }, { id: 2, name: 'Компания Б', short_name: 'Б', is_active: true }];
                else if (path === '/me/permissions') body = { permissions: ['addresses.read', 'addresses.manage'], scopes: { 'addresses.read': 'company', 'addresses.manage': 'company' } };
                else if (path === '/address-types') body = objects.map(o => ({ id: o.type_id, code: o.type_code, name: o.type_name, short_name: o.type_short_name, category: o.type_category, is_system: true, sort_order: o.id, created_at: date, updated_at: date }));
                else if (path === '/address-objects/tree') body = [{ ...objects[0], children: [{ ...objects[1], children: [] }] }];
                else if (path === '/address-objects') body = objects.filter(o => o.parent_id === (url.searchParams.has('parent_id') ? Number(url.searchParams.get('parent_id')) : null));
                else if (/^\/address-objects\/\d+$/.test(path)) body = objects.find(o => o.id === Number(path.split('/').at(-1)));
                else if (path === '/address-objects/12/buildings') body = [house];
                else if (path === '/buildings/42') body = house;
                else if (path.endsWith('/entrances') || path.endsWith('/locations')) body = [];
                else if (path === '/map/session') body = { tile_url_template: '/map/tiles/{z}/{x}/{y}.png?expires=9999999999&signature=local', expires_at: 9999999999, tile_size: 256, min_zoom: 0, max_zoom: 20, default_latitude: 55.577, default_longitude: 38.246, default_zoom: 16 };
                else if (path === '/map/buildings') body = { type: 'FeatureCollection', features: [house, ...Array.from({ length: 8 }, (_, i) => ({ ...house, id: 50 + i, longitude: 38.25 + i * 0.000015, latitude: 55.575 }))].map(h => ({ type: 'Feature', id: h.id, properties: { id: h.id, address_object_id: 12, number: h.number, corpus: null, structure: null, full_address: h.full_address }, geometry: { type: 'Point', coordinates: [h.longitude, h.latitude] } })) };
                else if (path === '/map/markers' && method === 'POST') return route.fulfill({ status: 409, json: { detail: conflict } });
                else if (path === '/map/markers') body = markers;
                else if (path === '/map/buildings/42/marker') body = markers[0];
                else if (/^\/map\/markers\/\d+$/.test(path)) body = markers.find(m => m.id === Number(path.split('/').at(-1)));
                else if (path === '/map/connections' && method === 'POST') {
                    const data = route.request().postDataJSON();
                    body = { ...line, ...data, id: 2, source: data.source.kind === 'building' ? end(house) : end(node), target: data.target.kind === 'building' ? end(house) : end(node) };
                    lines.push(body);
                }
                else if (path === '/map/connections') body = lines;
                else if (/^\/map\/connections\/\d+\/split$/.test(path) && method === 'POST') {
                    const id = Number(path.split('/').at(-2)), data = route.request().postDataJSON();
                    const original = lines.find(line => line.id === id), coordinates = original.geometry.coordinates;
                    const point = [data.position.longitude, data.position.latitude];
                    const splice = { ...node, ...data.marker, id: 9000, point_type: 'splice', name: data.marker.name,
                        visibility: original.visibility, owner_user_id: original.owner_user_id, latitude: point[1], longitude: point[0] };
                    const firstGeometry = [...coordinates.slice(0, data.segment_index + 1), point];
                    const secondGeometry = [point, ...coordinates.slice(data.segment_index + 1)];
                    const first = { ...original, target: end(splice), vertices: firstGeometry.slice(1,-1), geometry: { type: 'LineString', coordinates: firstGeometry }, version: original.version + 1, geometry_token: 'b'.repeat(64) };
                    const second = { ...original, id: 9000, source: end(splice), vertices: secondGeometry.slice(1,-1), geometry: { type: 'LineString', coordinates: secondGeometry }, version: 1, geometry_token: 'c'.repeat(64) };
                    lines = [...lines.filter(line => line.id !== id), first, second]; markers.push(splice);
                    return route.fulfill({ status: 201, json: { marker: splice, connections: [first, second] } });
                }
                else if (/^\/map\/connections\/\d+$/.test(path)) {
                    const id = Number(path.split('/').at(-1));
                    if (method === 'DELETE') { lines = lines.filter(l => l.id !== id); return route.fulfill({ status: 204 }); }
                    const index = lines.findIndex(l => l.id === id);
                    lines[index] = { ...lines[index], ...route.request().postDataJSON(), version: lines[index].version + 1, source: end(house), target: end(node) };
                    body = lines[index];
                }
                else if (path === '/map/marker-styles') { if (method === 'POST') styles.push({ ...styles[0], ...route.request().postDataJSON(), id: 2 }); body = method === 'POST' ? styles.at(-1) : styles; }
                else if (path === '/map/endpoints') body = { items: [end(house), end(node)].filter(item => (url.searchParams.get('q') || '').toLocaleLowerCase('ru').split(/\s+/).every(token => item.name.toLocaleLowerCase('ru').includes(token))), has_more: false, offset: 0, limit: 20 };
                else if (path.includes('/bounds')) body = { bounds: { west: 38.24, south: 55.574, east: 38.252, north: 55.58 }, building_count: 9 };
                else { unknownApi.push(method + ' ' + path); return route.fulfill({ status: 404, json: { detail: 'Unexpected visual fixture endpoint' } }); }
                return route.fulfill({ json: body });
            }
            if (!url.href.startsWith(base) && !url.href.startsWith('data:') && !url.href.startsWith('blob:')) return route.fulfill({ contentType: 'text/css', body: '' });
            return route.continue();
        });
        await page.goto(base + '/addresses');
        await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
        await page.getByTestId('open-address-map').click();
        await page.waitForFunction(() => {
            const element = document.querySelector('app-address-map');
            const c = element && window.ng?.getComponent(element);
            return c?.state() === 'ready' && c.map.getLayer('connection-active') && c.map.hasImage('xarionix-building-marker') && c.map.queryRenderedFeatures({ layers: ['custom-marker-points'] }).length > 0;
        }, undefined, { timeout: 12000 }).catch(async error => { await page.screenshot({ path: new URL('failure.png', out).pathname }); console.log('map failed', errors, unknownApi, page.url(), await page.locator('body').innerText(), await page.evaluate(() => { const e = document.querySelector('app-address-map'); const c = e && window.ng.getComponent(e); return { state: c?.state(), images: c?.map?.listImages(), loaded: c?.map?.loaded(), markers: c?.markers() }; })); throw error; });
        const component = fn => page.evaluate(fn);
        await component(() => window.ng.getComponent(document.querySelector('app-address-map')).map.jumpTo({ center: [38.2455,55.5763], zoom: 15.3 }));
        const screenshot = async name => { await page.waitForTimeout(450); await page.screenshot({ path: new URL(`${theme}-dpr${dpr}-${name}.png`, out).pathname, fullPage: true }); };
        await screenshot('overview');
        const rendered = await component(() => {
            const c = window.ng.getComponent(document.querySelector('app-address-map'));
            const map = c.map;
            const button = document.querySelector('[data-testid="add-map-marker"]');
            return { layers: map.getStyle().layers.map(l => l.id), labels: map.queryRenderedFeatures({ layers: ['custom-marker-labels', 'connection-labels'] }).length, images: map.listImages().length, fontLoaded: document.fonts.check('13px "Golos Text"'), toolbarColor: getComputedStyle(button).color, rootColor: getComputedStyle(document.body).color };
        });
        assert(rendered.labels > 0, 'Cyrillic MapLibre symbol labels must be rendered');
        assert.equal(new Set(rendered.layers).size, rendered.layers.length);
        assert.equal(rendered.toolbarColor, rendered.rootColor, 'Map toolbar must respect the active ERP foreground token');
        await component(() => window.ng.getComponent(document.querySelector('app-address-map')).map.jumpTo({ zoom: 14 }));
        await page.waitForTimeout(900);
        const clusters = await component(() => window.ng.getComponent(document.querySelector('app-address-map')).map.queryRenderedFeatures({ layers: ['building-cluster-count', 'custom-marker-cluster-count'] }).length);
        assert(clusters > 0, 'Actual MapLibre cluster text must be rendered');
        await screenshot('clusters');
        await component(() => window.ng.getComponent(document.querySelector('app-address-map')).map.jumpTo({ zoom: 15.3 }));
        await component(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); c.showBuildingPopup([38.245099,55.577276],42,'г. Раменское, ул. Гагарина, д. 53'); });
        await screenshot('selected-house');
        await component(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); c.openConnectionPopup(1); });
        await screenshot('connection');
        await component(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); c.closePopup(); c.startEditMarker(c.markers().find(m => m.id === 8)); });
        await page.getByRole('tab', { name: 'Оформление', exact: true }).click();
        await page.getByRole('textbox', { name: 'Название личного стиля' }).fill('Стиль после перезагрузки');
        await page.getByRole('button', { name: 'Сохранить как мой стиль', exact: true }).click();
        await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).personalStyles().length === 2);
        await screenshot('editor-style');
        const equalPixels = await page.evaluate(async () => {
            const c = window.ng.getComponent(document.querySelector('app-address-map'));
            const preview = document.querySelector('[data-testid="marker-live-preview"] img');
            await preview.decode();
            const canvas = document.createElement('canvas'); canvas.width = preview.naturalWidth * 2; canvas.height = preview.naturalHeight * 2;
            const ctx = canvas.getContext('2d'); ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
            const expected = ctx.getImageData(0,0,canvas.width,canvas.height).data;
            const feature = c.map.queryRenderedFeatures({ layers: ['custom-marker-points'] }).find(f => Number(f.properties.id) === 8);
            const saved = c.map.getImage(feature.properties.image_key).data;
            return expected.length === saved.data.length && expected.every((value, index) => value === saved.data[index]);
        });
        assert(equalPixels, 'Saved sprite pixels must equal the editor SVG rasterization at 2x');
        await component(() => window.ng.getComponent(document.querySelector('app-address-map')).startPointSelection());
        await screenshot('drag-preview');
        const dragOffset = await page.evaluate(() => {
            const c = window.ng.getComponent(document.querySelector('app-address-map'));
            const element = document.querySelector('.maplibregl-marker').getBoundingClientRect();
            const container = c.map.getContainer().getBoundingClientRect();
            const point = c.map.project(c.placementMarker.getLngLat());
            return Math.hypot(element.x + element.width / 2 - container.x - point.x, element.y + element.height / 2 - container.y - point.y);
        });
        assert(dragOffset < 1, 'Drag-preview centre must match its geographic point');
        await page.keyboard.press('Escape');
        await page.getByTestId('map-marker-dialog').waitFor();
        await component(() => { const c = window.ng.getComponent(document.querySelector('app-address-map')); c.markerDialog().close({}); c.editingMarker.set(null); c.markerDraft.set({ ...c.markerDraft(), name: 'Дом 53 — новый стиль', point_type: 'building', building_link_role: 'represents', building_id: 42, visibility: 'company' }); c.saveMarker(); });
        await page.getByText('Перепривязать дом?', { exact: true }).waitFor();
        await screenshot('binding-conflict');
        await page.getByRole('alertdialog').getByRole('button', { name: 'Отмена', exact: true }).click();
        if (theme === 'dark' && dpr === 1) {
            await page.getByTestId('add-map-connection').click();
            const inputs = page.locator('app-map-endpoint-picker input');
            await inputs.nth(0).fill('Гагарина');
            await page.getByRole('option', { name: house.full_address, exact: true }).click();
            await inputs.nth(1).fill('Узел');
            await page.getByRole('option', { name: node.name, exact: true }).waitFor();
            await inputs.nth(1).press('Enter');
            await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).connectionDraft().target?.id === 8);
            await page.locator('#connection-name').fill('Проверка создания линии');
            await page.locator('#connection-fibers').fill('24');
            await page.getByRole('button', { name: 'Сохранить соединение', exact: true }).click();
            await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).connections().length === 2);
            await component(() => window.ng.getComponent(document.querySelector('app-address-map')).openConnectionPopup(2));
            await page.getByRole('button', { name: 'Изменить', exact: true }).click();
            await page.locator('#connection-name').fill('Исправленное название линии');
            await page.getByRole('button', { name: 'Сохранить соединение', exact: true }).click();
            await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).connections().some(l => l.name === 'Исправленное название линии'));
            await component(() => window.ng.getComponent(document.querySelector('app-address-map')).openConnectionPopup(2));
            await page.getByRole('button', { name: 'Удалить', exact: true }).click();
            await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить', exact: true }).click();
            await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).connections().length === 1);
            assert.equal(markers.length, 8, 'Deleting a route must keep its endpoint objects');
            // Real MapLibre processing of 1000 additional points reuses the
            // same atlas images and creates no per-point DOM/Angular views.
            markers.push(...Array.from({ length: 1000 }, (_, i) => ({ ...node, id: 1000 + i, latitude: 55.572 + (i % 25) * .0002, longitude: 38.238 + Math.floor(i / 25) * .0003 })));
            await component(() => window.ng.getComponent(document.querySelector('app-address-map')).retryViewport());
            await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-address-map')).markers().length === 1008);
            await page.waitForTimeout(1000);
            const resources = await component(() => ({ images: window.ng.getComponent(document.querySelector('app-address-map')).map.listImages().length, domMarkers: document.querySelectorAll('.maplibregl-marker').length }));
            assert(resources.images <= 20 && resources.domMarkers === 0);
            rendered.thousandPointResources = resources;
        }
        if (verifySplice) {
            const { verifyMapSplice } = await import('./verify-map-splice.mjs');
            rendered.spliceChecks = await verifyMapSplice(page, screenshot);
        }
        await page.getByTestId('close-address-map').click();
        await page.getByTestId('address-map').waitFor({ state: 'detached' });
        await page.getByTestId('open-address-map').click();
        await page.waitForFunction(() => { const e = document.querySelector('app-address-map'); const c = e && window.ng.getComponent(e); return c?.state() === 'ready' && c.personalStyles().some(s => s.name === 'Стиль после перезагрузки'); }).catch(async error => { console.log('Reopen failed', errors, unknownApi, await page.evaluate(() => { const e = document.querySelector('app-address-map'); const c = e && window.ng.getComponent(e); return { url: location.href, state: c?.state(), setupError: c?.setupError(), styles: c?.personalStyles(), body: document.body.innerText }; })); throw error; });
        const reopenedLayers = await component(() => window.ng.getComponent(document.querySelector('app-address-map')).map.getStyle().layers.map(l => l.id));
        assert.equal(new Set(reopenedLayers).size, reopenedLayers.length);
        await page.reload();
        await page.getByTestId('open-address-map').waitFor();
        await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
        await page.getByTestId('open-address-map').click();
        await page.waitForFunction(() => { const e = document.querySelector('app-address-map'); const c = e && window.ng.getComponent(e); return c?.personalStyles().some(s => s.name === 'Стиль после перезагрузки'); });
        assert.deepEqual(unknownApi, [], 'All application requests must be covered by local fixtures');
        assert.deepEqual(errors, [], 'Browser must have no rendering errors');
        results.push({ theme, dpr, ...rendered, clusters, equalPixels, dragOffset, errors, unknownApi });
        await context.close();
    }
} catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
        await page.screenshot({ path: new URL('failure.png', out).pathname, fullPage: true }).catch(() => {});
        console.log('Browser failure', page.url(), await page.locator('body').innerText().catch(() => ''));
    }
    throw error;
} finally { await browser.close(); }
await writeFile(new URL('browser-results.json', out), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
