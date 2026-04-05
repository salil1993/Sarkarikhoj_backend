# Sarkari Khoj Khabar — Backend Architecture

This document describes the **current** production-oriented layout, **target** API namespaces, and how to evolve the system without breaking the live site.

## 1. Current stack

- **Runtime:** Next.js App Router (API routes only for most traffic)
- **Database:** MySQL + Prisma ORM
- **Validation:** Zod (`utils/validation.ts`, `utils/adminSchemas.ts`)
- **Cache / limits:** Upstash Redis (optional) + in-memory fallback (`utils/cache.ts`, `utils/rateLimit.ts`)
- **Compliance copy:** Static defaults in `services/legalDisclosure.ts`, **overridable** via `site_settings` and `GET /api/public/settings`

## 2. Domain modules (separation of concerns)

| Area | Location | Responsibility |
|------|----------|----------------|
| Public scheme discovery | `services/schemesQueryService.ts`, `controllers/schemesListController.ts`, `app/api/schemes/` | List, filters, search; only `publishStatus = published` |
| Scheme detail | `app/api/scheme/[slug]/` | Single scheme; analytics view |
| Eligibility (indicative) | `services/eligibilityScoreEngine.ts`, `services/eligibilityEngine.ts`, `app/api/check-eligibility/` | Rules + legacy fallback; **not** approval |
| SEO surfaces | `services/seoSurfaceService.ts`, `app/api/seo/surfaces/` | Category / location / income listings |
| Trending | `services/trendingService.ts`, `app/api/schemes/trending/` | Engagement-weighted signals |
| User | `services/userService.ts`, `app/api/user/*` | Register, notifications, recommendations |
| Admin | `app/api/admin/*`, `controllers/admin/*`, `services/admin*.ts` | Secret-gated operations (see below) |
| Compliance config | `services/siteSettingsService.ts`, `app/api/public/settings`, `app/api/admin/settings` | Disclaimers, UI labels |
| Curation | `services/featuredCollectionsService.ts`, `app/api/public/collections`, `app/api/admin/collections` | Manual / auto collections (auto wiring TBD) |
| Audit | `services/auditLogService.ts`, `app/api/admin/audit-logs` | Admin mutations (starts with scheme CRUD) |
| Analytics | `services/analyticsService.ts`, `app/api/analytics/*`, `app/api/admin/analytics` | First-party events + dashboards |

## 3. Data model (implemented vs planned)

### Implemented in schema (this repo)

- **Scheme** — core content + `publishStatus` workflow (`draft` | `review` | `published` | `archived` — use strings consistently), `shortSummary`, `lastVerifiedAt`, `featuredImageUrl`, `adminNotes`, `complianceNotes`, FK to **SchemeCategory** (optional; denormalized `category` string retained for search).
- **SchemeCategory**, **BlogCategory** — taxonomy tables.
- **Tag** / **SchemeOnTag** — audience / topic tags.
- **EligibilityRule** — weighted criteria consumed by the score engine.
- **User**, **SavedScheme**, **UserEligibilityCheck**, **Notification** — dashboard primitives.
- **AnalyticsEvent** — append-only events.
- **SeoBlogPost** — blog + SEO columns (`metaTitle`, `canonicalUrl`, `robots`, etc.).
- **SeoPage** — persisted landing payloads + SEO / FAQ / JSON-LD hooks.
- **AdminUser** — foundation for future JWT/session auth (password hash storage).
- **AuditLog** — admin actions (`actor` = `admin_secret` | `admin_user` | `system`).
- **SiteSetting** — key/value JSON for legal copy and UI labels.
- **FeaturedCollection** / **FeaturedCollectionItem** — curated lists.

### Naming alignment with product language

- **Public “user”** = `User` (`external_id` from client).
- **Admin operator** = `AdminUser` (not a government account).

## 4. API route map

### Public (no admin secret)

| Path | Role |
|------|------|
| `GET /api/schemes` | List + filters (published only) |
| `GET /api/scheme/[slug]` | Detail (published only) |
| `POST /api/check-eligibility` | Indicative scoring |
| `GET /api/schemes/trending` | Trending |
| `GET /api/seo/surfaces` | SEO listing payloads |
| `GET /api/public/settings` | **Merged legal + UI labels** (for hero disclaimer / CTAs) |
| `GET /api/public/collections` | Published featured collections (`?slug=`) |
| `GET /api/health` | Liveness + DB probe |
| `POST /api/analytics/event` | Client analytics |
| `POST /api/user/register`, `GET /api/user/*` | User dashboard APIs |

### Admin (`X-Admin-Secret` + middleware; migrate to JWT + RBAC)

| Path | Role |
|------|------|
| `GET/POST /api/admin/schemes`, `PUT/DELETE …/[id]` | Scheme CRUD + **audit** |
| `GET/POST /api/admin/blogs`, `PUT/DELETE …/[id]` | Blog CRUD |
| `GET/PUT /api/admin/settings` | Site / compliance settings |
| `GET/POST /api/admin/collections` | Featured collections |
| `GET /api/admin/audit-logs` | Audit trail |
| `GET /api/admin/analytics` | Bundled metrics |
| `POST /api/admin/import`, `POST /api/admin/seo/generate`, … | Ingestion / SEO generation |

### Target namespaces (incremental migration)

Introduce **`/api/public/*` proxies** or move handlers without breaking clients:

- `GET /api/public/schemes` → same handler as `/api/schemes`
- `POST /api/public/eligibility` → alias `check-eligibility`

Use **Next.js rewrites** or thin route files that delegate to shared handlers.

## 5. Eligibility engine (indicative only)

- **DB rules** in `eligibility_rules` drive `evaluateDbRule` / `scoreFromDbRules`.
- **Legacy** columns used when rules empty.
- **Public scoring cache** key bumped to `platform:schemes:scoring:v3` when publish filtering shipped.
- Responses must continue to carry **eligibility_notice**; frontend should also read **`/api/public/settings`** for `ui.indicative_eligibility_label`.

Future: AND/OR groups stored as JSON on `Scheme` or a `RuleGroup` table; keep evaluation in one service.

## 6. Security

- **Today:** `ADMIN_SECRET` header + Edge middleware for `/api/admin/*`.
- **Next:** `AdminUser` + bcrypt + signed JWT (`jose` or session cookie), RBAC on `role`, retain audit logs.
- **Writes:** Zod on all admin bodies; avoid mass assignment — use explicit DTOs in services.
- **Rate limits:** Per-route identifiers in `utils/rateLimit.ts`.

## 7. Performance

- Redis-backed caches for eligibility (scored mode), scheme scoring list, trending, SEO surfaces.
- **Published** filter pushed to Prisma `where` to shrink payloads.
- Pagination on admin lists; add cursor pagination for very large tables later.

## 8. Operations

- Migrations: `prisma/migrations/*`
- Seed: `npm run db:seed` (tags, categories, schemes, default site settings)
- Tests: `npm run test` (Vitest; start with response normalizers / rules)

## 9. Roadmap (priority)

1. Admin JWT login + RBAC middleware; map `AuditLog.adminUserId`.
2. OR / AND rule groups + admin UI contract.
3. Full blog CMS (related posts, reading time auto, blocks).
4. SEO page admin CRUD + sitemap feed.
5. Background aggregation job for analytics summaries (optional Queue).
6. Re-export public APIs under `/api/public/*` with rewrites.

This backend is **informational / private publisher**, not a government system — all copy and models should keep **official links** and **indicative eligibility** clearly separated.
