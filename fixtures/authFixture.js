const { test: base, request } = require('@playwright/test');
const { readTestData } = require('../utils/testData.js');
const tokenStore = require('../utils/tokenStore');

// ─────────────────────────────────────────────────────────────────────────────
// AUTH FIXTURE
//
// Provides authenticated Playwright pages for all test files.
// Authentication is done directly against Keycloak via HTTP — no browser UI.
//
// How it works:
//   1. loginViaApi()       — POST credentials to Keycloak, get SSO cookies back
//   2. createAuthContext() — inject cookies into a browser context, navigate to app
//   3. authenticate()      — combines steps 1 and 2 into one call
//   4. authenticatedPage   — Playwright fixture that runs 1-3 before each test
//                            and closes the context after
//
// Usage in test files:
//   const { test } = require('../../fixtures/authFixture.js');
//   test('my test', async ({ authenticatedPage }) => { ... });
// ─────────────────────────────────────────────────────────────────────────────


// Env config cached once at module load — process.env never changes during a run
const ENV = {
  keycloakUrl: process.env.PW_KEYCLOAK_URL,
  keycloakRealm: process.env.PW_KEYCLOAK_REALM,
  keycloakClientId: process.env.PW_KEYCLOAK_CLIENT,
  baseURL: process.env.PW_BASE_URL,
  envName: process.env.PW_ENV_NAME,
};


// ─── Keycloak API Login ───────────────────────────────────────────────────────
// Authenticates directly with Keycloak — no browser window, no UI interaction.
// Returns a Playwright storageState object (cookies in memory, no file written).
//
// How it works:
//   - GET  the Keycloak login page to retrieve the form action URL (one-time token)
//   - POST username + password to that URL
//   - On success, Keycloak redirects away from /login-actions/ → we collect SSO cookies
//   - On failure (wrong credentials), Keycloak stays on /login-actions/ → we throw

// Builds the Keycloak authorization endpoint URL that triggers the login page
function buildKeycloakAuthUrl() {
  return `${ENV.keycloakUrl}/realms/${ENV.keycloakRealm}/protocol/openid-connect/auth` +
    `?client_id=${encodeURIComponent(ENV.keycloakClientId)}` +
    `&redirect_uri=${encodeURIComponent(ENV.baseURL)}` +
    `&response_type=code&scope=openid&response_mode=fragment`;
}

async function loginViaApi(username, password) {
  const apiContext = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const loginPageResponse = await apiContext.get(buildKeycloakAuthUrl());
    const html = await loginPageResponse.text();

    const actionMatch = html.match(/action="([^"]+)"/);
    if (!actionMatch) throw new Error(`Keycloak form action not found for "${username}"`);
    const formAction = actionMatch[1].replace(/&amp;/g, '&');

    const postResponse = await apiContext.post(formAction, {
      form: { username, password, credentialId: '' },
    });

    const finalUrl = postResponse.url();
    if (finalUrl.includes('/login-actions/') && !finalUrl.includes('required-action'))
      throw new Error(`Keycloak login failed for "${username}" — invalid credentials or account locked`);

    return await apiContext.storageState();
  } finally {
    await apiContext.dispose();
  }
}


// ─── Browser Context Factory ──────────────────────────────────────────────────
// Creates a browser context pre-loaded with SSO cookies, sets language to English,
// navigates to the app, and waits until past the Keycloak login page.
// Returns { context, page } — context is needed for teardown, page for the test.

// Listens on the context for the first Bearer token in any request header.
// Fires exactly once then removes itself — token stored for BaseApi subclasses.
function setupTokenCapture(context) {
  const handler = req => {
    const auth = req.headers()['authorization'];
    if (auth?.startsWith('Bearer ')) {
      tokenStore.setToken(auth.slice(7));
      context.off('request', handler);
    }
  };
  context.on('request', handler);
}

async function createAuthContext(browser, storageState, captureToken = false) {
  const context = await browser.newContext({ storageState, ignoreHTTPSErrors: true, permissions: [] });


  if (captureToken) setupTokenCapture(context);

  await context.addInitScript(() => {
    if (!localStorage.getItem('r-lang')) localStorage.setItem('r-lang', 'en');
    if (!localStorage.getItem('r-session-lang')) localStorage.setItem('r-session-lang', 'en');
  });

  const page = await context.newPage();
  await page.goto(ENV.baseURL);
  await page.waitForURL(url => !url.href.includes('keycloak'), { timeout: 60_000 });
  await page.waitForLoadState('networkidle');

  return { context, page };
}


// ─── Combined Login ───────────────────────────────────────────────────────────
// Runs loginViaApi + createAuthContext in one call.
// Used internally by loginAs() and the authenticatedPage fixture.

async function authenticate(browser, username, password, captureToken = false) {
  const storageState = await loginViaApi(username, password);
  return createAuthContext(browser, storageState, captureToken);
}


// ─── Login Helper ─────────────────────────────────────────────────────────────
// Generic login for any user — used in beforeAll-pattern files and permission tests.
// Does NOT capture the Bearer token — only the admin fixture should do that.
//
// Usage:
//   const loginData = readTestData('LoginTestData.json');
//   page = await loginAs(browser, loginData.username, loginData.password);

async function loginAs(browser, username, password) {
  const { page } = await authenticate(browser, username, password, false);
  return page;
}


// ─── Fixture ──────────────────────────────────────────────────────────────────
// authenticatedPage — logs in as admin before each test, closes context after.
// Captures the Bearer token so BaseApi subclasses can make authenticated API calls.
//
// For tests that need a different user, call loginAs() directly inside the test:
//   test('no perm', async ({ browser }) => {
//     const noPermPage = await loginAs(browser, username, password);
//     try { ... } finally { await noPermPage.context().close(); }
//   });

const test = base.extend({
  authenticatedPage: async ({ browser }, use) => {
    if (!ENV.keycloakUrl || !ENV.keycloakRealm || !ENV.keycloakClientId)
      throw new Error(`Keycloak not configured for environment "${ENV.envName || 'unknown'}"`);
    const { username, password } = readTestData('LoginTestData.json');
    const { context, page } = await authenticate(browser, username, password, true);
    await use(page);
    await context.close();
  },
});

module.exports = { test, loginAs };
