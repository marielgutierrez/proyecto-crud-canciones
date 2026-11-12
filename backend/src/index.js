import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { initializeApp, cert } from "firebase-admin/app";
import { createStore } from "./store.js";

const PORT = Number(process.env.PORT) || 8080;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const firebaseReady = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
);

const cloudinaryReady = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
);

if (firebaseReady) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

if (cloudinaryReady) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const store = createStore(firebaseReady);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

async function uploadCover(file, previousPublicId) {
  if (!file) return {};

  if (!cloudinaryReady) {
    return {
      coverUrl: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      coverPublicId: "",
    };
  }

  if (previousPublicId) {
    await cloudinary.uploader.destroy(previousPublicId).catch(() => {});
  }

  const uploaded = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "popstack",
        resource_type: "image",
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(file.buffer);
  });

  return { coverUrl: uploaded.secure_url, coverPublicId: uploaded.public_id };
}

const app = express();
app.use(
  cors({
    origin: FRONTEND_ORIGIN.split(",").map((origin) => origin.trim()),
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "popstack-api",
    db: store.mode,
    storage: cloudinaryReady ? "cloudinary" : "inline",
  });
});

app.get("/api/songs", async (_req, res, next) => {
  try {
    res.json(await store.list());
  } catch (error) {
    next(error);
  }
});

app.get("/api/songs/:id", async (req, res, next) => {
  try {
    const song = await store.get(req.params.id);
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    res.json(song);
  } catch (error) {
    next(error);
  }
});

app.post("/api/songs", upload.single("cover"), async (req, res, next) => {
  try {
    const cover = await uploadCover(req.file);
    const song = await store.create({ ...req.body, ...cover });
    res.status(201).json(song);
  } catch (error) {
    next(error);
  }
});

app.put("/api/songs/:id", upload.single("cover"), async (req, res, next) => {
  try {
    const current = await store.get(req.params.id);
    if (!current) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    const cover = await uploadCover(req.file, current.coverPublicId);
    const song = await store.update(req.params.id, { ...req.body, ...cover });
    res.json(song);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/songs/:id", async (req, res, next) => {
  try {
    const removed = await store.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    if (cloudinaryReady && removed.coverPublicId) {
      await cloudinary.uploader.destroy(removed.coverPublicId).catch(() => {});
    }
    res.json({ ok: true, id: removed.id });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || "Unexpected error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PopStack API on :${PORT} db=${store.mode} storage=${cloudinaryReady ? "cloudinary" : "inline"}`);
});
