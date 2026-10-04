import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";

// Tells the Connect to Website page whether the "send drafts to this app" door is set up, and its address.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.CONTENT_INGEST_SECRET),
    endpoint: `${req.nextUrl.origin}/api/seo/content/import`,
  });
}
