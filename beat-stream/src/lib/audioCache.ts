import { createStore, get, set, del, keys, values } from "idb-keyval";

const audioStore = typeof indexedDB !== "undefined"
  ? createStore("beatstream", "audio")
  : null;

export const audioCache = {
  async put(songId: string, blob: Blob): Promise<void> {
    if (!audioStore) return;
    await set(songId, blob, audioStore);
  },
  async get(songId: string): Promise<Blob | undefined> {
    if (!audioStore) return undefined;
    return await get<Blob>(songId, audioStore);
  },
  async has(songId: string): Promise<boolean> {
    if (!audioStore) return false;
    return (await get(songId, audioStore)) !== undefined;
  },
  async remove(songId: string): Promise<void> {
    if (!audioStore) return;
    await del(songId, audioStore);
  },
  async clear(): Promise<void> {
    if (!audioStore) return;
    const ks = await keys(audioStore);
    await Promise.all(ks.map((k) => del(k, audioStore)));
  },
  async size(): Promise<number> {
    if (!audioStore) return 0;
    const vs = await values<Blob>(audioStore);
    return vs.reduce((sum, b) => sum + (b?.size || 0), 0);
  },
  async keys(): Promise<string[]> {
    if (!audioStore) return [];
    const ks = await keys(audioStore);
    return ks.map((k) => String(k));
  },
};

export async function downloadAudio(url: string, songId: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  await audioCache.put(songId, blob);
  return blob;
}

export async function getAudioObjectUrl(songId: string): Promise<string | null> {
  const blob = await audioCache.get(songId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
