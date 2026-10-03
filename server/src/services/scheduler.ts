import cron from "node-cron";
import { prisma } from "../db.js";
import { nowInTz, toDate } from "../lib/dates.js";
import { computeStats, isDue } from "./streaks.js";
import { checkInLite, habitSchedule } from "./habitView.js";
import { actionToken, pushEnabled, sendToUser } from "./push.js";

const NUDGES = [
  "Small steps count. Start this one.",
  "Show up today. That's the whole job.",
  "Consistency beats intensity.",
  "Two minutes is all it takes to start.",
  "Day by day, the arc gets written.",
];

/** Atomically claim a reminder so that only one server instance sends it per minute. */
async function claimReminder(id: string, now: Date) {
  const { count } = await prisma.reminder.updateMany({
    where: { id, OR: [{ lastSentAt: null }, { lastSentAt: { lt: new Date(now.getTime() - 90_000) } }] },
    data: { lastSentAt: now },
  });
  return count === 1;
}

export async function runHabitReminders(now = new Date()) {
  const zones = await prisma.user.findMany({
    where: { reminders: { some: { enabled: true } } },
    distinct: ["timezone"],
    select: { timezone: true },
  });

  for (const { timezone } of zones) {
    const local = nowInTz(timezone, now);
    const reminders = await prisma.reminder.findMany({
      where: { enabled: true, time: local.time, user: { timezone }, habit: { archivedAt: null } },
      include: { habit: { include: { checkIns: true } } },
    });

    for (const r of reminders) {
      const h = r.habit;
      const sched = habitSchedule(h);
      const scheduledToday = r.daysOfWeek.length ? r.daysOfWeek.includes(local.weekday) : isDue(sched, local.day);
      if (!scheduledToday || local.day < sched.startDate) continue;
      const stats = computeStats(sched, h.checkIns.map(checkInLite), local.day);
      // Never nag about something already done: done or skipped today, or a weekly target already met.
      if (h.kind === "BUILD" && (stats.doneToday || stats.todayStatus === "SKIPPED" || !stats.dueToday)) continue;
      if (!(await claimReminder(r.id, now))) continue;

      const streakLine =
        h.kind === "QUIT"
          ? `${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"} strong. Keep going!`
          : stats.currentStreak > 0
            ? `Keep your ${stats.currentStreak}-${stats.streakUnit === "weeks" ? "week" : "day"} streak alive.`
            : NUDGES[Math.floor(Math.random() * NUDGES.length)];
      const progress = h.targetCount > 1 ? ` (${stats.todayCount}/${h.targetCount}${h.unit ? " " + h.unit : ""})` : "";

      await sendToUser(r.userId, {
        title: `${h.name}${progress}`,
        body: r.message ? `${r.message}\n${streakLine}` : streakLine,
        tag: `habit-${h.id}`,
        url: `/habits/${h.id}`,
        actions:
          h.kind === "BUILD"
            ? [
                { action: "done", title: h.targetCount > 1 ? "➕ Log 1" : "✅ Done" },
                { action: "snooze", title: "⏰ 10 min" },
              ]
            : [],
        data: { type: "habit", habitId: h.id, date: local.day, token: actionToken(r.userId, h.id, local.day) },
      });
    }
  }
}

export async function runTaskReminders(now = new Date()) {
  const due = await prisma.task.findMany({
    where: {
      remindAt: { lte: now, gte: new Date(now.getTime() - 86_400_000) },
      reminderSentAt: null,
      completedAt: null,
    },
    take: 500,
  });
  for (const t of due) {
    const { count } = await prisma.task.updateMany({
      where: { id: t.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (!count) continue;
    await sendToUser(t.userId, {
      title: t.title,
      body: t.notes || (t.dueAt ? `Due ${t.dueAt.toLocaleString()}` : "Reminder for your task"),
      tag: `task-${t.id}`,
      url: "/tasks",
      data: { type: "task", taskId: t.id },
    });
  }
}

/** Countdown stages before a project deadline: 3 days, 1 day, 3 hours, due. */
const STAGES = [
  { stage: 1, before: 72 * 3600_000, title: "3 days left" },
  { stage: 2, before: 24 * 3600_000, title: "Due tomorrow" },
  { stage: 3, before: 3 * 3600_000, title: "Due in 3 hours" },
  { stage: 4, before: 0, title: "Due now" },
];

function projectLine(p: { kind: string; totalUnits: number | null; unitsDone: number; unitLabel: string | null; steps: { doneAt: Date | null; title: string }[] }) {
  if (p.kind === "COURSE" && p.totalUnits) return `${p.unitsDone} of ${p.totalUnits} ${p.unitLabel || "lessons"} done.`;
  const next = p.steps.find((s) => !s.doneAt);
  const done = p.steps.filter((s) => s.doneAt).length;
  if (next) return `Next: ${next.title} (${done}/${p.steps.length} steps)`;
  return p.steps.length ? "Every step is ticked. Mark it complete." : "Open it and add the first step.";
}

export async function runProjectReminders(now = new Date()) {
  // Deadline countdown. Each stage is claimed atomically so it's sent once.
  const upcoming = await prisma.project.findMany({
    where: {
      completedAt: null,
      archivedAt: null,
      deadlineStage: { lt: 4 },
      deadline: { not: null, lte: new Date(now.getTime() + STAGES[0].before), gte: new Date(now.getTime() - 86_400_000) },
    },
    include: { steps: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    take: 500,
  });
  for (const p of upcoming) {
    const left = p.deadline!.getTime() - now.getTime();
    const reached = [...STAGES].reverse().find((s) => left <= s.before);
    if (!reached || reached.stage <= p.deadlineStage) continue;
    const { count } = await prisma.project.updateMany({ where: { id: p.id, deadlineStage: p.deadlineStage }, data: { deadlineStage: reached.stage } });
    if (!count) continue;
    await sendToUser(p.userId, {
      title: `${reached.title}: ${p.title}`,
      body: reached.stage === 4 ? "Mark it complete, or open it and move the deadline." : projectLine(p),
      tag: `project-${p.id}`,
      url: `/projects/${p.id}`,
      data: { type: "project", projectId: p.id },
    });
  }

  // Weekly nudge for projects that have gone quiet, at 7 pm local time.
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const quiet = await prisma.project.findMany({
    where: {
      nudge: true,
      completedAt: null,
      archivedAt: null,
      lastActivityAt: { lt: weekAgo },
      OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: weekAgo } }],
    },
    include: { steps: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }, user: { select: { timezone: true } } },
    take: 500,
  });
  for (const p of quiet) {
    if (nowInTz(p.user.timezone, now).time !== "19:00") continue;
    const { count } = await prisma.project.updateMany({
      where: { id: p.id, OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: weekAgo } }] },
      data: { lastNudgeAt: now },
    });
    if (!count) continue;
    const days = Math.floor((now.getTime() - p.lastActivityAt.getTime()) / 86_400_000);
    await sendToUser(p.userId, {
      title: `${p.title} has been quiet for ${days} days`,
      body: projectLine(p),
      tag: `project-${p.id}`,
      url: `/projects/${p.id}`,
      data: { type: "project", projectId: p.id },
    });
  }
}

const snoozeTimers = new Set<NodeJS.Timeout>();

/** Re-send a habit reminder after a delay (in-memory; good enough for snoozes). */
export function snoozeHabit(userId: string, habitId: string, minutes = 10) {
  const timer = setTimeout(async () => {
    snoozeTimers.delete(timer);
    const h = await prisma.habit.findFirst({
      where: { id: habitId, userId },
      include: { checkIns: true, user: { select: { timezone: true } } },
    });
    if (!h) return;
    const day = nowInTz(h.user.timezone).day;
    const done = h.checkIns.some((c) => c.date.getTime() === toDate(day).getTime() && c.status === "DONE" && c.count >= h.targetCount);
    if (done) return;
    await sendToUser(userId, {
      title: h.name,
      body: "Snooze is over. Do it now.",
      tag: `habit-${h.id}`,
      url: `/habits/${h.id}`,
      actions: [{ action: "done", title: "✅ Done" }],
      data: { type: "habit", habitId: h.id, date: day, token: actionToken(userId, h.id, day) },
    });
  }, minutes * 60_000);
  snoozeTimers.add(timer);
}

export function startScheduler() {
  if (!pushEnabled) console.warn("[scheduler] running without push; reminders will only fire on Android local notifications");
  cron.schedule("* * * * *", async () => {
    try {
      await runHabitReminders();
      await runTaskReminders();
      await runProjectReminders();
    } catch (err) {
      console.error("[scheduler] tick failed", err);
    }
  });
  cron.schedule("17 3 * * *", async () => {
    await prisma.refreshToken
      .deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }] } })
      .catch((e) => console.error("[scheduler] cleanup failed", e));
  });
  console.log("[scheduler] reminder scheduler started");
}
