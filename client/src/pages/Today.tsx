import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useHabits, useOverview, useProjects, useTasks, useTaskMutations } from "../lib/hooks";
import { sortProjects } from "../lib/projects";
import { ProjectRow } from "../components/ProjectParts";
import { useAuth, useUI } from "../lib/store";
import { addDays, greeting, parseDay } from "../lib/dates";
import { dayComplete, tap } from "../lib/celebrate";
import type { Habit } from "../lib/types";
import { HabitCard } from "../components/HabitCard";
import { DaySheet } from "../components/DaySheet";
import { useHabitForm } from "../components/Layout";
import { MoodPicker, NoteSheet } from "../components/Mood";
import { Empty, Loading, Scribble, SectionHead } from "../components/ui";
import { CharacterSheet } from "../components/Character";

export default function TodayPage() {
  const user = useAuth((s) => s.user);
  const today = useUI((s) => s.today);
  const toast = useUI((s) => s.toast);
  const { data: habits, isLoading } = useHabits();
  const { data: overview } = useOverview();
  const form = useHabitForm();
  const [noteFor, setNoteFor] = useState<Habit | null>(null);
  const [showOther, setShowOther] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const { due, other, quit, counted, doneCount, dueCount } = useMemo(() => {
    const list = habits ?? [];
    const build = list.filter((h) => h.kind === "BUILD");
    const due = build.filter((h) => h.stats.dueToday || h.stats.doneToday);
    const settled = (h: Habit) => Number(h.stats.doneToday || h.stats.todayStatus === "SKIPPED");
    due.sort((a, b) => settled(a) - settled(b));
    // "N times a week" habits are optional on any given day: they count toward today only once done.
    const counted = due.filter((h) => h.stats.todayStatus !== "SKIPPED" && (h.frequencyType !== "TIMES_PER_WEEK" || h.stats.doneToday));
    return {
      due,
      other: build.filter((h) => !due.includes(h)),
      quit: list.filter((h) => h.kind === "QUIT"),
      counted,
      doneCount: counted.filter((h) => h.stats.doneToday).length,
      dueCount: counted.length,
    };
  }, [habits]);

  // Land the ALL DONE stamp only at the moment the day becomes complete, not on load.
  const prevPerfect = useRef<boolean | null>(null);
  useEffect(() => {
    if (!habits) return;
    const perfect = dueCount > 0 && doneCount === dueCount;
    if (prevPerfect.current === false && perfect) {
      setJustCompleted(true);
      setTimeout(dayComplete, 220);
      toast({ title: "Day complete", body: "Every habit stamped. That's how streaks are built." });
    }
    prevPerfect.current = perfect;
  }, [doneCount, dueCount, habits, toast]);

  const byId = useMemo(() => new Map((habits ?? []).map((h) => [h.id, h])), [habits]);
  const week = overview?.heatmap.slice(-7) ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i - 6), done: 0, due: 0 }));
  const sheetHabits = counted;

  // The arc starts on the earliest habit (or the day the account was made) and counts every day since.
  const arcDay = useMemo(() => {
    const starts = (habits ?? []).map((h) => h.startDate).filter(Boolean);
    if (user?.createdAt) starts.push(user.createdAt.slice(0, 10));
    if (!starts.length) return 0;
    const first = starts.sort()[0];
    return Math.max(1, Math.round((parseDay(today).getTime() - parseDay(first).getTime()) / 86_400_000) + 1);
  }, [habits, user?.createdAt, today]);

  if (isLoading) return <Loading />;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">
      <aside className="space-y-5 lg:sticky lg:top-[84px] lg:self-start">
        <DaySheet day={today} habits={sheetHabits} week={week} doneCount={doneCount} dueCount={dueCount} justCompleted={justCompleted} empty={!habits?.length} />
        <div className="hidden lg:block">
          <MoodPicker />
        </div>
      </aside>

      <div className="min-w-0 space-y-8">
        <p className="text-[24px] leading-tight font-semibold sm:text-[30px]">
          {greeting()}
          {user?.name && (
            <>
              ,{" "}
              <span className="relative inline-block">
                {user.name.split(" ")[0]}
                <Scribble className="absolute -bottom-[0.28em] left-0" />
              </span>
            </>
          )}
          .
        </p>
        {arcDay > 0 && (
          <p className="-mt-5 flex flex-wrap items-baseline gap-x-2 text-[15px] text-ink-2">
            <span className="numeral text-[30px] font-extrabold text-pen">Day {arcDay}</span>
            of your arc. Week {Math.ceil(arcDay / 7)}.
          </p>
        )}

        {!habits?.length ? (
          <Empty
            title="Your first page is blank"
            body="Pick one habit small enough to do on your worst day. Two minutes of reading beats an hour you never start."
            action={
              <button className="btn-pen" onClick={() => form.show()}>
                <Plus size={18} /> Add your first habit
              </button>
            }
          />
        ) : (
          <>
            <section>
              <SectionHead aside={dueCount ? `${doneCount}/${dueCount}` : undefined}>Due today</SectionHead>
              {due.length ? (
                <ul className="sheet overflow-hidden">
                  {due.map((h, i) => (
                    <HabitCard
                      key={h.id}
                      index={i}
                      habit={h}
                      stackParent={h.stackAfterId ? byId.get(h.stackAfterId) : undefined}
                      onEdit={(x) => form.show(x)}
                      onNote={setNoteFor}
                    />
                  ))}
                </ul>
              ) : (
                <p className="sheet px-5 py-4 text-[15px] text-ink-2">Nothing is scheduled for today.</p>
              )}
            </section>

            {quit.length > 0 && (
              <section>
                <SectionHead>Staying off</SectionHead>
                <ul className="sheet overflow-hidden">
                  {quit.map((h, i) => (
                    <HabitCard key={h.id} index={i} habit={h} onEdit={(x) => form.show(x)} onNote={setNoteFor} />
                  ))}
                </ul>
              </section>
            )}

            {other.length > 0 && (
              <section>
                <button
                  onClick={() => (tap(), setShowOther((s) => !s))}
                  className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink"
                  aria-expanded={showOther}
                >
                  <motion.span animate={{ rotate: showOther ? 0 : -90 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={18} />
                  </motion.span>
                  Not scheduled today · {other.length}
                </button>
                <AnimatePresence initial={false}>
                  {showOther && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <ul className="sheet mt-2.5 overflow-hidden">
                        {other.map((h) => (
                          <HabitCard key={h.id} habit={h} onEdit={(x) => form.show(x)} onNote={setNoteFor} />
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </>
        )}

        <TodayProjects />

        {overview && habits && habits.length > 0 && (
          <section>
            <SectionHead
              aside={
                <Link to="/stats" className="font-semibold text-pen hover:underline">
                  Level {overview.profile.level}
                </Link>
              }
            >
              Character
            </SectionHead>
            <div className="sheet px-5 py-4">
              <CharacterSheet categories={overview.categories} profile={overview.profile} />
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:hidden">
          <MoodPicker />
        </div>
        <TodayTasks />
      </div>

      <NoteSheet habit={noteFor} onClose={() => setNoteFor(null)} />
    </div>
  );
}

/** Active projects, soonest deadline first, each with its next step one tap away. */
function TodayProjects() {
  const { data } = useProjects();
  const active = sortProjects((data ?? []).filter((p) => !p.completedAt));
  if (!active.length) return null;
  return (
    <section>
      <SectionHead
        aside={
          <Link to="/projects" className="font-semibold text-pen hover:underline">
            {active.length > 3 ? `All ${active.length}` : "All projects"}
          </Link>
        }
      >
        Projects
      </SectionHead>
      <ul className="sheet overflow-hidden">
        {active.slice(0, 3).map((p, i) => (
          <ProjectRow key={p.id} project={p} index={i} quick />
        ))}
      </ul>
    </section>
  );
}

function TodayTasks() {
  const { data: tasks } = useTasks();
  const { update } = useTaskMutations();
  const today = useUI((s) => s.today);
  const end = parseDay(addDays(today, 1));
  const list = (tasks ?? []).filter((t) => !t.completedAt && (!t.dueAt || new Date(t.dueAt) < end)).slice(0, 6);

  return (
    <section>
      <SectionHead
        aside={
          <Link to="/tasks" className="font-semibold text-pen hover:underline">
            All tasks
          </Link>
        }
      >
        Tasks for today
      </SectionHead>
      {list.length === 0 ? (
        <p className="sheet px-5 py-4 text-[15px] text-ink-2">
          No tasks due. <Link to="/tasks" className="font-semibold text-pen hover:underline">Add one</Link> with a reminder.
        </p>
      ) : (
        <ul className="sheet overflow-hidden">
          <AnimatePresence initial={false}>
            {list.map((t) => {
              const overdue = t.dueAt && new Date(t.dueAt) < new Date();
              return (
                <motion.li
                  key={t.id}
                  layout="position"
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 border-b border-rule px-5 py-3 last:border-b-0"
                >
                  <button
                    onClick={() => (tap(), update.mutate({ id: t.id, completed: true }))}
                    className="h-[22px] w-[22px] shrink-0 rounded-[6px] border-[1.5px] border-rule-strong transition-colors hover:border-pen"
                    aria-label={`Complete ${t.title}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{t.title}</span>
                  {t.dueAt && (
                    <span className={clsx("mono", overdue ? "text-red" : "text-ink-3")}>
                      {new Date(t.dueAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
