import type { Project } from "./types";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Plain-words countdown to a deadline, plus how worried to be about it. */
export function countdown(deadline: string | null, now = Date.now()) {
  if (!deadline) return null;
  const at = new Date(deadline);
  const left = at.getTime() - now;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((new Date(at).setHours(0, 0, 0, 0) - startOfToday.getTime()) / DAY);
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  if (left < 0) {
    const late = Math.max(1, -dayDiff);
    return { label: dayDiff >= 0 ? `Was due at ${time}` : `${late} ${late === 1 ? "day" : "days"} overdue`, tone: "late" as const, days: dayDiff };
  }
  if (left < 6 * HOUR) {
    const h = Math.max(1, Math.round(left / HOUR));
    return { label: left < HOUR ? `Due in ${Math.max(1, Math.round(left / 60000))} min` : `${h} ${h === 1 ? "hour" : "hours"} left`, tone: "late" as const, days: 0 };
  }
  if (dayDiff === 0) return { label: `Due today, ${time}`, tone: "late" as const, days: 0 };
  if (dayDiff === 1) return { label: `Due tomorrow, ${time}`, tone: "soon" as const, days: 1 };
  return { label: `${dayDiff} days left`, tone: dayDiff <= 3 ? ("soon" as const) : ("calm" as const), days: dayDiff };
}

export const unitWord = (p: Pick<Project, "unitLabel">) => p.unitLabel?.trim() || "lessons";

export const byUnits = (p: Pick<Project, "kind" | "totalUnits">) => p.kind === "COURSE" && !!p.totalUnits;

/** "5 of 8 steps" or "14 of 60 lessons" */
export function progressText(p: Project) {
  if (byUnits(p)) return `${p.unitsDone} of ${p.totalUnits} ${unitWord(p)}`;
  if (!p.steps.length) return p.kind === "COURSE" ? "No lessons or steps yet" : "No steps yet";
  return `${p.stepsDone} of ${p.steps.length} steps`;
}

/** Active first (soonest deadline first), then finished. */
export function sortProjects(list: Project[]) {
  const t = (p: Project) => (p.deadline ? new Date(p.deadline).getTime() : Infinity);
  return [...list].sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || t(a) - t(b) || b.createdAt.localeCompare(a.createdAt));
}

const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
/** Split an ISO deadline into the date + time inputs' values. */
export const splitDeadline = (iso: string | null) => (iso ? { date: toLocal(new Date(iso)).slice(0, 10), time: toLocal(new Date(iso)).slice(11, 16) } : { date: "", time: "18:00" });
export const joinDeadline = (date: string, time: string) => (date ? new Date(`${date}T${time || "23:59"}`).toISOString() : null);
