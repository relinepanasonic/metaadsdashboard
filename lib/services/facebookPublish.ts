// Posts to a Facebook Page straight through the Graph API, with the same System User token the
// rest of the app uses (no Make.com). The token asks Facebook for the Page's own access token,
// then: text -> /feed, photo -> /photos, several photos -> unpublished photos attached to one
// /feed post, video -> /videos.

import type { MediaItem } from "./scheduler";

const VERSION = process.env.META_API_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

interface GraphError { error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number } }

async function call<T>(path: string, params: Record<string, string>, method: "GET" | "POST"): Promise<T> {
  const url = method === "GET" ? `${BASE}${path}?${new URLSearchParams(params)}` : `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    cache: "no-store",
    ...(method === "POST" ? { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(e ? `${e.error_user_msg || e.message}${e.code ? ` (code ${e.code})` : ""}` : `Graph API ${res.status}`);
  }
  return json;
}

// The System User token can read each Page's own token; posting needs that one.
async function pageToken(pageId: string): Promise<string> {
  const system = process.env.META_ACCESS_TOKEN;
  if (!system) throw new Error("META_ACCESS_TOKEN is not set.");
  try {
    const r = await call<{ access_token?: string }>(`/${pageId}`, { fields: "access_token", access_token: system }, "GET");
    if (!r.access_token) throw new Error("no page token");
    return r.access_token;
  } catch (e) {
    throw new Error(`This app's Meta token cannot post to that Facebook Page. Give the System User "Create content" access to the Page in Business Settings → Pages. (${e instanceof Error ? e.message : e})`);
  }
}

export interface FacebookPost {
  caption: string;
  contentType: string; // reel | video | image | carousel | text
  media: MediaItem[];
}

export async function publishFacebook(pageId: string, post: FacebookPost): Promise<{ id: string; url: string }> {
  const token = await pageToken(pageId);
  const message = post.caption;
  const link = (id: string) => `https://www.facebook.com/${id}`;

  if (post.contentType === "text") {
    if (!message.trim()) throw new Error("Write some text to post.");
    const r = await call<{ id: string }>(`/${pageId}/feed`, { message, access_token: token }, "POST");
    return { id: r.id, url: link(r.id) };
  }

  if (post.contentType === "image") {
    const m = post.media[0];
    if (!m) throw new Error("This post has no photo.");
    const r = await call<{ id: string; post_id?: string }>(`/${pageId}/photos`, { url: m.url, caption: message, access_token: token }, "POST");
    return { id: r.post_id ?? r.id, url: link(r.post_id ?? r.id) };
  }

  if (post.contentType === "carousel") {
    // Facebook has no swipeable carousel for a Page post; several photos in one post is the equivalent.
    if (post.media.some((m) => m.kind === "video")) throw new Error("Facebook can post several photos in one post, but not videos mixed in.");
    if (post.media.length < 2) throw new Error("Add at least two photos.");
    const ids: string[] = [];
    for (const m of post.media) {
      const r = await call<{ id: string }>(`/${pageId}/photos`, { url: m.url, published: "false", access_token: token }, "POST");
      ids.push(r.id);
    }
    const attached: Record<string, string> = {};
    ids.forEach((id, i) => { attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
    const r = await call<{ id: string }>(`/${pageId}/feed`, { message, ...attached, access_token: token }, "POST");
    return { id: r.id, url: link(r.id) };
  }

  // reel / video
  const v = post.media[0];
  if (!v) throw new Error("This post has no video.");
  const r = await call<{ id: string }>(`/${pageId}/videos`, { file_url: v.url, description: message, access_token: token }, "POST");
  return { id: r.id, url: `https://www.facebook.com/${pageId}/videos/${r.id}` };
}
