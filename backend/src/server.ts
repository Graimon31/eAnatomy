import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import apiRouter from "./routes/api";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// --- Middleware ---

// CORS for local dev
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));

// Compression: gzip/brotli — critical for polygon JSON payloads
// threshold: compress responses > 1 KB
app.use(compression({ level: 6, threshold: 1024 }));

// Serve static images with aggressive caching
app.use(
  "/images",
  express.static(path.join(__dirname, "..", "public", "images"), {
    maxAge: "7d",
    immutable: true,
  })
);

// --- Routes ---
app.use("/api", apiRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`eAnatomy API running on http://localhost:${PORT}`);
});

export default app;
