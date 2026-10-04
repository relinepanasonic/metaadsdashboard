// The prompt for Claude Code in the ERP project (Accounting Prof) that connects its AI Office to this
// app's Content Engine. The contract mirrors app/api/seo/content/import/route.ts and the writing rules
// mirror lib/services/contentWriter.ts — keep all three in step.

export function aiOfficeBlogPrompt(endpoint: string): string {
  return `I want my AI Office (src/app/ai-office, src/lib/ai/*, src/app/api/ai-office/*) to write blog posts and hand them to my Digital Ads app, where a person reviews and publishes them to my websites. Inspect the AI Office code first (how teams, agents, tasks, missions and their outputs are stored; the "Blog SEO Team" style blueprint in src/lib/ai/blueprint.ts), then propose a SHORT plan and WAIT for my approval before changing code or the database. Read the relevant guide in node_modules/next/dist/docs/ first (this Next.js version has breaking changes).

## The receiving side (already built and live — do not change it)
POST ${endpoint}
Authorization: Bearer <ADS_INGEST_SECRET>
Content-Type: application/json

{
  "site": { "domain": "profesoronline.id", "pathPrefix": null },   // or { "domain": "nanocare.id", "pathPrefix": "/ac-tipe-hu/" } for a sub-website
  "keyword": "cara jualan online di shopee",                       // the target keyword, required
  "title": "…",  "slug": "…",  "metaDescription": "…",  "excerpt": "…",
  "bodyHtml": "<h2>…</h2><p>…</p>…",
  "tag": "Optimization",                                           // one of: Optimization | Indonesia News | Foreign Sellers | Consumer Behavior | Case Study
  "language": "id",
  "externalId": "<the AI Office task id>",                          // makes retries safe: the same id UPDATES one draft, never creates a second
  "mode": "draft",                                                  // always "draft" from the ERP. A person approves and publishes in the Digital Ads app.
  "dryRun": false                                                   // true = validate only, store nothing (use it for a "Test connection" button)
}

Answers
200 { ok:true, id, site, status:"drafted", updated:boolean, needsExperience:boolean, reviewUrl }   stored as a draft
200 { ok:true, dryRun:true, … }                                                                    validated only
400 { ok:false, error }   something in the post is not acceptable (the message says what, in English)
401                        wrong or missing secret
404                        that website is not set up in the Digital Ads app (add it there first)
409                        keyword already published, or the slug is already used by another post
5xx                        retry later

## Writing standards the agents MUST follow (the receiving side rejects or the reviewer will reject otherwise)
1. The whole article in natural Bahasa Indonesia (language "id"). Not a stiff translation.
2. NEVER invent statistics, percentages, market figures or GMV numbers. If a claim needs a number you do not know for certain, write the sentence without a number.
3. NEVER invent case studies, client results, testimonials or brand names.
4. Mention a law or regulation only if you are certain of its exact name (Indonesia's data-protection law is UU PDP, UU No. 27/2022 — not "PDPA").
5. The body MUST contain exactly ONE section "<h2>Dari Pengalaman Kami</h2>" whose content is exactly this single placeholder paragraph, left untouched — a human fills it with a real experience, and publishing stays locked until they do:
   <p>[ISI PENGALAMAN ANDA DI SINI — contoh nyata dari toko yang kamu tangani, angka asli, atau kesalahan yang sering kamu temui]</p>
6. Limits: title under 70 characters; slug lowercase kebab-case, url-safe, under 60 characters, cut at a word boundary; metaDescription under 155 characters and containing the main keyword; excerpt one sentence under 140 characters; body 800–1200 words.
7. bodyHtml uses ONLY <p>, <h2>, <ul>, <ol>, <li>, <strong>, <em>. No <html>/<head>/<body>, no inline style, no images, no scripts, no iframes, no links with javascript:.
Style: confident, direct, data-based without invented data, no filler; premium but down to earth. The business is "Profesor Toko Online", an e-commerce optimisation consultancy in Indonesia (since 2021) serving Shopee, TikTok Shop and Tokopedia sellers.

## What to build in the ERP
1. Env vars (server only — never exposed to the browser, never logged, never committed): ADS_APP_URL = ${endpoint.replace(/\/api\/seo\/content\/import$/, "")} and ADS_INGEST_SECRET. I will give you the secret value; ask me, do not invent one. Add both names to .env.example.
2. A server-side function that validates the post object against the standards above (check the placeholder is present exactly once, the limits, the tag list, no forbidden tags) and POSTs it to the endpoint with a 30 s timeout, mapping every answer to a plain-language message for the user (409 -> "already published or slug in use", 404 -> "that website is not set up in Digital Ads yet", etc.).
3. In the AI Office, make the blog team's FINAL step (the editor) return one JSON object with exactly these fields: keyword, title, slug, metaDescription, excerpt, bodyHtml, tag. Update the blueprint / agent job desks accordingly, and parse + validate that JSON (if it is invalid, ask the agent once to fix it, then show the error). Give the writer agent the writing standards above.
4. In Mission Control, for a finished blog task, a "Send to Blog Queue" button with: a website selector (profesoronline.id and the sub-websites I use; make this a small editable list), the keyword, and the result (status, a link to reviewUrl). Prevent sending the same task twice by remembering the returned id; a re-send of an edited task is allowed and updates the same draft (same externalId). Also a "Test connection" button that sends a dryRun.
5. Only superadmin / founder may send. Record who sent what and when (use the existing mission memory or a small table — propose which in your plan).
6. Nothing in the ERP may publish to a website by itself. mode is always "draft". An optional setting "send automatically when the editor finishes" is fine, default OFF.
7. Tests: invalid JSON from an agent, a post missing the placeholder, wrong secret (401), website not found (404), duplicate (409), success, retry with the same task id (updated:true).

When done, show me the exact steps to set ADS_INGEST_SECRET in Vercel, and confirm that no secret is in the repo.`;
}
