# ShopQR

QR menu and restaurant ordering system. Customers scan table QR codes, order from a mobile menu, and staff manage menus, tables, bills, kitchen workflow, reports, and shop settings.

## Current Stack

- `frontend/`: Vite, React, TypeScript, Tailwind
- `backend/`: Node.js, TypeScript, Fastify
- Database/Auth/Realtime: Supabase
- Image storage: Cloudflare R2 through the backend upload API

## Project Layout

```text
backend/
  src/                 Fastify API
  supabase/            SQL migrations and setup_all.sql
  .env.example         Backend env template

frontend/
  src/                 React app
  public/              Frontend static assets
  .env.example         Frontend env template
```

## Environment

Create real env files from the templates:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Put secrets only in `.env` files. They are ignored by Git.

Backend needs Supabase and R2 values:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
IMAGE_STORAGE_DRIVER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

Frontend needs public client values:

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_IMAGE_STORAGE_DRIVER=r2
```

## Database Setup

For a new Supabase database, run:

```text
backend/supabase/setup_all.sql
```

Run it once in Supabase Dashboard -> SQL Editor. The script is idempotent and includes migrations `0001` through `0022`.

After running it, provision the first platform admin if needed:

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'your-admin@example.com'
on conflict do nothing;
```

## Local Development

Run backend:

```bash
cd backend
npm install
npm run dev
```

Run frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:4000/health
```

## Build

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run build
```

## Notes

- Do not commit `.env`, `.env.local`, `dist`, logs, or `node_modules`.
- Image uploads go through `POST /api/storage/upload` on the backend, then to Cloudflare R2.
- Keep `backend/supabase/setup_all.sql` in sync with migration files when adding database changes.
