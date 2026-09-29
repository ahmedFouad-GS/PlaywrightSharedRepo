// @ts-check
import { defineConfig, devices } from '@playwright/test';

const envConfigs = {
  test: {
    metadata: {
      envName: 'TST-',
      keycloakUrl: '',
      keycloakRealm: '',
      keycloakClientId: '',
      apiBaseUrl: '',
    },
    baseURL: '',
  },
  stg: {
    metadata: {
      envName: 'STG-',
      keycloakUrl: '',
      keycloakRealm: '',
      keycloakClientId: '',
      apiBaseUrl: '',
    },
    baseURL: '',
  },
};

// Set process.env from the active project's metadata so authFixture.js
// can read config without needing testInfo.
const projectArg = process.argv.find(a => a.startsWith('--project='))?.split('=')[1];
// @ts-ignore
const activeEnv = envConfigs[projectArg];
// Worker processes reload this config without the original CLI argv, so
// projectArg comes back undefined there. Only assign when it's actually
// found (main process) so workers inherit the correct values from the
// parent instead of falling back to stg and overwriting them.
if (activeEnv) {
  process.env.PW_ENV_NAME = activeEnv.metadata.envName;
  process.env.PW_KEYCLOAK_URL = activeEnv.metadata.keycloakUrl;
  process.env.PW_KEYCLOAK_REALM = activeEnv.metadata.keycloakRealm;
  process.env.PW_KEYCLOAK_CLIENT = activeEnv.metadata.keycloakClientId;
  process.env.PW_BASE_URL = activeEnv.baseURL;
  process.env.PW_API_BASE_URL = activeEnv.metadata.apiBaseUrl;
}

export default defineConfig({
  testDir: './tests',
  retries: 2,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 4,
  reporter: [
    ['allure-playwright'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  timeout: 180000,
  use: {
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
    launchOptions: { slowMo: 1000 },
    ignoreHTTPSErrors: true,
  },
  globalTeardown: require.resolve('./global-teardown.js'),
  globalSetup: require.resolve('./global-setup'),

  projects: [
    {
      name: 'test',
      use: { ...devices['Desktop Chrome'], headless: true, baseURL: envConfigs.test.baseURL },
      metadata: envConfigs.test.metadata,
    },
    {
      name: 'stg',
      use: { ...devices['Desktop Chrome'], headless: true, baseURL: envConfigs.stg.baseURL },
      metadata: envConfigs.stg.metadata,
    },
  ],
});
