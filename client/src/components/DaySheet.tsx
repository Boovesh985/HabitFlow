import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { parseDay, WEEKDAYS_LETTER } from "../lib/dates";
import type { Habit } from "../lib/types";
import { DoneStamp, StampMark, StampSlot } from "./Stamp";
import { Tape } from "./ui";
import { ShapeArt } from "./Desk";

/**
 * A page from a tear-off day calendar. Sundays print in red, like the real thing.
 * Each habit due today gets a stamp position; the page gets an ALL DONE stamp when complete.
 */
export function DaySheet({
  day,
  habits,
  week,
  doneCount,
  dueCount,
  justCompleted,
  empty = false,
}: {
  day: string;
  habits: Habit[];
  week: { date: string; done: number; due: number }[];
  doneCount: number;
  dueCount: number;
  justCompleted: boolean;
  empty?: boolean;
}) {
  const d = parseDay(day);
  const sunday = d.getDay() === 0;
  const perfect = dueCount > 0 && doneCount === dueCount;
  const month = d.toLocaleDateString(undefined, { month: "long" });
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });

  const line =
    empty
      ? "Day one. Add a habit to start the arc."
      : dueCount === 0
      ? "Rest day. Recovery is part of the arc."
      : perfect
      ? "Every habit stamped. Today counts."
      : doneCount === 0
      ? "Clean page. Start with the easiest one."
      : dueCount - doneCount === 1
      ? "One left. Finish it."
      : `${dueCount - doneCount} left. Keep moving.`;

  return (
    <section aria-label={`Today, ${weekday} ${d.getDate()} ${month}`} className="relative">
      {/* cut-paper shapes tucked behind the page, so the desk's color reaches the phone too */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="desk-spin absolute top-[30%] -right-9 -z-10 w-28 [animation-duration:120s]"
        style={{ opacity: "var(--shape-opacity)" }}
      >
        <ShapeArt kind="burst" color="var(--d2)" />
      </svg>
      <svg aria-hidden viewBox="0 0 100 100" className="desk-drift absolute -bottom-8 -left-8 -z-10 w-24" style={{ opacity: "var(--shape-opacity)" }}>
        <ShapeArt kind="disc" color="var(--d1)" />
      </svg>
      <Tape className="-top-1 -left-5" rotate={-34} width={74} />
      <Tape className="-top-1 -right-5" rotate={34} width={74} color="var(--d3)" />
      <div className="sheet relative overflow-hidden !rounded-[16px]">
        {/* binding */}
        <div className={clsx("flex items-center justify-between px-5 py-2.5 text-white", sunday ? "bg-red" : "bg-binding")}>
          <span className="numeral text-[22px] font-bold tracking-wide">{month}</span>
          <span className="mono opacity-80">{d.getFullYear()}</span>
        </div>
        <div className="perforation -mt-1" />

        <div className="flex gap-5 px-5 pt-2 pb-5 lg:flex-col lg:gap-3">
          <div className="shrink-0">
            <motion.div
              key={day}
              initial={{ rotateX: -70, opacity: 0, transformOrigin: "top" }}
              animate={{ rotateX: 0, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 600 }}
              className={clsx("numeral text-[104px] font-black sm:text-[128px] lg:text-[168px]", sunday ? "text-red" : "text-ink")}
            >
              {d.getDate()}
            </motion.div>
            <div className={clsx("numeral -mt-1 text-[26px] font-bold lg:text-[30px]", sunday ? "text-red" : "text-ink")}>{weekday}</div>
          </div>

          <div className="min-w-0 flex-1 lg:border-t lg:border-rule lg:pt-4">
            <p className="flex items-baseline gap-2">
              <span className="relative inline-block h-[36px] overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={doneCount}
                    className="numeral block text-[40px] font-extrabold"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "-100%" }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {doneCount}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-[15px] font-semibold text-ink-2">of {dueCount} done</span>
            </p>
            <p className="mt-1 text-[15px] text-ink-2">{line}</p>

            {habits.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Today's stamps">
                {habits.map((h) => (
                  <li key={h.id} title={h.name}>
                    {h.stats.doneToday ? (
                      <StampMark color={h.color} size={26} seed={h.id + day} />
                    ) : (
                      <StampSlot color={h.color} size={26} level={h.targetCount > 1 ? h.stats.todayCount / h.targetCount : 0} />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid grid-cols-7 gap-1 border-t border-rule pt-3" aria-label="This week">
              {week.map((w) => {
                const isToday = w.date === day;
                const r = isToday ? (dueCount ? doneCount / dueCount : 0) : w.due ? w.done / w.due : 0;
                const wd = parseDay(w.date).getDay();
                return (
                  <div key={w.date} className="flex flex-col items-center gap-1" title={`${w.date}: ${Math.round(r * 100)}%`}>
                    <span className={clsx("mono !text-[11px]", wd === 0 ? "text-red" : isToday ? "font-bold text-ink" : "text-ink-3")}>
                      {WEEKDAYS_LETTER[wd]}
                    </span>
                    <span
                      className={clsx("h-[18px] w-[18px] rounded-full", isToday && "ring-2 ring-d3 ring-offset-2 ring-offset-sheet")}
                      style={{
                        background: r > 0 ? `conic-gradient(var(--pen) ${r * 360}deg, var(--well) 0)` : "var(--well)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {perfect && <DoneStamp animate={justCompleted} className="right-3 bottom-[74px] lg:top-[70px] lg:bottom-auto" />}
      </div>
    </section>
  );
}
