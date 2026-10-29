// Real MapLibre + Spartan interactions, mocked transport only. PostgreSQL
// geometry/concurrency contract is tested separately in the backend suite.
import assert from 'node:assert/strict';

export async function verifyMapUx(page, screenshot, state) {
  const evaluate = (fn) => page.evaluate(fn);
  const base = structuredClone(state.getLines()[0]);
  const points = [
    [38.2445, 55.577],
    [38.2457, 55.5777],
    [38.247, 55.578],
    [38.2483, 55.5788],
  ];
  let line = {
    ...base,
    id: 8500,
    name: 'Прокладка с границами',
    vertices: points.slice(1, -1),
    geometry: { type: 'LineString', coordinates: points },
    installation_methods: ['aerial', 'duct', 'direct_buried'],
    version: 1,
    geometry_token: 'd'.repeat(64),
  };
  state.setLines([line]);
  state.markers.splice(
    0,
    state.markers.length,
    ...state.markers.filter((m) => m.id < 1000 || m.id >= 9000),
  );
  const edits = [];
  await page.route('**/api/v1/map/connections/8500/installation-boundaries/*', async (route) => {
    const data = route.request().postDataJSON(),
      vertex = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    edits.push(data);
    assert.equal(data.expected_version, line.version);
    assert.equal(data.expected_geometry_token, line.geometry_token);
    const boundaries = line.installation_methods.flatMap((m, i) =>
      i && m !== line.installation_methods[i - 1] ? [i] : [],
    );
    const prev = boundaries.filter((i) => i < vertex).at(-1) ?? 0,
      next = boundaries.find((i) => i > vertex) ?? line.installation_methods.length;
    let geometry = structuredClone(line.geometry.coordinates),
      methods = [...line.installation_methods];
    if (data.operation === 'set') methods.fill(data.installation_after, vertex, next);
    else if (data.operation === 'remove')
      methods.fill(methods[vertex - (data.keep === 'previous' ? 1 : 0)], prev, next);
    else {
      const target = data.segment_index + 1,
        position = [data.position.longitude, data.position.latitude];
      geometry.splice(target, 0, position);
      methods.splice(target, 0, methods[data.segment_index]);
      methods.fill(line.installation_methods[vertex - 1], prev, target);
      methods.fill(line.installation_methods[vertex], target, next + 1);
    }
    line = {
      ...line,
      vertices: geometry.slice(1, -1),
      geometry: { type: 'LineString', coordinates: geometry },
      installation_methods: methods,
      version: line.version + 1,
      geometry_token: (line.version + 1).toString(16).padStart(64, '0'),
    };
    state.setLines([line]);
    await route.fulfill({ json: line });
  });
  await evaluate(() => {
    const c = window.ng.getComponent(document.querySelector('app-address-map'));
    c.connectionDialog().close({});
    c.markerDialog().close({});
    c.closePopup();
    c.activePanel.set(null);
    c.retryViewport();
    c.map.jumpTo({ center: [38.2465, 55.578], zoom: 17, bearing: 0, pitch: 0 });
  });
  await page.waitForFunction(() =>
    window.ng
      .getComponent(document.querySelector('app-address-map'))
      .connections()
      .some((l) => l.id === 8500),
  );
  // Already persisted transitions must be visible without selecting the cable.
  await evaluate(()=>window.ng.getComponent(document.querySelector('app-address-map')).selectedConnectionId.set(null));
  await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('app-address-map')).map.queryRenderedFeatures({layers:['installation-boundary-points']}).filter(f=>Number(f.properties.connection_id)===8500).length===2);
  await screenshot('ux-existing-boundaries');
  const savedBoundary=await evaluate(()=>{
    const c=window.ng.getComponent(document.querySelector('app-address-map')),p=c.map.project(c.connections().find(l=>l.id===8500).geometry.coordinates[1]),r=c.map.getContainer().getBoundingClientRect();
    return {x:r.x+p.x,y:r.y+p.y};
  });
  await page.mouse.move(savedBoundary.x,savedBoundary.y);
  assert.equal(await page.getByTestId('insert-splice-hover').count(),0,'Existing boundary must take precedence over the plus');
  await page.mouse.click(savedBoundary.x,savedBoundary.y);await page.getByTestId('installation-boundary-menu').waitFor();
  const handleStyle=await page.getByTestId('installation-boundary-handle').first().evaluate(button=>{
    const style=getComputedStyle(button),c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=style.backgroundColor;ctx.fillRect(0,0,1,1);
    return {color:Array.from(ctx.getImageData(0,0,1,1).data),width:parseFloat(style.width),height:parseFloat(style.height),opacity:style.opacity};
  });
  assert.equal(handleStyle.color[3],255,'The boundary handle background must be opaque in both themes');
  assert(handleStyle.color[0]<65&&handleStyle.color[1]<80&&handleStyle.color[2]<100);
  assert.equal(handleStyle.width,12);assert.equal(handleStyle.height,12);assert.equal(handleStyle.opacity,'1');
  await page.keyboard.press('Escape');await page.getByTestId('installation-boundary-menu').waitFor({state:'detached'});
  await evaluate(() =>
    window.ng.getComponent(document.querySelector('app-address-map')).openConnectionPopup(8500),
  );
  await page.getByTestId('edit-installation-card').click();
  const handles = page.getByTestId('installation-boundary-handle');
  await handles.first().waitFor();
  assert.equal(await handles.count(), 2);
  const open = async () => {
    await handles.first().click();
    await page.getByTestId('installation-boundary-menu').waitFor();
  };
  await open();
  await screenshot('ux-boundary-menu');
  await page.keyboard.press('Escape');
  await page.getByTestId('installation-boundary-menu').waitFor({ state: 'detached' });
  await open();
  await page.getByRole('button', { name: 'Изменить способ после точки', exact: true }).click();
  await evaluate(() =>
    window.ng.getComponent(document.querySelector('app-address-map')).boundaryMethod.set('facade'),
  );
  await page
    .getByTestId('installation-boundary-menu')
    .getByRole('button', { name: 'Сохранить', exact: true })
    .click();
  await page.getByTestId('installation-boundary-menu').waitFor({ state: 'detached' });
  assert.deepEqual(line.installation_methods, ['aerial', 'facade', 'direct_buried']);
  await open();
  await page.getByRole('button', { name: 'Переместить границу', exact: true }).click();
  const location = await evaluate(() => {
    const c = window.ng.getComponent(document.querySelector('app-address-map')),
      p = c.connections().find((l) => l.id === 8500).geometry.coordinates;
    const a = c.map.project(p[0]),
      b = c.map.project(p[1]),
      r = c.map.getContainer().getBoundingClientRect();
    return { x: r.x + (a.x + b.x) / 2, y: r.y + (a.y + b.y) / 2 };
  });
  await page.mouse.move(location.x, location.y);
  await page.mouse.click(location.x, location.y);
  assert(
    await evaluate(
      () => !!window.ng.getComponent(document.querySelector('app-address-map')).boundaryPreview(),
    ),
    'Moving must keep a preview until explicitly saved',
  );
  await screenshot('ux-boundary-preview');
  await page
    .getByTestId('installation-edit-toolbar')
    .getByRole('button', { name: 'Сохранить', exact: true })
    .click();
  await page.waitForFunction(
    () => !window.ng.getComponent(document.querySelector('app-address-map')).activeBoundary(),
  );
  assert.equal(edits.at(-1).operation, 'move');
  assert.equal(line.geometry.coordinates.length, 5);
  for (const point of points)
    assert(line.geometry.coordinates.some((p) => JSON.stringify(p) === JSON.stringify(point)));
  // A cancellation has no transport side effects.
  const saved = JSON.stringify(line),
    count = edits.length;
  await open();
  await page.getByRole('button', { name: 'Переместить границу', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(edits.length, count);
  assert.equal(JSON.stringify(line), saved);
  await open();
  await page.getByRole('button', { name: 'Удалить границу', exact: true }).click();
  await page.getByRole('button', { name: /Следующий ·/ }).click();
  await page.waitForFunction(
    () =>
      window.ng.getComponent(document.querySelector('app-address-map')).installationHandles()
        .length === 1,
  );
  assert.equal(
    line.geometry.coordinates.length,
    5,
    'Removing metadata must not remove the former corner',
  );
  await evaluate(() => {
    const c = window.ng.getComponent(document.querySelector('app-address-map'));
    c.finishInstallationEdit();
    c.retryViewport();
  });
  await page.waitForFunction(() =>
    window.ng
      .getComponent(document.querySelector('app-address-map'))
      .connections()
      .some((l) => l.id === 8500),
  );
  await evaluate(() =>
    window.ng.getComponent(document.querySelector('app-address-map')).openConnectionPopup(8500),
  );
  await page.getByRole('button', { name: 'Изменить', exact: true }).click();
  const sections = page.getByTestId('connection-installation-sections').getByRole('button').first();
  assert.equal(await sections.getAttribute('aria-expanded'), 'false');
  await sections.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="connection-installation-sections"] button')
        .getAttribute('aria-expanded') === 'true',
  );
  await sections.click();
  const before = await evaluate(() =>
    structuredClone(
      window.ng.getComponent(document.querySelector('app-address-map')).connectionDraft(),
    ),
  );
  await page.getByRole('button', { name: 'Поменять местами', exact: true }).click();
  const after = await evaluate(() =>
    window.ng.getComponent(document.querySelector('app-address-map')).connectionDraft(),
  );
  assert.deepEqual(after.vertices, [...before.vertices].reverse());
  assert.deepEqual(after.installation_methods, [...before.installation_methods].reverse());
  assert.equal(after.source.id, before.target.id);
  await screenshot('ux-connection-editor');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByTestId('add-map-marker').click();
  await page.getByTestId('marker-name').fill('Несохранённое название');
  await page.locator('#marker-label').fill('Подпись');
  await page.getByTestId('choose-marker-point').click();
  await evaluate(() => {
    const c = window.ng.getComponent(document.querySelector('app-address-map'));
    c.placementMarker.setLngLat([38.2465, 55.578]);
    c.confirmPointSelection();
  });
  await page.getByTestId('map-marker-dialog').waitFor();
  assert.equal(await page.getByTestId('marker-name').inputValue(), 'Несохранённое название');
  assert.equal(await page.locator('#marker-label').inputValue(), 'Подпись');
  await screenshot('ux-marker-editor');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByTestId('map-layers-toggle').click();
  await page.getByRole('button', { name: 'О слоях', exact: true }).click();
  await page
    .getByText(
      'Состав слоёв общий для компании, видимость — только ваша. Объекты включённых слоёв объединяются без дубликатов.',
      { exact: true },
    )
    .waitFor();
  await page.keyboard.press('Escape');
  assert(await page.getByTestId('map-layers').isVisible(), 'Nested help must not close layers');
  await page.keyboard.press('Escape');
  await evaluate(() => {
    const c = window.ng.getComponent(document.querySelector('app-address-map'));
    window.__uxMap = c.map;
    c.selectedConnectionId.set(8500);
  });
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('expand-address-map').click();
    assert(
      await evaluate(
        () =>
          window.ng.getComponent(document.querySelector('app-address-map')).map === window.__uxMap,
      ),
    );
    await screenshot('ux-expanded-' + i);
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 420, height: 860 });
  await page.getByTestId('add-map-marker').click();
  await screenshot('ux-marker-narrow');
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Narrow screen must not overflow',
  );
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  return {
    boundaryOperations: edits.map((e) => e.operation),
    cancelPreservesDraft: true,
    geometryPreserved: true,
    spartanCollapsible: true,
    swapReversesMethods: true,
    coordinateDraftPreserved: true,
    nestedPopover: true,
    sameMapInstance: true,
    narrowOverflow: false,
  };
}
