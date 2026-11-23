# Daily Cost API

Backend for **Daily Cost**, an Android app (web admin planned) for tracking **family** expenses and income. Several family members use their own phones and share one set of data: wallets, categories, transactions and a monthly report.

> **Status:** early development. The foundation is in place (project scaffold, Prisma schema and migration, global error handling, response envelope). Auth, families, wallets, transactions and reports are planned; see [Roadmap](#roadmap).

## Tech stack

| Area | Choice |
|---|---|
| Framework | NestJS 12 (CommonJS), TypeScript |
| Database | PostgreSQL 15, Prisma 6 |
| Auth (planned) | Phone or email + password (argon2), JWT access token, rotating refresh tokens |
| Tests | Jest |
| Local database | Docker Compose |
| Push (planned) | Firebase Cloud Messaging |

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

| Variable | Example | Notes |
|---|---|---|
| `DB_USER` | `dailycost` | Used by `docker-compose.yml` |
| `DB_PASSWORD` | `change-me` | Avoid `@` and `/`, or URL-encode them in `DATABASE_URL` |
| `DB_NAME` | `dailycost` | |
| `DB_PORT` | `5433` | Host port, so it doesn't clash with another local Postgres |
| `DATABASE_URL` | `postgresql://dailycost:change-me@localhost:5433/dailycost?schema=public` | Must match the values above |
| `JWT_ACCESS_SECRET` | *(32+ random characters)* | Required, at least 32 characters |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | |
| `PORT` | `3000` | Optional |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The API validates its configuration at startup. If a variable is missing or invalid it exits with code 1 and a message naming every problem (values are never printed). See `.env.example` for the full list, defaults and allowed ranges; the rules live in `src/config/env.validation.ts`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` | Run with file watching |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm test` | Unit tests |
| `npm run test:cov` | Unit tests with coverage |
| `npx prisma migrate dev --name <name>` | Create and apply a migration |
| `npx prisma studio` | Browse the database |

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
{ "data": [ ], "meta": { "path": "/api/v1/transactions", "total": 120, "limit": 50, "offset": 0 } }
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

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| View data and reports | yes | yes | yes | yes |
| Add transactions, edit own | yes | yes | yes | no |
| Edit or delete anyone's | yes | yes | no | no |
| Manage wallets and categories | yes | yes | no | no |
| Invite and remove members | yes | yes | no | no |
| Change roles, update or delete the family | yes | no | no | no |

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
