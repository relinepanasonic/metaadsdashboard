// Value-Based Custom Audience — matches Meta's CSV upload template exactly.
// Column order matters for the downloadable template but not for parsing
// (we map by header name, so column order in an uploaded file doesn't matter).

export const META_AUDIENCE_HEADERS = [
  "email", "email", "email", // 3 email columns (Meta allows duplicates for multiple emails per person)
  "phone", "phone", "phone",
  "madid",
  "fn", "ln",
  "zip", "ct", "st", "country",
  "dob", "doby", "gen", "age",
  "uid",
  "value",
] as const;

export interface AudienceRow {
  email1: string;
  email2: string;
  email3: string;
  phone1: string;
  phone2: string;
  phone3: string;
  madid: string;
  fn: string;
  ln: string;
  zip: string;
  ct: string;
  st: string;
  country: string;
  dob: string;
  doby: number | null;
  gen: string;
  age: number | null;
  uid: string;
  value: number | null;
}

// Minimal CSV parser — handles quoted fields, commas inside quotes, and
// duplicate header names (Meta's template reuses "email"/"phone" 3x each).
export function parseCsv(text: string): AudienceRow[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headerRaw = splitLine(lines[0]).map((h) => h.toLowerCase().trim());
  // Positional indices for the 3 email / 3 phone columns (by occurrence order).
  const emailIdx = headerRaw.reduce<number[]>((a, h, i) => (h === "email" ? [...a, i] : a), []);
  const phoneIdx = headerRaw.reduce<number[]>((a, h, i) => (h === "phone" ? [...a, i] : a), []);
  const idx = (name: string) => headerRaw.indexOf(name);

  const num = (v: string | undefined): number | null => {
    if (!v) return null;
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const rows: AudienceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    rows.push({
      email1: cells[emailIdx[0]] ?? "",
      email2: cells[emailIdx[1]] ?? "",
      email3: cells[emailIdx[2]] ?? "",
      phone1: cells[phoneIdx[0]] ?? "",
      phone2: cells[phoneIdx[1]] ?? "",
      phone3: cells[phoneIdx[2]] ?? "",
      madid: cells[idx("madid")] ?? "",
      fn: cells[idx("fn")] ?? "",
      ln: cells[idx("ln")] ?? "",
      zip: cells[idx("zip")] ?? "",
      ct: cells[idx("ct")] ?? "",
      st: cells[idx("st")] ?? "",
      country: cells[idx("country")] ?? "",
      dob: cells[idx("dob")] ?? "",
      doby: num(cells[idx("doby")]),
      gen: cells[idx("gen")] ?? "",
      age: num(cells[idx("age")]),
      uid: cells[idx("uid")] ?? "",
      value: num(cells[idx("value")]),
    });
  }
  return rows;
}

// Builds a downloadable copy of Meta's template (header + 1 example row).
export function buildTemplateCsv(): string {
  const header = META_AUDIENCE_HEADERS.join(",");
  const example =
    "elizabetho@fb.com,olsene@fb.com,eolsen@fb.com,1-(650)-561-5622,1-(650)-782-5622,1-(650)-888-5622," +
    "aece52e7-03ee-455a-b3c4-e57283966239,Elizabeth,Olsen,94046,Menlo Park,CA,US,10/21/68,1968,F,48,1234567890,20.1";
  return `${header}\n${example}\n`;
}
