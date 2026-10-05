import { Router } from "express";
import { prisma } from "../db.js";
import { addDays, diffDays, nowInTz, toDay, weekday } from "../lib/dates.js";
import { uid } from "../middleware/auth.js";
import { computeStats, dayOutcome } from "../services/streaks.js";
import { checkInLite, habitSchedule } from "../services/habitView.js";
import { listAchievements, profileStats } from "../services/gamification.js";
import { resolveToday } from "./habits.js";

export const statsRouter = Router();

statsRouter.get("/overview", async (req, res) => {
  const userId = uid(req);
  const today = await resolveToday(req);
  const days = Math.min(Number(req.query.days ?? 365) || 365, 730);
  const from = addDays(today, -(days - 1));

  const [user, habits, profile, focus] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
    prisma.habit.findMany({ where: { userId, archivedAt: null }, include: { checkIns: true } }),
    profileStats(userId),
    prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: new Date(`${addDays(today, -7)}T00:00:00Z`) } },
    }),
  ]);

  const prepared = habits.map((h) => {
    const sched = habitSchedule(h);
    const cis = h.checkIns.map(checkInLite);
    return { h, sched, cis, byDay: new Map(cis.map((c) => [c.date, c])), stats: computeStats(sched, cis, today) };
  });

  const heatmap: { date: string; done: number; due: number }[] = [];
  const weekdayAgg = Array.from({ length: 7 }, () => ({ done: 0, due: 0 }));
  for (let d = from; d <= today; d = addDays(d, 1)) {
    let done = 0;
    let due = 0;
    for (const p of prepared) {
      if (p.h.kind === "QUIT") continue;
      const out = dayOutcome(p.sched, p.byDay.get(d), d);
      if (out === "done") {
        done++;
        due++;
      } else if (out === "missed" && d !== today) due++; // today isn't missed until it's over
    }
    heatmap.push({ date: d, done, due });
    if (due && d !== today) {
      weekdayAgg[weekday(d)].done += done;
      weekdayAgg[weekday(d)].due += due;
    }
  }

  // Character stats: every completion ever, including archived habits, so levels never go backwards.
  // Quit habits earn one point per clean day.
  const allHabits = await prisma.habit.findMany({ where: { userId }, include: { checkIns: true } });
  const categories = new Map<string, { done: number; habits: number }>();
  for (const h of allHabits) {
    const sched = habitSchedule(h);
    const cis = h.checkIns.map(checkInLite);
    let points = computeStats(sched, cis, today).totalDone;
    if (h.kind === "QUIT" && sched.startDate <= today) {
      const slips = new Set(cis.filter((c) => c.status === "SLIP").map((c) => c.date)).size;
      points = Math.max(0, diffDays(today, sched.startDate) + 1 - slips);
    }
    const c = categories.get(h.category) ?? { done: 0, habits: 0 };
    c.done += points;
    if (!h.archivedAt) c.habits++;
    categories.set(h.category, c);
  }

  const last30 = heatmap.slice(-30);
  const sum = (xs: { done: number; due: number }[]) =>
    xs.reduce((a, x) => ({ done: a.done + x.done, due: a.due + x.due }), { done: 0, due: 0 });
  const t30 = sum(last30);
  const t7 = sum(heatmap.slice(-7));
  const prev7 = sum(heatmap.slice(-14, -7));

  const focusByDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return {
      date: d,
      minutes: Math.round(
        focus.filter((f) => nowInTz(user.timezone, f.startedAt).day === d).reduce((a, f) => a + f.durationSec, 0) / 60,
      ),
    };
  });

  res.json({
    today,
    profile,
    heatmap,
    weekdays: weekdayAgg.map((w, i) => ({ weekday: i, rate: w.due ? w.done / w.due : 0 })),
    categories: [...categories.entries()].map(([name, v]) => ({ name, ...v })),
    completion: {
      last7: t7.due ? t7.done / t7.due : 0,
      prev7: prev7.due ? prev7.done / prev7.due : 0,
      last30: t30.due ? t30.done / t30.due : 0,
    },
    focusByDay,
    leaderboard: prepared
      .map((p) => ({
        id: p.h.id,
        name: p.h.name,
        icon: p.h.icon,
        color: p.h.color,
        kind: p.h.kind,
        currentStreak: p.stats.currentStreak,
        bestStreak: p.stats.bestStreak,
        streakUnit: p.stats.streakUnit,
        completionRate: p.stats.completionRate,
      }))
      .sort((a, b) => b.currentStreak - a.currentStreak),
  });
});

statsRouter.get("/profile", async (req, res) => {
  res.json({ profile: await profileStats(uid(req)) });
});

statsRouter.get("/achievements", async (req, res) => {
  res.json({ achievements: await listAchievements(uid(req)) });
});
