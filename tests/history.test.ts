import { describe, it, expect, beforeEach } from "vitest";
import { loadHistory, saveToHistory, clearHistory, deleteBatch, type SendBatch } from "@/lib/history";

const makeBatch = (overrides: Partial<SendBatch> = {}): SendBatch => ({
  id: `batch_${Math.random()}`,
  timestamp: new Date().toISOString(),
  subject: "Test subject",
  body: "Test body",
  from: "user@example.com",
  hasAttachment: false,
  attachmentName: "",
  totalRecipients: 1,
  sent: 1,
  failed: 0,
  results: [{ email: "to@example.com", name: "John", status: "sent" }],
  durationMs: 1000,
  ...overrides,
});

describe("history lib", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no history saved", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves a batch and reads it back", () => {
    const batch = makeBatch({ id: "test-1" });
    saveToHistory(batch);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("test-1");
  });

  it("inserts new batches at the start (most recent first)", () => {
    saveToHistory(makeBatch({ id: "first" }));
    saveToHistory(makeBatch({ id: "second" }));
    saveToHistory(makeBatch({ id: "third" }));
    const history = loadHistory();
    expect(history.map((b) => b.id)).toEqual(["third", "second", "first"]);
  });

  it("caps history at 100 batches", () => {
    for (let i = 0; i < 105; i++) {
      saveToHistory(makeBatch({ id: `batch-${i}` }));
    }
    const history = loadHistory();
    expect(history).toHaveLength(100);
    expect(history[0].id).toBe("batch-104");
    expect(history[99].id).toBe("batch-5");
  });

  it("clearHistory removes all batches", () => {
    saveToHistory(makeBatch());
    saveToHistory(makeBatch());
    expect(loadHistory()).toHaveLength(2);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it("deleteBatch removes only the matching batch", () => {
    saveToHistory(makeBatch({ id: "keep-1" }));
    saveToHistory(makeBatch({ id: "delete-me" }));
    saveToHistory(makeBatch({ id: "keep-2" }));
    deleteBatch("delete-me");
    const history = loadHistory();
    expect(history.map((b) => b.id)).toEqual(["keep-2", "keep-1"]);
  });

  it("deleteBatch is a no-op if id doesn't exist", () => {
    saveToHistory(makeBatch({ id: "exists" }));
    deleteBatch("doesnt-exist");
    expect(loadHistory()).toHaveLength(1);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem("email-blaster-history", "not-valid-json{{");
    expect(loadHistory()).toEqual([]);
  });

  it("preserves all batch fields", () => {
    const batch = makeBatch({
      id: "full",
      hasAttachment: true,
      attachmentName: "resume.pdf",
      sent: 5,
      failed: 2,
      durationMs: 12345,
      results: [
        { email: "a@x.com", name: "Alice", status: "sent" },
        { email: "b@x.com", name: "Bob", status: "failed", error: "bounced" },
      ],
    });
    saveToHistory(batch);
    const reloaded = loadHistory()[0];
    expect(reloaded).toEqual(batch);
  });

  it("calculates aggregate stats correctly", () => {
    saveToHistory(makeBatch({ sent: 5, failed: 1, totalRecipients: 6 }));
    saveToHistory(makeBatch({ sent: 10, failed: 0, totalRecipients: 10 }));
    saveToHistory(makeBatch({ sent: 0, failed: 3, totalRecipients: 3 }));

    const history = loadHistory();
    const totalSent = history.reduce((a, b) => a + b.sent, 0);
    const totalFailed = history.reduce((a, b) => a + b.failed, 0);
    expect(totalSent).toBe(15);
    expect(totalFailed).toBe(4);
  });
});
