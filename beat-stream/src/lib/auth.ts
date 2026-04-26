// Frontend-only profile system.
//
// IMPORTANT — what this is and isn't:
//   • This is a *device-scoped* multi-profile system, NOT real authentication.
//     There's no server, no database, no JWT. Anyone with access to the
//     browser's localStorage can read every profile's data including hashed
//     passwords. Use this for personalization / multi-user-on-one-device only.
//   • Passwords are SHA-256 + per-user salt so a casual reader of localStorage
//     can't recover the plaintext. They're not bcrypt-strong.
//   • The "admin" role is whichever account has the `isAdmin` flag in storage,
//     bootstrapped by the FIRST account that registers (sole-occupant model).
//
// All profile data lives at the key `bs-auth-profiles` as a single JSON array.
// The currently-signed-in user id is at `bs-auth-current`.

import { store } from "./storage";

const PROFILES_KEY = "bs-auth-profiles";
const CURRENT_KEY = "bs-auth-current";

export interface UserProfile {
  id: string;
  email: string;            // lower-cased
  displayName: string;
  avatar: string;           // emoji
  passwordHash: string;     // hex-encoded SHA-256(salt + password)
  passwordSalt: string;     // hex
  isAdmin: boolean;
  createdAt: number;
  lastLogin: number;
  securityQuestion: string;
  securityAnswerHash: string; // hex SHA-256(salt + lowered answer)
  // Optional per-profile counts (mirrored from main play counts at logout)
  totalPlays?: number;
  totalListenSeconds?: number;
  topArtist?: string;
  topSong?: string;
  topLanguage?: string;
}

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const auth = {
  list(): UserProfile[] {
    return store.read<UserProfile[]>(PROFILES_KEY, []);
  },
  byId(id: string): UserProfile | null {
    return auth.list().find((p) => p.id === id) || null;
  },
  byEmail(email: string): UserProfile | null {
    const e = email.toLowerCase().trim();
    return auth.list().find((p) => p.email === e) || null;
  },
  current(): UserProfile | null {
    if (typeof window === "undefined") return null;
    const id = store.read<string | null>(CURRENT_KEY, null);
    return id ? auth.byId(id) : null;
  },
  setCurrent(id: string | null) {
    if (id) store.write(CURRENT_KEY, id);
    else store.remove(CURRENT_KEY);
  },
  saveAll(list: UserProfile[]) { store.write(PROFILES_KEY, list); },

  async register(input: {
    email: string;
    displayName: string;
    password: string;
    avatar?: string;
    securityQuestion: string;
    securityAnswer: string;
  }): Promise<UserProfile> {
    const email = input.email.toLowerCase().trim();
    if (!email || !input.password || !input.displayName) throw new Error("Missing fields");
    if (auth.byEmail(email)) throw new Error("Email already registered");
    const passwordSalt = randomHex(16);
    const passwordHash = await sha256Hex(passwordSalt + input.password);
    const answerSalt = randomHex(8);
    const securityAnswerHash = await sha256Hex(answerSalt + input.securityAnswer.toLowerCase().trim());
    const list = auth.list();
    const profile: UserProfile = {
      id: `u_${Date.now()}_${randomHex(4)}`,
      email,
      displayName: input.displayName,
      avatar: input.avatar || "🎧",
      passwordHash,
      passwordSalt,
      isAdmin: list.length === 0,    // first registrant is admin
      createdAt: Date.now(),
      lastLogin: Date.now(),
      securityQuestion: input.securityQuestion,
      securityAnswerHash: `${answerSalt}:${securityAnswerHash}`,
    };
    list.push(profile);
    auth.saveAll(list);
    auth.setCurrent(profile.id);
    return profile;
  },

  async login(email: string, password: string): Promise<UserProfile> {
    const u = auth.byEmail(email);
    if (!u) throw new Error("No account with that email");
    const test = await sha256Hex(u.passwordSalt + password);
    if (test !== u.passwordHash) throw new Error("Wrong password");
    u.lastLogin = Date.now();
    const list = auth.list().map((p) => (p.id === u.id ? u : p));
    auth.saveAll(list);
    auth.setCurrent(u.id);
    return u;
  },

  logout() { auth.setCurrent(null); },

  async resetPassword(email: string, securityAnswer: string, newPassword: string): Promise<UserProfile> {
    const u = auth.byEmail(email);
    if (!u) throw new Error("No account with that email");
    const [salt, expected] = u.securityAnswerHash.split(":");
    const test = await sha256Hex(salt + securityAnswer.toLowerCase().trim());
    if (test !== expected) throw new Error("Wrong security answer");
    u.passwordSalt = randomHex(16);
    u.passwordHash = await sha256Hex(u.passwordSalt + newPassword);
    const list = auth.list().map((p) => (p.id === u.id ? u : p));
    auth.saveAll(list);
    return u;
  },

  update(id: string, patch: Partial<UserProfile>) {
    const list = auth.list();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return;
    list[idx] = { ...list[idx], ...patch };
    auth.saveAll(list);
  },

  remove(id: string) {
    const list = auth.list().filter((p) => p.id !== id);
    auth.saveAll(list);
    if (store.read<string | null>(CURRENT_KEY, null) === id) auth.setCurrent(null);
  },

  promoteAdmin(id: string) { auth.update(id, { isAdmin: true }); },
  demoteAdmin(id: string) { auth.update(id, { isAdmin: false }); },
};

export const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What was your first pet's name?",
  "What is your mother's maiden name?",
  "What was the model of your first car?",
  "What was the name of your first school?",
  "What is your favourite movie?",
];
