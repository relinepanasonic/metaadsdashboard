import { NextResponse } from "next/server";
import { getUnifiedDashboardData } from "@/lib/services/dashboard";

export async function GET() {
  try {
    const data = await getUnifiedDashboardData();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
