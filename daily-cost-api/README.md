# Daily Cost API

Backend for **Daily Cost**, a family expense and income tracker. Family members use their own Android phones while sharing family wallets, categories, transactions, and monthly reports. A web administration interface is planned.

> **Project status:** Under active development. The NestJS/Prisma foundation, common API infrastructure, health check, Swagger documentation, and email-based registration/login flows are described in the current project documentation. Family management, financial features, reporting, notifications, and several auth hardening tasks are being developed in stages. **Refresh-token rotation and logout (issue #12) are described below as the intended contract; verify their merge status before treating them as deployed.**

## Tech stack

| Area                 | Technology                                                                |
| -------------------- | ------------------------------------------------------------------------- |
| API                  | NestJS 12, TypeScript, Node.js 24                                         |
| Database             | PostgreSQL 15, Prisma 6                                                   |
| Authentication       | Email/password, Argon2id, JWT access tokens, hashed opaque refresh tokens |
| Email verification   | Six-digit codes; local Mailpit, SMTP for deployment                       |
| API documentation    | OpenAPI / Swagger                                                         |
| Testing              | Jest                                                                      |
| Local infrastructure | Docker Compose                                                            |
| Android client       | Kotlin, Jetpack Compose (separate client)                                 |
| Planned              | Web admin, Firebase Cloud Messaging                                       |

## Requirements

- **Node.js 24.15 or newer**, selected using `.nvmrc` and `nvm use`. Node 24.9+ is needed for the project's Jest / NestJS ESM compatibility.
- npm
- Docker and Docker Compose

## Getting started

Run these commands from the **API project directory** (`daily-cost-api/`):

```bash
nvm use
npm install
cp .env.example .env
# Edit .env and set a strong JWT_ACCESS_SECRET and matching database credentials.
docker compose up -d
npx prisma migrate dev
npm run start:dev
```

Default addresses:

| Resource                      | URL                                   |
| ----------------------------- | ------------------------------------- |
| API routes                    | `http://localhost:3000/api/v1`        |
| Database readiness            | `http://localhost:3000/health`        |
| Swagger UI (non-production)   | `http://localhost:3000/api/docs`      |
| OpenAPI JSON (non-production) | `http://localhost:3000/api/docs-json` |
| PostgreSQL (host)             | `localhost:5433`                      |

**Never commit `.env`.** Use `.env.example` as the source of configuration names and permitted values.

### Configuration

| Variable                   | Example / default                                                         | Purpose                                             |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `DB_USER`                  | `dailycost`                                                               | Docker Compose PostgreSQL user                      |
| `DB_PASSWORD`              | `change-me`                                                               | Docker Compose PostgreSQL password; replace locally |
| `DB_NAME`                  | `dailycost`                                                               | Docker Compose database name                        |
| `DB_PORT`                  | `5433`                                                                    | PostgreSQL host port                                |
| `DATABASE_URL`             | `postgresql://dailycost:change-me@localhost:5433/dailycost?schema=public` | Required database connection URL                    |
| `JWT_ACCESS_SECRET`        | Set a random string of at least 32 characters                             | Required signing secret                             |
| `ACCESS_TOKEN_TTL_SECONDS` | `900`                                                                     | JWT lifetime in seconds                             |
| `REFRESH_TOKEN_TTL_DAYS`   | `30`                                                                      | Opaque refresh-token lifetime in days               |
| `PORT`                     | `3000`                                                                    | HTTP server port                                    |
| `NODE_ENV`                 | `development`                                                             | `development`, `test`, or `production`              |
| `CORS_ORIGINS`             | `http://localhost:5173`                                                   | Comma-separated list of browser origins             |

Additional email verification and SMTP settings are used by the authentication module (including `EMAIL_CODE_TTL_MINUTES` and `MAIL_HOST`). Consult the current `.env.example` and auth module configuration for the complete list; do not copy secrets into documentation.

Generate a signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Environment variables are validated at startup by `src/config/env.validation.ts`. Missing or invalid values prevent startup; validation errors identify the variable without printing its secret value.

## Useful commands

| Command                                | Purpose                                   |
| -------------------------------------- | ----------------------------------------- |
| `npm run start:dev`                    | Start in watch mode                       |
| `npm run build`                        | Compile to `dist/`                        |
| `npm run start:prod`                   | Run the compiled build                    |
| `npm test`                             | Run Jest tests                            |
| `npm run test:cov`                     | Run coverage                              |
| `npx prisma migrate dev`               | Apply development migrations              |
| `npx prisma migrate dev --name <name>` | Create/apply a named migration            |
| `npx prisma studio`                    | Inspect database records                  |
| `docker compose stop`                  | Stop services, preserving volumes         |
| `docker compose up -d`                 | Start services                            |
| `docker compose down -v`               | **Delete service volumes and local data** |

## Architecture

```text
prisma/
  schema.prisma              Database models
  migrations/                Schema migrations
src/
  main.ts                    Bootstrap, middleware, global prefix, CORS, Swagger
  app.module.ts              Application modules and global providers
  config/                    Environment validation, CORS, Swagger
  prisma/                    Global Prisma module and service
  common/
    constants/               Error codes and shared constants
    decorators/              Cross-cutting route metadata
    exceptions/              Application exceptions
    filters/                 Exception mapping
    interceptors/            Success response wrapping
    middleware/              Request ID and HTTP request logger
    pagination/              Pagination DTO and helper
    types/                   Shared types
    utils/                   Money and date helpers
  modules/
    auth/                    Authentication and email verification
      dto/                   Validated request DTOs
      docs/                  Swagger endpoint decorators
    users/                   User functionality
    families/                Family lifecycle
    members/                 Family memberships
    invitations/             Invitation codes
    wallets/                 Family wallets
    categories/              Income/expense categories
    transactions/            Family ledger
    reports/                 Financial reporting
    notifications/           Push notifications
    health/                  Database readiness check
      docs/                  Swagger documentation

test/                         End-to-end tests
```

Modules should keep **route-specific Swagger decorators in their own `docs/` directory**. Validation and transformation remain in `dto/`. Global Swagger setup stays in `src/config/swagger.config.ts`.

## API conventions

The primary API prefix is **`/api/v1`**. The public `GET /health` endpoint is outside this prefix. Family-scoped routes follow `/api/v1/families/:familyId/...` when implemented.

### Response envelope

A normal successful response:

```json
{
  "data": { "id": "example-id" },
  "meta": { "path": "/api/v1/wallets" }
}
```

A paginated response:

```json
{
  "data": [],
  "meta": {
    "path": "/api/v1/transactions",
    "total": 120,
    "limit": 50,
    "offset": 0
  }
}
```

List endpoints use a shared pagination contract (`limit` defaults to 50, maximum 200; `offset` defaults to 0). Controllers/services return paginated data; the global interceptor constructs the API envelope. Routes annotated with `@SkipResponseWrap()` can return unwrapped data (for example, `/health`).

An error response:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Cannot GET /api/v1/nope",
    "details": null,
    "path": "/api/v1/nope",
    "requestId": "b6f1c3a2-5d7e-4f90-8a1b-3c2d4e5f6a7b"
  }
}
```

**Client applications must branch on `error.code`, not `error.message`.** Codes are stable identifiers for localization into Dari, Pashto, and English. The English message is intended for development and debugging. Validation errors use `VALIDATION_FAILED` and identify affected fields. Unexpected errors produce generic responses without leaking internal details.

The complete error-code catalog lives in `src/common/constants/error-codes.ts`; documented examples include `BAD_REQUEST`, `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `ALREADY_EXISTS`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, and `SERVICE_UNAVAILABLE`.

### Request IDs and logging

Every request receives an `X-Request-Id` response header. A supplied ID is accepted when it contains 1–64 letters, digits, `.`, `_`, or `-`; otherwise a new UUID is generated. The ID appears in error responses and server request logs, alongside the HTTP method, path, status, and duration. Request log entries omit query strings to avoid exposing sensitive query parameters.

### CORS

`CORS_ORIGINS` accepts a comma-separated list of exact browser origins, such as `https://admin.example.com` (scheme and host, optional port; no URL path or wildcard).

- **Production:** only configured origins receive CORS permission headers; an empty list allows no browser origins.
- **Development:** if the list is empty, localhost and `127.0.0.1` origins are allowed.
- **Headers:** `Authorization`, `Content-Type`, `X-Request-Id` are allowed, and `X-Request-Id` is exposed to browser code. Cookie credentials are disabled.

CORS is a browser enforcement mechanism; native Android requests are not restricted by it.

## Authentication and sessions

The current documented account flow uses **email/password** and **Argon2id** password hashing. Registration issues an email verification code; an account must be verified before login. Phone-based authentication remains a broader product goal, not part of the documented email flow.

All paths below are under `/api/v1`.

| Endpoint                         | Purpose                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/register`            | Register with `fullName`, `email`, `password`, optional `language` (`fa`, `ps`, `en`); send verification code; do not issue tokens yet |
| `POST /auth/verify-email`        | Verify using `{ email, code }`                                                                                                         |
| `POST /auth/resend-verification` | Request another code; documented to return 200 and enforce a resend interval                                                           |
| `POST /auth/login`               | Sign in with `{ email, password }`; return public user, access token, and refresh token                                                |
| `POST /auth/refresh`             | **Issue #12 target:** exchange `{ refreshToken }` for a new access token and refresh token                                             |
| `POST /auth/logout`              | **Issue #12 target:** revoke the supplied `{ refreshToken }`                                                                           |

Email verification uses six-digit codes, a documented 15-minute default expiration, a limit of five incorrect attempts, and a one-minute resend interval. Verification email language follows the user's preference. In local development, emails are sent to Mailpit; production requires SMTP configuration.

Important auth errors include `ALREADY_EXISTS` (409), `INVALID_CREDENTIALS` (401), `EMAIL_NOT_VERIFIED` (403), `VERIFICATION_CODE_INVALID` (400), and `VERIFICATION_CODE_EXPIRED` (400).

### Refresh-token rotation and logout — issue #12

The intended contract is:

1. Generate refresh tokens as opaque cryptographically random values. Persist **only their SHA-256 hashes** in `refresh_tokens`.
2. On refresh, consume the current token once and create a replacement atomically in a database transaction.
3. Reusing a previously revoked refresh token at the refresh endpoint revokes all active refresh-token sessions of that user and returns 401.
4. Unknown, expired, or invalid tokens cannot renew a session.
5. Logout revokes the supplied refresh token and is idempotent; ordinary logout does not revoke other devices' sessions.

**Security limitations:** Revoking a refresh token does not immediately revoke previously issued stateless access JWTs; those remain valid until their expiration unless separate access-token revocation is implemented. Android clients should serialize concurrent refresh requests to avoid self-triggered reuse detection. Token rotation and replay handling must be tested against PostgreSQL for concurrency and rollback behavior before considering #12 complete.

### Calling protected routes

Every route requires `Authorization: Bearer <accessToken>` unless the handler is marked `@Public()` (currently the auth endpoints and the health check). A route added later is private by default.

| Response | Code | What the app does |
|---|---|---|
| 401 | `TOKEN_EXPIRED` | The access token is past its lifetime: call refresh, then retry the request once |
| 401 | `UNAUTHORIZED` | Missing, invalid or revoked credentials, or the account is disabled: sign the user out |

Access tokens are short-lived and stateless; signing out revokes the refresh token. The account is checked on every request, so a disabled user is locked out immediately.

For developers: `@CurrentUser() user: AuthUser` (or `@CurrentUser('id') id: string`) gives the authenticated user inside a handler, and `@Public()` opts a handler out of the guard.

## Health and API documentation

### Health

`GET /health` is an **unwrapped, public database readiness endpoint**:

- HTTP 200: `{ "status": "ok", "database": "up" }`
- HTTP 503: `SERVICE_UNAVAILABLE` when PostgreSQL is unreachable or the check times out.
- The database probe uses a lightweight `SELECT 1` with a three-second application-level timeout.
- The request ID header and request logging remain active.

This checks API-to-database readiness, not whether every dependency or migration is healthy. Do not use database-dependent readiness as a container liveness restart policy without considering database outages.

### Swagger / OpenAPI

In non-production environments:

- UI: `http://localhost:3000/api/docs`
- JSON specification: `http://localhost:3000/api/docs-json`
- Endpoint groups start **collapsed** by default (`docExpansion: 'none'`).
- The OpenAPI security scheme supports JWT Bearer authentication for protected endpoints; public operations do not require it.

Swagger endpoints are **not registered when `NODE_ENV=production`**. To try an authenticated operation, sign in, select **Authorize** in Swagger UI, and enter the JWT access token.

## Money and date conventions

### Money

- Monetary amounts are stored as **integer minor units**; transactions require strictly positive amounts.
- Existing Prisma `Int` fields permit at most **2,147,483,647** minor units per non-negative stored amount.
- Some fields, such as an opening balance, permit zero.
- Conversion from major units uses decimal strings and `BigInt` to avoid floating-point rounding.
- Currency fraction precision must be provided explicitly; the family selects the currency.
- Derived wallet balances can be negative and may be larger than one stored amount, but must remain safe integers when represented as JavaScript `number` values.

Shared utilities in `src/common/utils/money.ts`: `assertMinorAmount()`, `toMinorUnits()`, `fromMinorUnits()`, `addMinorUnits()`.

### Dates

- Timestamps are stored in UTC; filters accept explicit ISO 8601 UTC timestamps ending in `Z`.
- Report ranges are **inclusive at `from`, exclusive at `to`**: `[from, to)`.
- Transaction list filters may provide either or both UTC bounds.
- The client calculates Jalali or Gregorian calendar month boundaries in the intended family timezone and sends UTC timestamps to the backend.

Shared utilities in `src/common/utils/date.ts`: `parseUtcDateTime()`, `createUtcDateRange()`, `createOptionalUtcDateRange()`.

## Financial domain rules

The planned V1 financial model is family-scoped:

- `transactions` is the money ledger with `INCOME`, `EXPENSE`, and `TRANSFER` types. There are no separate income or expense tables.
- Wallet balance is **calculated**, not manually stored: opening balance + income − expenses + transfers in − transfers out.
- Wallets and transactions use soft deletion; categories are archived rather than deleted.
- Transaction edits use optimistic locking with a `version` field. A stale version receives a conflict response (409).
- Membership roles belong to a user's **family membership**, not the global user record.
- A request from a non-member should produce 404 for family resources rather than revealing another family's existence.

### Family roles and permissions (V1 target)

| Action                                  | Owner | Admin | Member | Viewer |
| --------------------------------------- | :---: | :---: | :----: | :----: |
| View transactions and reports           |  Yes  |  Yes  |  Yes   |  Yes   |
| Add transactions                        |  Yes  |  Yes  |  Yes   |   No   |
| Edit/delete own transactions            |  Yes  |  Yes  |  Yes   |   No   |
| Edit/delete other members' transactions |  Yes  |  Yes  |   No   |   No   |
| Manage wallets and categories           |  Yes  |  Yes  |   No   |   No   |
| Invite/remove members                   |  Yes  |  Yes  |   No   |   No   |
| Change roles; update/delete family      |  Yes  |  No   |   No   |   No   |

Authorization must be enforced on the server for every family-scoped request.

## Testing

```bash
nvm use
npm test
npm run build
```

If Jest reports `Must use import to load ES Module`, verify that Node.js 24.9 or later is running. For session rotation, unit mocks are insufficient: test concurrent refresh requests, revoked-token replay, and transaction rollback against a real test PostgreSQL database.

## Contributing

1. Create a branch from up-to-date `main`: `feat/<short-name>`, `fix/<short-name>`, or `chore/<short-name>`.
2. Make a focused change with tests and any relevant Swagger docs under `modules/<module>/docs/`.
3. Run `npm test && npm run build` and review `git diff --check`.
4. Use Conventional Commits with `Refs #<issue>` in the commit body.
5. Open a pull request containing `Closes #<issue>` in its description. Normal feature branches use squash merges.

## Roadmap

The roadmap is managed through GitHub milestones and issues:

1. **Foundation:** error handling, response envelope, request IDs, environment validation, CORS, pagination, health, Swagger, money/date utilities.
2. **Auth and users:** registration, email verification, login, refresh rotation and logout, JWT guard, rate limiting, user profile.
3. **Families and permissions:** family creation, membership/permissions guards, member management, invitations.
4. **Wallets and categories:** wallet creation and computed balances, default/custom categories.
5. **Transactions:** income, expenses, transfers, optimistic locking, idempotent create.
6. **Reports:** monthly totals, category/member breakdowns, savings reporting.
7. **Notifications and hardening:** FCM, cleanup, Docker deployment, CI, backup, e2e testing.
8. **V1 release:** production configuration, final API documentation, release checks.

Personal wallets and reports, budgets, savings goals, offline mode, and server-generated PDF reports are outside V1 scope.
