// Shared types for the auth-kit. Both client-side (BeatStream) and
// server-backed (EmailBlaster) implementations conform to AuthAdapter so the
// same UI works against either backend.

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  isAdmin: boolean;
  createdAt: number;
  lastLogin: number;
  // App-specific extras (keep optional so each app can add its own)
  totalPlays?: number;
  totalListenSeconds?: number;
  topArtist?: string;
  topSong?: string;
  topLanguage?: string;
  // Optional — only stored client-side in the localStorage backend
  passwordHash?: string;
  passwordSalt?: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

export interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
  avatar?: string;
  securityQuestion: string;
  securityAnswer: string;
}

export type ToastFn = (message: string, type?: "success" | "error" | "info") => void;

/**
 * Each app implements this to plug into the shared auth UI. The methods can
 * be sync (localStorage) or async (server fetch) — they're awaited either way.
 */
export interface AuthAdapter {
  // Mutations
  register(input: RegisterInput): Promise<UserProfile>;
  login(email: string, password: string): Promise<UserProfile>;
  logout(): void | Promise<void>;
  resetPassword(email: string, securityAnswer: string, newPassword: string): Promise<UserProfile>;
  // Queries
  byEmail(email: string): UserProfile | null | Promise<UserProfile | null>;
  current(): UserProfile | null | Promise<UserProfile | null>;
  // Admin only
  list(): UserProfile[] | Promise<UserProfile[]>;
  remove(id: string): void | Promise<void>;
  promoteAdmin(id: string): void | Promise<void>;
  demoteAdmin(id: string): void | Promise<void>;
}
