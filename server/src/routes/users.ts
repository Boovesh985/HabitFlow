import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";
import { isValidTimezone, toDay } from "../lib/dates.js";
import { uid } from "../middleware/auth.js";
import { checkInView, reminderView } from "../services/habitView.js";

export const usersRouter = Router();

export function userView(u: User) {
  return { id: u.id, email: u.email, name: u.name, avatar: u.avatar, timezone: u.timezone, createdAt: u.createdAt };
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  avatar: z.string().max(16).optional(),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone").optional(),
});

usersRouter.patch("/me", async (req, res) => {
  const data = patchSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: uid(req) }, data });
  res.json({ user: userView(user) });
});

usersRouter.put("/me/password", async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string(), newPassword: z.string().min(8, "Password must be at least 8 characters") })
    .parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, "Current password is incorrect");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.json({ ok: true });
});

usersRouter.get("/me/export", async (req, res) => {
  const userId = uid(req);
  const [user, habits, tasks, moods, focus, achievements, projects] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.habit.findMany({ where: { userId }, include: { checkIns: true, reminders: true } }),
    prisma.task.findMany({ where: { userId } }),
    prisma.moodEntry.findMany({ where: { userId } }),
    prisma.focusSession.findMany({ where: { userId } }),
    prisma.userAchievement.findMany({ where: { userId } }),
    prisma.project.findMany({ where: { userId }, include: { steps: { orderBy: { sortOrder: "asc" } } } }),
  ]);
  res.setHeader("Content-Disposition", `attachment; filename="habitflow-export-${toDay(new Date())}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: 1,
    user: userView(user),
    habits: habits.map((h) => ({
      ...h,
      startDate: toDay(h.startDate),
      checkIns: h.checkIns.map(checkInView),
      reminders: h.reminders.map(reminderView),
    })),
    tasks,
    moods: moods.map((m) => ({ ...m, date: toDay(m.date) })),
    focusSessions: focus,
    achievements,
    projects,
  });
});

usersRouter.delete("/me", async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(400, "Password is incorrect");
  await prisma.user.delete({ where: { id: user.id } });
  res.json({ ok: true });
});
