// Extension to the existing real-WebGL regression fixture (no Yandex traffic).
// MAP_VERIFY_SPLICE=1 node scripts/verify-map-stage25172.mjs
import assert from 'node:assert/strict';

export async function verifyMapSplice(page, screenshot) {
    const component = fn => page.evaluate(fn);
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        c.closePopup(); c.bindingConflict.set(null);
        c.map.jumpTo({ center: [38.246, 55.578], zoom: 17, pitch: 0, bearing: 0 });
    });
    await page.waitForTimeout(700);
    const legend = page.getByTestId('map-legend-toggle');
    await legend.click(); await page.waitForFunction(() => document.querySelector('[data-testid="map-legend-toggle"]').getAttribute('aria-expanded') === 'true');
    await screenshot('legend-expanded');
    await legend.click(); await page.waitForFunction(() => document.querySelector('[data-testid="map-legend-toggle"]').getAttribute('aria-expanded') === 'false');
    const target = await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        const points = c.connections().find(line => line.id === 1).geometry.coordinates;
        const a = c.map.project(points[0]), b = c.map.project(points[1]);
        const rect = c.map.getContainer().getBoundingClientRect(), t = .37;
        const x = a.x + t * (b.x - a.x), y = a.y + t * (b.y - a.y);
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        return { x: rect.x + x, y: rect.y + y, cursorX: rect.x + x + (b.y - a.y) / length * 5,
            cursorY: rect.y + y - (b.x - a.x) / length * 5, position: c.map.unproject([x, y]).toArray() };
    });
    await page.mouse.move(target.cursorX, target.cursorY);
    const plus = page.getByTestId('insert-splice-hover');
    await plus.waitFor({ state: 'visible' });
    let box = await plus.boundingBox();
    assert(Math.hypot(box.x + box.width / 2 - target.x, box.y + box.height / 2 - target.y) < 1, 'Plus must snap exactly onto the line');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);
    assert(await plus.isVisible(), 'Plus must survive transferring the cursor onto it');
    const hoverColor=await plus.evaluate(button=>{
        const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');
        ctx.fillStyle=getComputedStyle(button).backgroundColor;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);
    });
    assert(hoverColor[0]<65&&hoverColor[1]<80&&hoverColor[2]<100&&hoverColor[3]>210,`Plus hover must retain its dark surface: ${hoverColor}`);
    await screenshot('hover-plus');
    const resting = await plus.boundingBox();
    await page.mouse.down();
    const pressed = await plus.boundingBox();
    assert(Math.hypot(resting.x - pressed.x, resting.y - pressed.y) < .1, 'Spartan active styling must not move the snapped plus');
    await page.mouse.up();
    await page.getByTestId('route-node-splice').click();
    await page.getByTestId('map-marker-dialog').waitFor();
    assert((await page.locator('app-map-marker-editor').textContent()).includes('разделит соединение'));
    assert(await page.locator('#marker-latitude').isDisabled());
    await page.getByRole('tab', { name: 'Иконка', exact: true }).click();
    await page.locator('button[data-testid="marker-icon-note"]').waitFor({ state: 'visible' });
    const grid = await page.locator('button[data-testid^="marker-icon-"]').evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect(), svg = button.querySelector('svg').getBoundingClientRect();
        return { id: button.dataset.testid, w: rect.width, h: rect.height, sw: svg.width, sh: svg.height,
            offset: Math.hypot(svg.x + svg.width / 2 - rect.x - rect.width / 2, svg.y + svg.height / 2 - rect.y - rect.height / 2) };
    }));
    assert.equal(grid.length, 14);
    assert(grid.every(icon => icon.w === 44 && icon.h === 44 && icon.sw >= 20 && icon.sw <= 24 && icon.offset < .5), JSON.stringify(grid));
    await screenshot('icon-grid');
    // Verify real browser-decoded note pixels, not merely string attributes.
    const transparency = await component(async () => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        const editor = window.ng.getComponent(document.querySelector('app-map-marker-editor'));
        const original = { ...c.markerDraft() };
        const results = [];
        for (const shape of ['circle', 'rounded', 'pill', 'icon']) {
            c.markerDraft.set({ ...original, icon_name: 'note', marker_shape: shape, background_enabled: false, border_enabled: false, icon_color: '#12AB34', icon_opacity: .4 });
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const image = new Image(); image.src = document.querySelector('[data-testid="marker-live-preview"] img').src; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
            const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const alpha = Array.from(data).filter((_, index) => index % 4 === 3);
            results.push({ shape, maxAlpha: Math.max(...alpha), clearPixels: alpha.filter(value => value === 0).length / alpha.length });
        }
        c.markerDraft.set(original);
        return results;
    });
    assert(transparency.every(result => result.maxAlpha > 0 && result.maxAlpha <= 103 && result.clearPixels > .65), JSON.stringify(transparency));
    // Cancel must not split anything.
    await component(() => window.ng.getComponent(document.querySelector('app-address-map')).markerDialog().close({}));
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    const countBefore = await component(() => window.ng.getComponent(document.querySelector('app-address-map')).connections().length);
    await page.mouse.move(target.cursorX, target.cursorY); await plus.waitFor({ state: 'visible' }); await plus.click();
    await page.getByTestId('route-node-splice').click();
    await page.getByTestId('map-marker-dialog').waitFor();
    await page.getByTestId('marker-name').fill('Муфта из hover-плюса');
    const before = await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        return { center: c.map.getCenter().toArray(), zoom: c.map.getZoom(), target: c.spliceTarget().point.position };
    });
    const request = page.waitForRequest(request => request.url().endsWith('/map/connections/1/split'));
    await page.getByTestId('save-map-marker').click();
    const payload = (await request).postDataJSON();
    assert.deepEqual([payload.position.longitude, payload.position.latitude], before.target);
    assert.equal(payload.segment_index, 0); assert(Math.abs(payload.fraction - .37) < .01);
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    const after = await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        return { center: c.map.getCenter().toArray(), zoom: c.map.getZoom(), count: c.connections().length,
            marker: c.markers().find(marker => marker.id === 9000), first: c.connections().find(line => line.id === 1), second: c.connections().find(line => line.id === 9000) };
    });
    assert.equal(after.count, countBefore + 1);
    assert.deepEqual(after.center, before.center); assert.equal(after.zoom, before.zoom);
    assert.equal(after.marker.point_type, 'splice');
    assert.equal(after.first.target.id, after.marker.id); assert.equal(after.second.source.id, after.marker.id);
    // P0: do not reload the page or wait for worker/source completion here.
    const inserted=await component(()=>{
        const c=window.ng.getComponent(document.querySelector('app-address-map'));
        const marker=c.markers().find(marker=>marker.id===9000),p=c.map.project([marker.longitude,marker.latitude]),r=c.map.getContainer().getBoundingClientRect();
        return {x:r.x+p.x,y:r.y+p.y};
    });
    await page.mouse.move(inserted.x,inserted.y);
    await page.waitForTimeout(170);
    assert.equal(await plus.count(),0,'Insertion plus must not cover a freshly inserted node without reload');
    await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-address-map')).map.queryRenderedFeatures({layers:['custom-marker-points']}).some(f=>Number(f.properties.id)===9000));
    await page.mouse.click(inserted.x,inserted.y);
    await page.getByTestId('map-marker-popup').waitFor();
    await component(()=>window.ng.getComponent(document.querySelector('app-address-map')).closePopup());
    await screenshot('splice-created');
    // Overlapping cables require an explicit choice, then confirmation of the
    // plus on the selected line (not automatic splitting of both).
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        const original = c.connections().find(line => line.id === 1);
        c.connections.update(lines => [...lines, { ...original, id: 7001, name: 'Наложенный кабель' }]);
    });
    await page.waitForTimeout(300);
    const overlap = await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        const points = c.connections().find(line => line.id === 1).geometry.coordinates;
        const a = c.map.project(points[0]), b = c.map.project(points[1]);
        const rect = c.map.getContainer().getBoundingClientRect();
        return { x: rect.x + (a.x + b.x) / 2, y: rect.y + (a.y + b.y) / 2 };
    });
    await page.mouse.move(overlap.x, overlap.y);
    await plus.waitFor({ state: 'visible' }); await plus.click();
    await page.getByRole('heading', { name: 'Выберите соединение', exact: true }).waitFor();
    await page.getByRole('button', { name: /Наложенный кабель/ }).click();
    await page.getByRole('heading', { name: 'Выберите соединение', exact: true }).waitFor({ state: 'detached' });
    await plus.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'insert-splice-hover');
    assert.equal(await component(() => window.ng.getComponent(document.querySelector('app-address-map')).spliceHover().targets[0].connection.id), 7001);
    await page.keyboard.press('Enter');
    await page.getByTestId('route-node-splice').click();
    await page.getByTestId('map-marker-dialog').waitFor();
    assert.equal(await component(() => window.ng.getComponent(document.querySelector('app-address-map')).spliceTarget().connection.id), 7001);
    await component(() => window.ng.getComponent(document.querySelector('app-address-map')).markerDialog().close({}));
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    // The card alternative works without mouse-based map positioning.
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        c.connections.update(lines => lines.filter(line => line.id !== 7001));
        c.openConnectionPopup(1);
    });
    await page.getByTestId('insert-splice-card').click();
    await page.getByRole('heading', { name: 'Место добавления объекта', exact: true }).waitFor();
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        c.spliceSegment.set(0); c.spliceFraction.set(.61);
    });
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.getByTestId('route-node-splice').click();
    await page.getByTestId('map-marker-dialog').waitFor();
    assert.equal(await component(() => window.ng.getComponent(document.querySelector('app-address-map')).spliceTarget().point.fraction), .61);
    await component(() => window.ng.getComponent(document.querySelector('app-address-map')).markerDialog().close({}));
    await page.getByTestId('map-marker-dialog').waitFor({ state: 'detached' });
    // Existing route editing suppresses the plus entirely.
    await component(() => {
        const c = window.ng.getComponent(document.querySelector('app-address-map'));
        c.startEditConnection(c.connections().find(line => line.id === 1)); c.startConnectionMap('vertices');
    });
    await page.mouse.move(overlap.x, overlap.y); await page.waitForTimeout(200);
    assert.equal(await plus.count(), 0);
    await component(() => window.ng.getComponent(document.querySelector('app-address-map')).cancelConnectionMap());
    return { grid, transparency, snapped: payload.position, cameraPreserved: true, splitTopology: true, overlapChoice: true, cardAlternative: true, hiddenDuringRouteEditing: true };
}
