# API Layer

This folder contains API client classes used in tests for direct HTTP calls — primarily for test cleanup (e.g. deleting created data after a test) without going through the UI.

## Structure

```
Apis/
├── baseApi.js                          ← Base class — extend this for every new API
└── web/
    └── shiftmanagement/
        └── breakSettingsApi.js         ← Example: Break Settings API client
```

## How it works

`BaseApi` handles two things automatically:
- **Auth** — reads the Bearer token from `process.env.PLAYWRIGHT_ACCESS_TOKEN` (captured during login)
- **Base URL** — reads `process.env.PW_API_BASE_URL` (set from `playwright.config.js`)

Subclasses only define the business methods. No auth or URL wiring needed.

## How to add a new API class

**Step 1** — Create a file under the relevant domain folder:
```
Apis/web/yourmodule/YourModuleApi.js
```

**Step 2** — Extend `BaseApi`:
```js


## Available HTTP methods

All methods auto-attach `Authorization: Bearer <token>` and prepend `PW_API_BASE_URL`.

| Method | Usage |
|---|---|
| `this.get(endpoint, options?)` | GET request |
| `this.post(endpoint, options?)` | POST request |
| `this.put(endpoint, options?)` | PUT request |
| `this.delete(endpoint, options?)` | DELETE request |

Pass extra headers or body via `options`:
```js
await this.post('some/endpoint', {
  data: { key: 'value' },
  headers: { 'Content-Type': 'application/json' },
});
```

