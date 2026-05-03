import { NextRequest } from "next/server";
import { upsertContact } from "@/lib/jobApp";
import { bad, ok, requireUser } from "../../_helpers";

// Naive CSV parser — handles quoted fields and commas-in-quotes.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return bad("file is required");
  const text = await file.text();
  const rows = parseCsv(text);
  let imported = 0;
  for (const row of rows) {
    const email = row.email || row["e-mail"] || "";
    if (!email) continue;
    await upsertContact(auth.email, {
      email: email.trim(),
      name: row.name || "",
      company: row.company || "",
      role: row.role || row.position || "",
      custom1: row.custom1 || "",
      custom2: row.custom2 || "",
      notes: row.notes || "",
    });
    imported++;
  }
  return ok({ imported });
}
