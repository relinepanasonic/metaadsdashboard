import { graph } from "./instagram";

// Facebook Pages via the same System User token as Meta Ads. Follower counts
// work with the permissions already granted (pages_read_engagement). Posts need
// pages_read_user_content, and Page reach/insights need extra permissions plus
// metric names that Meta keeps changing, so those are not pulled here.

export interface DiscoveredPage {
  id: string;
  name: string;
}

export async function discoverPages(): Promise<DiscoveredPage[]> {
  const json = await graph<{ data: { id: string; name: string }[] }>("/me/accounts", { fields: "id,name", limit: "100" });
  return json.data.map((p) => ({ id: p.id, name: p.name }));
}

export interface PageBasics {
  name: string;
  fan_count: number;
  followers_count: number;
}

export async function fetchPageBasics(pageId: string): Promise<PageBasics> {
  return graph<PageBasics>(`/${pageId}`, { fields: "name,fan_count,followers_count" });
}

export interface FbPost {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
  reactions?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
}

// Reading a Page's posts requires that Page's own access token.
export async function fetchPagePosts(pageId: string, limit = 30): Promise<FbPost[]> {
  const { access_token } = await graph<{ access_token?: string }>(`/${pageId}`, { fields: "access_token" });
  if (!access_token) throw new Error("No Page access token — assign this Page to the token's user in Business Settings.");

  const json = await graph<{ data: FbPost[] }>(
    `/${pageId}/posts`,
    {
      fields: "id,message,permalink_url,created_time,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
      limit: String(limit),
    },
    access_token
  );
  return json.data;
}
