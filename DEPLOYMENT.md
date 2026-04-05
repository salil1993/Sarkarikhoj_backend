# Deployment: Sarkari Scheme Eligibility Checker (Next.js + Prisma + MySQL)

This project is a **Next.js App Router** app deployed on **Vercel** as serverless functions. API routes live under `app/api/*`. The database is **MySQL**, accessed with **Prisma**.

## Prerequisites

- Node.js 20+ (matches Vercel defaults)
- A MySQL 8+ instance (managed options: PlanetScale-compatible MySQL, AWS RDS, Aiven, etc.)
- A Vercel account (for production hosting)

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | MySQL connection string for Prisma |
| `CORS_ORIGIN` | No | Comma-separated allowed browser `Origin` values (preferred on Vercel) |
| `CORS_ORIGINS` | No | Same as `CORS_ORIGIN` if set (legacy fallback) |
| `UPSTASH_REDIS_REST_URL` | No* | Upstash Redis REST URL for **distributed** rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No* | Upstash Redis REST token |

\*If both Upstash variables are omitted, the API uses an **in-memory** rate limiter. That is only suitable for single-instance or local development. On Vercel, **set Upstash** (or another shared store) for consistent limits across function instances.

Example `.env.local` (local):

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE_NAME"
# Optional:
# CORS_ORIGIN="https://sarkarikhojkhabar.com,https://www.sarkarikhojkhabar.com"
# UPSTASH_REDIS_REST_URL="https://....upstash.io"
# UPSTASH_REDIS_REST_TOKEN="..."
```

## Database setup (first time)

1. Create an empty MySQL database.
2. Point `DATABASE_URL` at it (use TLS and strong credentials in production).
3. Apply migrations:

```bash
export DATABASE_URL="mysql://..."
npx prisma migrate deploy
```

4. Seed example schemes:

```bash
npx prisma db seed
```

For local iteration (non-production), you may use `npx prisma migrate dev` instead of `migrate deploy`.

## Local development

```bash
npm install
cp .env.example .env.local
# Edit DATABASE_URL in .env.local

npx prisma migrate dev
npx prisma db seed

npm run dev
```

- App: `http://localhost:3000`
- List schemes: `GET http://localhost:3000/api/schemes`
- Check eligibility: `POST http://localhost:3000/api/check-eligibility` with JSON body (see below).

### Example: check eligibility

```bash
curl -s -X POST http://localhost:3000/api/check-eligibility \
  -H "Content-Type: application/json" \
  -d '{"age":35,"gender":"male","state":"punjab","income":200000,"occupation":"farmer","category":"general"}'
```

## Vercel deployment

1. Push this repository to GitHub (or GitLab/Bitbucket) and **Import** the project in Vercel.
2. In the Vercel project **Settings → Environment Variables**, add:
   - `DATABASE_URL` (production and preview as needed)
   - Optional: `CORS_ORIGINS`, Upstash keys
3. **Build command** (default is fine): `npm run build` (runs `prisma generate` via `postinstall` / `build` script).
4. Deploy.

### After the first production deploy

Run migrations against the **production** database (from a trusted machine or CI):

```bash
DATABASE_URL="mysql://...production..." npx prisma migrate deploy
DATABASE_URL="mysql://...production..." npx prisma db seed
```

Automate this in CI (GitHub Actions, etc.) with secrets, or use a migration service your team trusts.

### Serverless + MySQL connection pooling

Serverless functions open many short-lived connections. Use a **pooler** or a host that supports serverless-friendly MySQL (for example, a pooled connection string from your provider). Without pooling, you may hit `Too many connections` under load.

Prisma docs: [Deploy to Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel) and [Connection management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management).

### Rate limiting on Vercel

Create a free [Upstash Redis](https://upstash.com/) database, copy the REST URL and token into Vercel env vars. The app will automatically switch from in-memory limiting to Upstash.

### CORS

By default, API responses do **not** send `Access-Control-Allow-Origin`. Set `CORS_ORIGINS` to a comma-separated allowlist so browser-based frontends on other origins can call the API. `OPTIONS` is implemented on the API routes for preflight.

## API summary

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/check-eligibility` | Body: `age`, `gender`, `state`, `income`, `occupation`, optional `category`. Returns eligible schemes. |
| `GET` | `/api/schemes` | All schemes |
| `GET` | `/api/scheme/[slug]` | One scheme by `slug` |

Security features: Zod validation, string sanitization, structured errors, security headers on `/api/*`, and rate limiting (Upstash recommended in production).

## Project layout

- `app/api/` — Next.js route handlers
- `services/eligibilityEngine.ts` — Eligibility rules + Prisma `where` builder
- `db/client.ts` — Prisma singleton for serverless
- `prisma/` — `schema.prisma`, migrations, seed
- `utils/` — validation, sanitization, rate limit, CORS, errors
- `types/` — shared TypeScript types
