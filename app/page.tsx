export default function Home() {
  return (
    <main>
      <h1>SarkariKhojKhabar API</h1>
      <p>
        Next.js + Prisma + MySQL backend. Public and admin routes under <code>/api</code>.
      </p>
      <h2>Core</h2>
      <ul>
        <li>
          <code>GET /api/health</code>
        </li>
        <li>
          <code>POST /api/check-eligibility</code> — scored or strict mode, optional{" "}
          <code>userId</code>
        </li>
        <li>
          <code>GET /api/schemes</code> — <code>?state=</code>, <code>?category=</code> (tag),{" "}
          <code>?sort=trending</code>
        </li>
        <li>
          <code>GET /api/schemes/trending</code>
        </li>
        <li>
          <code>GET /api/scheme/[slug]</code>
        </li>
        <li>
          <code>POST /api/engagements</code> — view / click / share
        </li>
      </ul>
      <h2>Users</h2>
      <ul>
        <li>
          <code>POST /api/user/register</code>
        </li>
        <li>
          <code>GET /api/user/recommendations</code> — header <code>X-User-Id</code>
        </li>
        <li>
          <code>GET|PATCH /api/user/notifications</code> — header <code>X-User-Id</code>
        </li>
      </ul>
      <h2>Admin (X-Admin-Secret)</h2>
      <ul>
        <li>
          <code>GET /api/analytics/dashboard</code>
        </li>
        <li>
          <code>POST /api/admin/import</code> — JSON <code>&#123; csv &#125;</code>
        </li>
        <li>
          <code>POST /api/admin/scrape</code> — probe portal URL
        </li>
        <li>
          <code>POST /api/admin/ai-content</code> — <code>&#123; slug &#125;</code> (needs Groq/OpenAI)
        </li>
      </ul>
    </main>
  );
}
