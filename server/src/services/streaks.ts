import { addDays, diffDays, minDay, weekday, weekStart, type Day } from "../lib/dates.js";

export type Frequency = "DAILY" | "WEEKLY_DAYS" | "TIMES_PER_WEEK";
export type Status = "DONE" | "SKIPPED" | "FROZEN" | "SLIP";

export interface HabitSchedule {
  kind: "BUILD" | "QUIT";
  frequencyType: Frequency;
  daysOfWeek: number[];
  timesPerWeek: number;
  targetCount: number;
  startDate: Day;
}

export interface CheckInLite {
  date: Day;
  count: number;
  status: Status;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  streakUnit: "days" | "weeks";
  completionRate: number; // 0..1 over the last 30 days (or 4 weeks)
  totalDone: number;
  dueToday: boolean;
  doneToday: boolean;
  todayCount: number;
  todayStatus: Status | null;
  weekProgress: { done: number; target: number } | null;
}

type DayState = "done" | "preserve" | "miss";

export function isDue(h: HabitSchedule, day: Day): boolean {
  if (day < h.startDate) return false;
  if (h.frequencyType === "DAILY" || h.frequencyType === "TIMES_PER_WEEK") return true;
  return h.daysOfWeek.length === 0 || h.daysOfWeek.includes(weekday(day));
}

function isComplete(h: HabitSchedule, c: CheckInLite | undefined): boolean {
  return !!c && c.status === "DONE" && c.count >= h.targetCount;
}

function dayState(h: HabitSchedule, c: CheckInLite | undefined): DayState {
  if (isComplete(h, c)) return "done";
  if (c && (c.status === "SKIPPED" || c.status === "FROZEN")) return "preserve";
  return "miss";
}

export function computeStats(h: HabitSchedule, checkIns: CheckInLite[], today: Day): HabitStats {
  const byDay = new Map(checkIns.map((c) => [c.date, c]));
  const todayCi = byDay.get(today);
  const earliest = checkIns.reduce((m, c) => minDay(m, c.date), h.startDate);
  const sched: HabitSchedule = { ...h, startDate: earliest };

  const base = {
    totalDone: checkIns.filter((c) => isComplete(h, c)).length,
    todayCount: todayCi?.status === "DONE" ? todayCi.count : 0,
    todayStatus: todayCi?.status ?? null,
  };

  if (h.kind === "QUIT") return { ...base, ...quitStats(sched, checkIns, today) };
  if (h.frequencyType === "TIMES_PER_WEEK") return { ...base, ...weeklyStats(sched, byDay, today) };
  return { ...base, ...dailyStats(sched, byDay, today) };
}

function dailyStats(h: HabitSchedule, byDay: Map<Day, CheckInLite>, today: Day) {
  // Best streak: walk forward through history.
  let best = 0;
  let run = 0;
  for (let d = h.startDate; d <= today; d = addDays(d, 1)) {
    const st = dayState(h, byDay.get(d));
    if (st === "done") run++;
    else if (st === "miss" && isDue(h, d) && d !== today) run = 0;
    best = Math.max(best, run);
  }

  // Current streak: walk backward from today; an unfinished today doesn't break it.
  let current = 0;
  for (let d = today; d >= h.startDate; d = addDays(d, -1)) {
    const st = dayState(h, byDay.get(d));
    if (st === "done") current++;
    else if (st === "preserve" || !isDue(h, d) || d === today) continue;
    else break;
  }

  // Completion rate over the last 30 days (excluding a still-pending today).
  let due = 0;
  let done = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (d < h.startDate) break;
    if (!isDue(h, d)) continue;
    const st = dayState(h, byDay.get(d));
    if (d === today && st !== "done") continue;
    if (st === "preserve") continue;
    due++;
    if (st === "done") done++;
  }

  const todayCi = byDay.get(today);
  return {
    currentStreak: current,
    bestStreak: Math.max(best, current),
    streakUnit: "days" as const,
    completionRate: due ? done / due : 0,
    dueToday: isDue(h, today),
    doneToday: isComplete(h, todayCi),
    weekProgress: null,
  };
}

function weeklyStats(h: HabitSchedule, byDay: Map<Day, CheckInLite>, today: Day) {
  const thisWeek = weekStart(today);
  const firstWeek = weekStart(h.startDate);

  const weekInfo = (ws: Day) => {
    let done = 0;
    let frozen = false;
    for (let i = 0; i < 7; i++) {
      const c = byDay.get(addDays(ws, i));
      if (isComplete(h, c)) done++;
      else if (c && (c.status === "FROZEN" || c.status === "SKIPPED")) frozen = true;
    }
    return { done, met: done >= h.timesPerWeek, frozen };
  };

  // Lenient weeks: the current (in progress) week and the partial first week never break a streak.
  const lenient = (ws: Day) => ws === thisWeek || ws === firstWeek;

  let best = 0;
  let run = 0;
  for (let ws = firstWeek; ws <= thisWeek; ws = addDays(ws, 7)) {
    const w = weekInfo(ws);
    if (w.met) run++;
    else if (!w.frozen && !lenient(ws)) run = 0;
    best = Math.max(best, run);
  }

  let current = 0;
  for (let ws = thisWeek; ws >= firstWeek; ws = addDays(ws, -7)) {
    const w = weekInfo(ws);
    if (w.met) current++;
    else if (w.frozen || lenient(ws)) continue;
    else break;
  }

  let met = 0;
  let total = 0;
  for (let i = 1; i <= 4; i++) {
    const ws = addDays(thisWeek, -7 * i);
    if (ws < firstWeek) break;
    total++;
    if (weekInfo(ws).met) met++;
  }
  const cur = weekInfo(thisWeek);
  if (cur.met) {
    total++;
    met++;
  }

  return {
    currentStreak: current,
    bestStreak: Math.max(best, current),
    streakUnit: "weeks" as const,
    completionRate: total ? met / total : 0,
    dueToday: !cur.met || isComplete(h, byDay.get(today)),
    doneToday: isComplete(h, byDay.get(today)),
    weekProgress: { done: cur.done, target: h.timesPerWeek },
  };
}

function quitStats(h: HabitSchedule, checkIns: CheckInLite[], today: Day) {
  const slips = checkIns
    .filter((c) => c.status === "SLIP")
    .map((c) => c.date)
    .sort();
  // Clean streak = clean days since the last slip (or since the habit started), today included.
  let best = 0;
  for (let i = 0; i < slips.length; i++) {
    const gap = i === 0 ? diffDays(slips[0], h.startDate) : diffDays(slips[i], slips[i - 1]) - 1;
    best = Math.max(best, gap);
  }
  const last = slips[slips.length - 1];
  const slippedToday = last === today;
  const current = last ? diffDays(today, last) : diffDays(today, h.startDate) + 1;

  let clean = 0;
  let days = 0;
  const slipSet = new Set(slips);
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (d < h.startDate) break;
    days++;
    if (!slipSet.has(d)) clean++;
  }

  return {
    currentStreak: Math.max(0, current),
    bestStreak: Math.max(best, current, 0),
    streakUnit: "days" as const,
    completionRate: days ? clean / days : 0,
    dueToday: true,
    doneToday: !slippedToday,
    weekProgress: null,
  };
}

/** Did the habit get completed (or legitimately skipped) on the given day? Used for "perfect day" & heatmaps. */
export function dayOutcome(h: HabitSchedule, c: CheckInLite | undefined, day: Day): "done" | "missed" | "skipped" | "not-due" {
  if (h.kind === "QUIT") {
    if (day < h.startDate) return "not-due";
    return c?.status === "SLIP" ? "missed" : "done";
  }
  if (isComplete(h, c)) return "done";
  if (h.frequencyType === "TIMES_PER_WEEK") return "not-due";
  if (!isDue(h, day)) return "not-due";
  if (c && (c.status === "SKIPPED" || c.status === "FROZEN")) return "skipped";
  return "missed";
}
