import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";
import { addDays, isValidDay, toDate, toDay } from "../lib/dates.js";
import { uid } from "../middleware/auth.js";
import { evaluateAchievements } from "../services/gamification.js";
import { resolveToday } from "./habits.js";

export const moodsRouter = Router();

const view = (m: { date: Date; mood: number; energy: number | null; note: string | null }) => ({
  date: toDay(m.date),
  mood: m.mood,
  energy: m.energy,
  note: m.note,
});

moodsRouter.get("/", async (req, res) => {
  const today = await resolveToday(req);
  const from = typeof req.query.from === "string" && isValidDay(req.query.from) ? req.query.from : addDays(today, -90);
  const moods = await prisma.moodEntry.findMany({
    where: { userId: uid(req), date: { gte: toDate(from) } },
    orderBy: { date: "asc" },
  });
  res.json({ moods: moods.map(view) });
});

moodsRouter.put("/:date", async (req, res) => {
  const userId = uid(req);
  if (!isValidDay(req.params.date)) throw new HttpError(400, "Invalid date");
  const body = z
    .object({
      mood: z.number().int().min(1).max(5),
      energy: z.number().int().min(1).max(5).nullish(),
      note: z.string().max(1000).nullish(),
    })
    .parse(req.body);
  const date = toDate(req.params.date);
  const mood = await prisma.moodEntry.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, mood: body.mood, energy: body.energy ?? null, note: body.note ?? null },
    update: { mood: body.mood, energy: body.energy ?? null, note: body.note ?? null },
  });
  const newAchievements = await evaluateAchievements(userId, await resolveToday(req));
  res.json({ mood: view(mood), newAchievements });
});
