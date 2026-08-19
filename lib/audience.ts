// Audience CSV — matches the business's real internal template (extends
// Meta's Value-Based Custom Audience columns with branch/category/product
// fields). Semicolon-delimited; comma-delimited files (e.g. Meta's raw
// export) still parse fine — the delimiter is auto-detected per file.

export interface AudienceRow {
  branch_city: string; // "City" (1st column) — store/outlet city
  branch_name: string; // "SC Cabang" — branch/outlet name
  category: string;
  product: string; // "Produk"
  full_name: string; // "Name" — combined, separate from fn/ln
  email1: string;
  email2: string;
  email3: string;
  phone1: string;
  phone2: string;
  phone3: string;
  madid: string;
  fn: string; // "Front Name"
  ln: string; // "Last Name"
  zip: string; // "Kode Pos"
  ct: string; // "City" (2nd column) — customer's city
  st: string; // "Provinsi"
  country: string;
  dob: string; // "Date of Birth"
  doby: number | null; // "Year of Borth" (template's own spelling)
  gen: string;
  age: number | null;
  uid: string;
  value: number | null;
}

// Auto-detect , vs ; from the header line.
function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function splitLine(line: string, delim: string): string[] {
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
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): AudienceRow[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delim = detectDelimiter(lines[0]);
  const headerRaw = splitLine(lines[0], delim).map((h) => h.toLowerCase().trim());

  const idx = (name: string) => headerRaw.indexOf(name);
  const allIdx = (name: string) => headerRaw.reduce<number[]>((a, h, i) => (h === name ? [...a, i] : a), []);

  const cityIdx = allIdx("city"); // [0] = branch city, [1] = customer city
  const phoneNames = ["phone", "phone_3", "phone_4"];
  const emailNames = ["email", "email_1", "email_2"];

  const num = (v: string | undefined): number | null => {
    if (!v) return null;
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const rows: AudienceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    if (cells.every((c) => !c)) continue;

    rows.push({
      branch_city: cells[cityIdx[0]] ?? "",
      branch_name: cells[idx("sc cabang")] ?? "",
      category: cells[idx("category")] ?? "",
      product: cells[idx("produk")] ?? "",
      full_name: cells[idx("name")] ?? "",
      email1: cells[idx(emailNames[0])] ?? "",
      email2: cells[idx(emailNames[1])] ?? "",
      email3: cells[idx(emailNames[2])] ?? "",
      phone1: cells[idx(phoneNames[0])] ?? "",
      phone2: cells[idx(phoneNames[1])] ?? "",
      phone3: cells[idx(phoneNames[2])] ?? "",
      madid: cells[idx("madid")] ?? "",
      fn: cells[idx("front name")] ?? "",
      ln: cells[idx("last name")] ?? "",
      zip: cells[idx("kode pos")] ?? "",
      ct: cells[cityIdx[1]] ?? cells[cityIdx[0]] ?? "",
      st: cells[idx("provinsi")] ?? "",
      country: cells[idx("country")] ?? "",
      dob: cells[idx("date of birth")] ?? "",
      doby: num(cells[idx("year of borth")]),
      gen: cells[idx("gen")] ?? "",
      age: num(cells[idx("age")]),
      uid: cells[idx("uid")] ?? "",
      value: num(cells[idx("value")]),
    });
  }
  return rows;
}

// Downloadable copy of the real internal template (header + 1 example row),
// semicolon-delimited to match the source file exactly.
export function buildTemplateCsv(): string {
  const header = [
    "City", "SC Cabang", "Category", "Produk", "Name",
    "phone", "phone_3", "phone_4",
    "email", "email_1", "email_2",
    "madid", "Front Name", "Last Name", "Kode Pos", "City", "Provinsi", "country",
    "Date of Birth", "Year of Borth", "gen", "age", "UID", "Value",
  ].join(";");
  const example = [
    "Jakarta", "Cabang Kelapa Gading", "Elektronik", "Panasonic AC",
    "Elizabeth Olsen", "1-(650)-561-5622", "1-(650)-782-5622", "1-(650)-888-5622",
    "elizabetho@fb.com", "olsene@fb.com", "eolsen@fb.com",
    "aece52e7-03ee-455a-b3c4-e57283966239", "Elizabeth", "Olsen", "94046",
    "Menlo Park", "CA", "US", "10/21/68", "1968", "F", "48", "1234567890", "20.1",
  ].join(";");
  return `${header}\n${example}\n`;
}
