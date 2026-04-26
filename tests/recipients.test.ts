import { describe, it, expect } from "vitest";

interface Recipient { name: string; email: string; }

// Re-implementing the parsers as pure functions for testing.
// They mirror the logic in src/app/page.tsx.

function parseManualEmails(text: string): Recipient[] {
  const parsed: Recipient[] = [];
  for (const line of text.split("\n").filter((l) => l.trim())) {
    const match = line.trim().match(/^(.+?)\s*<(.+?)>$/);
    if (match) parsed.push({ name: match[1].trim(), email: match[2].trim() });
    else if (line.includes("@")) parsed.push({ name: "", email: line.trim() });
  }
  return parsed;
}

function parseCsv(text: string, format: "name,email" | "email,name"): Recipient[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const parsed: Recipient[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length >= 2) {
      if (format === "name,email") parsed.push({ name: cols[0], email: cols[1] });
      else parsed.push({ name: cols[1], email: cols[0] });
    } else if (cols.length === 1 && cols[0].includes("@")) {
      parsed.push({ name: "", email: cols[0] });
    }
  }
  return parsed;
}

describe("manual email parser", () => {
  it("parses plain emails (no name)", () => {
    expect(parseManualEmails("a@example.com\nb@example.com")).toEqual([
      { name: "", email: "a@example.com" },
      { name: "", email: "b@example.com" },
    ]);
  });

  it("parses Name <email> format", () => {
    expect(parseManualEmails("John Doe <john@example.com>")).toEqual([
      { name: "John Doe", email: "john@example.com" },
    ]);
  });

  it("parses mixed format", () => {
    const input = "Alice <a@x.com>\nb@x.com\nCharlie Brown <c@x.com>";
    expect(parseManualEmails(input)).toEqual([
      { name: "Alice", email: "a@x.com" },
      { name: "", email: "b@x.com" },
      { name: "Charlie Brown", email: "c@x.com" },
    ]);
  });

  it("ignores blank lines", () => {
    expect(parseManualEmails("a@x.com\n\n\nb@x.com\n")).toEqual([
      { name: "", email: "a@x.com" },
      { name: "", email: "b@x.com" },
    ]);
  });

  it("ignores lines without @", () => {
    expect(parseManualEmails("a@x.com\nthis is not an email\nb@x.com")).toEqual([
      { name: "", email: "a@x.com" },
      { name: "", email: "b@x.com" },
    ]);
  });

  it("trims whitespace around name and email", () => {
    expect(parseManualEmails("  John   <  john@x.com  >")).toEqual([
      { name: "John", email: "john@x.com" },
    ]);
  });

  it("handles empty input", () => {
    expect(parseManualEmails("")).toEqual([]);
  });
});

describe("csv parser", () => {
  it("parses name,email format with header", () => {
    const csv = "Name,Email\nAlice,a@x.com\nBob,b@x.com";
    expect(parseCsv(csv, "name,email")).toEqual([
      { name: "Alice", email: "a@x.com" },
      { name: "Bob", email: "b@x.com" },
    ]);
  });

  it("parses email,name format with header", () => {
    const csv = "Email,Name\na@x.com,Alice\nb@x.com,Bob";
    expect(parseCsv(csv, "email,name")).toEqual([
      { name: "Alice", email: "a@x.com" },
      { name: "Bob", email: "b@x.com" },
    ]);
  });

  it("strips quoted values", () => {
    const csv = `Name,Email\n"Alice","a@x.com"\n'Bob','b@x.com'`;
    expect(parseCsv(csv, "name,email")).toEqual([
      { name: "Alice", email: "a@x.com" },
      { name: "Bob", email: "b@x.com" },
    ]);
  });

  it("handles single-column CSV (just emails)", () => {
    const csv = "Email\na@x.com\nb@x.com";
    expect(parseCsv(csv, "name,email")).toEqual([
      { name: "", email: "a@x.com" },
      { name: "", email: "b@x.com" },
    ]);
  });

  it("skips the header row", () => {
    const csv = "Name,Email\nAlice,a@x.com";
    const result = parseCsv(csv, "name,email");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "Alice", email: "a@x.com" });
  });

  it("ignores blank lines in CSV", () => {
    const csv = "Name,Email\n\nAlice,a@x.com\n\n\nBob,b@x.com\n";
    expect(parseCsv(csv, "name,email")).toEqual([
      { name: "Alice", email: "a@x.com" },
      { name: "Bob", email: "b@x.com" },
    ]);
  });

  it("trims whitespace in CSV columns", () => {
    const csv = "Name,Email\n  Alice  ,  a@x.com  ";
    expect(parseCsv(csv, "name,email")).toEqual([
      { name: "Alice", email: "a@x.com" },
    ]);
  });
});
