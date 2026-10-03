import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useCheckIn, useMoods, useSaveMood } from "../lib/hooks";
import { useUI } from "../lib/store";
import { tap } from "../lib/celebrate";
import type { Habit } from "../lib/types";
import { Sheet } from "./ui";

export const MOODS = [
  { v: 1, label: "Rough" },
  { v: 2, label: "Low" },
  { v: 3, label: "Okay" },
  { v: 4, label: "Good" },
  { v: 5, label: "Great" },
];

/** A small hand-drawn face; mood 1..5 bends the mouth from frown to grin. */
export function Face({ mood, size = 34, active }: { mood: number; size?: number; active?: boolean }) {
  const curve = (mood - 3) * 3.2; // control point offset for the mouth
  const stroke = active ? "var(--pen)" : "var(--ink-2)";
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden style={{ display: "block" }}>
      <g filter="url(#ink-soft)" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
        <circle cx="18" cy="18" r="15.5" fill={active ? "var(--pen-soft)" : "none"} />
        {mood === 1 ? (
          <>
            <path d="M11 13.5l3 1.5M25 13.5l-3 1.5" />
          </>
        ) : (
          <>
            <circle cx="13" cy="14.5" r="0.9" fill={stroke} />
            <circle cx="23" cy="14.5" r="0.9" fill={stroke} />
          </>
        )}
        {mood === 3 ? <path d="M12.5 23h11" /> : <path d={`M11.5 ${23 - curve / 3} Q18 ${23 + curve} 24.5 ${23 - curve / 3}`} />}
      </g>
    </svg>
  );
}

export function MoodPicker() {
  const today = useUI((s) => s.today);
  const { data: moods } = useMoods();
  const save = useSaveMood();
  const current = moods?.find((m) => m.date === today);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  useEffect(() => setNote(current?.note ?? ""), [current?.note]);

  const pick = (v: number) => {
    tap();
    save.mutate({
      date: today,
      mood: v,
      energy: current?.energy ?? null,
      note: current?.note ?? null,
    });
    setShowNote(true);
  };

  return (
    <section className="sheet px-5 py-4" aria-label="Mood">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold">How's today feeling?</h2>
        {current && <span className="text-sm text-ink-2">{MOODS[current.mood - 1].label}</span>}
      </div>
      <div className="mt-3 flex justify-between" role="radiogroup" aria-label="Mood">
        {MOODS.map((m) => {
          const active = current?.mood === m.v;
          return (
            <motion.button
              key={m.v}
              role="radio"
              aria-checked={active}
              whileTap={{ scale: 0.88 }}
              onClick={() => pick(m.v)}
              className={clsx("flex flex-col items-center gap-1 rounded-[10px] px-1.5 py-1.5 transition-colors", !active && "hover:bg-well")}
            >
              <Face mood={m.v} active={active} />
              <span className={clsx("text-[12px] font-semibold", active ? "text-pen" : "text-ink-3")}>{m.label}</span>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {showNote && current && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ ...current, note: note || null });
              setShowNote(false);
            }}
          >
            <div className="mt-3 flex gap-2">
              <input
                className="field"
                placeholder="One line about today (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                aria-label="Mood note"
              />
              <button className="btn-ink shrink-0">Save</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <p className="mt-3 text-[13px] text-ink-3">Logged moods show up in Insights next to your habits.</p>
    </section>
  );
}

export function NoteSheet({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const checkIn = useCheckIn();
  useEffect(() => setNote(habit?.todayNote ?? ""), [habit]);
  return (
    <Sheet open={!!habit} onClose={onClose} title={habit ? `Note · ${habit.name}` : ""}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!habit) return;
          const s = habit.stats;
          checkIn.mutate({
            habitId: habit.id,
            // A note on an unchecked day is stored as a zero-count entry, so it doesn't complete the habit.
            status: s.todayStatus ?? "DONE",
            count: s.todayStatus ? s.todayCount : 0,
            note: note || null,
          });
          onClose();
        }}
      >
        <textarea
          autoFocus
          rows={5}
          className="field resize-none leading-relaxed"
          placeholder="How did it go? What made it easier or harder?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          aria-label="Note"
        />
        <button className="btn-ink w-full">Save note</button>
      </form>
    </Sheet>
  );
}
