// ============================================================================
// GOOGLE SEARCH CONSOLE SERVICE  — service-account auth, zero extra deps.
// ----------------------------------------------------------------------------
// Uses the standard Google "JWT Bearer" service-account flow: we sign a JWT
// with the service account's private key (RS256, via Node's built-in crypto),
// exchange it for an access token, then call the Search Console REST API.
//
// One shared service account serves every connected property — staff never
// see or handle a key. They just add the service account's email as a
// Restricted user on their site in Search Console, then paste the site URL
// into our app.
//
// Env vars (server-side only, set once by a Superadmin):
//   GOOGLE_SC_SERVICE_ACCOUNT_EMAIL   the service account's email
//   GOOGLE_SC_PRIVATE_KEY             its PEM private key, \n escaped
// ============================================================================

const SA_EMAIL = process.env.GOOGLE_SC_SERVICE_ACCOUNT_EMAIL;
const SA_KEY_RAW = process.env.GOOGLE_SC_PRIVATE_KEY;

export const SEARCH_CONSOLE_CONFIGURED = Boolean(SA_EMAIL && SA_KEY_RAW);

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/webmasters/v3";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function base64url(input: Buffer | string): string {
  return Buffer.from(input as string)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  if (!SA_EMAIL || !SA_KEY_RAW) {
    throw new Error("Search Console service account not configured.");
  }
  const privateKey = SA_KEY_RAW.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: SA_EMAIL,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const crypto = await import("node:crypto");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function gscFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Search Console API ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

// Verifies the service account actually has access to a property yet
// (i.e. staff completed the "add as user" step). Throws a clear error if not.
export async function verifySiteAccess(siteUrl: string): Promise<void> {
  await gscFetch(`/sites/${encodeURIComponent(siteUrl)}`);
}

export interface SearchAnalyticsRow {
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Daily search performance for a date range (used to build the traffic chart
// and month-over-month comparisons).
export async function fetchSearchAnalytics(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<SearchAnalyticsRow[]> {
  const json = await gscFetch<{ rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> }>(
    `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 1000,
      }),
    }
  );
  return (json.rows ?? []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Real queries your site already gets impressions for (used by the Research
// tab). This is NOT keyword research (no search volume / difficulty — GSC
// doesn't expose that for terms you don't already rank on); it's an honest
// "what are people actually finding you for" view.
export async function fetchTopQueries(
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit = 250
): Promise<QueryRow[]> {
  const json = await gscFetch<{ rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> }>(
    `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit,
      }),
    }
  );
  return (json.rows ?? [])
    .map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

export interface IndexCoverageSummary {
  indexed: number;
  notIndexed: number;
}

// Search Console's Inspection API is per-URL only (no bulk "how many pages
// indexed" endpoint) — for a dashboard-level number we approximate using the
// sitemaps report, which does return indexed/submitted counts per sitemap.
export async function fetchSitemapCoverage(siteUrl: string): Promise<IndexCoverageSummary> {
  const json = await gscFetch<{ sitemap?: Array<{ contents?: Array<{ submitted?: string; indexed?: string }> }> }>(
    `/sites/${encodeURIComponent(siteUrl)}/sitemaps`
  );
  let submitted = 0;
  let indexed = 0;
  for (const sm of json.sitemap ?? []) {
    for (const c of sm.contents ?? []) {
      submitted += Number(c.submitted) || 0;
      indexed += Number(c.indexed) || 0;
    }
  }
  return { indexed, notIndexed: Math.max(0, submitted - indexed) };
}
