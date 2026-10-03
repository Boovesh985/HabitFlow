import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useOverview } from "../lib/hooks";
import { parseDay, WEEKDAYS_SHORT } from "../lib/dates";
import { Heatmap } from "../components/Heatmap";
import { HabitIcon } from "../components/HabitIcon";
import { Face, MOODS } from "../components/Mood";
import { CharacterSheet } from "../components/Character";
import { Bar, Highlight, Loading, PageTitle, SectionHead } from "../components/ui";

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const pct = (v: number) => `${Math.round(v * 100)}%`;

function N({ children, tone }: { children: React.ReactNode; tone?: "red" | "pen" }) {
  const n = (
    <span className={clsx("numeral text-[1.35em] font-extrabold", tone === "red" ? "text-red" : tone === "pen" ? "text-pen" : "text-ink")}>{children}</span>
  );
  return tone === "pen" ? <Highlight delay={0.35}>{n}</Highlight> : n;
}

/** Rough → Great runs red → green, so the table reads at a glance. */
const MOOD_INK = ["oklch(0.6 0.19 28)", "oklch(0.7 0.16 55)", "oklch(0.75 0.13 95)", "oklch(0.66 0.14 140)", "oklch(0.58 0.14 160)"];
const CAT_INK = ["oklch(0.55 0.18 260)", "oklch(0.68 0.19 35)", "oklch(0.82 0.15 85)", "oklch(0.6 0.14 160)", "oklch(0.55 0.17 310)", "oklch(0.55 0.03 260)"];

export default function StatsPage() {
  const { data, isLoading } = useOverview();
  if (isLoading || !data) return <Loading />;

  const { profile: p, completion: c } = data;
  const trend = Math.round((c.last7 - c.prev7) * 100);
  const ranked = data.weekdays.filter((w) => w.rate > 0).sort((a, b) => b.rate - a.rate);
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
  const top = data.leaderboard.find((l) => l.kind === "BUILD" && l.currentStreak > 0);
  const moodRows = data.moodCorrelation.filter((m) => m.days > 0);
  const focusTotal = data.focusByDay.reduce((a, f) => a + f.minutes, 0);
  const maxFocus = Math.max(1, ...data.focusByDay.map((f) => f.minutes));

  const moodLine = (() => {
    const avg = (xs: typeof moodRows) =>
      xs.reduce((a, m) => a + m.avgCompletion * m.days, 0) /
      Math.max(
        1,
        xs.reduce((a, m) => a + m.days, 0)
      );
    const hi = moodRows.filter((m) => m.mood >= 4);
    const lo = moodRows.filter((m) => m.mood <= 2);
    if (moodRows.reduce((a, m) => a + m.days, 0) < 5) return "Log your mood on a few more days and a pattern will show up here.";
    if (hi.length && lo.length) {
      const diff = avg(hi) - avg(lo);
      if (diff > 0.08) return `On good days you get through ${pct(diff)} more of your habits than on low days.`;
      if (diff < -0.08) return "You keep your habits going even on low days. That's the hard part.";
    }
    return "So far your mood and your habits move fairly independently.";
  })();

  return (
    <div className="space-y-10">
      <PageTitle>Insights</PageTitle>

      <section className="max-w-[68ch] space-y-3 text-[19px] leading-[1.6] sm:text-[21px]">
        {c.last7 || c.prev7 ? (
          <p>
            This week you finished <N tone="pen">{pct(c.last7)}</N> of what was due
            {c.prev7 > 0 && <>, {trend === 0 ? "level with" : `${Math.abs(trend)} points ${trend > 0 ? "up on" : "down from"}`} last week</>}. Across the last
            30 days it's <N>{pct(c.last30)}</N>.
          </p>
        ) : (
          <p>Check in for a few days and this page will start describing your patterns.</p>
        )}
        {best && (
          <p>
            You're most reliable on <N>{DAY_NAMES[best.weekday]}</N>
            {worst && worst.weekday !== best.weekday && (
              <>
                {" "}
                and slip most on <N tone="red">{DAY_NAMES[worst.weekday]}</N>
              </>
            )}
            .
            {top && (
              <>
                {" "}
                Your longest run going is{" "}
                <Link to={`/habits/${top.id}`} className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                  {top.name}
                </Link>{" "}
                at <N tone="red">{top.currentStreak}</N> {top.streakUnit}.
              </>
            )}
          </p>
        )}
        <p className="text-[16px] text-ink-2 sm:text-[17px]">
          Level {p.level} · {p.xp.toLocaleString()} XP · {p.totalCheckIns.toLocaleString()} check-ins all time · {p.streakFreezes} streak{" "}
          {p.streakFreezes === 1 ? "freeze" : "freezes"} saved up
        </p>
        <Bar value={p.progress} className="max-w-[320px]" />
      </section>

      <section>
        <SectionHead aside="Each attribute levels up from the habits that train it. Level n takes n² completions.">Character</SectionHead>
        <div className="sheet px-5 py-5">
          <CharacterSheet categories={data.categories} profile={data.profile} />
        </div>
      </section>

      <section>
        <SectionHead aside="Each dot is a day; darker means more of your habits got done.">The year so far</SectionHead>
        <div className="sheet px-5 py-5">
          <Heatmap
            cells={data.heatmap.map((h) => ({
              date: h.date,
              value: h.due ? h.done / h.due : 0,
              label: h.due ? `${h.done} of ${h.due} habits` : "nothing due",
            }))}
          />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHead>By day of the week</SectionHead>
          <div className="sheet px-5 pt-5 pb-4">
            <div className="flex h-40 items-end gap-2.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d, i) => {
                const w = data.weekdays[d];
                const isBest = best?.weekday === d;
                return (
                  <div key={d} className="flex h-full flex-1 flex-col items-center gap-2" title={`${DAY_NAMES[d]}: ${pct(w.rate)}`}>
                    <span className="text-[12px] font-semibold text-ink-2">{w.rate ? pct(w.rate) : ""}</span>
                    <div className="relative w-full flex-1 overflow-hidden rounded-[6px] bg-well">
                      <motion.div
                        className="absolute inset-x-0 bottom-0 rounded-[6px]"
                        style={{
                          background: isBest ? "var(--pen)" : "color-mix(in oklch, var(--pen) 32%, var(--sheet))",
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: `${w.rate * 100}%` }}
                        transition={{
                          duration: 0.7,
                          delay: i * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      />
                    </div>
                    <span className={clsx("text-[13px] font-bold", d === 0 ? "text-red" : "text-ink")}>{WEEKDAYS_SHORT[d]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section>
          <SectionHead>Mood and habits</SectionHead>
          <div className="sheet px-5 py-4">
            <p className="mb-3 text-[15px] text-ink-2">{moodLine}</p>
            <ul className="space-y-2">
              {[...MOODS].reverse().map((m) => {
                const row = data.moodCorrelation[m.v - 1];
                return (
                  <li key={m.v} className="grid grid-cols-[34px_56px_1fr_84px] items-center gap-3">
                    <Face mood={m.v} size={28} />
                    <span className="text-[14px] font-semibold">{m.label}</span>
                    <Bar value={row.avgCompletion} color={row.days ? MOOD_INK[m.v - 1] : "var(--well)"} />
                    <span className="text-right text-[13px] text-ink-2">{row.days ? `${pct(row.avgCompletion)} · ${row.days}d` : "no days"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section>
          <SectionHead>Longest running</SectionHead>
          {data.leaderboard.every((h) => h.currentStreak === 0) ? (
            <p className="sheet px-5 py-4 text-[15px] text-ink-2">No streaks running yet. Two days in a row starts one.</p>
          ) : (
            <ol className="sheet divide-y divide-rule overflow-hidden">
              {data.leaderboard
                .filter((h) => h.currentStreak > 0)
                .slice(0, 7)
                .map((h, i) => (
                  <li key={h.id}>
                    <Link to={`/habits/${h.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-well/60">
                      <span className="mono w-5 text-ink-3">{i + 1}</span>
                      <HabitIcon icon={h.icon} color={h.color} size={32} radius={8} />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{h.name}</span>
                      <span className="numeral text-[24px] font-bold">{h.currentStreak}</span>
                      <span className="w-14 text-[13px] text-ink-2">{h.kind === "QUIT" ? "clean" : h.streakUnit}</span>
                    </Link>
                  </li>
                ))}
            </ol>
          )}
        </section>

        <section>
          <SectionHead aside={`${focusTotal} min`}>Focus, last 7 days</SectionHead>
          <div className="sheet relative px-5 pt-5 pb-4">
            {focusTotal === 0 && (
              <p className="absolute inset-x-5 top-12 z-10 text-center text-[15px] text-ink-2">
                No focus sessions this week.{" "}
                <Link to="/focus" className="font-semibold text-pen underline">
                  Start one
                </Link>
              </p>
            )}
            <div className="flex h-28 items-end gap-2.5">
              {data.focusByDay.map((f, i) => {
                const wd = parseDay(f.date).getDay();
                return (
                  <div key={f.date} className="flex h-full flex-1 flex-col items-center gap-2" title={`${f.minutes} min`}>
                    <div className="relative w-full flex-1 overflow-hidden rounded-[6px] bg-well">
                      <motion.div
                        className="absolute inset-x-0 bottom-0 rounded-[6px] bg-red"
                        initial={{ height: 0 }}
                        animate={{ height: `${(f.minutes / maxFocus) * 100}%` }}
                        transition={{
                          duration: 0.7,
                          delay: i * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      />
                    </div>
                    <span className={clsx("text-[13px] font-bold", wd === 0 ? "text-red" : "text-ink")}>{WEEKDAYS_SHORT[wd]}</span>
                  </div>
                );
              })}
            </div>
            {data.categories.length > 0 &&
              (() => {
                const cats = [...data.categories].sort((a, b) => b.done - a.done);
                const total = Math.max(
                  1,
                  cats.reduce((a, c) => a + c.done, 0)
                );
                return (
                  <div className="mt-4 border-t border-rule pt-3">
                    <p className="mb-2 text-[14px] font-semibold">Progress by category</p>
                    <div className="flex h-3 overflow-hidden rounded-full bg-well">
                      {cats.map((c, i) => (
                        <motion.span
                          key={c.name}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{ background: CAT_INK[i % CAT_INK.length] }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(c.done / total) * 100}%` }}
                          transition={{
                            duration: 0.7,
                            delay: 0.1 + i * 0.06,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        />
                      ))}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-ink-2">
                      {cats.map((c, i) => (
                        <li key={c.name} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_INK[i % CAT_INK.length] }} />
                          {c.name} <span className="font-semibold text-ink">{c.done}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
          </div>
        </section>
      </div>
    </div>
  );
}
