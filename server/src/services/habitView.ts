import type { CheckIn, Habit, Reminder } from "@prisma/client";
import { toDay, type Day } from "../lib/dates.js";
import { computeStats, type CheckInLite, type HabitSchedule } from "./streaks.js";

export function habitSchedule(h: Habit): HabitSchedule {
  return {
    kind: h.kind,
    frequencyType: h.frequencyType,
    daysOfWeek: h.daysOfWeek,
    timesPerWeek: h.timesPerWeek,
    targetCount: h.targetCount,
    startDate: toDay(h.startDate),
  };
}

export function checkInLite(c: CheckIn): CheckInLite {
  return { date: toDay(c.date), count: c.count, status: c.status };
}

export function checkInView(c: CheckIn) {
  return { id: c.id, habitId: c.habitId, date: toDay(c.date), count: c.count, status: c.status, note: c.note };
}

export function reminderView(r: Reminder) {
  return { id: r.id, time: r.time, daysOfWeek: r.daysOfWeek, message: r.message, enabled: r.enabled };
}

type HabitWith = Habit & { checkIns: CheckIn[]; reminders?: Reminder[] };

/** Full habit DTO with computed streak stats. `recentDays` controls how much check-in history is embedded. */
export function habitView(h: HabitWith, today: Day, recentDays = 7) {
  const cis = h.checkIns.map(checkInLite);
  const stats = computeStats(habitSchedule(h), cis, today);
  const cutoff = new Date(`${today}T00:00:00Z`).getTime() - recentDays * 86_400_000;
  const todayCi = h.checkIns.find((c) => toDay(c.date) === today);
  return {
    id: h.id,
    name: h.name,
    description: h.description,
    icon: h.icon,
    color: h.color,
    category: h.category,
    kind: h.kind,
    frequencyType: h.frequencyType,
    daysOfWeek: h.daysOfWeek,
    timesPerWeek: h.timesPerWeek,
    targetCount: h.targetCount,
    unit: h.unit,
    startDate: toDay(h.startDate),
    sortOrder: h.sortOrder,
    stackAfterId: h.stackAfterId,
    archived: !!h.archivedAt,
    reminders: (h.reminders ?? []).map(reminderView),
    todayNote: todayCi?.note ?? null,
    stats,
    recent: h.checkIns
      .filter((c) => c.date.getTime() > cutoff)
      .map(checkInView)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
