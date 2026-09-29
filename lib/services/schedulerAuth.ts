// Server-only: the shared secret Make.com sends when it talks to the scheduler.
// Set SCHEDULER_SECRET in Vercel (any long random string) and paste the same
// value into Make — never in the repo or in chat.

import { timingSafeEqual } from "crypto";

export function schedulerConfigured(): boolean {
  return Boolean(process.env.SCHEDULER_SECRET);
}

export function schedulerAuthorized(req: Request): boolean {
  const secret = process.env.SCHEDULER_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-scheduler-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
