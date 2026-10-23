// Reads the labelled answers the writer returns:  [[NAME]] on its own line, then the text (any number of lines).
// Labelled sections survive quotes, line breaks and long text, which JSON does not.

export interface Marked {
  name: string;
  body: string;
}

export function parseMarked(text: string): Marked[] {
  const marker = /^\[\[([A-Z0-9_]+)\]\][ \t]*$/gm;
  const hits: { name: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text))) hits.push({ name: m[1], start: m.index, end: m.index + m[0].length });
  return hits.map((h, i) => ({ name: h.name, body: text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length).trim() }));
}

export function firstOf(sections: Marked[], name: string): string {
  return sections.find((s) => s.name === name)?.body ?? "";
}

// "KEY: value" lines inside one section (the plan's briefs).
export function parseKeyValues(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

export function listKeys(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v && v !== "none" && v !== "-" && v !== "tidak ada");
}
