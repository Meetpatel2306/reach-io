import { describe, it, expect, beforeEach } from "vitest";

// Re-implementing the SMTP localStorage helpers from page.tsx as pure functions for testing.
// They mirror the logic exactly.

interface SavedSmtp {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpSecurity: string;
}

const SMTP_STORAGE_KEY = "email-blaster-smtp";

function loadSmtp(): SavedSmtp | null {
  try {
    const raw = localStorage.getItem(SMTP_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSmtp(config: SavedSmtp) {
  try { localStorage.setItem(SMTP_STORAGE_KEY, JSON.stringify(config)); } catch {}
}

function clearSmtp() {
  try { localStorage.removeItem(SMTP_STORAGE_KEY); } catch {}
}

describe("SMTP localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadSmtp returns null when no config saved", () => {
    expect(loadSmtp()).toBeNull();
  });

  it("saveSmtp + loadSmtp round-trips correctly", () => {
    const config: SavedSmtp = {
      smtpHost: "smtp.gmail.com",
      smtpPort: "587",
      smtpUser: "test@gmail.com",
      smtpPass: "abcd1234efgh5678",
      smtpSecurity: "starttls",
    };
    saveSmtp(config);
    expect(loadSmtp()).toEqual(config);
  });

  it("clearSmtp removes saved config", () => {
    saveSmtp({
      smtpHost: "smtp.gmail.com",
      smtpPort: "587",
      smtpUser: "test@gmail.com",
      smtpPass: "secret",
      smtpSecurity: "starttls",
    });
    expect(loadSmtp()).not.toBeNull();
    clearSmtp();
    expect(loadSmtp()).toBeNull();
  });

  it("saveSmtp overwrites previous config", () => {
    saveSmtp({
      smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUser: "old@x.com",
      smtpPass: "old", smtpSecurity: "starttls",
    });
    saveSmtp({
      smtpHost: "smtp.office365.com", smtpPort: "587", smtpUser: "new@x.com",
      smtpPass: "new", smtpSecurity: "starttls",
    });
    expect(loadSmtp()?.smtpUser).toBe("new@x.com");
    expect(loadSmtp()?.smtpHost).toBe("smtp.office365.com");
  });

  it("loadSmtp returns null when localStorage is corrupt", () => {
    localStorage.setItem(SMTP_STORAGE_KEY, "not-valid-json{");
    expect(loadSmtp()).toBeNull();
  });

  it("preserves password (not stripped or sanitized)", () => {
    const password = "p@$$w0rd!#&*()_+";
    saveSmtp({
      smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUser: "u@x.com",
      smtpPass: password, smtpSecurity: "starttls",
    });
    expect(loadSmtp()?.smtpPass).toBe(password);
  });
});

describe("SMTP value trimming (mirrors page.tsx load logic)", () => {
  // The page.tsx loader trims values to handle trailing whitespace in env vars.
  function loadAndTrim(): SavedSmtp | null {
    const saved = loadSmtp();
    if (!saved || !saved.smtpUser || !saved.smtpPass) return null;
    return {
      smtpHost: saved.smtpHost?.trim() || "smtp.gmail.com",
      smtpPort: saved.smtpPort?.trim() || "587",
      smtpUser: saved.smtpUser.trim(),
      smtpPass: saved.smtpPass.trim(),
      smtpSecurity: saved.smtpSecurity?.trim() || "starttls",
    };
  }

  beforeEach(() => localStorage.clear());

  it("trims whitespace from saved values", () => {
    saveSmtp({
      smtpHost: "  smtp.gmail.com  ",
      smtpPort: " 587 ",
      smtpUser: "user@x.com\n",
      smtpPass: "  pass  ",
      smtpSecurity: " starttls ",
    });
    const result = loadAndTrim();
    expect(result?.smtpHost).toBe("smtp.gmail.com");
    expect(result?.smtpPort).toBe("587");
    expect(result?.smtpUser).toBe("user@x.com");
    expect(result?.smtpPass).toBe("pass");
    expect(result?.smtpSecurity).toBe("starttls");
  });

  it("returns null when smtpUser missing", () => {
    saveSmtp({
      smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUser: "",
      smtpPass: "pass", smtpSecurity: "starttls",
    });
    expect(loadAndTrim()).toBeNull();
  });

  it("returns null when smtpPass missing", () => {
    saveSmtp({
      smtpHost: "smtp.gmail.com", smtpPort: "587", smtpUser: "u@x.com",
      smtpPass: "", smtpSecurity: "starttls",
    });
    expect(loadAndTrim()).toBeNull();
  });
});
