// Server-side auth helpers — sessions, password hashing, user CRUD
import { getIronSession, type SessionOptions } from "iron-session";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { kvGet, kvSet, kvDel, kvKeys } from "./storage";

export const ADMIN_EMAIL = "meetpatel4384@gmail.com";

export interface User {
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt?: string;
  sessionMaxAgeMs?: number;
  // For password recovery via security question (auth-kit pattern)
  avatar?: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
}

export interface SessionData {
  email?: string;
  name?: string;
  role?: "admin" | "user";
  expiresAt?: number; // unix ms
}

// Sessions never expire — 10 years
export const NEVER_EXPIRES = 365 * 24 * 60 * 60 * 1000 * 10;

function getSessionOptions(maxAgeMs: number = NEVER_EXPIRES): SessionOptions {
  const password = process.env.SESSION_SECRET || "dev-only-secret-min-32-chars-long-please-change!";
  return {
    password,
    cookieName: "eb_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor(maxAgeMs / 1000),
    },
  };
}

export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions());
  return session;
}

export async function setSessionUser(user: User): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(NEVER_EXPIRES));
  session.email = user.email;
  session.name = user.name;
  session.role = user.role;
  session.expiresAt = Date.now() + NEVER_EXPIRES;
  await session.save();
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions());
  session.destroy();
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// User CRUD via storage layer
const userKey = (email: string) => `user:${email.toLowerCase()}`;

export async function getUserByEmail(email: string): Promise<User | null> {
  return await kvGet<User>(userKey(email));
}

export async function saveUser(user: User): Promise<void> {
  await kvSet(userKey(user.email), user);
}

export async function deleteUser(email: string): Promise<void> {
  await kvDel(userKey(email));
}

export async function listUsers(): Promise<User[]> {
  const keys = await kvKeys("user:*");
  const users = await Promise.all(keys.map((k) => kvGet<User>(k)));
  return users.filter((u): u is User => !!u);
}

export async function createUser(
  email: string,
  name: string,
  password: string,
  extras: { avatar?: string; securityQuestion?: string; securityAnswer?: string } = {},
): Promise<User> {
  const existing = await getUserByEmail(email);
  if (existing) throw new Error("User already exists");

  const isFirstUser = (await listUsers()).length === 0;
  const role: "admin" | "user" = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || isFirstUser ? "admin" : "user";

  const user: User = {
    email: email.toLowerCase(),
    name,
    passwordHash: await hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
    avatar: extras.avatar,
    securityQuestion: extras.securityQuestion,
    securityAnswerHash: extras.securityAnswer ? await hashPassword(extras.securityAnswer.toLowerCase().trim()) : undefined,
  };
  await saveUser(user);
  return user;
}
