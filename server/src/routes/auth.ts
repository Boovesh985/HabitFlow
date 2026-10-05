import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { HttpError } from "../lib/http.js";
import { isValidTimezone } from "../lib/dates.js";
import { requireAuth, uid } from "../middleware/auth.js";
import { userView } from "./users.js";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

async function issueTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId, typ: "access" }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl as jwt.SignOptions["expiresIn"],
  });
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash(refreshToken),
      expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
    },
  });
  return { accessToken, refreshToken };
}

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().trim().min(1, "Name is required").max(60),
  timezone: z.string().optional(),
});

authRouter.post("/register", limiter, async (req, res) => {
  if (!config.allowRegistration) throw new HttpError(403, "Registration is closed on this server");
  const body = registerSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new HttpError(409, "An account with this email already exists");
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash: await bcrypt.hash(body.password, 12),
      timezone: body.timezone && isValidTimezone(body.timezone) ? body.timezone : "Asia/Kolkata",
    },
  });
  res.status(201).json({ user: userView(user), ...(await issueTokens(user.id)) });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRouter.post("/login", limiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, "Incorrect email or password");
  }
  res.json({ user: userView(user), ...(await issueTokens(user.id)) });
});

authRouter.post("/refresh", limiter, async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(refreshToken) } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) {
    // Reuse of a revoked token suggests theft: revoke the whole family for this user.
    if (row?.revokedAt) await prisma.refreshToken.updateMany({ where: { userId: row.userId }, data: { revokedAt: new Date() } });
    throw new HttpError(401, "Session expired, please sign in again");
  }
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  res.json(await issueTokens(row.userId));
});

authRouter.post("/logout", async (req, res) => {
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null;
  if (token) await prisma.refreshToken.updateMany({ where: { tokenHash: hash(token) }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: uid(req) } });
  if (!user) throw new HttpError(404, "User not found");
  res.json({ user: userView(user) });
});

authRouter.get("/config", (_req, res) => {
  res.json({ allowRegistration: config.allowRegistration, vapidPublicKey: config.vapid.publicKey || null });
});
