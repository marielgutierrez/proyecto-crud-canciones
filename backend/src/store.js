import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { SEED_SONGS } from "./seed.js";

const COLLECTION = "songs";

function nowIso() {
  return new Date().toISOString();
}

function normalize(payload, existing = {}) {
  const title = String(payload.title ?? existing.title ?? "").trim();
  const artist = String(payload.artist ?? existing.artist ?? "").trim();

  if (!title || !artist) {
    const error = new Error("title and artist are required");
    error.status = 400;
    throw error;
  }

  return {
    title,
    artist,
    album: String(payload.album ?? existing.album ?? "").trim(),
    year: Number(payload.year ?? existing.year ?? new Date().getFullYear()) || new Date().getFullYear(),
    duration: String(payload.duration ?? existing.duration ?? "").trim(),
    genre: String(payload.genre ?? existing.genre ?? "Pop").trim() || "Pop",
    lyricsHook: String(payload.lyricsHook ?? existing.lyricsHook ?? "").trim(),
    coverUrl: payload.coverUrl ?? existing.coverUrl ?? "",
    coverPublicId: payload.coverPublicId ?? existing.coverPublicId ?? "",
  };
}

function createMemoryStore() {
  const songs = new Map(
    SEED_SONGS.map((song) => {
      const id = randomUUID();
      const stamp = nowIso();
      return [id, { id, ...song, coverPublicId: "", createdAt: stamp, updatedAt: stamp }];
    }),
  );

  return {
    mode: "memory",
    async list() {
      return [...songs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async get(id) {
      return songs.get(id) || null;
    },
    async create(payload) {
      const id = randomUUID();
      const stamp = nowIso();
      const song = { id, ...normalize(payload), createdAt: stamp, updatedAt: stamp };
      songs.set(id, song);
      return song;
    },
    async update(id, payload) {
      const current = songs.get(id);
      if (!current) return null;
      const song = { ...current, ...normalize(payload, current), updatedAt: nowIso() };
      songs.set(id, song);
      return song;
    },
    async remove(id) {
      const current = songs.get(id);
      if (!current) return null;
      songs.delete(id);
      return current;
    },
  };
}

function createFirestoreStore() {
  const db = getFirestore();
  const col = db.collection(COLLECTION);

  async function seedIfEmpty() {
    const snap = await col.limit(1).get();
    if (!snap.empty) return;
    const batch = db.batch();
    for (const song of SEED_SONGS) {
      const ref = col.doc();
      const stamp = nowIso();
      batch.set(ref, { ...song, coverPublicId: "", createdAt: stamp, updatedAt: stamp });
    }
    await batch.commit();
  }

  const ready = seedIfEmpty();

  return {
    mode: "firestore",
    async list() {
      await ready;
      const snap = await col.orderBy("createdAt", "desc").get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },
    async get(id) {
      await ready;
      const doc = await col.doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async create(payload) {
      await ready;
      const stamp = nowIso();
      const data = { ...normalize(payload), createdAt: stamp, updatedAt: stamp };
      const ref = await col.add(data);
      return { id: ref.id, ...data };
    },
    async update(id, payload) {
      await ready;
      const ref = col.doc(id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const data = { ...normalize(payload, doc.data()), updatedAt: nowIso() };
      await ref.update(data);
      return { id, ...doc.data(), ...data };
    },
    async remove(id) {
      await ready;
      const ref = col.doc(id);
      const doc = await ref.get();
      if (!doc.exists) return null;
      const song = { id, ...doc.data() };
      await ref.delete();
      return song;
    },
  };
}

export function createStore(useFirestore) {
  return useFirestore ? createFirestoreStore() : createMemoryStore();
}
