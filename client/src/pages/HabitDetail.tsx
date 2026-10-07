import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bell, Check, ChevronLeft, ChevronRight, Pencil, Snowflake, SkipForward, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { useCheckIn, useHabit, useProfile } from "../lib/hooks";
import { useUI } from "../lib/store";
import { addDays, formatDay, formatTime12, localDay, parseDay, WEEKDAYS_SHORT, WEEKDAYS_LETTER } from "../lib/dates";
import type { CheckIn, Habit } from "../lib/types";
import { scheduleLabel } from "../components/HabitCard";
import { HabitIcon } from "../components/HabitIcon";
import { useHabitForm } from "../components/Layout";
import { Heatmap } from "../components/Heatmap";
import { StampMark } from "../components/Stamp";
import { Loading, NumberInput, SectionHead, Sheet } from "../components/ui";

export default function HabitDetailPage() {
  const { id } = useParams();
  const { data: h, isLoading } = useHabit(id);
  const showForm = useHabitForm((s) => s.show);
  const today = useUI((s) => s.today);
  const [editDay, setEditDay] = useState<string | null>(null);
  const byDay = useMemo(() => new Map((h?.history ?? []).map((c) => [c.date, c])), [h]);

  if (isLoading || !h) return <Loading />;

  const heat = Array.from({ length: 365 }, (_, i) => {
    const d = addDays(today, i - 364);
    const c = byDay.get(d);
    let v = 0;
    if (h.kind === "QUIT") v = d >= h.startDate && d <= today && c?.status !== "SLIP" ? 1 : 0;
    else if (c?.status === "DONE") v = Math.min(1, c.count / h.targetCount);
    else if (c?.status === "FROZEN" || c?.status === "SKIPPED") v = 0.2;
    return {
      date: d,
      value: v,
      label: c ? `${c.status === "DONE" ? "done" : c.status.toLowerCase()}${h.targetCount > 1 && c.status === "DONE" ? ` (${c.count}/${h.targetCount})` : ""}` : d < h.startDate ? "before you started" : "no entry",
    };
  });

  const notes = (h.history ?? []).filter((c) => c.note).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const unit = h.stats.streakUnit === "weeks" ? "weeks" : "days";
  const stats = [
    { label: h.kind === "QUIT" ? "Clean now" : "Current streak", value: h.stats.currentStreak, unit },
    { label: "Best streak", value: h.stats.bestStreak, unit },
    { label: h.stats.streakUnit === "weeks" ? "Last 4 weeks" : "Last 30 days", value: `${Math.round(h.stats.completionRate * 100)}%`, unit: "on track" },
    { label: "All time", value: h.stats.totalDone, unit: h.kind === "QUIT" ? "check-ins" : "completions" },
  ];

  return (
    <div className="space-y-8">
      <Link to="/habits" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={17} /> Habits
      </Link>

      <header className="flex flex-wrap items-start gap-4 border-b border-rule pb-6">
        <HabitIcon icon={h.icon} color={h.color} size={64} radius={14} />
        <div className="min-w-0 flex-1">
          <h1 className="numeral text-[44px] font-extrabold sm:text-[56px]">{h.name}</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            {scheduleLabel(h)} · {h.category}
            {h.targetCount > 1 && ` · ${h.targetCount} ${h.unit ?? "times"} a day`} · since {formatDay(h.startDate, { month: "short", day: "numeric", year: "numeric" })}
          </p>
          {h.description && <p className="mt-3 max-w-[62ch] text-[17px] leading-relaxed">{h.description}</p>}
          {h.reminders.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {h.reminders.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-rule-strong px-3 py-1 text-[13px]">
                  <Bell size={13} className="text-ink-2" />
                  <span className="mono !text-[12.5px]">{formatTime12(r.time)}</span>
                  {r.daysOfWeek.length > 0 && <span className="text-ink-2">{r.daysOfWeek.map((d) => WEEKDAYS_SHORT[d]).join(" ")}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        <button className="btn-line" onClick={() => showForm(h)}>
          <Pencil size={16} /> Edit
        </button>
      </header>

      <dl className="sheet grid grid-cols-2 overflow-hidden md:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={clsx("px-5 py-4", i % 2 === 1 && "border-l border-rule", i >= 2 && "border-t border-rule md:border-t-0", i === 2 && "md:border-l")}>
            <dt className="text-[13px] font-semibold text-ink-2">{s.label}</dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="numeral text-[40px] font-extrabold">{s.value}</span>
              <span className="text-[13px] text-ink-2">{s.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <MonthCalendar habit={h} byDay={byDay} onPick={setEditDay} />
        <section>
          <SectionHead>Notes</SectionHead>
          {notes.length === 0 ? (
            <p className="sheet px-5 py-4 text-[15px] text-ink-2">Add a note to any day from the calendar, or from the habit's menu on Today.</p>
          ) : (
            <ul className="sheet divide-y divide-rule overflow-hidden">
              {notes.map((n) => (
                <li key={n.date} className="px-5 py-3.5">
                  <div className="mono text-ink-3">{formatDay(n.date, { weekday: "short", month: "short", day: "numeric" })}</div>
                  <p className="mt-0.5 text-[15px] leading-relaxed">{n.note}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <SectionHead>The last twelve months</SectionHead>
        <div className="sheet px-5 py-5">
          <Heatmap cells={heat} color={h.color} />
        </div>
      </section>

      <DayEditor habit={h} day={editDay} entry={editDay ? byDay.get(editDay) : undefined} onClose={() => setEditDay(null)} />
    </div>
  );
}

function MonthCalendar({ habit: h, byDay, onPick }: { habit: Habit; byDay: Map<string, CheckIn>; onPick: (d: string) => void }) {
  const today = useUI((s) => s.today);
  const [cursor, setCursor] = useState(() => {
    const d = parseDay(today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dir, setDir] = useState(0);

  const cells = useMemo(() => {
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return [...Array(cursor.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => localDay(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)))];
  }, [cursor]);

  const move = (n: number) => {
    setDir(n);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  };
  const atCurrentMonth = localDay(cursor) >= today.slice(0, 8) + "01";
  const isDue = (d: string) => d >= h.startDate && (h.frequencyType !== "WEEKLY_DAYS" || !h.daysOfWeek.length || h.daysOfWeek.includes(parseDay(d).getDay()));

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[17px] font-bold">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-1">
          <button className="btn-quiet !p-2" onClick={() => move(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <button className="btn-quiet !p-2" onClick={() => move(1)} disabled={atCurrentMonth} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="sheet overflow-hidden">
        <div className="grid grid-cols-7 border-b border-rule bg-well/60">
          {WEEKDAYS_LETTER.map((l, i) => (
            <div key={i} className={clsx("py-1.5 text-center text-[12px] font-bold", i === 0 ? "text-red" : "text-ink-2")}>
              {l}
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cursor.toISOString()}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-7"
          >
            {cells.map((d, i) => {
              const border = clsx(i % 7 !== 6 && "border-r", "border-b border-rule");
              if (!d) return <div key={`b${i}`} className={clsx("aspect-square bg-well/40", border)} />;
              const c = byDay.get(d);
              const future = d > today;
              const sunday = parseDay(d).getDay() === 0;
              const done =
                h.kind === "QUIT" ? d >= h.startDate && d <= today && c?.status !== "SLIP" : c?.status === "DONE" && c.count >= h.targetCount;
              const partial = h.kind === "BUILD" && c?.status === "DONE" && c.count > 0 && c.count < h.targetCount;
              const missed = !future && !c && isDue(d) && d < today && h.kind === "BUILD" && h.frequencyType !== "TIMES_PER_WEEK";
              return (
                <button
                  key={d}
                  disabled={future}
                  onClick={() => onPick(d)}
                  className={clsx("relative aspect-square p-1 text-left transition-colors hover:bg-well disabled:hover:bg-transparent", border, d === today && "bg-pen-soft/60")}
                  aria-label={`${formatDay(d)}: ${done ? "done" : c?.status.toLowerCase() ?? (missed ? "missed" : "no entry")}`}
                >
                  <span className={clsx("mono !text-[11.5px] font-semibold", future ? "text-ink-3/60" : sunday ? "text-red" : "text-ink-2", d === today && "!text-ink")}>
                    {parseDay(d).getDate()}
                  </span>
                  <span className="absolute inset-0 grid place-items-center pt-2">
                    {done && <StampMark color={h.color} size={30} seed={h.id + d} animate={false} soft={h.kind === "QUIT"} />}
                    {partial && (
                      <span className="mono !text-[11px] font-bold" style={{ color: h.color }}>
                        {c!.count}/{h.targetCount}
                      </span>
                    )}
                    {c?.status === "FROZEN" && <Snowflake size={16} className="text-pen" />}
                    {c?.status === "SKIPPED" && <span className="text-[13px] font-bold text-ink-3">rest</span>}
                    {c?.status === "SLIP" && <X size={20} className="text-red" strokeWidth={2.6} />}
                    {missed && <span className="h-1.5 w-1.5 rounded-full bg-red" />}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-2.5 text-[13px] text-ink-2">
        Tap a day to fill it in. A red dot is a missed day; a streak freeze can cover it.
      </p>
    </section>
  );
}

function DayEditor({ habit: h, day, entry, onClose }: { habit: Habit; day: string | null; entry?: CheckIn; onClose: () => void }) {
  const checkIn = useCheckIn();
  const { data: profile } = useProfile();
  const today = useUI((s) => s.today);
  const [note, setNote] = useState("");
  const [count, setCount] = useState(h.targetCount);
  const key = `${day}-${entry?.status}-${entry?.count}`;
  const [lastKey, setLastKey] = useState("");
  if (day && key !== lastKey) {
    setLastKey(key);
    setNote(entry?.note ?? "");
    setCount(entry?.status === "DONE" ? entry.count : h.targetCount);
  }

  const run = (v: Parameters<typeof checkIn.mutate>[0]) => {
    checkIn.mutate(v);
    onClose();
  };

  const current = entry
    ? entry.status === "DONE"
      ? h.targetCount > 1
        ? `${entry.count} of ${h.targetCount} ${h.unit ?? ""}`
        : "Done"
      : { SKIPPED: "Rest day", FROZEN: "Covered by a freeze", SLIP: "Slipped" }[entry.status] ?? entry.status
    : "Nothing logged";

  return (
    <Sheet open={!!day} onClose={onClose} title={day ? formatDay(day) : ""}>
      {day && (
        <div className="space-y-5">
          <p className="text-[15px] text-ink-2">
            Right now: <span className="font-semibold text-ink">{current}</span>
          </p>

          {h.kind === "BUILD" ? (
            <div className="space-y-2.5">
              {h.targetCount > 1 && (
                <div className="flex items-center gap-3">
                  <label className="field-label !mb-0" htmlFor="amt">Amount</label>
                  <NumberInput id="amt" min={0} className="field !w-24" value={count} onChange={setCount} />
                  <span className="text-[15px] text-ink-2">of {h.targetCount} {h.unit}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-pen" onClick={() => run({ habitId: h.id, date: day, status: "DONE", count, note: note || null })}>
                  <Check size={17} /> Mark done
                </button>
                <button className="btn-line" onClick={() => run({ habitId: h.id, date: day, status: "SKIPPED", note: note || null })}>
                  <SkipForward size={17} /> Rest day
                </button>
              </div>
              {day < today && (
                <button
                  className="btn-line w-full"
                  disabled={!profile?.streakFreezes && entry?.status !== "FROZEN"}
                  onClick={() => run({ habitId: h.id, date: day, status: "FROZEN", note: note || null })}
                >
                  <Snowflake size={17} className="text-pen" /> Cover with a streak freeze · {profile?.streakFreezes ?? 0} left
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-line" onClick={() => run({ habitId: h.id, date: day, status: "DONE", count: 0, note: note || null })}>
                <Check size={17} /> Stayed clean
              </button>
              <button className="btn bg-red text-sheet" onClick={() => run({ habitId: h.id, date: day, status: "SLIP", count: 0, note: note || null })}>
                <X size={17} /> Slipped
              </button>
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="daynote">Note</label>
            <textarea id="daynote" rows={3} className="field resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering about this day" />
          </div>

          {entry && (
            <button className="text-[15px] font-semibold text-red hover:underline" onClick={() => run({ habitId: h.id, date: day, remove: true })}>
              Clear this day
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
