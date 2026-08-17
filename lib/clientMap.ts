// Maps a campaign name to a Client. Meta has no "client" field, so we infer it
// from keywords in the campaign name. Add/adjust rules here as you onboard clients.
// (Later this can be replaced by a per-campaign assignment stored in Supabase.)

interface ClientRule {
  client: string;
  match: string[]; // lowercase substrings; first matching rule wins
}

export const CLIENT_RULES: ClientRule[] = [
  { client: "Proone", match: ["proone"] },
  { client: "Timbangan ko Jhonny", match: ["timbangan", "jhonny"] },
  { client: "Occo", match: ["occo"] },
  { client: "HBO", match: ["hbo"] },
  { client: "Panasonic", match: ["panasonic", "pana"] },
  { client: "New Wave", match: ["new wave", "newwave", "cici"] },
  { client: "Reline", match: ["reline"] },
];

export const UNASSIGNED = "Unassigned";

export function resolveClient(campaignName: string): string {
  const n = campaignName.toLowerCase();
  for (const rule of CLIENT_RULES) {
    if (rule.match.some((m) => n.includes(m))) return rule.client;
  }
  return UNASSIGNED;
}
