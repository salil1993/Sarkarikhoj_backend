# SarkariKhojKhabar backend architecture

## Layers

| Layer | Role |
|-------|------|
| **`app/api/**/route.ts`** | HTTP boundary: CORS, rate limits, parse request, call services/controllers, return JSON with **legal envelope**. |
| **`controllers/`** | Optional thin orchestration (e.g. `schemesListController` wires list + analytics). |
| **`services/`** | Business logic: eligibility scoring, trending SQL, SEO surfaces, AI generation, presenters, analytics writes. |
| **`utils/`** | Cross-cutting: CORS, cache (Upstash / memory), validation + structured Zod errors, public JSON helpers, errors + Prisma mapping. |
| **`prisma/`** | Schema, migrations, seed — single MySQL database. |

## Data model (high level)

- **`schemes`** — canonical records; `apply_link` is the **official URL** (exposed as `official_url` in APIs). Optional `district`, `category`, `eligibility_rules_json` for SEO and tooling.
- **Relational** tags, rules, benefits, documents, FAQs — used by the eligibility engine and presenters.
- **`scheme_engagements`** — `view` / `click` / `share` weights for trending.
- **`analytics_events`** — server-side events (eligibility, views, searches, SEO surfaces, conversions).
- **`seo_blog_posts`** — AI-generated draft blogs (admin), optional publish flag.

## Legal & SEO contract

- Successful and error JSON bodies include **`legal`**: disclaimer, official-sources notice, eligibility notice (no guaranteed approval language).
- Public scheme objects use **`title`**, **`official_url`**, **`last_updated`**, structured **`benefits`**, **`eligibility_rules`** (JSON snapshot or derived from rules).
- **`GET /api/seo/surfaces`** — cached programmatic SEO payloads: `type=category|location|income` with query params (see README).

## Caching & scale

- **Upstash Redis** (optional): rate limits, eligibility score cache, trending list, SEO surfaces.
- **Without Redis**: in-memory fallbacks (per serverless instance).
- Stateless API routes suitable for horizontal scale on Vercel; DB is the main shared bottleneck — use connection limits and indexes (`state`+`district`, `category`).

## Security

- Zod on inputs; sanitisation in `utils/sanitize.ts` where used.
- Rate limiting per IP / client id.
- Admin routes gated by `ADMIN_SECRET` (`X-Admin-Secret`).
