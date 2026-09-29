const { test: base, request, chromium } = require('@playwright/test');
const { readTestData } = require('../utils/testData.js');
const tokenStore = require('../utils/tokenStore.js');

// ─────────────────────────────────────────────────────────────────────────────
// AUTH FIXTURE
//
// Provides authenticated Playwright pages and API users for all test files.
// Authentication is done directly against Keycloak via HTTP — no browser UI.
//
// How it works:
//   1. loginViaApi()       — POST credentials to Keycloak, get SSO cookies back
//   2. createAuthContext() — inject cookies into a browser context
//   3. authenticate()      — combines steps 1 and 2 into one call
//   4. authenticatedPage   — logs in the default user (Admin)
//   5. authenticateApiUser — logs in additional users for API usage and
//                             automatically closes their contexts after the test
//
// Usage:
//
//   const { test } = require('../../fixtures/authFixture');
//
//   test('my test', async ({
//     authenticatedPage,
//     authenticateApiUser
//   }) => {
//     await authenticateApiUser(
//       'operator',
//       operatorUsername,
//       operatorPassword
//     );
//
//     await MyApi.runAs(
//       'operator',
//       api => api.doSomething()
//     );
//   });
// ─────────────────────────────────────────────────────────────────────────────

// Env config cached once at module load
const ENV = {
  keycloakUrl: process.env.PW_KEYCLOAK_URL,
  keycloakRealm: process.env.PW_KEYCLOAK_REALM,
  keycloakClientId: process.env.PW_KEYCLOAK_CLIENT,
  baseURL: process.env.PW_BASE_URL,
  envName: process.env.PW_ENV_NAME,
};

// ─────────────────────────────────────────────────────────────────────────────
// Keycloak Authentication
// ─────────────────────────────────────────────────────────────────────────────

function buildKeycloakAuthUrl() {
  return (
    `${ENV.keycloakUrl}/realms/${ENV.keycloakRealm}/protocol/openid-connect/auth` +
    `?client_id=${encodeURIComponent(ENV.keycloakClientId)}` +
    `&redirect_uri=${encodeURIComponent(ENV.baseURL)}` +
    `&response_type=code&scope=openid&response_mode=fragment`
  );
}

async function loginViaApi(
  username,
  password,
  newPassword = null
) {
  const apiContext = await request.newContext({
    ignoreHTTPSErrors: true,
  });

  try {
    // Open Keycloak login page
    const loginPageResponse =
      await apiContext.get(
        buildKeycloakAuthUrl()
      );

    const loginPageHtml =
      await loginPageResponse.text();

    const loginActionMatch =
      loginPageHtml.match(
        /action="([^"]+)"/
      );

    if (!loginActionMatch) {
      throw new Error(
        `Keycloak form action not found for "${username}".`
      );
    }

    const loginAction =
      loginActionMatch[1].replace(
        /&amp;/g,
        '&'
      );

    // Submit username/password
    let response =
      await apiContext.post(
        loginAction,
        {
          form: {
            username,
            password,
            credentialId: '',
          },
        }
      );

    let finalUrl = response.url();
    let responseHtml =
      await response.text();


    // -------------------------------------------------------
    // First login → update password
    // -------------------------------------------------------
    const requiresPasswordUpdate =
      finalUrl.includes(
        'execution=UPDATE_PASSWORD'
      ) ||
      responseHtml.includes(
        'password-new'
      );

    if (requiresPasswordUpdate) {
      if (!newPassword) {
        throw new Error(
          `User "${username}" must change password, but no new password was provided.`
        );
      }

      const passwordActionMatch =
        responseHtml.match(
          /action="([^"]+)"/
        );

      if (!passwordActionMatch) {
        throw new Error(
          `Password update form action not found for "${username}".`
        );
      }

      const passwordAction =
        passwordActionMatch[1].replace(
          /&amp;/g,
          '&'
        );

      response =
        await apiContext.post(
          passwordAction,
          {
            form: {
              'password-new':
                newPassword,
              'password-confirm':
                newPassword,
            },
          }
        );

      finalUrl = response.url();
      responseHtml =
        await response.text();

      // If still on UPDATE_PASSWORD page,
      // password policy probably failed.
      if (
        finalUrl.includes(
          'execution=UPDATE_PASSWORD'
        )
      ) {
        throw new Error(
          `Password update failed for "${username}".`
        );
      }
    }

    // -------------------------------------------------------
    // Invalid credentials
    // -------------------------------------------------------
    if (
      responseHtml.includes(
        'Email or Username and password that you’ve entered don’t match any profile'
      ) ||
      responseHtml.includes(
        'Invalid username or password'
      ) ||
      responseHtml.includes(
        'Invalid credentials'
      )
    ) {
      throw new Error(
        `Keycloak login failed for "${username}" - invalid credentials.`
      );
    }

    return await apiContext.storageState();
  } finally {
    await apiContext.dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Context Factory
// ─────────────────────────────────────────────────────────────────────────────

function setupTokenCapture(
  context,
  userKey = 'default'
) {
  const handler = req => {
    const auth =
      req.headers()['authorization'];

    if (auth?.startsWith('Bearer ')) {
      tokenStore.setToken(
        userKey,
        auth.slice(7)
      );

      context.off('request', handler);
    }
  };

  context.on('request', handler);
}

async function createAuthContext(
  browser,
  storageState,
  captureToken = false,
  userKey = 'default'
) {
  const context = await browser.newContext({
    storageState,
    ignoreHTTPSErrors: true,
    permissions: [],
  });

  if (captureToken) {
    setupTokenCapture(
      context,
      userKey
    );
  }

  await context.addInitScript(() => {
    if (!localStorage.getItem('r-lang')) {
      localStorage.setItem(
        'r-lang',
        'en'
      );
    }

    if (!localStorage.getItem('r-session-lang')) {
      localStorage.setItem(
        'r-session-lang',
        'en'
      );
    }
  });

  const page =
    await context.newPage();

  await page.goto(ENV.baseURL);

  await page.waitForURL(
    url => !url.href.includes('keycloak'),
    { timeout: 60_000 }
  );

  await page.waitForLoadState(
    'networkidle'
  );

  return { context, page };
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication Helper
// ─────────────────────────────────────────────────────────────────────────────

async function authenticate(
  browser,
  username,
  password,
  captureToken = false,
  userKey = 'default'
) {
  const storageState =
    await loginViaApi(
      username,
      password
    );

  return createAuthContext(
    browser,
    storageState,
    captureToken,
    userKey
  );
}
async function authenticateApiOnly(
  userKey,
  username,
  password,
  newPassword = null
) {
  const browser =
    await chromium.launch({
      headless: true,
    });

  try {
    const storageState =
      await loginViaApi(
        username,
        password,
        newPassword
      );

    const context =
      await browser.newContext({
        storageState,
        ignoreHTTPSErrors: true,
      });

    setupTokenCapture(
      context,
      userKey
    );

    const page =
      await context.newPage();

    await page.goto(ENV.baseURL);

    await page.waitForURL(
      url =>
        !url.href.includes(
          'keycloak'
        ),
      {
        timeout: 60_000,
      }
    );

    await page.waitForLoadState(
      'networkidle'
    );

    await page.waitForTimeout(
      1000
    );

    const token =
      tokenStore.getToken(
        userKey
      );

    if (!token) {
      throw new Error(
        `Failed to capture token for user "${userKey}".`
      );
    }
  } finally {
    await browser.close();
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// Login Helper
// ─────────────────────────────────────────────────────────────────────────────

async function loginAs(
  browser,
  username,
  password
) {
  const { page } =
    await authenticate(
      browser,
      username,
      password
    );

  return page;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const test = base.extend({
  authenticatedPage: async ({ browser }, use) => {
    if (
      !ENV.keycloakUrl ||
      !ENV.keycloakRealm ||
      !ENV.keycloakClientId
    ) {
      throw new Error(
        `Keycloak not configured for environment "${ENV.envName || 'unknown'}"`
      );
    }

    const {
      username,
      password,
    } = readTestData(
      'LoginTestData.json'
    );

    const {
      context,
      page,
    } = await authenticate(
      browser,
      username,
      password,
      true
    );

    try {
      await use(page);
    } finally {
      await context.close();
    }
  },

  authenticateApiUser: async ({ }, use) => {
    const login = async (
      userKey,
      username,
      password,
      newPassword = null
    ) => {
      await authenticateApiOnly(
        userKey,
        username,
        password,
        newPassword
      );
    };

    await use(login);
  },
});

module.exports = {
  test,
  loginAs,
};
