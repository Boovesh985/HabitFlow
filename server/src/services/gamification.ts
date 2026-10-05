import { prisma } from "../db.js";
import { nowInTz, toDay, type Day } from "../lib/dates.js";
import { computeStats, dayOutcome } from "./streaks.js";
import { habitSchedule, checkInLite } from "./habitView.js";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_step", title: "First Step", description: "Complete your first habit", icon: "👣", tier: "bronze" },
  { key: "ten_done", title: "Warming Up", description: "Complete habits 10 times", icon: "🔥", tier: "bronze" },
  { key: "hundred_done", title: "Centurion", description: "Complete habits 100 times", icon: "💯", tier: "gold" },
  { key: "thousand_done", title: "Unstoppable", description: "Complete habits 1,000 times", icon: "🚀", tier: "legendary" },
  { key: "streak_3", title: "Hat Trick", description: "Reach a 3 day streak", icon: "🎯", tier: "bronze" },
  { key: "streak_7", title: "One Week Wonder", description: "Reach a 7 day streak", icon: "📅", tier: "silver" },
  { key: "streak_30", title: "Monthly Master", description: "Reach a 30 day streak", icon: "🏆", tier: "gold" },
  { key: "streak_100", title: "Triple Digits", description: "Reach a 100 day streak", icon: "👑", tier: "legendary" },
  { key: "collector", title: "Habit Collector", description: "Track 5 active habits", icon: "🧩", tier: "silver" },
  { key: "perfect_day", title: "Perfect Day", description: "Complete every habit due today", icon: "🌟", tier: "silver" },
  { key: "early_bird", title: "Early Bird", description: "Check in before 7 AM", icon: "🌅", tier: "bronze" },
  { key: "night_owl", title: "Night Owl", description: "Check in after 11 PM", icon: "🦉", tier: "bronze" },
  { key: "focus_first", title: "In The Zone", description: "Finish a focus session", icon: "🧘", tier: "bronze" },
  { key: "focus_master", title: "Deep Worker", description: "Focus for 10 hours total", icon: "⏳", tier: "gold" },
  { key: "task_slayer", title: "Task Slayer", description: "Complete 25 tasks", icon: "⚔️", tier: "silver" },
  { key: "breaking_free", title: "Breaking Free", description: "Stay clean for 7 days on a quit habit", icon: "🕊️", tier: "silver" },
  { key: "first_brick", title: "First Brick", description: "Finish a step of a project", icon: "🧱", tier: "bronze" },
  { key: "shipped", title: "Shipped", description: "Complete a project", icon: "📦", tier: "gold" },
  { key: "graduate", title: "Graduate", description: "Finish a course", icon: "🎓", tier: "gold" },
  { key: "builder", title: "Builder", description: "Finish 100 project steps or lessons", icon: "🏗️", tier: "legendary" },
];

export const XP = { checkIn: 10, focusMinute: 1, mood: 5, task: 5, achievement: 50, step: 10, unit: 10, project: 100 };

/** Level L requires 50·L·(L−1) XP: L2 = 100, L3 = 300, L4 = 600 ... */
export function levelFromXp(xp: number) {
  const level = Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2);
  const floor = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, xp, levelFloor: floor, nextLevelXp: next, progress: (xp - floor) / (next - floor) };
}

export async function profileStats(userId: string) {
  const [doneCount, frozenCount, focus, moodCount, taskCount, achCount, stepCount, units, projectsDone, coursesDone] = await Promise.all([
    prisma.checkIn.count({ where: { userId, status: "DONE" } }),
    prisma.checkIn.count({ where: { userId, status: "FROZEN" } }),
    prisma.focusSession.aggregate({ where: { userId }, _sum: { durationSec: true }, _count: true }),
    prisma.moodEntry.count({ where: { userId } }),
    prisma.task.count({ where: { userId, completedAt: { not: null } } }),
    prisma.userAchievement.count({ where: { userId } }),
    prisma.projectStep.count({ where: { doneAt: { not: null }, project: { userId } } }),
    prisma.project.aggregate({ where: { userId }, _sum: { unitsDone: true } }),
    prisma.project.count({ where: { userId, kind: "PROJECT", completedAt: { not: null } } }),
    prisma.project.count({ where: { userId, kind: "COURSE", completedAt: { not: null } } }),
  ]);
  const unitsDone = units._sum.unitsDone ?? 0;
  const focusMinutes = Math.floor((focus._sum.durationSec ?? 0) / 60);
  const xp =
    doneCount * XP.checkIn +
    focusMinutes * XP.focusMinute +
    moodCount * XP.mood +
    taskCount * XP.task +
    achCount * XP.achievement +
    stepCount * XP.step +
    unitsDone * XP.unit +
    (projectsDone + coursesDone) * XP.project;
  // Streak freezes: start with 2, earn one per 25 completions, spend one per frozen day.
  const freezes = Math.max(0, 2 + Math.floor(doneCount / 25) - frozenCount);
  return {
    ...levelFromXp(xp),
    totalCheckIns: doneCount,
    focusMinutes,
    focusSessions: focus._count,
    moodEntries: moodCount,
    tasksCompleted: taskCount,
    achievements: achCount,
    streakFreezes: freezes,
    projectSteps: stepCount,
    courseUnits: unitsDone,
    projectsDone,
    coursesDone,
  };
}

/** Evaluate all achievements and persist any newly unlocked ones. Returns the new ones. */
export async function evaluateAchievements(userId: string, today?: Day): Promise<AchievementDef[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (!user) return [];
  const day = today ?? nowInTz(user.timezone).day;

  const [owned, habits, stats, lastCheckIns] = await Promise.all([
    prisma.userAchievement.findMany({ where: { userId }, select: { key: true } }),
    prisma.habit.findMany({ where: { userId, archivedAt: null }, include: { checkIns: true } }),
    profileStats(userId),
    prisma.checkIn.findMany({ where: { userId, status: "DONE" }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  const have = new Set(owned.map((o) => o.key));

  let maxStreak = 0;
  let maxClean = 0;
  let dueToday = 0;
  let doneToday = 0;
  for (const h of habits) {
    const sched = habitSchedule(h);
    const cis = h.checkIns.map(checkInLite);
    const s = computeStats(sched, cis, day);
    if (h.kind === "QUIT") maxClean = Math.max(maxClean, s.currentStreak);
    else maxStreak = Math.max(maxStreak, s.bestStreak);
    const out = dayOutcome(sched, cis.find((c) => c.date === day), day);
    if (h.kind === "BUILD" && out !== "not-due") {
      dueToday++;
      if (out === "done" || out === "skipped") doneToday++;
    }
  }

  const hours = lastCheckIns.map((c) => nowInTz(user.timezone, c.updatedAt).hour);
  const checks: Record<string, boolean> = {
    first_step: stats.totalCheckIns >= 1,
    ten_done: stats.totalCheckIns >= 10,
    hundred_done: stats.totalCheckIns >= 100,
    thousand_done: stats.totalCheckIns >= 1000,
    streak_3: maxStreak >= 3,
    streak_7: maxStreak >= 7,
    streak_30: maxStreak >= 30,
    streak_100: maxStreak >= 100,
    collector: habits.length >= 5,
    perfect_day: dueToday > 0 && doneToday === dueToday,
    early_bird: hours.some((h) => h < 7 && h >= 4),
    night_owl: hours.some((h) => h >= 23),
    focus_first: stats.focusSessions >= 1,
    focus_master: stats.focusMinutes >= 600,
    task_slayer: stats.tasksCompleted >= 25,
    breaking_free: maxClean >= 7,
    first_brick: stats.projectSteps + stats.courseUnits >= 1,
    shipped: stats.projectsDone >= 1,
    graduate: stats.coursesDone >= 1,
    builder: stats.projectSteps + stats.courseUnits >= 100,
  };

  const unlocked = ACHIEVEMENTS.filter((a) => !have.has(a.key) && checks[a.key]);
  if (unlocked.length) {
    await prisma.userAchievement.createMany({
      data: unlocked.map((a) => ({ userId, key: a.key })),
      skipDuplicates: true,
    });
  }
  return unlocked;
}

export async function listAchievements(userId: string) {
  const owned = await prisma.userAchievement.findMany({ where: { userId } });
  const map = new Map(owned.map((o) => [o.key, o.unlockedAt]));
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: map.has(a.key),
    unlockedAt: map.has(a.key) ? toDay(map.get(a.key)!) : null,
  }));
}
