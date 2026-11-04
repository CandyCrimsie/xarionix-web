import { expect, test, Page, APIResponse } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';

interface State {
  baseUrl: string;
  coreUrl: string;
  issuer: string;
  users: Record<string, { password: string; otp: string; subject: string; user_id: string }>;
  package: string;
  packageSha: string;
  publicKey: string;
  publisher: string;
  namespace: string;
  operatorDirectory: string;
  platform: string;
  nativeRuntime: boolean;
  deployment: {
    id: string;
    name: string;
    issuer: string;
    subject: string;
    client_id: string;
    engine_id: string;
    platform: string;
  };
}
const state = JSON.parse(fs.readFileSync(process.env['CONSOLE_E2E_STATE']!, 'utf8')) as State;
async function otp(name: string): Promise<string> {
  // The disposable Keycloak credential's secretData is raw UTF-8 (TimeBasedOTP).
  const previous = Math.floor(Date.now() / 30000);
  await expect
    .poll(() => Math.floor(Date.now() / 30000), { timeout: 35000, intervals: [250] })
    .not.toBe(previous);
  const counter = Math.floor(Date.now() / 30000);
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', state.users[name].otp).update(bytes).digest(),
    offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
async function login(page: Page, name = 'admin') {
  await page.goto('/login');
  const authorization = page.waitForRequest((r) =>
    r.url().startsWith(state.issuer + '/protocol/openid-connect/auth'),
  );
  await page.getByRole('button', { name: 'Войти через Keycloak' }).click();
  const request = await authorization,
    url = new URL(request.url());
  expect(url.searchParams.get('response_type')).toBe('code');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('state')).toBeTruthy();
  await page.locator('#username').fill(name);
  await page.locator('#password').fill(state.users[name].password);
  await page.locator('#kc-login').click();
  await page.locator('#otp').fill(await otp(name));
  await page.locator('#kc-login').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Обзор платформы' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
}
async function select(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function response(
  page: Page,
  method: string,
  pathname: string,
  action: () => Promise<unknown>,
) {
  const pending = page.waitForResponse(
    (r) => r.request().method() === method && new URL(r.url()).pathname.endsWith(pathname),
  );
  await action();
  const result = await pending;
  expect(result.ok(), `HTTP ${result.status()} for ${method} ${pathname}`).toBeTruthy();
  return result;
}
async function dialogSave(page: Page, label = 'Сохранить') {
  await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
}

test('smoke: genuine Keycloak PKCE + OTP, profile, themes, no persisted JWT, logout', async ({
  page,
}) => {
  await login(page);
  const credentials = await page.evaluate(() => ({
    local: Object.values(localStorage),
    session: Object.values(sessionStorage),
  }));
  for (const value of [...credentials.local, ...credentials.session])
    expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  await page.getByRole('button', { name: 'Меню профиля' }).click();
  await page.getByRole('menuitem', { name: 'Профиль', exact: true }).click();
  await page.getByRole('button', { name: 'Изменить имя' }).click();
  await page.getByLabel('Имя', { exact: true }).fill('Администратор Console');
  await response(page, 'PATCH', '/api/v1/me', () => dialogSave(page));
  await expect(
    page.getByRole('heading', { name: 'Администратор Console', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Светлая тема', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  fs.mkdirSync('reports/console-screenshots', { recursive: true });
  await page.screenshot({
    path: 'reports/console-screenshots/profile-light.png',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Тёмная тема', exact: true }).click();
  await page.screenshot({
    path: 'reports/console-screenshots/profile-dark.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'reports/console-screenshots/profile-mobile.png',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Меню профиля' }).click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  // Keycloak may ask for its supported RP logout confirmation when no id_token_hint is sent.
  const logout = page.locator('#kc-logout');
  if (await logout.isVisible({ timeout: 1500 }).catch(() => false)) await logout.click();
  await expect(page).toHaveURL(/\/auth\/logged-out$/);
  await page.goto('/platform/packages');
  await expect(page).toHaveURL(/\/login/);
});

test('real company CRUD, employee, invitation, RBAC role and permission persistence', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Компании', exact: true }).first().click();
  await page.getByRole('button', { name: 'Создать компанию', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Северная сеть');
  await page.getByLabel('Адресное имя', { exact: true }).fill('north-' + randomUUID().slice(0, 8));
  const created = await response(page, 'POST', '/api/v1/companies', () => dialogSave(page));
  const company = await created.json();
  await page.getByRole('link', { name: 'Северная сеть', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Северная сеть', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Сотрудники', exact: true }).first().click();
  await page.getByRole('button', { name: 'Добавить сотрудника' }).click();
  await page.getByLabel('Имя', { exact: true }).fill('Сергей Инженеров');
  await page.getByLabel('Должность', { exact: true }).fill('Сетевой инженер');
  await response(page, 'POST', `/api/v1/companies/${company.id}/employees`, () => dialogSave(page));
  await expect(page.getByRole('button', { name: 'Сергей Инженеров', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Роли и права', exact: true }).first().click();
  await page.getByRole('button', { name: 'Создать роль', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Инженер сети');
  await page.getByLabel('Код роли', { exact: true }).fill('network-engineer');
  const roleResponse = await response(page, 'POST', `/api/v1/companies/${company.id}/roles`, () =>
    dialogSave(page),
  );
  const role = await roleResponse.json();
  await page.getByRole('button', { name: 'Инженер сети', exact: true }).click();
  await page.getByRole('button', { name: 'Права роли', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const permission = page
    .getByRole('dialog')
    .locator('label')
    .filter({ hasText: 'core.employees.read' })
    .getByRole('checkbox');
  await permission.click();
  await response(page, 'PUT', `/api/v1/companies/${company.id}/roles/${role.id}/permissions`, () =>
    dialogSave(page),
  );
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Приглашения', exact: true }).first().click();
  await page.getByRole('button', { name: 'Пригласить', exact: true }).click();
  await page.getByLabel('Email получателя', { exact: true }).fill('engineer@example.test');
  const issued = await response(page, 'POST', `/api/v1/companies/${company.id}/invitations`, () =>
    dialogSave(page),
  );
  const invitation = (await issued.json()).invitation;
  await expect(page.getByLabel('Одноразовый секрет приглашения')).toHaveValue(/.{40,}/);
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(page.getByLabel('Одноразовый секрет приглашения')).not.toBeVisible();
  await page.getByRole('button', { name: 'engineer@example.test', exact: true }).click();
  await response(
    page,
    'DELETE',
    `/api/v1/companies/${company.id}/invitations/${invitation.id}`,
    () =>
      page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Подтвердить', exact: true })
        .click(),
  );
  await page.getByRole('button', { name: 'Пригласить', exact: true }).click();
  await page.getByLabel('Email получателя', { exact: true }).fill('member@example.test');
  await page
    .getByRole('dialog')
    .getByRole('checkbox', { name: /Инженер сети/ })
    .click();
  const memberInvitation = await response(
    page,
    'POST',
    `/api/v1/companies/${company.id}/invitations`,
    () => dialogSave(page),
  );
  const invitationSecret = (await memberInvitation.json()).secret as string;
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  const memberContext = await page.context().browser()!.newContext({ baseURL: state.baseUrl });
  try {
    const memberPage = await memberContext.newPage();
    await login(memberPage, 'member');
    await memberPage.getByRole('link', { name: 'Компании', exact: true }).first().click();
    await memberPage.getByRole('button', { name: 'Принять приглашение', exact: true }).click();
    await memberPage.getByLabel('Компания · UUID', { exact: true }).fill(company.id);
    await memberPage.getByLabel('Секрет приглашения', { exact: true }).fill(invitationSecret);
    await response(memberPage, 'POST', '/api/v1/invitations/accept', () => dialogSave(memberPage));
    await memberPage.getByRole('link', { name: 'Северная сеть', exact: true }).click();
    await expect(
      memberPage.getByRole('heading', { name: 'Северная сеть', exact: true }),
    ).toBeVisible();
    await expect(memberPage.getByRole('button', { name: 'Изменить', exact: true })).toHaveCount(0);
    await memberPage.getByRole('link', { name: 'Сотрудники', exact: true }).first().click();
    await expect(
      memberPage.getByRole('button', { name: 'Сергей Инженеров', exact: true }),
    ).toBeVisible();
  } finally {
    await memberContext.close();
  }
});

test('signed .xpkg upload, exact server plan approval and separate trusted executor apply', async ({
  page,
}) => {
  test.setTimeout(300000);
  await login(page);
  await page.getByRole('link', { name: 'Издатели', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить издателя' }).click();
  await page.getByLabel('Идентификатор', { exact: true }).fill(state.publisher);
  await page.getByLabel('Название', { exact: true }).fill('Тестовый издатель Console');
  await response(page, 'POST', '/api/v1/platform/package-publishers', () => dialogSave(page));
  await page.getByRole('link', { name: 'Тестовый издатель Console', exact: true }).click();
  await page.getByRole('button', { name: 'Ключ', exact: true }).click();
  await page.getByLabel('Идентификатор ключа', { exact: true }).fill('test-key');
  await page.getByLabel('Публичный ключ · Base64', { exact: true }).fill(state.publicKey);
  await dialogSave(page);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Изменить', exact: true }).click();
  await page.getByLabel('Разрешённые пространства', { exact: true }).fill(state.namespace);
  await dialogSave(page);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Пакеты', exact: true }).click();
  await page.getByLabel('Файл пакета .xpkg').setInputFiles(state.package);
  await response(page, 'POST', '/api/v1/platform/packages', () =>
    page.getByRole('button', { name: 'Загрузить пакет', exact: true }).click(),
  );
  await page.getByRole('link', { name: 'hello-console', exact: true }).click();
  const prepared = await response(page, 'POST', '/api/v1/platform/module-install-plans', () =>
    page.getByRole('button', { name: 'Подготовить установку' }).click(),
  );
  const plan = await prepared.json();
  await expect(page.getByTestId('plan-digest')).toHaveText(plan.digest);
  expect(plan.plan.package_sha256).toBe(state.packageSha);
  await page.getByRole('button', { name: 'Одобрить план', exact: true }).click();
  await response(page, 'POST', `/api/v1/platform/module-install-plans/${plan.id}/approve`, () =>
    page.getByRole('alertdialog').getByRole('button', { name: 'Одобрить', exact: true }).click(),
  );
  await expect(page.getByTestId('awaiting-trusted-executor')).toBeVisible();
  await expect(page.getByRole('button', { name: /Применить|Запустить CLI/ })).toHaveCount(0);
  // Trusted test operator is a DIFFERENT process using the real Core CLI and a restricted SQL role.
  const control = path.join(state.operatorDirectory, randomUUID() + '.request.json');
  fs.writeFileSync(control, JSON.stringify({ plan_id: plan.id, digest: plan.digest }), {
    mode: 0o600,
  });
  await expect(page.getByRole('heading', { name: 'План применён', exact: true })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole('link', { name: 'Открыть установленные модули' }).click();
  await page.getByRole('link', { name: 'hello-console', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'hello-console', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Включить', exact: true }).click();
  const enabledPlan = await response(page, 'POST', '/api/v1/platform/module-install-plans', () =>
    dialogSave(page, 'Подготовить'),
  );
  const enable = await enabledPlan.json();
  expect(enable.plan.ready).toBe(false);
  expect(enable.plan.blockers).toContain('runtime_not_healthy');
  await expect(page.getByRole('button', { name: 'Одобрить план', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: 'Deployment hosts', exact: true }).click();
  await page.getByRole('button', { name: 'Зарегистрировать host', exact: true }).click();
  for (const [label, value] of [
    ['Host UUID', state.deployment.id],
    ['Название', state.deployment.name],
    ['Issuer', state.deployment.issuer],
    ['Subject deployment identity', state.deployment.subject],
    ['Client ID deployment identity', state.deployment.client_id],
    ['Rootless Docker engine ID', state.deployment.engine_id],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await select(page, 'Платформа', state.platform === 'linux/amd64' ? 'Linux amd64' : 'Linux arm64');
  await response(page, 'POST', '/api/v1/platform/deployment-hosts', () => dialogSave(page));
  if (state.nativeRuntime)
    fs.writeFileSync(
      path.join(state.operatorDirectory, randomUUID() + '.request.json'),
      JSON.stringify({ operation: 'start-agent' }),
      { mode: 0o600 },
    );
  await page.getByRole('link', { name: 'Установленные модули', exact: true }).click();
  await page.getByRole('link', { name: 'hello-console', exact: true }).click();
  await page.getByRole('link', { name: 'Управление', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Развернуть', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Развернуть', exact: true }).click();
  const deploymentResponse = await response(page, 'POST', '/api/v1/platform/deployment-plans', () =>
    dialogSave(page, 'Подготовить'),
  );
  const deployment = await deploymentResponse.json();
  expect(deployment.body.expected_deployment_generation).toBe(0);
  await page.getByRole('button', { name: 'Одобрить и поставить в очередь', exact: true }).click();
  const queued = await response(
    page,
    'POST',
    `/api/v1/platform/deployment-plans/${deployment.id}/approve`,
    () =>
      page.getByRole('alertdialog').getByRole('button', { name: 'Одобрить', exact: true }).click(),
  );
  const provisionJob = await queued.json();
  expect(provisionJob.state).toBe('queued');
  await expect(page.getByRole('heading', { name: 'Задание поставлено в очередь' })).toBeVisible();
  await page.getByRole('link', { name: 'Отслеживать выполнение', exact: true }).click();
  await page.getByRole('tab', { name: 'Задания', exact: true }).click();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: provisionJob.job_id })
      .getByText(state.nativeRuntime ? 'Завершено' : 'В очереди', { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  if (state.nativeRuntime) {
    await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
    await page.getByRole('button', { name: 'Запустить', exact: true }).click();
    const startPrepared = await response(page, 'POST', '/api/v1/platform/deployment-plans', () =>
      dialogSave(page, 'Подготовить'),
    );
    const startPlan = await startPrepared.json();
    await page.getByRole('button', { name: 'Одобрить и поставить в очередь', exact: true }).click();
    const started = await response(
      page,
      'POST',
      `/api/v1/platform/deployment-plans/${startPlan.id}/approve`,
      () =>
        page
          .getByRole('alertdialog')
          .getByRole('button', { name: 'Одобрить', exact: true })
          .click(),
    );
    const startJob = await started.json();
    await page.getByRole('link', { name: 'Отслеживать выполнение', exact: true }).click();
    await page.getByRole('tab', { name: 'Задания', exact: true }).click();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: startJob.job_id })
        .getByText('Завершено', { exact: true }),
    ).toBeVisible({ timeout: 90000 });
    await page.getByRole('tab', { name: 'Здоровье', exact: true }).click();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Здоровье', exact: true })
        .getByText('Исправен', { exact: true }),
    ).toBeVisible({ timeout: 90000 });
    await page.screenshot({
      path: 'reports/console-screenshots/runtime-healthy.png',
      animations: 'disabled',
    });
    await page.getByRole('link', { name: 'Установленные модули', exact: true }).click();
    await page.getByRole('link', { name: 'hello-console', exact: true }).click();
    await page.getByRole('button', { name: 'Включить', exact: true }).click();
    const enablePrepared = await response(
      page,
      'POST',
      '/api/v1/platform/module-install-plans',
      () => dialogSave(page, 'Подготовить'),
    );
    const readyEnable = await enablePrepared.json();
    expect(readyEnable.plan.ready).toBe(true);
    await page.getByRole('button', { name: 'Одобрить план', exact: true }).click();
    await response(
      page,
      'POST',
      `/api/v1/platform/module-install-plans/${readyEnable.id}/approve`,
      () =>
        page
          .getByRole('alertdialog')
          .getByRole('button', { name: 'Одобрить', exact: true })
          .click(),
    );
    fs.writeFileSync(
      path.join(state.operatorDirectory, randomUUID() + '.request.json'),
      JSON.stringify({ plan_id: readyEnable.id, digest: readyEnable.digest }),
      { mode: 0o600 },
    );
    await expect(page.getByRole('heading', { name: 'План применён', exact: true })).toBeVisible({
      timeout: 60000,
    });
    await page.getByRole('link', { name: 'Открыть установленные модули' }).click();
    await page.getByRole('link', { name: 'hello-console', exact: true }).click();
    await page.getByRole('link', { name: 'Управление', exact: true }).click();
    await page.getByRole('button', { name: 'Остановить', exact: true }).click();
    const stopResponse = await response(page, 'POST', '/api/v1/platform/deployment-plans', () =>
      dialogSave(page, 'Подготовить'),
    );
    const stop = await stopResponse.json();
    expect(stop.body.expected_deployment_generation).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Одобрить и поставить в очередь', exact: true }).click();
    await response(page, 'POST', `/api/v1/platform/deployment-plans/${stop.id}/approve`, () =>
      page.getByRole('alertdialog').getByRole('button', { name: 'Одобрить', exact: true }).click(),
    );
    await page.getByRole('link', { name: 'Отслеживать выполнение', exact: true }).click();
    await expect(
      page
        .locator('dd')
        .filter({ hasText: /^Остановлен$/ })
        .first(),
    ).toBeVisible({ timeout: 90000 });
  }
});

test('non-admin cannot open platform management; no hidden controls grant access', async ({
  page,
}) => {
  await login(page, 'member');
  await expect(page.getByRole('link', { name: 'Издатели', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    history.pushState(null, '', '/platform/packages');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'Раздел недоступен' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Загрузить пакет', exact: true })).toHaveCount(0);
});

test('real duplicate and malformed uploads, revoked trust, offline services and memory-only reload', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Пакеты', exact: true }).click();
  await page.getByLabel('Файл пакета .xpkg').setInputFiles(state.package);
  const duplicate = await response(page, 'POST', '/api/v1/platform/packages', () =>
    page.getByRole('button', { name: 'Загрузить пакет', exact: true }).click(),
  );
  // Chromium may evict a large upload's inspector body; verify the persisted registry instead.
  expect(duplicate.status()).toBe(200);
  await expect(page.getByRole('link', { name: 'hello-console', exact: true })).toHaveCount(1);
  await page.getByLabel('Файл пакета .xpkg').setInputFiles({
    name: 'malformed.xpkg',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not a ZIP package'),
  });
  const invalid = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/platform/packages'),
  );
  await page.getByRole('button', { name: 'Загрузить пакет', exact: true }).click();
  expect([400, 422]).toContain((await invalid).status());
  await expect(page.getByTestId('api-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Загрузить пакет', exact: true })).toBeEnabled();

  await page.getByRole('link', { name: 'Издатели', exact: true }).click();
  await page.getByRole('link', { name: 'Тестовый издатель Console', exact: true }).click();
  await page.getByRole('button', { name: 'test-key', exact: true }).click();
  await page.getByRole('button', { name: 'Отозвать ключ', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Пакеты', exact: true }).click();
  await page.getByRole('link', { name: 'hello-console', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Подготовить установку', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText('Отсутствует', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Пакеты', exact: true }).first().click();
  const offline = '**/core-api/api/v1/platform/packages?*';
  await page.route(offline, (r) => r.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await expect(page.getByTestId('api-error')).toContainText('Сервис недоступен');
  await page.unroute(offline);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.getByRole('link', { name: 'hello-console', exact: true })).toBeVisible();
  await expect(page.getByTestId('api-error')).not.toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  // Network fault injection only: no forged token, API success or authority response.
  const discovery = state.issuer + '/.well-known/openid-configuration';
  await page.route(discovery, (r) => r.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Войти через Keycloak' }).click();
  await expect(page.getByText('Не удалось начать вход.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Войти через Keycloak' })).toBeEnabled();
  await expect(page).toHaveURL(/\/login/);
});
