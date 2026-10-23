// Viral Radar: turning a niche account's recent media into "which Reels beat their own account's usual results".
// A Reel is a winner not because it has big numbers (a big account always has big numbers) but because it beat
// what THAT account normally gets. So the score is the Reel's views divided by the account's median Reel views.

export interface RawMedia {
  id: string;
  caption?: string | null;
  media_product_type?: string | null;
  media_type?: string | null;
  permalink?: string | null;
  timestamp?: string | null;
  like_count?: number | null;
  comments_count?: number | null;
  view_count?: number | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
}

export interface ScoredReel {
  mediaId: string;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  postedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  outlier: number | null;
  basis: "views" | "engagement" | "none";
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// "@Some.Account", "https://instagram.com/some.account/" or "some.account" -> "some.account" (or null if it is not a handle)
export function normHandle(input: string): string | null {
  let h = input.trim().toLowerCase();
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?#].*$/, "").replace(/^@/, "");
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

export function isReel(m: RawMedia): boolean {
  return m.media_product_type === "REELS" || (m.media_type === "VIDEO" && /\/reel\//.test(m.permalink ?? ""));
}

const MIN_FOR_VIEWS_BASIS = 5; // need this many Reels with a view count to trust "usual views"

export function scoreReels(media: RawMedia[]): ScoredReel[] {
  const reels = media.filter(isReel);
  const withViews = reels.filter((r) => (r.view_count ?? 0) > 0);
  const useViews = withViews.length >= MIN_FOR_VIEWS_BASIS;
  const engagement = (r: RawMedia) => (r.like_count ?? 0) + 5 * (r.comments_count ?? 0);
  const baseValues = useViews ? withViews.map((r) => r.view_count as number) : reels.map(engagement).filter((v) => v > 0);
  const base = reels.length >= 3 ? median(baseValues) : null;

  return reels.map((r) => {
    const value = useViews ? r.view_count ?? null : engagement(r);
    const outlier = base && base > 0 && value != null ? Math.round((value / base) * 100) / 100 : null;
    return {
      mediaId: r.id,
      caption: r.caption ?? "",
      permalink: r.permalink ?? null,
      thumbnailUrl: r.thumbnail_url ?? null,
      mediaUrl: r.media_url ?? null,
      postedAt: r.timestamp ?? null,
      views: r.view_count ?? null,
      likes: r.like_count ?? null,
      comments: r.comments_count ?? null,
      outlier,
      basis: outlier == null ? "none" : useViews ? "views" : "engagement",
    };
  });
}

// What Instagram's error means for a person who typed a handle.
export function discoveryErrorMessage(raw: string): string {
  if (/invalid user id|does not exist|cannot be found|not a business/i.test(raw)) return "Not found, or not a public Business/Creator account (private and personal accounts can't be read).";
  if (/rate limit|too many calls|request limit/i.test(raw)) return "Instagram's rate limit was hit. Try again in an hour.";
  if (/permission|oauth|token/i.test(raw)) return "The Meta token lacks permission for this lookup.";
  return raw.slice(0, 200);
}
