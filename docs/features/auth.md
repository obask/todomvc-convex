# Auth

## What
Better Auth handles email/password sessions against the Postgres auth tables. The Better Auth tables use default camelCase column names such as `emailVerified`; app-owned `todos` columns remain snake_case.

## Where
- `auth.ts` - Better Auth instance and Postgres dialect setup.
- `db/schema.sql` - SQL schema for Better Auth tables and todos.
