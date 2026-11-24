# Daily Cost API

Backend for **Daily Cost**, an Android app (web admin planned) for tracking **family** expenses and income. Several family members use their own phones and share one set of data: wallets, categories, transactions and a monthly report.

> **Status:** early development. The foundation is in place (project scaffold, Prisma schema and migration, global error handling, response envelope). Auth, families, wallets, transactions and reports are planned; see [Roadmap](#roadmap).

## Tech stack

| Area           | Choice                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| Framework      | NestJS 12 (CommonJS), TypeScript                                              |
| Database       | PostgreSQL 15, Prisma 6                                                       |
| Auth (planned) | Phone or email + password (argon2), JWT access token, rotating refresh tokens |
| Tests          | Jest                                                                          |
| Local database | Docker Compose                                                                |
| Push (planned) | Firebase Cloud Messaging                                                      |

## Requirements

- **Node 24** (`>= 24.15`). The version is pinned in `.nvmrc`; run `nvm use`. Nest 12 publishes ES modules, and Jest only loads them on Node 24.9 or newer.
- Docker (Docker Desktop is fine)
- npm

## Getting started

```bash
nvm use
npm install
docker compose up -d          # PostgreSQL on localhost:5433
npx prisma migrate dev        # apply migrations and generate the client
npm run start:dev             # http://localhost:3000/api/v1
```

Create a `.env` file in the project root (it is git-ignored, never commit it):

| Variable                   | Example                                                                   | Notes                                                                             |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `DB_USER`                  | `dailycost`                                                               | Used by `docker-compose.yml`                                                      |
| `DB_PASSWORD`              | `change-me`                                                               | Avoid `@` and `/`, or URL-encode them in `DATABASE_URL`                           |
| `DB_NAME`                  | `dailycost`                                                               |                                                                                   |
| `DB_PORT`                  | `5433`                                                                    | Host port, so it doesn't clash with another local Postgres                        |
| `DATABASE_URL`             | `postgresql://dailycost:change-me@localhost:5433/dailycost?schema=public` | Must match the values above                                                       |
| `JWT_ACCESS_SECRET`        | _(32+ random characters)_                                                 | Required, at least 32 characters                                                  |
| `ACCESS_TOKEN_TTL_SECONDS` | `900`                                                                     |                                                                                   |
| `REFRESH_TOKEN_TTL_DAYS`   | `30`                                                                      |                                                                                   |
| `PORT`                     | `3000`                                                                    | Optional                                                                          |
| `CORS_ORIGINS`             | `http://localhost:5173`                                                   | Optional. Comma separated browser origins allowed to call the API (the web admin) |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The API validates its configuration at startup. If a variable is missing or invalid it exits with code 1 and a message naming every problem (values are never printed). See `.env.example` for the full list, defaults and allowed ranges; the rules live in `src/config/env.validation.ts`.

## CORS

The web admin runs in a browser, so its origin must be allowed. Set `CORS_ORIGINS` to a comma separated list of exact origins (`https://admin.example.com`, no path, no trailing slash, no wildcard). Invalid entries stop the API at startup.

- **Production:** only the listed origins get CORS headers. Unknown origins are not rejected with an error; the response simply has no `Access-Control-*` headers, so the browser blocks the call. An empty list means no browser origin is allowed.
- **Development:** when the list is empty, any `localhost` or `127.0.0.1` origin is allowed.
- **The Android app is unaffected:** native clients send no `Origin` header.
- Allowed request headers: `Authorization`, `Content-Type`, `X-Request-Id`. `X-Request-Id` is exposed to the browser, so the admin can show it in error messages. Cookies are not used (`credentials: false`).

## Health Check

`GET /health` is a public database readiness endpoint intended for hosting and container health checks.

- Returns HTTP `200` with `{ "status": "ok", "database": "up" }` when PostgreSQL responds successfully.
- Returns HTTP `503` with error code `SERVICE_UNAVAILABLE` when the database is unreachable or the check times out.
- Does not require authentication.
- Excluded from the `/api/v1` global prefix and response wrapper.
- Retains the standard request ID header and request logging.
- Runs a lightweight `SELECT 1` query with a 3-second application-level timeout.

The endpoint checks API-to-database connectivity, not the status of migrations or every dependency. Use it for readiness monitoring rather than database-dependent liveness restarts.

## Swagger API Documentation

Daily Cost uses OpenAPI/Swagger for interactive API documentation.

### Development

Start the backend:

```bash
npm run start:dev
```

Open Swagger UI at:

`http://localhost:3000/api/docs`

The OpenAPI JSON specification is available at:

`http://localhost:3000/api/docs-json`

### Authentication

Protected endpoints use JWT Bearer authentication.

1. Obtain an access token using the login endpoint once authentication is implemented.
2. Open Swagger UI and select **Authorize**.
3. Enter the JWT access token.
4. Execute protected endpoints using Swagger UI.

Public endpoints, including `/health`, do not require authentication.

### Production

Swagger UI and OpenAPI document endpoints are not registered when `NODE_ENV=production`.

Do not enable Swagger publicly in production without a deliberate security review.

### API Response Format

Successful responses follow the `{ data, meta }` convention. Paginated responses include `total`, `limit`, and `offset` inside `meta`.

Errors use the standard `{ error }` envelope with a stable error code and request ID.

## Scripts

| Command                                | Purpose                      |
| -------------------------------------- | ---------------------------- |
| `npm run start:dev`                    | Run with file watching       |
| `npm run build`                        | Compile to `dist/`           |
| `npm run start:prod`                   | Run the compiled build       |
| `npm test`                             | Unit tests                   |
| `npm run test:cov`                     | Unit tests with coverage     |
| `npx prisma migrate dev --name <name>` | Create and apply a migration |
| `npx prisma studio`                    | Browse the database          |

Database containers: `docker compose stop` / `start` keeps the data, `docker compose down -v` wipes it.

## Project structure

```
prisma/
  schema.prisma             data model (9 tables)
  migrations/               SQL migrations
src/
  main.ts                   global prefix /api/v1, validation pipe
  app.module.ts             module wiring, global filter and interceptor
  prisma/                   PrismaModule and PrismaService (global)
  common/                   shared building blocks
    constants/              error codes (default categories: planned)
    exceptions/             AppException
    filters/                global exception filter
    interceptors/           response envelope
    pagination/             Paginated result
    decorators/             @SkipResponseWrap (auth decorators: planned)
    types/  utils/
  modules/                  one folder per feature (planned)
    auth  users  families  members  invitations
    wallets  categories  transactions  reports  notifications
test/                       end-to-end tests
```

## API conventions

All routes live under `/api/v1`. Every route will require a JWT unless marked public. Routes of a family live under `/families/:familyId/...` and are limited to its active members.

### Responses

Success:

```json
{ "data": { "id": "..." }, "meta": { "path": "/api/v1/wallets" } }
```

Lists add pagination to `meta`:

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

Errors (the HTTP status is always set to match):

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

- Controllers return plain values; list endpoints return `new Paginated(items, total, limit, offset)`.
- `@SkipResponseWrap()` opts a route out of the envelope (health check, file downloads).
- `path` is the full request path without the query string.
- **Clients must branch on `error.code`, never on `error.message`.** Codes are stable and machine-readable so the Android and web apps can show Dari, Pashto or English text. Messages are English, for developers.
- Validation failures use `VALIDATION_FAILED`, with the failing fields in `details`.
- Unknown errors return a generic 500. Internals are logged on the server and never sent to the client.
- Core codes: `BAD_REQUEST`, `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`. The full list is in `src/common/constants/error-codes.ts`.
- Every request gets an id: a valid incoming `X-Request-Id` header (1-64 characters: letters, digits, `.`, `_`, `-`) is reused, otherwise one is generated. It is returned in the `X-Request-Id` response header, in every error body as `requestId`, and in the server logs. Quote it when reporting a problem.

### Domain rules

- **Money** is an integer in minor units (`amountMinor`, always > 0). The sign comes from the transaction type; the currency is set per family.
- **`transactions` is the ledger**: type `INCOME`, `EXPENSE` or `TRANSFER`. A wallet balance is calculated (opening balance + income - expense + transfers in - transfers out), never stored.
- **Soft delete** (`deletedAt`) for transactions and wallets. Categories are archived, not deleted.
- **Optimistic locking**: updating a transaction requires the `version` the client last saw; a mismatch returns 409.
- **Dates are UTC.** Reports take `from` (inclusive) and `to` (exclusive); the app converts Jalali or Gregorian month boundaries.
- Non-members get **404** (not 403) for a family's routes, so family ids can't be probed.

### Roles

| Action                                    | Owner | Admin | Member | Viewer |
| ----------------------------------------- | ----- | ----- | ------ | ------ |
| View data and reports                     | yes   | yes   | yes    | yes    |
| Add transactions, edit own                | yes   | yes   | yes    | no     |
| Edit or delete anyone's                   | yes   | yes   | no     | no     |
| Manage wallets and categories             | yes   | yes   | no     | no     |
| Invite and remove members                 | yes   | yes   | no     | no     |
| Change roles, update or delete the family | yes   | no    | no     | no     |

## Testing

```bash
npm test
```

If every suite fails with `Must use import to load ES Module`, you are on Node older than 24.9. Run `nvm use`.

## Contributing workflow

- Branch from a fresh `main`: `feat/<short-name>`, `fix/...`, `chore/...`.
- Conventional Commits, with `Refs #<issue>` in the body.
- Open a pull request with `Closes #<issue>` in the description so the issue closes on merge.
- Run `npm test && npm run build` before pushing.

## Roadmap

Tracked as GitHub milestones and issues:

1. **Foundation**: error handling, response envelope, request ID, env validation, CORS, pagination, health check, Swagger
2. **Auth and users**: register, login, refresh tokens, JWT guard, rate limiting
3. **Families and access control**: families, membership and permission guards, members, invitations
4. **Wallets and categories**
5. **Transactions**: validation rules, optimistic locking, idempotent create
6. **Reports**: monthly summary, by category and member, savings
7. **Notifications and hardening**: FCM, cleanup jobs, Docker, CI, backups, e2e tests
8. **V1 release**

## Money and Date Utilities

Shared utilities are implemented in `src/common/utils/`.

### Money

- Monetary values are stored as integer minor units.
- Single monetary amounts stored in Prisma `Int` columns are limited to 2,147,483,647 minor units.
- Transaction amounts must be positive.
- Zero is allowed for applicable values such as wallet opening balances.
- Major-unit conversion uses decimal strings and `BigInt`, avoiding floating-point rounding errors.
- Currency precision must be provided explicitly.
- Calculated balances may be negative and must remain within JavaScript's safe integer range.
- The Android application handles currency presentation and localization.

### Dates

- Timestamps are stored in UTC.
- API date filters use explicit ISO 8601 UTC timestamps ending in `Z`.
- Report ranges use inclusive `from` and exclusive `to` boundaries.
- Optional date bounds are supported for transaction lists.
- Invalid dates and reversed ranges are rejected.
- Jalali and Gregorian calendar month boundaries are calculated using the family's intended timezone, then converted to UTC before submission to the backend.

### Utilities

- `assertMinorAmount()`
- `toMinorUnits()`
- `fromMinorUnits()`
- `addMinorUnits()`
- `parseUtcDateTime()`
- `createUtcDateRange()`
- `createOptionalUtcDateRange()`

All monetary and date helpers are pure functions, independent of NestJS, Prisma, and HTTP request handling.

## Authentication

Accounts use **email and password**. Passwords are hashed with argon2id.

| Endpoint                         | Purpose                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/register`            | Create an account (`fullName`, `email`, `password`, optional `language` fa/ps/en). Returns the user with `emailVerified: false`, and emails a 6-digit code. No tokens yet. |
| `POST /auth/verify-email`        | `{ email, code }`. The code expires after `EMAIL_CODE_TTL_MINUTES` (default 15) and allows 5 wrong attempts.                                                               |
| `POST /auth/resend-verification` | `{ email }`. Always answers 200; sends a new code at most once per minute.                                                                                                 |
| `POST /auth/login`               | `{ email, password }`. Returns `user`, `accessToken` and `refreshToken`.                                                                                                   |

Error codes the apps handle: `ALREADY_EXISTS` (409, email taken), `INVALID_CREDENTIALS` (401, wrong email or password; this is _not_ an expired token), `EMAIL_NOT_VERIFIED` (403, ask for the code), `VERIFICATION_CODE_INVALID` (400, wrong code) and `VERIFICATION_CODE_EXPIRED` (400, request a new code).

The verification email is written in the user's language (Dari, Pashto or English). Local development sends mail to Mailpit; production needs a real SMTP server (`MAIL_HOST` and friends).
