# Daily Cost

An Android app for tracking **family** expenses and income. Several family members use their own phones and share the same family data. Personal (per-member) tracking comes in V2.

# Main Goals
- Track daily family expenses and income, with every entry showing who added it;
- Show a monthly family report on expenses and income;
- Be simple enough for everyday use by the whole family, in Dari, Pashto and English.

# Tech Stack
- **Android:** Kotlin, Jetpack Compose (RTL-ready), ViewModel, Hilt
- **Backend:** NestJS, Prisma, PostgreSQL (online-only, single source of truth)
- **Auth:** phone/email + password, JWT access tokens, rotating refresh tokens
- **Push notifications:** Firebase Cloud Messaging

# Features
## V1
- Simple authentication (register, login, logout);
- Family creation, invitation by code, and member management;
- RBAC with fixed roles: Owner, Admin, Member, Viewer;
- Family wallets (cash, bank, mobile money, savings) with an opening balance;
- Family savings (a wallet of type savings, filled by transfers);
- Family expense categories (defaults + custom);
- Family income categories (defaults + custom);
- Family incomes;
- Family expenses;
- Transfers between wallets;
- Family monthly reports (income vs expenses, by category, by member, wallet balances);
- Push notifications for family activity;
- Multi-language: Dari / Pashto / English, with RTL layout;
- Jalali (Solar Hijri) and Gregorian calendar option, Persian digit support;
- Online only: the backend is the single source of truth.

## V2
- Personal wallets;
- Personal savings;
- Personal reports;
- Personal expense categories;
- Personal incomes;
- Personal expenses;
- Privacy: personal data is hidden from other family members by default.

## Later / Not in scope now
- Offline mode;
- Budgets per category (limits and alerts);
- Savings goals with targets;
- Server-generated PDF reports.

# Roles and Permissions (V1)
Roles are fixed and defined in code. The role belongs to the **membership** (a user can have different roles in different families).

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| View reports and transactions | Yes | Yes | Yes | Yes |
| Add transactions | Yes | Yes | Yes | No |
| Edit/delete own transactions | Yes | Yes | Yes | No |
| Edit/delete anyone's transactions | Yes | Yes | No | No |
| Manage wallets and categories | Yes | Yes | No | No |
| Invite or remove members | Yes | Yes | No | No |
| Change roles, delete family | Yes | No | No | No |

# Default Categories
Created for each family when it is registered. Families can rename, hide or add their own.
- **Expense:** food & groceries, health, education, fun, transport, internet & phone, rent/housing, utilities, clothing, kids, gifts & guests, charity, other.
- **Income:** salary, business, remittance, gift, other.

# Design Rules
- `transactions` is the single source of truth for money; there are no separate expense/income tables.
- Wallet balance = opening balance + income - expense + transfers in - transfers out (calculated, never stored by hand).
- Amounts are stored as integers in minor units (no floats); currency is set per family.
- Every data table is scoped by `family_id`; permissions are checked on the server for every request.
- Soft delete (`deleted_at`) for wallets and transactions; reports ignore deleted rows.
- Edits use a `version` number (optimistic locking) so two people can't silently overwrite each other.
- Dates are stored in UTC; the app converts for display and computes Jalali/Gregorian month boundaries for reports.

# Entities
## V1
1. **users**
    - id
    - full_name
    - phone / email
    - password_hash
    - language
    - status
    - created_at
2. **families**
    - id
    - name
    - owner_id
    - currency
    - calendar (jalali / gregorian)
    - status
    - created_at
3. **members**
    - id
    - family_id
    - user_id
    - role (owner / admin / member / viewer)
    - status
    - joined_at
4. **invitations**
    - id
    - family_id
    - code
    - role
    - created_by
    - expires_at
    - used_by
    - used_at
5. **wallets**
    - id
    - family_id
    - name
    - type (cash / bank / mobile_money / savings)
    - opening_balance_minor
    - status
    - created_by
    - created_at
    - deleted_at
6. **categories**
    - id
    - family_id
    - type (income / expense)
    - name (custom) / name_key (default, translated in the app)
    - icon
    - sort_order
    - status
    - created_at
7. **transactions**
    - id
    - family_id
    - type (income / expense / transfer)
    - wallet_id
    - to_wallet_id (transfer only)
    - category_id (income / expense only)
    - amount_minor
    - note
    - occurred_at
    - created_by
    - updated_by
    - version
    - created_at
    - updated_at
    - deleted_at
8. **refresh_tokens**
    - id
    - user_id
    - token_hash
    - expires_at
    - revoked_at
    - created_at
9. **device_tokens** (push notifications)
    - id
    - user_id
    - token
    - platform
    - created_at

## V2 (planned changes)
- Add `scope` (family / personal) and `owner_user_id` to `wallets` and `categories`;
- Personal wallets, savings, categories, incomes and expenses reuse the same tables, filtered by scope and owner.

# Build Order
1. Backend and auth (register, login, create a family)
2. Invitations and members, with roles enforced
3. Wallets and categories (default categories seeded in three languages)
4. Transactions (income, expense, transfer) and wallet balances
5. Monthly report screen
6. Localization polish: RTL, Jalali calendar, Persian digits
7. Push notifications
