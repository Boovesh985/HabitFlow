import { describe, expect, it } from "vitest";
import { computeStats, type CheckInLite, type HabitSchedule } from "../src/services/streaks.js";
import { addDays, weekStart } from "../src/lib/dates.js";

const daily: HabitSchedule = {
  kind: "BUILD",
  frequencyType: "DAILY",
  daysOfWeek: [],
  timesPerWeek: 3,
  targetCount: 1,
  startDate: "2026-01-01",
};
const done = (date: string, count = 1): CheckInLite => ({ date, count, status: "DONE" });
const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe("daily habits", () => {
  it("counts a streak ending today", () => {
    const s = computeStats(daily, range("2026-01-01", 5).map((d) => done(d)), "2026-01-05");
    expect(s.currentStreak).toBe(5);
    expect(s.bestStreak).toBe(5);
    expect(s.doneToday).toBe(true);
  });

  it("does not break the streak when today is still pending", () => {
    const s = computeStats(daily, range("2026-01-01", 4).map((d) => done(d)), "2026-01-05");
    expect(s.currentStreak).toBe(4);
    expect(s.doneToday).toBe(false);
  });

  it("breaks on a missed day and keeps the best streak", () => {
    const cis = [...range("2026-01-01", 6).map((d) => done(d)), ...range("2026-01-08", 2).map((d) => done(d))];
    const s = computeStats(daily, cis, "2026-01-09");
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(6);
  });

  it("skips and freezes preserve but don't extend the streak", () => {
    const cis: CheckInLite[] = [
      done("2026-01-01"),
      done("2026-01-02"),
      { date: "2026-01-03", count: 0, status: "SKIPPED" },
      { date: "2026-01-04", count: 0, status: "FROZEN" },
      done("2026-01-05"),
    ];
    expect(computeStats(daily, cis, "2026-01-05").currentStreak).toBe(3);
  });

  it("requires the full target count", () => {
    const h = { ...daily, targetCount: 8 };
    const s = computeStats(h, [done("2026-01-01", 8), done("2026-01-02", 5)], "2026-01-02");
    expect(s.currentStreak).toBe(1);
    expect(s.doneToday).toBe(false);
    expect(s.todayCount).toBe(5);
  });

  it("computes 30-day completion rate excluding pending today", () => {
    const s = computeStats(daily, range("2026-01-01", 10).filter((_, i) => i % 2 === 0).map((d) => done(d)), "2026-01-11");
    // Jan 1-10 due (10 days), 5 done; today (Jan 11) pending and excluded.
    expect(s.completionRate).toBeCloseTo(0.5);
  });
});

describe("specific weekdays", () => {
  // Mon / Wed / Fri. 2026-01-05 is a Monday.
  const mwf: HabitSchedule = { ...daily, frequencyType: "WEEKLY_DAYS", daysOfWeek: [1, 3, 5], startDate: "2026-01-05" };

  it("ignores non-scheduled days", () => {
    const s = computeStats(mwf, ["2026-01-05", "2026-01-07", "2026-01-09", "2026-01-12"].map((d) => done(d)), "2026-01-13");
    expect(s.currentStreak).toBe(4);
    expect(s.dueToday).toBe(false); // Tuesday
  });

  it("breaks when a scheduled day is missed", () => {
    const s = computeStats(mwf, ["2026-01-05", "2026-01-09"].map((d) => done(d)), "2026-01-09");
    expect(s.currentStreak).toBe(1);
  });
});

describe("times per week", () => {
  const tpw: HabitSchedule = { ...daily, frequencyType: "TIMES_PER_WEEK", timesPerWeek: 3, startDate: "2026-01-05" };

  it("counts consecutive successful weeks", () => {
    const cis = ["2026-01-05", "2026-01-06", "2026-01-08", "2026-01-12", "2026-01-14", "2026-01-16"].map((d) => done(d));
    const s = computeStats(tpw, cis, "2026-01-19");
    expect(weekStart("2026-01-19")).toBe("2026-01-19");
    expect(s.streakUnit).toBe("weeks");
    expect(s.currentStreak).toBe(2);
    expect(s.weekProgress).toEqual({ done: 0, target: 3 });
  });

  it("a failed full week breaks the streak", () => {
    const cis = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-12", "2026-01-19", "2026-01-20", "2026-01-21"].map((d) =>
      done(d),
    );
    const s = computeStats(tpw, cis, "2026-01-22");
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(1);
  });
});

describe("quit habits", () => {
  const quit: HabitSchedule = { ...daily, kind: "QUIT", startDate: "2026-01-01" };
  const slip = (date: string): CheckInLite => ({ date, count: 0, status: "SLIP" });

  it("counts clean days including today when there are no slips", () => {
    expect(computeStats(quit, [], "2026-01-01").currentStreak).toBe(1);
    expect(computeStats(quit, [], "2026-01-10").currentStreak).toBe(10);
  });

  it("resets on a slip and tracks the best clean run", () => {
    const s = computeStats(quit, [slip("2026-01-15"), slip("2026-01-18")], "2026-01-20");
    expect(s.bestStreak).toBe(14); // Jan 1 - Jan 14
    expect(s.currentStreak).toBe(2); // Jan 19, 20
    expect(computeStats(quit, [slip("2026-01-20")], "2026-01-20").doneToday).toBe(false);
  });
});
