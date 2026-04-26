// Hybrid storage: Vercel KV in production, in-memory + JSON file in dev
// All keys are namespaced with `eb:` prefix.

import fs from "fs/promises";
import path from "path";

const NS = "eb:";
const LOCAL_FILE = path.join(process.cwd(), ".local-storage.json");

interface KvLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

let kvClient: KvLike | null = null;
let memStore: Record<string, unknown> | null = null;

async function getKv(): Promise<KvLike | null> {
  if (kvClient) return kvClient;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const mod = await import("@vercel/kv");
    kvClient = mod.kv as unknown as KvLike;
    return kvClient;
  } catch { return null; }
}

async function loadLocal(): Promise<Record<string, unknown>> {
  if (memStore) return memStore;
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf-8");
    memStore = JSON.parse(raw);
  } catch {
    memStore = {};
  }
  return memStore!;
}

async function saveLocal() {
  try {
    await fs.writeFile(LOCAL_FILE, JSON.stringify(memStore || {}, null, 2));
  } catch {}
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKv();
  if (kv) return await kv.get<T>(NS + key);
  const store = await loadLocal();
  return (store[NS + key] as T) ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.set(NS + key, value);
    return;
  }
  const store = await loadLocal();
  store[NS + key] = value;
  await saveLocal();
}

export async function kvDel(key: string): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.del(NS + key);
    return;
  }
  const store = await loadLocal();
  delete store[NS + key];
  await saveLocal();
}

export async function kvKeys(pattern: string): Promise<string[]> {
  const kv = await getKv();
  if (kv) {
    const keys = await kv.keys(NS + pattern);
    return keys.map((k) => k.replace(NS, ""));
  }
  const store = await loadLocal();
  const prefix = NS + pattern.replace(/\*$/, "");
  return Object.keys(store)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.replace(NS, ""));
}

export function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
