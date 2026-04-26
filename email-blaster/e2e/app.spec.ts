import { test, expect } from "@playwright/test";

test.describe("Email Blaster Pro — smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    // Mark tour as seen so it doesn't auto-open and block the UI
    await page.addInitScript(() => {
      window.localStorage.setItem("email-blaster-tour-seen", "1");
    });
  });

  test("home page renders with header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Email Blaster Pro", level: 1 })).toBeVisible();
    // Header icons present
    await expect(page.getByTitle("Setup Guide")).toBeVisible();
    await expect(page.getByTitle("Send History")).toBeVisible();
    await expect(page.getByTitle("SMTP Settings")).toBeVisible();
  });

  test("step navigation buttons are present", async ({ page }) => {
    await page.goto("/");
    // Each step button has its label as accessible name
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recipients" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  });

  test("guide page back button returns to home (regression for React #130)", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { name: /Get Started in Minutes/i })).toBeVisible();

    // Capture console errors during navigation
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Click the back arrow link (first link is the back button)
    await page.locator("a").first().click();

    // Should land on home without React error
    await expect(page.getByRole("heading", { name: "Email Blaster Pro", level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("history page renders empty state when no batches", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "Send History" })).toBeVisible();
    await expect(page.getByText(/No emails sent yet/i)).toBeVisible();
  });

  test("guide provider tabs switch correctly", async ({ page }) => {
    await page.goto("/guide");

    // Default tab is Gmail
    await expect(page.getByRole("heading", { name: "Gmail Setup" })).toBeVisible();

    // Switch to Outlook
    await page.getByRole("button", { name: "Outlook", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Outlook \/ Hotmail Setup/ })).toBeVisible();

    // Switch to Yahoo
    await page.getByRole("button", { name: "Yahoo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Yahoo Mail Setup" })).toBeVisible();
  });

  test("guide platform tabs switch correctly", async ({ page }) => {
    await page.goto("/guide");

    // iOS is default — heading contains "Install on iPhone"
    await expect(page.getByRole("heading", { name: /Install on iPhone/ })).toBeVisible();

    // Switch to Android
    await page.getByRole("button", { name: "Android", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Install on Android" })).toBeVisible();

    // Switch to Desktop
    await page.getByRole("button", { name: "Desktop", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Install on Desktop" })).toBeVisible();
  });

  test("FAQ items expand on click", async ({ page }) => {
    await page.goto("/guide");

    const faqQuestion = page.getByText("Is my password stored securely?");
    await expect(faqQuestion).toBeVisible();
    await faqQuestion.click();
    await expect(page.getByText(/localStorage only/i)).toBeVisible();
  });

  test("settings panel opens when clicking gear icon", async ({ page }) => {
    await page.goto("/");

    await page.getByTitle("SMTP Settings").click();
    await expect(page.getByRole("heading", { name: "Email Settings" })).toBeVisible();
    // Sign in with Google button is the recommended path
    await expect(page.getByRole("button", { name: /Sign in with Google/i })).toBeVisible();
    // SMTP fields are still available below the OR divider
    await expect(page.getByPlaceholder("you@gmail.com")).toBeVisible();
  });

  test("manually adding recipients updates the count", async ({ page }) => {
    await page.goto("/");

    // Navigate to recipients step (button in step bar)
    await page.getByRole("button", { name: "Recipients" }).click();

    // Add via manual entry
    const textarea = page.getByPlaceholder(/hr@company.com/);
    await textarea.fill("alice@x.com\nBob <bob@x.com>");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    // Both recipients should appear in the list
    await expect(page.getByText("alice@x.com")).toBeVisible();
    await expect(page.getByText("bob@x.com")).toBeVisible();
  });

  test("send button shows 'Configure SMTP First' when SMTP not set", async ({ page }) => {
    await page.goto("/");

    // Add a recipient first so length > 0
    await page.getByRole("button", { name: "Recipients" }).click();
    await page.getByPlaceholder(/hr@company.com/).fill("test@x.com");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    // Go to send step
    await page.getByRole("button", { name: "Send" }).click();

    // Send button shows configure prompt and is disabled
    const sendBtn = page.getByRole("button", { name: /Configure SMTP First|Send to/ });
    await expect(sendBtn).toBeDisabled();
  });

  test("install guide platform-specific headings show correctly", async ({ page }) => {
    await page.goto("/guide");

    // iOS heading default
    await expect(page.getByRole("heading", { name: /Install on iPhone/ })).toBeVisible();

    // Switch to Android — heading changes
    await page.getByRole("button", { name: "Android", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Install on Android" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Install on iPhone/ })).not.toBeVisible();

    // Switch to Desktop
    await page.getByRole("button", { name: "Desktop", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Install on Desktop" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Install on Android" })).not.toBeVisible();

    // Back to iOS
    await page.getByRole("button", { name: "iPhone / iPad" }).click();
    await expect(page.getByRole("heading", { name: /Install on iPhone/ })).toBeVisible();
  });
});
