import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/supabase/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { ContentItem, SeriesBible, SourceAnalysis, SourcePost } from "@/lib/reengine/types";

export const runtime = "nodejs";

// One generation as an Excel file in the same column layout as the Miss Pan template.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role === "client") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ ok: false, error: "runId is required" }, { status: 400 });

  const { data: run } = await db.from("reengine_runs").select("client_id,source,analysis,items,created_at").eq("id", runId).maybeSingle();
  if (!run) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });
  const { data: bibleRow } = await db.from("reengine_bibles").select("data").eq("client_id", run.client_id).maybeSingle();
  const bible = bibleRow?.data as SeriesBible | undefined;
  const items = (run.items ?? []) as ContentItem[];
  const analysis = (run.analysis ?? {}) as Partial<SourceAnalysis>;
  const source = (run.source ?? {}) as SourcePost;

  const wb = new ExcelJS.Workbook();
  wb.creator = "ProfToko Dashboard — Re-Engine";
  const ws = wb.addWorksheet("Konten Baru");
  ws.addRow([`${bible?.seriesName ?? "Re-Engine"} — ${items.length} KONTEN BARU dari konten sukses | 1 Prompt Image + 1 Prompt Video per konten`]);
  ws.mergeCells(1, 1, 1, 11);
  ws.addRow([`Sumber: ${(source.caption ?? "").replace(/\s+/g, " ").slice(0, 200)}`]);
  ws.mergeCells(2, 1, 2, 11);
  const head = ws.addRow(["No", "Format", "Judul", "Hook", "Problem / Pain", "Solution (+RTB)", "CTA", "Produk", "Prompt Image (1x — Nano Banana / Imagen)", "Prompt Video (1x — Google Flow / Veo, ~40s)", "Caption + Hashtags"]);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  items.forEach((it, i) => {
    const products = it.productKeys.map((k) => bible?.products.find((p) => p.key === k)?.name ?? k).join(" + ") || it.spokenNames;
    ws.addRow([i + 1, it.format, it.title, it.hook, it.problem, it.solution, it.cta, products, it.imagePrompt, it.videoPrompt, it.caption]);
  });
  [5, 22, 26, 38, 34, 44, 28, 34, 90, 90, 50].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.eachRow((row, n) => {
    if (n >= 3) row.alignment = { vertical: "top", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: 3 }];

  const an = wb.addWorksheet("Analisis Konten Sukses");
  const rows: [string, string][] = [
    ["Rumus hook", analysis.formula ?? ""], ["Pola hook", analysis.pattern ?? ""], ["Struktur", analysis.structure ?? ""],
    ["Mengapa berhasil", analysis.why ?? ""], ["Dipertahankan", analysis.keep ?? ""], ["Diganti", analysis.vary ?? ""],
    ["Caption sumber", source.caption ?? ""], ["Link sumber", source.permalink ?? ""],
  ];
  rows.forEach(([k, v]) => an.addRow([k, v]));
  an.getColumn(1).width = 22;
  an.getColumn(2).width = 110;
  an.getColumn(1).font = { bold: true };
  an.eachRow((r) => (r.alignment = { vertical: "top", wrapText: true }));

  const buf = await wb.xlsx.writeBuffer();
  const name = `re-engine-${String(run.created_at).slice(0, 10)}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
