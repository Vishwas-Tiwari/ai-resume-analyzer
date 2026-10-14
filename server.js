/**
 * Local dev server for /api/* routes.
 * Mimics Vercel serverless functions so the app works without `vercel dev`.
 * Run alongside `npm run dev` via `npm run dev:api`.
 */

import "dotenv/config";
import express from "express";
import handler from "./api/analyze-resume.js";

const app = express();
const PORT = 3001;

// Mount the Vercel-style handler at /api/analyze-resume
app.all("/api/analyze-resume", (req, res) => {
  handler(req, res);
});

app.listen(PORT, () => {
  console.log(`[API server] Running at http://localhost:${PORT}`);
});
