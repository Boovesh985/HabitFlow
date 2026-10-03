import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import clsx from "clsx";
import { useCheckIn, useFocusSessions, useHabits, useLogFocus } from "../lib/hooks";
import { useUI } from "../lib/store";
import { dayComplete, tap } from "../lib/celebrate";
import { isNative } from "../lib/platform";
import { PageTitle, SectionHead, Segmented } from "../components/ui";

type Mode = "focus" | "short" | "long";
const DURATIONS: Record<Mode, number> = { focus: 25, short: 5, long: 15 };
const LABELS: Record<Mode, string> = { focus: "Focus", short: "Short break", long: "Long break" };
const FOCUS_NOTIFY_ID = 424_242;

/** A Time Timer–style dial: the red disc shows what's left and shrinks toward twelve o'clock. */
function Dial({ remaining, scaleMin, color }: { remaining: number; scaleMin: number; color: string }) {
  const R = 132;
  const C = 150;
  const frac = Math.max(0, Math.min(1, remaining / (scaleMin * 60)));
  const angle = frac * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = C + R * Math.cos(rad);
  const y = C + R * Math.sin(rad);
  const large = angle > 180 ? 1 : 0;
  // Counter-clockwise from 12 so the disc "unwinds" like the physical timer.
  const sector =
    frac >= 0.9999
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 0 ${C - 0.01} ${C - R} Z`
      : `M ${C} ${C} L ${C} ${C - R} A ${R} ${R} 0 ${large} 0 ${2 * C - x} ${y} Z`;
  const step = scaleMin <= 60 ? 5 : 15;

  return (
    <svg viewBox="0 0 300 300" className="h-auto w-full max-w-[340px]" role="img" aria-label={`${Math.ceil(remaining / 60)} minutes left`}>
      <circle cx={C} cy={C} r={146} fill="var(--sheet)" stroke="var(--rule-strong)" strokeWidth="1.5" />
      {frac > 0 && <path d={sector} fill={color} />}
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
        const major = i % 5 === 0;
        const r1 = major ? 124 : 130;
        return (
          <line
            key={i}
            x1={C + r1 * Math.cos(a)}
            y1={C + r1 * Math.sin(a)}
            x2={C + 138 * Math.cos(a)}
            y2={C + 138 * Math.sin(a)}
            stroke="var(--ink)"
            strokeOpacity={major ? 0.85 : 0.35}
            strokeWidth={major ? 2 : 1}
          />
        );
      })}
      {Array.from({ length: scaleMin / step }, (_, i) => {
        const m = i * step;
        const a = -(m / scaleMin) * 2 * Math.PI - Math.PI / 2;
        return (
          <text
            key={m}
            x={C + 108 * Math.cos(a)}
            y={C + 108 * Math.sin(a) + 5}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="var(--ink)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {m}
          </text>
        );
      })}
      <circle cx={C} cy={C} r="16" fill="var(--sheet)" stroke="var(--rule-strong)" strokeWidth="1.5" />
      <circle cx={C} cy={C} r="5" fill="var(--ink)" />
    </svg>
  );
}

export default function FocusPage() {
  const [mode, setMode] = useState<Mode>("focus");
  const [minutes, setMinutes] = useState(DURATIONS);
  const [remaining, setRemaining] = useState(DURATIONS.focus * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [habitId, setHabitId] = useState<string>("");
  const [completeHabit, setCompleteHabit] = useState(true);
  const [rounds, setRounds] = useState(0);
  const { data: habits } = useHabits();
  const { data: sessions } = useFocusSessions();
  const logFocus = useLogFocus();
  const checkIn = useCheckIn();
  const toast = useUI((s) => s.toast);

  const total = minutes[mode] * 60;
  const running = endAt !== null;

  const reset = useCallback(
    (m: Mode = mode) => {
      setEndAt(null);
      setRemaining(minutes[m] * 60);
      if (isNative) LocalNotifications.cancel({ notifications: [{ id: FOCUS_NOTIFY_ID }] }).catch(() => {});
    },
    [minutes, mode],
  );

  const finish = useCallback(() => {
    setEndAt(null);
    setRemaining(0);
    if (mode === "focus") {
      dayComplete();
      setRounds((r) => r + 1);
      // The dial only reaches zero while running, so a finished session is exactly its set length; pauses don't count.
      logFocus.mutate({ habitId: habitId || null, durationSec: Math.max(60, total) });
      if (habitId && completeHabit) {
        const h = habits?.find((x) => x.id === habitId);
        if (h && !h.stats.doneToday) checkIn.mutate(h.targetCount > 1 ? { habitId, delta: 1 } : { habitId, status: "DONE" });
      }
      toast({ title: "Focus session done", body: "Take a few minutes away from the screen." });
      if (!isNative && "Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker?.getRegistration().then((r) => r?.showNotification("Focus session done", { body: "Time for a break.", tag: "focus" }));
      }
      const next: Mode = (rounds + 1) % 4 === 0 ? "long" : "short";
      setMode(next);
      setRemaining(minutes[next] * 60);
    } else {
      toast({ title: "Break's over", body: "Ready for another round?" });
      setMode("focus");
      setRemaining(minutes.focus * 60);
    }
  }, [mode, habitId, completeHabit, habits, total, rounds, minutes, logFocus, checkIn, toast]);

  // Timestamp-based ticking stays accurate even when the tab is throttled in the background.
  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) finish();
    }, 250);
    return () => clearInterval(id);
  }, [endAt, finish]);

  useEffect(() => {
    document.title = running ? `${fmt(remaining)} · ${LABELS[mode]}` : "HabitFlow";
    return () => {
      document.title = "HabitFlow";
    };
  }, [remaining, running, mode]);

  const start = () => {
    tap();
    const left = remaining || total;
    if (remaining === 0) setRemaining(total);
    const end = Date.now() + left * 1000;
    setEndAt(end);
    if (isNative)
      LocalNotifications.schedule({
        notifications: [
          {
            id: FOCUS_NOTIFY_ID,
            title: mode === "focus" ? "Focus session done" : "Break's over",
            body: mode === "focus" ? "Time for a break." : "Ready for another round?",
            channelId: "reminders",
            schedule: { at: new Date(end), allowWhileIdle: true },
          },
        ],
      }).catch(() => {});
  };

  const pause = () => {
    tap();
    setEndAt(null);
    if (isNative) LocalNotifications.cancel({ notifications: [{ id: FOCUS_NOTIFY_ID }] }).catch(() => {});
  };

  const todayMinutes = Math.round(
    (sessions ?? []).filter((s) => new Date(s.startedAt).toDateString() === new Date().toDateString()).reduce((a, s) => a + s.durationSec, 0) / 60,
  );
  const scaleMin = Math.max(60, Math.ceil(minutes[mode] / 15) * 15);

  return (
    <div>
      <PageTitle sub="Set the dial, put the phone face down, and work until the red runs out.">Focus</PageTitle>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <section className="sheet flex flex-col items-center px-5 pt-6 pb-8">
          <div className="w-full max-w-[360px]">
            <Segmented
              id="focus-mode"
              size="sm"
              value={mode}
              onChange={(m) => {
                if (running) return;
                setMode(m);
                reset(m);
              }}
              options={[
                { value: "focus", label: `Focus ${minutes.focus}` },
                { value: "short", label: `Break ${minutes.short}` },
                { value: "long", label: `Long ${minutes.long}` },
              ]}
            />
          </div>

          <div className="mt-6 w-full max-w-[340px]">
            <Dial remaining={remaining} scaleMin={scaleMin} color={mode === "focus" ? "var(--red)" : "var(--pen)"} />
          </div>

          <div className="mt-4 text-center">
            <div className="numeral text-[64px] font-extrabold" aria-live="off">
              {fmt(remaining)}
            </div>
            <div className="text-[14px] text-ink-2">
              {LABELS[mode]} · round {rounds + 1}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button className="btn-line !h-12 !w-12 !rounded-full !p-0" onClick={() => (tap(), reset())} aria-label="Reset timer">
              <RotateCcw size={18} />
            </button>
            <button className="btn-ink !h-14 !min-w-[140px] !rounded-full text-[16px]" onClick={running ? pause : start}>
              {running ? <Pause size={20} /> : <Play size={20} />}
              {running ? "Pause" : remaining < total && remaining > 0 ? "Resume" : "Start"}
            </button>
            <button className="btn-line !h-12 !w-12 !rounded-full !p-0" onClick={() => (tap(), finish())} aria-label="Finish now" disabled={!running}>
              <SkipForward size={18} />
            </button>
          </div>
        </section>

        <div className="space-y-8">
          <section className="space-y-4">
            <SectionHead>Session</SectionHead>
            <div>
              <label className="field-label" htmlFor="fhabit">Working on</label>
              <select id="fhabit" className="field" value={habitId} onChange={(e) => setHabitId(e.target.value)} disabled={running}>
                <option value="">Nothing specific</option>
                {habits
                  ?.filter((h) => h.kind === "BUILD")
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </select>
            </div>
            {habitId && (
              <label className="flex cursor-pointer items-start gap-2.5 text-[15px]">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--pen)]" checked={completeHabit} onChange={(e) => setCompleteHabit(e.target.checked)} />
                Stamp this habit when the session ends
              </label>
            )}
            <div>
              <span className="field-label">Minutes</span>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DURATIONS) as Mode[]).map((m) => (
                  <label key={m} className="block">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      className="field text-center"
                      value={minutes[m]}
                      disabled={running}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                        setMinutes((x) => ({ ...x, [m]: v }));
                        if (m === mode) setRemaining(v * 60);
                      }}
                    />
                    <span className="mt-1 block text-center text-[13px] text-ink-2">{LABELS[m]}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section>
            <SectionHead aside={`${todayMinutes} min today`}>Recent sessions</SectionHead>
            {sessions?.length ? (
              <ul className="sheet divide-y divide-rule overflow-hidden">
                {sessions.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-[15px]">
                    <span className={clsx("min-w-0 flex-1 truncate", !s.habit && "text-ink-2")}>{s.habit?.name ?? "Focus"}</span>
                    <span className="mono text-ink-3">
                      {new Date(s.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="numeral w-12 text-right text-[20px] font-bold">{Math.round(s.durationSec / 60)}m</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sheet px-4 py-3.5 text-[15px] text-ink-2">Finished sessions are listed here and count toward your XP.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
