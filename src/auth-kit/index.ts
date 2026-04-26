// Public API of auth-kit. Apps import from here.

export { AuthShell } from "./AuthShell";
export { LoginPage } from "./LoginPage";
export { RegisterPage } from "./RegisterPage";
export { ForgotPage } from "./ForgotPage";
export { AdminPage } from "./AdminPage";
export type { AdminPageProps, AdminTab } from "./AdminPage";

// Reusable presentation primitives — use these to build matching custom
// admin tabs in your consuming app (Email-blaster's "Emails" / "Support"
// tabs, BeatStream's "Listening" tab, etc.).
export { StatCard, FilterBar, FilterRow, PillTabs, EmptyState } from "./primitives";
export { fmtRel, fmtDuration, profilesToCsv, downloadCsv } from "./helpers";

export { SECURITY_QUESTIONS, AVATARS } from "./constants";
export type { AuthAdapter, UserProfile, RegisterInput, ToastFn } from "./types";
