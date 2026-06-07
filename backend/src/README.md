# Backend Layer

Server-only code lives here.

- `auth/` resolves dashboard sessions and role access.
- `customer/` contains customer menu queries and order actions.
- `dashboard/` contains dashboard aggregate queries.

UI components and pages should stay in `src/app` or `src/components`.
Supabase reads/writes that must run on the server should be added here first,
then imported by routes/pages.
