import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";
import { addDays, nowInTz, toDate } from "../lib/dates.js";
import { requireAuth, uid } from "../middleware/auth.js";
import { pushEnabled, pushSubscribersChanged, sendToUser, verifyActionToken } from "../services/push.js";
import { snoozeHabit } from "../services/scheduler.js";
import { evaluateAchievements } from "../services/gamification.js";

export const pushRouter = Router();

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

pushRouter.post("/subscribe", requireAuth, async (req, res) => {
  if (!pushEnabled) throw new HttpError(503, "Push notifications are not configured on this server");
  const body = subSchema.parse(req.body);
  const data = {
    userId: uid(req),
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: req.headers["user-agent"]?.slice(0, 300),
  };
  await prisma.pushSubscription.upsert({ where: { endpoint: body.endpoint }, create: { endpoint: body.endpoint, ...data }, update: data });
  pushSubscribersChanged();
  res.json({ ok: true });
});

pushRouter.post("/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: uid(req) } });
  pushSubscribersChanged();
  res.json({ ok: true });
});

pushRouter.post("/test", requireAuth, async (req, res) => {
  const sent = await sendToUser(uid(req), {
    title: "🎉 Notifications are working",
    body: "You'll get reminders exactly when you set them.",
    tag: "test",
    url: "/",
  });
  res.json({ sent });
});

/** Called by the service worker when a notification action button is tapped. */
pushRouter.post("/action", async (req, res) => {
  const { token, action } = z.object({ token: z.string(), action: z.enum(["done", "snooze"]) }).parse(req.body);
  let p: ReturnType<typeof verifyActionToken>;
  try {
    p = verifyActionToken(token);
  } catch {
    throw new HttpError(401, "This notification has expired");
  }
  const habit = await prisma.habit.findFirst({
    where: { id: p.habitId, userId: p.sub },
    include: { user: { select: { timezone: true } } },
  });
  if (!habit) throw new HttpError(404, "Habit not found");

  if (action === "snooze") {
    snoozeHabit(p.sub, habit.id, 10);
    return res.json({ ok: true, snoozed: 10 });
  }

  const today = nowInTz(habit.user.timezone).day;
  if (p.date < addDays(today, -1)) throw new HttpError(400, "This reminder is from an earlier day");
  const date = toDate(p.date);
  const existing = await prisma.checkIn.findUnique({ where: { habitId_date: { habitId: habit.id, date } } });
  const count = habit.targetCount > 1 ? Math.min((existing?.status === "DONE" ? existing.count : 0) + 1, 100000) : habit.targetCount;
  await prisma.checkIn.upsert({
    where: { habitId_date: { habitId: habit.id, date } },
    create: { habitId: habit.id, userId: p.sub, date, count, status: "DONE" },
    update: { count, status: "DONE" },
  });
  await evaluateAchievements(p.sub, today);
  res.json({ ok: true, count, target: habit.targetCount });
});
