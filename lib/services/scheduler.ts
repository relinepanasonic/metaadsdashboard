// Shared bits of the Social Media scheduler: types, per-platform rules, the
// validation both the composer and the API use. (Safe to import from the browser;
// the server-only Make.com secret check lives in schedulerAuth.ts.)

export type Platform = "instagram" | "facebook" | "threads" | "tiktok";
export type ContentType = "reel" | "video" | "image" | "carousel" | "text";
export type TargetStatus = "pending" | "claimed" | "published" | "failed" | "cancelled";

export const PLATFORMS: Platform[] = ["instagram", "facebook", "threads", "tiktok"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  tiktok: "TikTok",
};

export const CONTENT_LABEL: Record<ContentType, string> = {
  reel: "Reel",
  video: "Video",
  image: "Photo",
  carousel: "Carousel",
  text: "Text only",
};

// Caption limits published by each platform.
export const CAPTION_LIMIT: Record<Platform, number> = { instagram: 2200, facebook: 63206, threads: 500, tiktok: 2200 };

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

// Returns an error message, or null when the combination can actually be posted.
export function validatePost(input: { contentType: ContentType; media: MediaItem[]; caption: string; targets: TargetInput[] }): string | null {
  const { contentType, media, caption, targets } = input;
  if (targets.length === 0) return "Pick at least one account to post to.";

  const videos = media.filter((m) => m.kind === "video").length;
  const images = media.filter((m) => m.kind === "image").length;

  if (contentType === "text") {
    if (media.length > 0) return "A text-only post cannot have media.";
    if (!caption.trim()) return "Write some text to post.";
    const bad = targets.find((t) => t.platform === "instagram" || t.platform === "tiktok");
    if (bad) return `${PLATFORM_LABEL[bad.platform]} cannot publish text-only posts — add a photo or video, or remove it.`;
  } else if (contentType === "reel" || contentType === "video") {
    if (videos !== 1 || images > 0) return "Add exactly one video.";
  } else if (contentType === "image") {
    if (images !== 1 || videos > 0) return "Add exactly one photo.";
  } else if (contentType === "carousel") {
    if (media.length < 2 || media.length > 10) return "A carousel needs 2 to 10 photos or videos.";
    const bad = targets.find((t) => t.platform === "tiktok");
    if (bad) return "TikTok does not support carousels here — remove TikTok or use a single video.";
  }

  if (targets.some((t) => t.platform === "tiktok") && contentType !== "reel" && contentType !== "video") {
    return "TikTok needs a video.";
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
