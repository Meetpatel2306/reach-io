import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getAutoUpdate, setAutoUpdate, fetchLatestVersion, checkForUpdate, BUNDLED_VERSION } from "@/lib/updater";

describe("auto-update preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to ON when no preference is stored", () => {
    expect(getAutoUpdate()).toBe(true);
  });

  it("setAutoUpdate(false) disables auto-update", () => {
    setAutoUpdate(false);
    expect(getAutoUpdate()).toBe(false);
  });

  it("setAutoUpdate(true) enables auto-update", () => {
    setAutoUpdate(false);
    setAutoUpdate(true);
    expect(getAutoUpdate()).toBe(true);
  });

  it("preference persists across reads", () => {
    setAutoUpdate(false);
    expect(getAutoUpdate()).toBe(false);
    expect(getAutoUpdate()).toBe(false);
    expect(getAutoUpdate()).toBe(false);
  });

  it("ignores corrupt localStorage value (defaults to ON)", () => {
    localStorage.setItem("email-blaster-auto-update", "garbage");
    // Any non-"0" value should be treated as ON
    expect(getAutoUpdate()).toBe(true);
  });
});

describe("BUNDLED_VERSION", () => {
  it("exposes a version string (default 'dev' in tests)", () => {
    expect(typeof BUNDLED_VERSION).toBe("string");
    expect(BUNDLED_VERSION.length).toBeGreaterThan(0);
  });
});

describe("fetchLatestVersion", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns version info when fetch succeeds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "v9", buildTime: "2026-01-01", notes: "test" }),
    } as Response);

    const result = await fetchLatestVersion();
    expect(result).toEqual({ version: "v9", buildTime: "2026-01-01", notes: "test" });
  });

  it("returns null when fetch fails (network error)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await fetchLatestVersion();
    expect(result).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    const result = await fetchLatestVersion();
    expect(result).toBeNull();
  });

  it("uses cache-busting query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "v1", buildTime: "" }),
    } as Response);
    globalThis.fetch = fetchMock;

    await fetchLatestVersion();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/\/version\.json\?t=\d+/);
  });

  it("sends no-cache headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "v1", buildTime: "" }),
    } as Response);
    globalThis.fetch = fetchMock;

    await fetchLatestVersion();
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.cache).toBe("no-store");
    expect(opts.headers).toMatchObject({ "Cache-Control": expect.stringContaining("no-cache") });
  });
});

describe("checkForUpdate", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns hasUpdate=true when bundled and latest differ", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "v999", buildTime: "" }),
    } as Response);

    const result = await checkForUpdate();
    expect(result.hasUpdate).toBe(true);
    expect(result.latest?.version).toBe("v999");
    expect(result.current).toBe(BUNDLED_VERSION);
  });

  it("returns hasUpdate=false when bundled equals latest", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: BUNDLED_VERSION, buildTime: "" }),
    } as Response);

    const result = await checkForUpdate();
    expect(result.hasUpdate).toBe(false);
  });

  it("returns hasUpdate=false when version.json fetch fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await checkForUpdate();
    expect(result.hasUpdate).toBe(false);
    expect(result.current).toBe(BUNDLED_VERSION);
  });
});
