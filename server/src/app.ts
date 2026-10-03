import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { habitsRouter } from "./routes/habits.js";
import { statsRouter } from "./routes/stats.js";
import { moodsRouter } from "./routes/moods.js";
import { focusRouter } from "./routes/focus.js";
import { tasksRouter } from "./routes/tasks.js";
import { pushRouter } from "./routes/push.js";
import { projectsRouter } from "./routes/projects.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin / native requests (no Origin header) and configured origins.
        if (!origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/users", requireAuth, usersRouter);
  app.use("/api/habits", requireAuth, habitsRouter);
  app.use("/api/stats", requireAuth, statsRouter);
  app.use("/api/moods", requireAuth, moodsRouter);
  app.use("/api/focus", requireAuth, focusRouter);
  app.use("/api/tasks", requireAuth, tasksRouter);
  app.use("/api/projects", requireAuth, projectsRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Optional: serve the built SPA from the same server.
  if (config.staticDir && fs.existsSync(config.staticDir)) {
    const dir = path.resolve(config.staticDir);
    app.use(
      express.static(dir, {
        index: false,
        setHeaders: (res, file) => {
          // Hashed build assets never change; the shell and service worker must always revalidate.
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          else res.setHeader("Cache-Control", "no-cache");
        },
      }),
    );
    app.get(/.*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(dir, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
