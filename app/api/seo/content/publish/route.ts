import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { FIRSTHAND_MARKER } from "@/lib/seo/constants";

export const maxDuration = 120;

// Hands a finished draft to the blog-automation service, which renders it with
// the site template and uploads it to Hostinger over FTP.
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });

  const endpoint = process.env.BLOG_PUBLISH_URL;
  const secret = process.env.BLOG_PUBLISH_SECRET;
  if (!endpoint || !secret) {
    return NextResponse.json({ ok: false, error: "BLOG_PUBLISH_URL / BLOG_PUBLISH_SECRET belum diset." }, { status: 500 });
  }

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "Missing keyword id" }, { status: 400 });

  const { data: row, error: readErr } = await db
    .from("saved_keywords")
    .select("id,keyword,status,draft_title,draft_slug,draft_meta,draft_excerpt,draft_html,draft_tag")
    .eq("id", id)
    .single();
  if (readErr || !row) return NextResponse.json({ ok: false, error: "Keyword not found" }, { status: 404 });
  if (row.status === "published") {
    return NextResponse.json({ ok: false, error: "Kata kunci ini sudah dipublikasikan." }, { status: 409 });
  }
  if (!row.draft_html || !row.draft_title || !row.draft_slug) {
    return NextResponse.json({ ok: false, error: "Draft belum lengkap." }, { status: 400 });
  }
  if (row.draft_html.includes(FIRSTHAND_MARKER)) {
    return NextResponse.json(
      { ok: false, error: "Bagian \"Dari Pengalaman Kami\" masih placeholder. Isi dulu dengan pengalaman nyata sebelum publish." },
      { status: 400 }
    );
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        title: row.draft_title,
        slug: row.draft_slug,
        metaDescription: row.draft_meta ?? "",
        excerpt: row.draft_excerpt ?? "",
        bodyHtml: row.draft_html,
        tag: row.draft_tag ?? "Optimization",
        language: "id",
      }),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Tidak bisa menghubungi publisher: ${(err as Error).message}` }, { status: 502 });
  }

  const result = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !result.ok) {
    return NextResponse.json({ ok: false, error: result.error || `Publisher error ${res.status}` }, { status: 502 });
  }

  await db
    .from("saved_keywords")
    .update({ status: "published", published_url: result.url, published_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true, url: result.url });
}
