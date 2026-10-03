import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, CornerDownRight, Minus, MoreHorizontal, Pencil, SkipForward, Snowflake, StickyNote, Undo2, X } from "lucide-react";
import { useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import type { Habit } from "../lib/types";
import { useCheckIn } from "../lib/hooks";
import { stamped, tap } from "../lib/celebrate";
import { addDays, formatTime12, parseDay, WEEKDAYS_SHORT, WEEKDAYS_LETTER } from "../lib/dates";
import { useUI } from "../lib/store";
import { InkBurst, StampMark, StampSlot, Tally } from "./Stamp";
import { HabitIcon } from "./HabitIcon";
import { MenuItem, Popover } from "./ui";

export function scheduleLabel(h: Habit) {
  if (h.kind === "QUIT") return "Quit";
  if (h.frequencyType === "TIMES_PER_WEEK") return `${h.timesPerWeek}× a week`;
  if (h.frequencyType === "WEEKLY_DAYS" && h.daysOfWeek.length && h.daysOfWeek.length < 7)
    return [...h.daysOfWeek]
      .sort()
      .map((d) => WEEKDAYS_SHORT[d])
      .join(", ");
  return "Every day";
}

export function streakText(h: Habit) {
  const n = h.stats.currentStreak;
  if (h.kind === "QUIT") return `${n} ${n === 1 ? "day" : "days"} clean`;
  if (!n) return null;
  return h.stats.streakUnit === "weeks" ? `${n}-week streak` : `${n}-day streak`;
}

function dueOn(h: Habit, day: string) {
  if (day < h.startDate) return false;
  if (h.frequencyType !== "WEEKLY_DAYS" || !h.daysOfWeek.length) return true;
  return h.daysOfWeek.includes(parseDay(day).getDay());
}

/** The six days before today as a strip of small marks. */
function PastStrip({ h, today }: { h: Habit; today: string }) {
  const byDay = new Map(h.recent.map((c) => [c.date, c]));
  return (
    <div className="flex items-center gap-[5px]" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => {
        const d = addDays(today, i - 6);
        const c = byDay.get(d);
        let mark: React.ReactNode;
        if (h.kind === "QUIT") {
          mark =
            d < h.startDate ? (
              <span className="h-1 w-1 rounded-full bg-rule-strong" />
            ) : c?.status === "SLIP" ? (
              <X size={14} strokeWidth={3} className="text-red" />
            ) : (
              <StampMark color={h.color} size={17} seed={h.id + d} animate={false} soft />
            );
        } else if (c?.status === "DONE" && c.count >= h.targetCount) {
          mark = <StampMark color={h.color} size={17} seed={h.id + d} animate={false} soft />;
        } else if (c?.status === "SKIPPED" || c?.status === "FROZEN") {
          mark = c.status === "FROZEN" ? <Snowflake size={13} className="text-pen" /> : <span className="h-[2px] w-2 rounded bg-ink-3" />;
        } else if (dueOn(h, d) && h.frequencyType !== "TIMES_PER_WEEK") {
          mark = <span className="h-[13px] w-[13px] rounded-full border-[1.5px] border-dashed border-rule-strong" />;
        } else {
          mark = <span className="h-1 w-1 rounded-full bg-rule-strong" />;
        }
        return (
          <div key={d} className="flex w-[17px] flex-col items-center gap-1">
            <span className="mono !text-[10px] leading-none text-ink-3">{WEEKDAYS_LETTER[parseDay(d).getDay()]}</span>
            <span className="grid h-[17px] w-[17px] place-items-center">{mark}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HabitCard({
  habit: h,
  stackParent,
  onEdit,
  onNote,
  index = 0,
}: {
  habit: Habit;
  stackParent?: Habit;
  onEdit: (h: Habit) => void;
  onNote: (h: Habit) => void;
  index?: number;
}) {
  const nav = useNavigate();
  const today = useUI((s) => s.today);
  const checkIn = useCheckIn();
  const [menu, setMenu] = useState(false);
  const [confirmSlip, setConfirmSlip] = useState(false);
  const [burst, setBurst] = useState(0);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const s = h.stats;
  const multi = h.targetCount > 1 && h.kind === "BUILD";
  const done = s.doneToday;
  const skipped = s.todayStatus === "SKIPPED";
  const notDue = h.kind === "BUILD" && !s.dueToday && !done;

  const primary = (e: MouseEvent) => {
    e.stopPropagation();
    if (h.kind === "QUIT") {
      tap();
      return setConfirmSlip((v) => !v);
    }
    if (multi) {
      checkIn.mutate({ habitId: h.id, delta: 1 });
      if (s.todayCount + 1 >= h.targetCount && !done) stamped(), setBurst((b) => b + 1);
      else tap();
      return;
    }
    if (done || skipped) {
      tap();
      checkIn.mutate({ habitId: h.id, remove: true });
    } else {
      stamped();
      setBurst((b) => b + 1);
      checkIn.mutate({ habitId: h.id, status: "DONE" });
    }
  };

  const streak = streakText(h);
  const firstReminder = h.reminders.find((r) => r.enabled);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
        default: {
          duration: 0.45,
          delay: Math.min(index, 8) * 0.045,
          ease: [0.16, 1, 0.3, 1],
        },
      }}
      className={clsx("group relative border-b border-rule last:border-b-0", notDue && "opacity-70")}
    >
      {h.kind === "BUILD" && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `color-mix(in oklch, ${h.color} 9%, transparent)`,
          }}
          initial={false}
          animate={{ clipPath: done ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
          transition={{ duration: done ? 0.6 : 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <div
        role="link"
        tabIndex={0}
        onClick={() => nav(`/habits/${h.id}`)}
        onKeyDown={(e) => e.key === "Enter" && nav(`/habits/${h.id}`)}
        className="relative flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors hover:bg-well/60 sm:gap-4 sm:px-5 sm:py-3.5"
      >
        <HabitIcon icon={h.icon} color={h.color} />

        <div className="min-w-0 flex-1">
          {stackParent && (
            <div className="mb-0.5 flex items-center gap-1 text-[13px] text-ink-2">
              <CornerDownRight size={13} /> after {stackParent.name}
            </div>
          )}
          <div className={clsx("truncate text-[16px] font-semibold leading-6", (done || skipped) && h.kind === "BUILD" && "text-ink-2")}>{h.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] leading-5 text-ink-2">
            {multi && (
              <span className="flex items-center gap-2">
                <Tally count={s.todayCount} target={h.targetCount} color={h.color} />
                <span>
                  {s.todayCount}/{h.targetCount}
                  {h.unit ? ` ${h.unit}` : ""}
                </span>
              </span>
            )}
            {skipped ? (
              <span>Skipped today</span>
            ) : streak ? (
              <span className={clsx("font-semibold", h.kind === "QUIT" ? "text-ink" : "text-red")}>{streak}</span>
            ) : !multi ? (
              <span>{notDue ? `Not today · ${scheduleLabel(h)}` : scheduleLabel(h)}</span>
            ) : null}
            {s.weekProgress && (
              <span>
                {s.weekProgress.done} of {s.weekProgress.target} this week
              </span>
            )}
            {firstReminder && !done && <span className="mono text-ink-3">{formatTime12(firstReminder.time)}</span>}
            {h.todayNote && <StickyNote size={13} className="text-ink-3" aria-label="Has a note" />}
          </div>
        </div>

        <div className="hidden md:block">
          <PastStrip h={h} today={today} />
        </div>

        {multi && s.todayCount > 0 && !done && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              tap();
              checkIn.mutate({ habitId: h.id, delta: -1 });
            }}
            className="btn-quiet !p-2"
            aria-label={`Remove one from ${h.name}`}
          >
            <Minus size={16} />
          </button>
        )}

        {h.kind === "QUIT" ? (
          <button
            onClick={primary}
            className={clsx(
              "shrink-0 rounded-[9px] border px-3 py-1.5 text-sm font-semibold transition-colors",
              done ? "border-rule-strong text-ink-2 hover:border-red hover:text-red" : "border-red bg-red-soft text-red"
            )}
          >
            {done ? "Slipped?" : "Slipped"}
          </button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.9, y: 2 }}
            onClick={primary}
            aria-label={done ? `Undo ${h.name}` : multi ? `Add one to ${h.name}` : `Mark ${h.name} done`}
            aria-pressed={done}
            className="relative grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full"
          >
            {burst > 0 && <InkBurst key={burst} color={h.color} seed={h.id + burst} />}
            <AnimatePresence mode="popLayout" initial={false}>
              {done ? (
                <motion.span
                  key="done"
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.12 },
                  }}
                >
                  <StampMark color={h.color} size={48} seed={h.id + today} />
                </motion.span>
              ) : (
                <motion.span key="slot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.05 } }}>
                  <StampSlot size={48} color={h.color} level={multi ? s.todayCount / h.targetCount : 0} label={multi ? "+1" : skipped ? "–" : undefined} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}

        <button
          ref={menuBtn}
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
          className="btn-quiet -mr-2 !px-1.5 !py-2"
          aria-label={`More for ${h.name}`}
          aria-haspopup="menu"
          aria-expanded={menu}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <Popover anchor={menuBtn} open={menu} onClose={() => setMenu(false)}>
        {h.kind === "BUILD" && (
          <MenuItem
            icon={skipped ? <Undo2 size={16} /> : <SkipForward size={16} />}
            onClick={() => {
              checkIn.mutate(skipped ? { habitId: h.id, remove: true } : { habitId: h.id, status: "SKIPPED" });
              setMenu(false);
            }}
          >
            {skipped ? "Undo skip" : "Skip today"}
          </MenuItem>
        )}
        {h.kind === "QUIT" && !done && (
          <MenuItem
            icon={<Undo2 size={16} />}
            onClick={() => {
              checkIn.mutate({ habitId: h.id, remove: true });
              setMenu(false);
            }}
          >
            Undo slip
          </MenuItem>
        )}
        <MenuItem icon={<StickyNote size={16} />} onClick={() => (setMenu(false), onNote(h))}>
          {h.todayNote ? "Edit note" : "Add a note"}
        </MenuItem>
        <MenuItem icon={<Pencil size={16} />} onClick={() => (setMenu(false), onEdit(h))}>
          Edit habit
        </MenuItem>
        <MenuItem icon={<ChevronRight size={16} />} onClick={() => nav(`/habits/${h.id}`)}>
          History
        </MenuItem>
      </Popover>

      <AnimatePresence>
        {confirmSlip && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-3.5 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-red-soft px-4 py-3 sm:mx-5">
              <p className="text-[15px] text-ink">{done ? `Log a slip for today? Your ${s.currentStreak}-day clean run resets.` : "Remove today's slip?"}</p>
              <div className="flex gap-2">
                <button className="btn-quiet !py-1.5" onClick={() => setConfirmSlip(false)}>
                  Cancel
                </button>
                <button
                  className="btn !py-1.5 bg-red text-sheet"
                  onClick={() => {
                    checkIn.mutate(done ? { habitId: h.id, status: "SLIP", count: 0 } : { habitId: h.id, remove: true });
                    setConfirmSlip(false);
                  }}
                >
                  {done ? "Log slip" : "Remove slip"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
