// Shared bits of the Social Media scheduler: types, per-platform rules, the
// validation both the composer and the API use. (Safe to import from the browser;
// the server-only Make.com secret check lives in schedulerAuth.ts.)

export type Platform = "instagram" | "facebook" | "threads" | "x" | "tiktok" | "youtube";
export type ContentType = "reel" | "video" | "image" | "carousel" | "text";
export type TargetStatus = "pending" | "claimed" | "published" | "failed" | "cancelled";

export const PLATFORMS: Platform[] = ["instagram", "facebook", "threads", "x", "tiktok", "youtube"];

// Accounts for these are linked on the Clients page as "publishing accounts"
// (Instagram and Facebook are linked there too, but also feed the Dashboard).
export const PUBLISH_ONLY_PLATFORMS: Platform[] = ["threads", "x", "tiktok", "youtube"];

// Platforms that have a working route in the Make.com scenario. Add a platform here once its
// route is built (Facebook, Threads and X are listed in the composer but locked until then).
export const ACTIVE_PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube Shorts",
};

export const CONTENT_LABEL: Record<ContentType, string> = {
  reel: "Reel",
  video: "Video",
  image: "Photo",
  carousel: "Carousel",
  text: "Text only",
};

// Caption limits published by each platform (YouTube: the description; the first line is the title).
export const CAPTION_LIMIT: Record<Platform, number> = { instagram: 2200, facebook: 63206, threads: 500, x: 280, tiktok: 2200, youtube: 5000 };
export const YOUTUBE_TITLE_LIMIT = 100;

export interface MediaItem {
  url: string;
  kind: "image" | "video";
  name?: string;
  size?: number;
}

export interface TargetInput {
  platform: Platform;
  handle?: string | null;
  externalId?: string | null;
}

// The first line of the caption, used as the YouTube video title.
export function titleFromCaption(caption: string): string {
  return (caption.split(/\r?\n/).find((l) => l.trim()) ?? "").trim().slice(0, YOUTUBE_TITLE_LIMIT);
}

// Why a platform cannot be picked for this content type (shown in the composer), or null when it can.
export function platformBlock(platform: Platform, contentType: ContentType): string | null {
  if (!ACTIVE_PLATFORMS.includes(platform)) return "Not set up in Make yet";
  if (contentType === "text" && (platform === "instagram" || platform === "tiktok" || platform === "youtube")) return "Needs a photo or video";
  if (contentType === "image" && (platform === "tiktok" || platform === "youtube")) return "Needs a video";
  if (contentType === "carousel" && (platform === "tiktok" || platform === "facebook" || platform === "youtube")) return "No carousels";
  return null;
}

// Returns an error message, or null when the combination can actually be posted.
export function validatePost(input: { contentType: ContentType; media: MediaItem[]; caption: string; targets: TargetInput[] }): string | null {
  const { contentType, media, caption, targets } = input;
  if (targets.length === 0) return "Pick at least one account to post to.";
  const has = (p: Platform) => targets.some((t) => t.platform === p);

  const videos = media.filter((m) => m.kind === "video").length;
  const images = media.filter((m) => m.kind === "image").length;

  if (contentType === "text") {
    if (media.length > 0) return "A text-only post cannot have media.";
    if (!caption.trim()) return "Write some text to post.";
    const bad = targets.find((t) => t.platform === "instagram" || t.platform === "tiktok" || t.platform === "youtube");
    if (bad) return `${PLATFORM_LABEL[bad.platform]} cannot publish text-only posts — add a photo or video, or remove it.`;
  } else if (contentType === "reel" || contentType === "video") {
    if (videos !== 1 || images > 0) return "Add exactly one video.";
  } else if (contentType === "image") {
    if (images !== 1 || videos > 0) return "Add exactly one photo.";
  } else if (contentType === "carousel") {
    if (media.length < 2 || media.length > 10) return "A carousel needs 2 to 10 photos or videos.";
    const bad = targets.find((t) => t.platform === "tiktok" || t.platform === "facebook" || t.platform === "youtube");
    if (bad) return `${PLATFORM_LABEL[bad.platform]} does not take carousels here — remove it, or post a single photo or video.`;
    if (has("x") && (media.length > 4 || videos > 0)) return "X takes up to 4 photos in one post (no videos in a set) — remove X or trim the photos.";
  }

  if ((has("tiktok") || has("youtube")) && contentType !== "reel" && contentType !== "video") {
    return `${has("youtube") ? "YouTube Shorts" : "TikTok"} needs a video.`;
  }

  if (has("youtube")) {
    if (!titleFromCaption(caption)) return "YouTube needs a title — write it as the first line of the caption.";
    if (caption.split(/\r?\n/).find((l) => l.trim())!.trim().length > YOUTUBE_TITLE_LIMIT) return `The first line becomes the YouTube title and must be ${YOUTUBE_TITLE_LIMIT} characters or fewer.`;
  }

  // Instagram only accepts JPEG photos (a PNG is refused with an unhelpful error).
  if (has("instagram")) {
    const notJpeg = media.find((m) => m.kind === "image" && !/\.jpe?g($|\?)/i.test(m.name ?? m.url));
    if (notJpeg) return `Instagram only accepts JPEG photos — "${notJpeg.name ?? "this photo"}" isn't one. Save it as .jpg first.`;
  }

  for (const t of targets) {
    if (caption.length > CAPTION_LIMIT[t.platform]) {
      return `The caption is too long for ${PLATFORM_LABEL[t.platform]} (${caption.length}/${CAPTION_LIMIT[t.platform]}).`;
    }
  }
  return null;
}

// What the post looks like overall, worked out from its targets.
export type PostState = "draft" | "cancelled" | "scheduled" | "publishing" | "published" | "partial" | "failed";

export function postState(status: string, targets: { status: TargetStatus }[]): PostState {
  if (status === "draft") return "draft";
  if (status === "cancelled") return "cancelled";
  const live = targets.filter((t) => t.status !== "cancelled");
  if (live.length === 0) return "cancelled";
  const published = live.filter((t) => t.status === "published").length;
  const failed = live.filter((t) => t.status === "failed").length;
  const claimed = live.filter((t) => t.status === "claimed").length;
  const pending = live.filter((t) => t.status === "pending").length;
  if (published === live.length) return "published";
  if (failed === live.length) return "failed";
  if (pending === 0 && claimed === 0) return "partial";
  if (claimed > 0 || published > 0 || failed > 0) return "publishing";
  return "scheduled";
}
