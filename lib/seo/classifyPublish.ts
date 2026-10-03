// Turns "what the website's publish endpoint answered to our harmless test request" into a
// plain-language verdict. Pure, so it can be tested without a network.

export type ConnectionState = "ok" | "ok-no-dryrun" | "no-target" | "unreachable" | "wrong-secret" | "no-endpoint" | "not-an-api" | "server-error" | "unknown";

export interface Verdict {
  state: ConnectionState;
  message: string;
}

export function classifyPublishResponse(input: { status: number; contentType: string; text: string; location?: string | null }): Verdict {
  const { status, contentType, text, location } = input;
  let json: { ok?: boolean; error?: string; dryRun?: boolean } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (status >= 300 && status < 400) {
    return { state: "no-endpoint", message: `The URL redirects to ${location ?? "another page"}. Use the final address of the publish endpoint directly.` };
  }
  if (status === 401 || status === 403) {
    return { state: "wrong-secret", message: "The website answered but rejected the secret. Make sure PUBLISH_SECRET on the website is exactly the secret shown here (then redeploy the website)." };
  }
  if (status === 404 || status === 405) {
    return { state: "no-endpoint", message: "The URL exists but there is no publish endpoint there yet (404/405). The website still needs the /api/publish endpoint — use the prompt below in the website's project." };
  }
  if (!json && /html|text\/plain/i.test(contentType)) {
    return { state: "not-an-api", message: "That address returned a normal web page, not a publish API. Point the URL at the website's /api/publish endpoint." };
  }
  if (status >= 500) {
    return { state: "server-error", message: `The website's publish endpoint crashed (HTTP ${status}). Its logs will say why.` };
  }
  if (status === 200 && json?.ok) {
    return { state: "ok", message: "Connected. The website accepted the secret and confirmed a dry run — nothing was published." };
  }
  if (status === 400 && json && json.ok === false && /missing|required|invalid|field/i.test(json.error ?? "")) {
    return { state: "ok-no-dryrun", message: "Connected. The website accepted the secret and refused the empty test post, so nothing was published. (It doesn't support dry runs, which is fine.)" };
  }
  return { state: "unknown", message: `Unexpected answer (HTTP ${status}). See the detail below.` };
}
