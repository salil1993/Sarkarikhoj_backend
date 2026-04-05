# Sarkarikhoj backend

Next.js **App Router** API for government scheme discovery, eligibility checks (strict and scored modes), trending, analytics, and admin tooling. Data is stored in **MySQL** via **Prisma**.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Next.js 15
- **ORM:** Prisma 6 + MySQL
- **Validation:** Zod
- **Optional:** Upstash Redis (rate limits, short-lived caches)

## Quick start

```bash
npm install
cp .env.example .env
# Set DATABASE_URL (see .env.example comments)

npm run db:migrate:dev
npm run db:seed
npm run dev
```

If you already have `schemes` but seed fails with “table does not exist” (e.g. `tags`), apply pending migrations, then seed:

```bash
npm run db:migrate
npm run db:seed
```

Or in one command: `npm run db:setup` (`migrate deploy` + `db seed`).

- App: [http://localhost:3000](http://localhost:3000)
- Health: `GET /api/health` → `{ ok, db, legal }` (all public JSON includes a `legal` disclosure block)

### Check database connectivity

```bash
npm run db:ping
```

## Environment variables

Copy `.env.example` and fill in values. Commonly used:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL URL for Prisma (required) |
| `CORS_ORIGIN` | Comma-separated allowed browser origins (optional) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limit + API cache (optional) |
| `ADMIN_SECRET` | Protects admin and analytics dashboard routes (header `X-Admin-Secret`) |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Optional LLM for `POST /api/admin/ai-content` |

Full tables and production notes: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## NPM scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:migrate` | `prisma migrate deploy` (production) |
| `npm run db:migrate:dev` | Create/apply migrations locally |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:setup` | `migrate deploy` then `db seed` |
| `npm run db:ping` | Run `SELECT 1` against `DATABASE_URL` |
| `npm run db:studio` | Prisma Studio |

## API routes (overview)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness + DB `SELECT 1` |
| `POST` | `/api/check-eligibility` | Eligibility check (body: age, gender, state, income, occupation, category; optional `mode`, `limit`, `userId`, `tags`) |
| `GET` | `/api/schemes` | List/filter schemes (`state`, `district`, `category`, `sort=trending`, `q` / `search`) |
| `GET` | `/api/schemes/trending` | Trending schemes (views/clicks/shares) |
| `GET` | `/api/scheme/[slug]` | Single scheme (public SEO shape + `official_url`) |
| `GET` | `/api/seo/surfaces` | Programmatic SEO: `?type=category&slug=` \| `?type=location&state=&district=` \| `?type=income&max_income=` |
| `POST` | `/api/analytics/event` | Client conversion/search tracking (`eventType`, optional `meta`) |
| `POST` | `/api/engagements` | Engagement events |
| `POST` | `/api/user/register` | User registration |
| `GET` | `/api/user/notifications` | Notifications |
| `GET` | `/api/user/recommendations` | Recommendations |
| `GET` | `/api/analytics/dashboard` | Admin analytics (requires `ADMIN_SECRET`) |
| `POST` | `/api/admin/import` | CSV import |
| `POST` | `/api/admin/scrape` | Scrape probe |
| `POST` | `/api/admin/ai-content` | AI: `{ "target":"scheme","slug" }` (default) or `{ "target":"blog","topic","blogSlug?","focusKeyword?" }` |

CORS for browser calls is configured in `utils/cors.ts` and `middleware.ts` (including `OPTIONS` preflight).

**Legal:** Every response includes `legal.disclaimer` and stresses verification on **`official_url`**. Validation errors include a `fields` array: `{ field, error }`.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for layers, caching, and data flow.

## Prisma

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Seed: `prisma/seed.ts`
- CLI config: `prisma.config.ts` (seed command + datasource for Prisma CLI)

Production:

```bash
npx prisma migrate deploy
```

## Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Vercel, Hostinger/MySQL, `DATABASE_URL`, CORS, Upstash

## License

Private project (`"private": true` in `package.json`).
