# Authentication and Multi-User API Support

## Overview

The framework provides two authentication mechanisms:

1. **Browser Authentication** using `authenticatedPage`.
2. **API-Only Authentication** using `authenticateApiUser`.

This architecture enables:

* Performing UI and API actions as the same user.
* Executing API requests as multiple users within a single test.
* Maintaining a single browser session while simulating additional users through API calls.
* Authenticating API users without opening visible browser windows.
* Supporting first-time logins that require password changes in Keycloak.

---

# Browser Authentication

The `authenticatedPage` fixture authenticates the default user (typically an Admin) through Keycloak, creates an authenticated browser context, and automatically captures the user's bearer token.

```javascript
test.beforeEach(async ({ authenticatedPage }) => {
    // Browser session is already authenticated.
});
```

The captured token is stored under the reserved key:

```text
default
```

All API requests executed without explicitly specifying a user will use this token.

Example:

```javascript
await ShiftApi.run(api =>
    api.createShift(data)
);
```

---

# API-Only Authentication

Additional users can be authenticated for API usage without affecting the current browser session.

The `authenticateApiUser` fixture:

1. Authenticates the user in a headless browser.
2. Captures the bearer token.
3. Stores the token in the token store.
4. Disposes of the temporary browser context.

```javascript
test(
    'my test',
    async ({ authenticateApiUser }) => {
        await authenticateApiUser(
            'operator',
            operatorUsername,
            operatorPassword
        );
    }
);
```

The token is stored under the specified key:

```text
operator
```

No cleanup is required. All temporary authentication resources are automatically disposed of.

---

# Token Store

Tokens are managed internally using unique user keys.

Example:

```text
default   → Admin token
operator  → Operator token
manager   → Manager token
approver  → Approver token
employee   → Employee token
```

The `default` token always represents the user authenticated through `authenticatedPage`.

---

# Running API Requests

## Default User

Uses the token captured from `authenticatedPage`.

```javascript
await ShiftApi.run(api =>
    api.deleteShift(id)
);
```

Equivalent to:

```javascript
await ShiftApi.runAs(
    'default',
    api => api.deleteShift(id)
);
```

---

## Specific User

```javascript
await ShiftApi.runAs(
    'operator',
    api => api.createShift(data)
);
```

---

# Scenario 1: Single User (UI + API)

The same user performs both UI and API actions.

```javascript
test(
    'Create shift',
    async ({ authenticatedPage }) => {

        // UI actions as Admin
        await authenticatedPage.click(...);

        // API actions as Admin
        await ShiftApi.run(api =>
            api.createShift(data)
        );
    }
);
```

No additional setup is required.

---

# Scenario 2: Multiple Users

Admin performs UI actions while another user performs API actions.

Authenticate the second user:

```javascript
await authenticateApiUser(
    'operator',
    operatorUsername,
    operatorPassword
);
```

Execute API requests as Operator:

```javascript
await ShiftApi.runAs(
    'operator',
    api => api.createShift(data)
);
```

Execute API requests as Admin:

```javascript
await ShiftApi.run(api =>
    api.approveShift(id)
);
```

Continue UI actions as Admin:

```javascript
await authenticatedPage.reload();
```

---

# First Login / Temporary Password Support

The framework automatically supports Keycloak users that are required to change their password during their first login.

When a user is configured with a temporary password, Keycloak redirects the authentication flow to:

```text
/login-actions/required-action?execution=UPDATE_PASSWORD
```

The framework detects this flow automatically, changes the password, and completes authentication.

---

## Authenticating a User with a Temporary Password

`authenticateApiUser` accepts an optional fourth parameter:

```javascript
await authenticateApiUser(
    userKey,
    username,
    temporaryPassword,
    newPassword
);
```

Example:

```javascript
await authenticateApiUser(
    'employee',
    employeeUsername,
    'Temp@123',
    'Aa@#12345'
);
```

Authentication flow:

```text
Temporary Password
        ↓
UPDATE_PASSWORD Required Action
        ↓
Submit New Password
        ↓
Redirect to Application
        ↓
Capture Bearer Token
        ↓
tokenStore["employee"]
```

---

## Example: First-Time Login

```javascript
test(
    'Employee first login',
    async ({ authenticateApiUser }) => {

        await authenticateApiUser(
            'employee',
            employeeUsername,
            temporaryPassword,
            'Aa@#12345'
        );

        await EmployeeApi.runAs(
            'employee',
            api => api.getProfile()
        );
    }
);
```

---

## Notes

* The new password must satisfy all configured Keycloak password policies.
* If the password change fails, authentication will fail and an exception will be thrown.
* If a user requires a password update and `newPassword` is not provided, the framework throws:

```text
User "<username>" must change password, but no new password was provided.
```

---

# Example: Multi-User Workflow

```javascript
test(
    'Multi-user workflow',
    async ({
        authenticatedPage,
        authenticateApiUser
    }) => {

        await authenticateApiUser(
            'operator',
            operatorUsername,
            operatorPassword
        );

        await ShiftApi.runAs(
            'operator',
            api => api.createShift(data)
        );

        await ShiftApi.run(api =>
            api.approveShift(id)
        );

        await authenticatedPage.reload();
    }
);
```

---

# Architecture

```text
authenticatedPage
        ↓
Admin Browser Login
        ↓
Bearer Token Capture
        ↓
tokenStore["default"]
        ↓
BaseApi.run()

────────────────────────────

authenticateApiUser("operator")
        ↓
Headless Authentication
        ↓
Bearer Token Capture
        ↓
tokenStore["operator"]
        ↓
BaseApi.runAs("operator")

────────────────────────────

authenticateApiUser(
    "employee",
    temporaryPassword,
    newPassword
)
        ↓
UPDATE_PASSWORD Required Action
        ↓
Password Change
        ↓
Bearer Token Capture
        ↓
tokenStore["employee"]
        ↓
BaseApi.runAs("employee")
```

This design preserves backward compatibility with existing tests while providing flexible support for:

* Single-user UI and API workflows.
* Multi-user API scenarios.
* First-time user authentication with temporary passwords.
* Token-based API execution without creating additional visible browser sessions.
