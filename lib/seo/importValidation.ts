// Checks a blog post sent by an outside writer (the ERP's AI Office) before it is stored in the
// Content Engine. Pure and dependency-free so it can be tested. The rules mirror the ones the
// Content Engine's own drafting prompt (lib/services/contentWriter.ts) enforces.

import { FIRSTHAND_MARKER } from "./constants";

// The website template maps these to CSS classes, so they must stay exactly these five strings.
export const TAGS = ["Optimization", "Indonesia News", "Foreign Sellers", "Consumer Behavior", "Case Study"] as const;

export interface ImportInput {
  keyword?: unknown;
  title?: unknown;
  slug?: unknown;
  metaDescription?: unknown;
  excerpt?: unknown;
  bodyHtml?: unknown;
  tag?: unknown;
  language?: unknown;
  mode?: unknown;
  externalId?: unknown;
  source?: unknown;
}

export interface CleanPost {
  keyword: string;
  title: string;
  slug: string;
  metaDescription: string;
  excerpt: string;
  bodyHtml: string;
  tag: (typeof TAGS)[number];
  mode: "draft" | "approve";
  externalId: string;
  source: string;
  needsExperience: boolean; // the "Dari Pengalaman Kami" placeholder is still in the body
}

export function cleanSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length <= 60) return s;
  return s.slice(0, 60).replace(/-[^-]*$/, ""); // cut at a word boundary, never mid-word
}

// Anything that could run code on the live site, or restyle it, is refused rather than "cleaned".
const FORBIDDEN_HTML = /<\s*(script|iframe|style|object|embed|form|link|meta|base)\b|\son[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html|<\s*\/?\s*(html|head|body)\b/i;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function validateImport(input: ImportInput): { ok: true; post: CleanPost } | { ok: false; error: string } {
  const keyword = str(input.keyword);
  const title = str(input.title);
  const slugRaw = str(input.slug);
  const metaDescription = str(input.metaDescription);
  const excerpt = str(input.excerpt);
  const bodyHtml = str(input.bodyHtml);

  for (const [name, v] of [["keyword", keyword], ["title", title], ["slug", slugRaw], ["metaDescription", metaDescription], ["excerpt", excerpt], ["bodyHtml", bodyHtml]] as const) {
    if (!v) return { ok: false, error: `Missing field: ${name}` };
  }

  const language = str(input.language) || "id";
  if (language !== "id") return { ok: false, error: 'Only Indonesian posts are accepted (language must be "id").' };

  if (title.length > 90) return { ok: false, error: "title is too long (max 90 characters)." };
  if (metaDescription.length > 200) return { ok: false, error: "metaDescription is too long (max 200 characters)." };
  if (excerpt.length > 220) return { ok: false, error: "excerpt is too long (max 220 characters)." };
  if (bodyHtml.length < 600) return { ok: false, error: "bodyHtml is too short to be a real article (under 600 characters)." };
  if (bodyHtml.length > 200_000) return { ok: false, error: "bodyHtml is too large (max 200,000 characters)." };

  if (FORBIDDEN_HTML.test(bodyHtml)) {
    return { ok: false, error: "bodyHtml contains something not allowed (script, iframe, style, form, inline event handlers, javascript: links, or html/head/body wrappers). Send clean body markup only." };
  }

  const slug = cleanSlug(slugRaw);
  if (slug.length < 3) return { ok: false, error: "slug is empty after cleaning — use letters, numbers and hyphens." };

  const mode = str(input.mode) === "approve" ? "approve" : "draft";
  const needsExperience = bodyHtml.includes(FIRSTHAND_MARKER);
  if (mode === "approve" && needsExperience) {
    return { ok: false, error: 'mode "approve" needs the "Dari Pengalaman Kami" section filled with a real experience. Send it as a draft, then fill it in the Content Engine.' };
  }

  const tagRaw = str(input.tag);
  const tag = (TAGS as readonly string[]).includes(tagRaw) ? (tagRaw as (typeof TAGS)[number]) : "Optimization";

  return {
    ok: true,
    post: {
      keyword,
      title,
      slug,
      metaDescription,
      excerpt,
      bodyHtml,
      tag,
      mode,
      externalId: str(input.externalId).slice(0, 120),
      source: (str(input.source) || "ai-office").slice(0, 40),
      needsExperience,
    },
  };
}
