const { request: playwrightRequest } = require('@playwright/test');
const { allure } = require('allure-playwright');
const tokenStore = require('../utils/tokenStore');

// ─── Base API Class ───────────────────────────────────────────────────────────
// Parent class for all API classes in the project.
// Uses Playwright's APIRequestContext with baseURL and auth headers pre-configured
// so subclasses only need to define their business methods — no URL building,
// no header injection, no lifecycle management needed.
//
// How to create a new API class:
//   1. Extend BaseApi
//   2. Use this.get() / this.post() / this.put() / this.delete()
//
// Example:
//   class MyApi extends BaseApi {
//     async deleteItem(id) {
//       return this.delete(`MyModule/api/Items/${id}`);
//     }
//   }
//
//   // In test afterEach — one line, lifecycle handled automatically:
//   await MyApi.run(api => api.deleteItem(id));

class BaseApi {
  constructor(context) {
    this.context = context;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  static async create(userKey = 'default', options = {}) {

    const token = tokenStore.getToken(userKey);

    if (!token)
      throw new Error(`Token for "${userKey}" not found`);

    const context = await playwrightRequest.newContext({
      baseURL: process.env.PW_API_BASE_URL,

      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
        ...options.extraHTTPHeaders
      },

      ignoreHTTPSErrors: true
    });

    return new this(context);
  }

  // Handles the full create → use → dispose lifecycle in one call.
  // Pass options to add extra headers for the entire operation.
  //
  // Usage:
  //   await MyApi.run(api => api.deleteItem(id));
  //   await MyApi.run(api => api.getSomething(), { extraHTTPHeaders: { 'Accept-Language': 'ar' } });
  // 
  static async run(callback, userKey = 'default', options = {}) {
    const api = await this.create(userKey, options);
    try {
      return await callback(api);
    } finally {
      await api.dispose();
    }
  }

  // Executes API calls as a specific user.
  //
  // Example:
  //
  // await ShiftApi.runAs(
  //     'operator',
  //     api => api.createShift()
  // );
  //
  static async runAs(userKey, callback, options = {}) {
    return this.run(callback, userKey, options);
  }

  // Closes the underlying request context — called automatically by run().
  async dispose() {
    await this.context.dispose();
  }
  // ─── Request Wrapper with Allure Steps and Attachments ───────────────────
  // Wraps API requests in Allure steps and attaches request/response details.
  async request(method, endpoint, options = {}) {
    return await allure.step(`API ${method.toUpperCase()} ${endpoint}`, async () => {
      if (options.data && !(options.data instanceof FormData) && !options.headers?.['Content-Type']) {
        options.headers = {
          'Content-Type': 'application/json',
          ...options.headers,
        };
      }
      const requestPayload = {
        url: `${process.env.PW_API_BASE_URL}${endpoint}`,
        method,
        headers: options.headers,
        data: options.data,
        params: options.params,
      };

      allure.attachment(
        'Request',
        JSON.stringify(requestPayload, null, 2),
        'application/json'
      );

      const response = await this.context[method](endpoint, options);

      let body;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }

      allure.attachment('Response Status', String(response.status()), 'text/plain');
      allure.attachment('Response Body', JSON.stringify(body, null, 2), 'application/json');

      return response;
    });
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────
  // baseURL and auth headers are handled by the context automatically.
  // Pass endpoint path only — no base URL needed.
  // Pass additional options (params, data, headers) via the options argument.

  get(endpoint, options) { return this.request('get', endpoint, options); }
  post(endpoint, options) { return this.request('post', endpoint, options); }
  put(endpoint, options) { return this.request('put', endpoint, options); }
  patch(endpoint, options) { return this.request('patch', endpoint, options); }
  delete(endpoint, options) { return this.request('delete', endpoint, options); }
}

module.exports = { BaseApi };
