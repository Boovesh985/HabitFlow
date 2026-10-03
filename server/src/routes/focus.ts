import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { uid } from "../middleware/auth.js";
import { evaluateAchievements, profileStats } from "../services/gamification.js";

export const focusRouter = Router();

focusRouter.get("/", async (req, res) => {
  const sessions = await prisma.focusSession.findMany({
    where: { userId: uid(req) },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { habit: { select: { name: true, icon: true, color: true } } },
  });
  res.json({ sessions });
});

focusRouter.post("/", async (req, res) => {
  const userId = uid(req);
  const body = z
    .object({
      habitId: z.string().uuid().nullish(),
      durationSec: z.number().int().min(60, "Focus at least a minute").max(6 * 3600),
      startedAt: z.string().datetime().optional(),
    })
    .parse(req.body);
  if (body.habitId) await prisma.habit.findFirstOrThrow({ where: { id: body.habitId, userId } });
  const session = await prisma.focusSession.create({
    data: {
      userId,
      habitId: body.habitId ?? null,
      durationSec: body.durationSec,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(Date.now() - body.durationSec * 1000),
    },
  });
  const [newAchievements, profile] = await Promise.all([evaluateAchievements(userId), profileStats(userId)]);
  res.status(201).json({ session, newAchievements, profile });
});
