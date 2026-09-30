// Publishes an Instagram carousel straight through the Graph API, using the same
// System User token as the rest of the app. (Make.com's carousel module needs the
// file list in a shape it does not let us build dynamically, so Make simply calls
// our endpoint for carousels and this does the work.)
//
// Flow, as documented by Meta: one "carousel item" container per photo/video ->
// wait until each is FINISHED -> one CAROUSEL container listing them -> wait ->
// publish it.

import type { MediaItem } from "./scheduler";

const TOKEN = process.env.META_ACCESS_TOKEN;
const VERSION = process.env.META_API_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!TOKEN) throw new Error("META_ACCESS_TOKEN is not set.");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: TOKEN }),
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message: string; code?: number; error_user_msg?: string } };
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(e ? `${e.error_user_msg || e.message}${e.code ? ` (code ${e.code})` : ""}` : `Graph API ${res.status}`);
  }
  return json;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!TOKEN) throw new Error("META_ACCESS_TOKEN is not set.");
  const res = await fetch(`${BASE}${path}?${new URLSearchParams({ ...params, access_token: TOKEN })}`, { cache: "no-store" });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Graph API ${res.status}`);
  return json;
}

// Waits until Instagram has finished downloading / processing a container.
async function waitUntilReady(containerId: string, what: string, maxSeconds: number): Promise<void> {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const s = await get<{ status_code?: string; status?: string }>(`/${containerId}`, { fields: "status_code,status" });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`Instagram could not process ${what}${s.status ? `: ${s.status}` : ""}. Check it is a JPEG photo or an MP4 (H.264) video under Instagram's size limits.`);
    }
    await sleep(3000);
  }
  throw new Error(`Instagram took too long to process ${what}.`);
}

export interface CarouselResult {
  mediaId: string;
  permalink: string | null;
}

export async function publishInstagramCarousel(igUserId: string, media: MediaItem[], caption: string): Promise<CarouselResult> {
  if (media.length < 2 || media.length > 10) throw new Error("A carousel needs 2 to 10 photos or videos.");

  // 1. one container per item
  const children: string[] = [];
  for (const [i, m] of media.entries()) {
    const params: Record<string, string> = m.kind === "video"
      ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" }
      : { image_url: m.url, is_carousel_item: "true" };
    const created = await post<{ id: string }>(`/${igUserId}/media`, params);
    await waitUntilReady(created.id, `item ${i + 1} (${m.name ?? m.kind})`, m.kind === "video" ? 150 : 45);
    children.push(created.id);
  }

  // 2. the carousel itself
  const carousel = await post<{ id: string }>(`/${igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption });
  await waitUntilReady(carousel.id, "the carousel", 60);

  // 3. publish
  const published = await post<{ id: string }>(`/${igUserId}/media_publish`, { creation_id: carousel.id });
  const info = await get<{ permalink?: string }>(`/${published.id}`, { fields: "permalink" }).catch(() => ({ permalink: undefined }));
  return { mediaId: published.id, permalink: info.permalink ?? null };
}
