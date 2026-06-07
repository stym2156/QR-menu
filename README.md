# ShopQR

QR menu and restaurant ordering system. Customers scan table QR codes, order from a mobile menu, and staff manage menus, tables, bills, kitchen workflow, reports, and shop settings.

## Current Stack

- `frontend/`: Vite, React, TypeScript, Tailwind
- `frontend/api/`: Vercel Functions for lightweight API routes
- `backend/`: Node.js, TypeScript, Fastify fallback for separate API hosting
- Database/Auth/Realtime: Supabase
- Image storage: Cloudflare R2 through `/api/storage/upload`

## Project Layout

```text
backend/
  src/                 Fastify API
  supabase/            SQL migrations and setup_all.sql
  .env.example         Backend env template

frontend/
  api/                 Vercel API functions
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

Vercel frontend/API needs public Supabase client values plus private R2 values:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=
VITE_IMAGE_STORAGE_DRIVER=r2

SUPABASE_URL=
SUPABASE_ANON_KEY=
IMAGE_STORAGE_DRIVER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE_URL=
```

If you run the optional Fastify backend separately, it needs:

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

For local frontend development with the separate Fastify backend, set:

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

Run frontend only. It can call same-origin Vercel Functions when deployed:

```bash
cd frontend
npm install
npm run dev
```

For local R2 upload testing with the existing Fastify backend, run backend too and set `VITE_API_URL=http://localhost:4000`:

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

Vercel API health check after deploy:

```text
/api/health
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
- Image uploads go through `POST /api/storage/upload`, then to Cloudflare R2.
- On Vercel, deploy `frontend/` as the project root with build command `npm run build` and output directory `dist`.
- Keep `backend/supabase/setup_all.sql` in sync with migration files when adding database changes.
