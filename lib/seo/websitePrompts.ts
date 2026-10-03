// The wording the "Connect to Website" page hands to Claude Code in a website's own project.
// The contract below is exactly what lib/services/publishKeyword.ts sends — keep them in step.

export const PUBLISH_CONTRACT = `POST <your endpoint>            e.g. https://<site-or-automation>/api/publish
Authorization: Bearer <PUBLISH_SECRET>
Content-Type: application/json
X-Dry-Run: 1                     (optional — see "Dry run" below)

Body:
{
  "title": "…",            required, plain text
  "slug": "…",             required, url-safe, lowercase, e.g. "cara-jualan-online-di-shopee"
  "metaDescription": "…",  required, <= ~160 chars
  "excerpt": "…",          required, 1–2 sentences for the blog card
  "bodyHtml": "<h2>…",     required, the article body as HTML (h2/h3/p/ul/ol/li/a/strong/em/blockquote/table)
  "tag": "…",              required, a category label
  "language": "id"         "id" (Indonesian) unless told otherwise
}

200  { "ok": true, "url": "https://<domain>/blog/<slug>/" }     published (url = the live page)
200  { "ok": true, "dryRun": true }                              dry run: everything validated, NOTHING published
400  { "ok": false, "error": "Missing field: title" }            bad / incomplete body
401  { "ok": false, "error": "Unauthorized" }                    missing or wrong secret
409  { "ok": false, "error": "Slug already published: <slug>" }  never overwrite an existing post
5xx  { "ok": false, "error": "<what went wrong>" }`;

const RULES = `Rules the endpoint must follow
1. Authenticate FIRST: compare the Authorization header with process.env.PUBLISH_SECRET using a constant-time comparison. No secret configured = reject everything (401). Never log the secret.
2. Validate every required field is a non-empty string BEFORE doing any work. An EMPTY body must return 400 "Missing field: …" and publish nothing — the app's "Test connection" button relies on this.
3. Dry run: if the request has header X-Dry-Run: 1 (or body {"dryRun": true}), run authentication + validation + slug-collision check, then answer {"ok":true,"dryRun":true} WITHOUT publishing anything.
4. bodyHtml is injected into a live page, so sanitize it: reject (400) if it contains <script, <iframe, <style, <object, <embed, javascript: URLs or inline on*= handlers.
5. Never overwrite: if the slug already exists, answer 409.
6. Keep the site consistent: after publishing, the blog index/listing and sitemap.xml must include the new post exactly once (no duplicates if it is somehow called twice).
7. Respond with JSON only, always including "ok". Return the final public URL in "url".
8. Do not put the secret in the repository. It lives in the host's environment variables as PUBLISH_SECRET.`;

const HOW_TO_TEST = `When you are done
- Show me the deployed endpoint URL.
- Show me these curl checks and their output (replace the URL and use my real secret from the environment, not pasted into the repo):
    curl -i -X POST <URL>                                            -> 401
    curl -i -X POST <URL> -H "Authorization: Bearer WRONG" -d '{}'  -> 401
    curl -i -X POST <URL> -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -d '{}'   -> 400 Missing field
    curl -i -X POST <URL> -H "Authorization: Bearer $SECRET" -H "X-Dry-Run: 1" -H "Content-Type: application/json" -d '{"title":"t","slug":"test-dry-run","metaDescription":"m","excerpt":"e","bodyHtml":"<p>x</p>","tag":"Test","language":"id"}'   -> 200 dryRun true, and NOTHING appears on the site
- Tell me the exact value format PUBLISH_SECRET expects, and that you have NOT committed any secret.`;

// For the Profesor Toko Online website: its blog-automation project already has a written spec.
export function profesorSitePrompt(domain: string): string {
  return `I am connecting my Digital Ads app (Meta Ads Engine) to this website (${domain}) so finished blog posts can be published straight from that app. Work in this project.

1. Read BLOG-PIPELINE-SPEC.md in the project root and carry out TASKS 1 to 5 in the order it gives. Do TASK 6 (cleanup of live posts) only if I confirm each deletion separately.
2. On top of that spec, the endpoint in TASK 4 (api/publish.js) must ALSO follow this contract exactly — it is what my app sends:

${PUBLISH_CONTRACT}

${RULES}

Extra notes for this project
- Keep using the existing FTP upload and the blog-automation render pipeline; do not replace them.
- Tag values the app may send: "Optimization", "Indonesia News", "Foreign Sellers", "Consumer Behavior", "Case Study" (keep the existing tag -> art mapping; unknown tags fall back to a default).
- Add PUBLISH_SECRET to the Vercel project's Production environment variables. I will give you the value — ask me for it, do not invent one.
- Deploy to Vercel after each step, as the spec says.

${HOW_TO_TEST}`;
}

// For any other Claude-built website: inspect it, then implement the same contract in whatever way fits.
export function genericSitePrompt(domain: string): string {
  return `I am connecting my Digital Ads app (Meta Ads Engine) to this website (${domain}) so finished blog posts can be published straight from that app. Work in this project.

First, inspect how this site is built and where its blog posts live (static HTML uploaded over FTP/SFTP, a Next.js app with MDX/markdown files, a database/CMS table, or something else). Tell me in 3-4 lines what you found and which approach you will use, then wait for my OK before changing anything.

Then add ONE authenticated endpoint that receives a finished post and publishes it using this site's own mechanism and template (same look as the existing posts, same blog listing, same sitemap, same URL pattern).

Contract (this is exactly what my app sends):

${PUBLISH_CONTRACT}

${RULES}

Notes
- If the site is a static host with no server code, say so — then propose the smallest separate publisher (for example a small Vercel function that renders the page and uploads it), and wait for my OK.
- If publishing means committing a file to a git repository, make the endpoint create that commit (or open a pull request if I prefer review) and return the URL the post will have once deployed.
- Add PUBLISH_SECRET as an environment variable on the host. I will give you the value — ask me for it, do not invent one.

${HOW_TO_TEST}`;
}
