export default function Home() {
  return (
    <main>
      <h1>Sarkari Scheme Eligibility Checker</h1>
      <p>API is available under <code>/api</code>. Use the deployment guide for environment setup.</p>
      <ul>
        <li>
          <code>POST /api/check-eligibility</code>
        </li>
        <li>
          <code>GET /api/schemes</code>
        </li>
        <li>
          <code>GET /api/scheme/[slug]</code>
        </li>
      </ul>
    </main>
  );
}
