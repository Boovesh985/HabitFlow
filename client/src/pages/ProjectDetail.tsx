import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { Archive, ArrowLeft, Check, GripVertical, Minus, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "../lib/api";
import { useHabits, useProjectMutations, useProjects } from "../lib/hooks";
import { byUnits, countdown, progressText, unitWord } from "../lib/projects";
import { formatTime12, WEEKDAYS_SHORT } from "../lib/dates";
import { dayComplete, stamped, tap } from "../lib/celebrate";
import { useUI } from "../lib/store";
import type { Habit, Project, ProjectStep } from "../lib/types";
import { HabitIcon } from "../components/HabitIcon";
import { DoneStamp, InkBurst, StampMark } from "../components/Stamp";
import { ProgressTrack } from "../components/ProjectParts";
import { useProjectForm } from "../components/ProjectForm";
import { DayPicker } from "../components/HabitForm";
import { Loading, MenuItem, Popover, SectionHead } from "../components/ui";
import { scheduleLabel, streakText } from "../components/HabitCard";

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`;
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, isLoading } = useProjects();
  const p = data?.find((x) => x.id === id);
  const m = useProjectMutations();
  const showForm = useProjectForm((s) => s.show);
  const [menu, setMenu] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  if (isLoading) return <Loading />;
  if (!p)
    return (
      <div className="sheet px-6 py-8">
        <p className="text-[15px] text-ink-2">This project doesn't exist any more.</p>
        <Link to="/projects" className="mt-3 inline-block font-semibold text-pen hover:underline">
          Back to projects
        </Link>
      </div>
    );

  const done = !!p.completedAt;
  const c = countdown(p.deadline);
  const allStepsDone = p.steps.length > 0 && p.stepsDone === p.steps.length;
  const unitsDone = byUnits(p) && p.unitsDone >= (p.totalUnits ?? 0);

  const complete = (v: boolean) => {
    if (v) {
      setJustDone(true);
      dayComplete();
    } else tap();
    m.update.mutate({ id: p.id, completed: v });
  };

  return (
    <div className="max-w-[860px]">
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={17} /> Projects
      </Link>

      <header className="relative mb-6 flex flex-wrap items-start gap-4 border-b-2 border-dashed border-[color-mix(in_oklch,var(--ink)_22%,transparent)] pb-5">
        <HabitIcon icon={p.icon} color={p.color} size={58} radius={14} />
        <div className="min-w-0 flex-1">
          <p className="mono !text-[12px] tracking-wide text-ink-2 uppercase">{p.kind === "COURSE" ? "Course" : "Project"}</p>
          <h1 className="numeral text-[40px] font-extrabold break-words sm:text-[52px]">{p.title}</h1>
          {p.description && <p className="mt-2 max-w-[62ch] text-[15px] whitespace-pre-line text-ink-2">{p.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-line" onClick={() => showForm(p)}>
            <Pencil size={16} /> Edit
          </button>
          <button ref={menuBtn} className="btn-quiet !px-2" onClick={() => setMenu((x) => !x)} aria-label="More" aria-haspopup="menu" aria-expanded={menu}>
            <MoreHorizontal size={19} />
          </button>
        </div>
        <Popover anchor={menuBtn} open={menu} onClose={() => setMenu(false)} width={210}>
          <MenuItem
            icon={<Archive size={16} />}
            onClick={() => {
              setMenu(false);
              m.update.mutate({ id: p.id, archived: true });
              nav("/projects");
            }}
          >
            Archive
          </MenuItem>
          <MenuItem
            danger
            icon={<Trash2 size={16} />}
            onClick={() => {
              setMenu(false);
              if (confirm(`Delete "${p.title}" and its steps? This can't be undone.`)) {
                m.remove.mutate(p.id);
                nav("/projects");
              }
            }}
          >
            Delete
          </MenuItem>
        </Popover>
        {done && <DoneStamp animate={justDone} text={p.kind === "COURSE" ? "COMPLETED" : "SHIPPED"} className="right-2 -bottom-8 sm:right-44 sm:top-2 sm:bottom-auto" />}
      </header>

      <dl className="sheet mb-8 grid grid-cols-2 divide-rule overflow-hidden sm:grid-cols-4 sm:divide-x [&>div]:px-5 [&>div]:py-4">
        <div className="border-b border-rule sm:border-b-0">
          <dt className="text-[13px] font-semibold text-ink-2">Progress</dt>
          <dd className="numeral mt-1 text-[38px] font-extrabold" style={{ color: p.color }}>
            {Math.round(p.progress * 100)}%
          </dd>
        </div>
        <div className="border-b border-l border-rule sm:border-b-0 sm:border-l-0">
          <dt className="text-[13px] font-semibold text-ink-2">{byUnits(p) ? unitWord(p)[0].toUpperCase() + unitWord(p).slice(1) : "Steps"}</dt>
          <dd className="mt-1">
            <span className="numeral text-[38px] font-extrabold">{byUnits(p) ? p.unitsDone : p.stepsDone}</span>
            <span className="text-[15px] text-ink-2"> / {byUnits(p) ? p.totalUnits : p.steps.length}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[13px] font-semibold text-ink-2">Deadline</dt>
          <dd className="mt-1.5">
            {p.deadline ? (
              <>
                <span className={clsx("block text-[16px] font-semibold", !done && c?.tone !== "calm" && "text-red")}>{done ? "Met" : c?.label}</span>
                <span className="mono text-ink-3">{new Date(p.deadline).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </>
            ) : (
              <button className="text-[15px] font-semibold text-pen hover:underline" onClick={() => showForm(p)}>
                Set one
              </button>
            )}
          </dd>
        </div>
        <div className="border-l border-rule sm:border-l-0">
          <dt className="text-[13px] font-semibold text-ink-2">Last worked on</dt>
          <dd className="mt-1.5 text-[16px] font-semibold">{ago(p.lastActivityAt)}</dd>
        </div>
      </dl>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          {byUnits(p) && <UnitCounter p={p} />}
          <Steps p={p} />
        </div>

        <aside className="space-y-6">
          <section className="sheet px-5 py-5">
            {done ? (
              <>
                <p className="text-[15px] text-ink-2">Finished {new Date(p.completedAt!).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.</p>
                <button className="btn-line mt-3 w-full" onClick={() => complete(false)}>
                  <RotateCcw size={16} /> Reopen
                </button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold">{allStepsDone || unitsDone ? "Everything's ticked off." : "Finish line"}</p>
                <p className="mt-1 text-[14px] text-ink-2">
                  {allStepsDone || unitsDone ? "Stamp it complete for the XP and the achievement." : `${progressText(p)}. Mark it complete whenever it's actually done.`}
                </p>
                <button className={clsx("mt-3 w-full", allStepsDone || unitsDone ? "btn-pen" : "btn-line")} onClick={() => complete(true)}>
                  <Check size={17} strokeWidth={2.6} /> Mark {p.kind === "COURSE" ? "course" : "project"} complete
                </button>
              </>
            )}
          </section>
          <Sessions p={p} />
        </aside>
      </div>
    </div>
  );
}

/* ---------- course units ---------- */

function UnitCounter({ p }: { p: Project }) {
  const m = useProjectMutations();
  const [burst, setBurst] = useState(0);
  const word = unitWord(p);
  const full = p.unitsDone >= (p.totalUnits ?? 0);
  return (
    <section>
      <SectionHead aside={`${Math.max(0, (p.totalUnits ?? 0) - p.unitsDone)} to go`}>Log progress</SectionHead>
      <div className="sheet flex items-center gap-4 px-5 py-5">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink-2">
            <span className="numeral text-[44px] font-extrabold text-ink">{p.unitsDone}</span> of {p.totalUnits} {word}
          </p>
          <div className="mt-3">
            <ProgressTrack project={p} height={10} />
          </div>
        </div>
        <button
          className="btn-quiet !p-2.5"
          onClick={() => (tap(), m.units.mutate({ id: p.id, delta: -1 }))}
          disabled={p.unitsDone === 0}
          aria-label={`Remove one ${word.replace(/s$/, "")}`}
        >
          <Minus size={18} />
        </button>
        <motion.button
          whileTap={{ scale: 0.92, y: 2 }}
          className="relative grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full text-sheet disabled:opacity-40"
          style={{ background: p.color }}
          disabled={full}
          onClick={() => {
            stamped();
            setBurst((b) => b + 1);
            m.units.mutate({ id: p.id, delta: 1 });
          }}
          aria-label={`Log one ${word.replace(/s$/, "")}`}
        >
          {burst > 0 && <InkBurst key={burst} color={p.color} seed={p.id + burst} />}
          <span className="numeral text-[26px] font-extrabold">+1</span>
        </motion.button>
      </div>
    </section>
  );
}

/* ---------- checklist ---------- */

function Steps({ p }: { p: Project }) {
  const m = useProjectMutations();
  const [order, setOrder] = useState(p.steps);
  const [text, setText] = useState("");
  useEffect(() => setOrder(p.steps), [p.steps]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const titles = text
      .split("\n")
      .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
    if (!titles.length) return;
    m.addSteps.mutate({ id: p.id, titles });
    setText("");
  };

  return (
    <section>
      <SectionHead aside={p.steps.length ? `${p.stepsDone}/${p.steps.length}` : undefined}>{p.kind === "COURSE" ? "Modules and steps" : "Steps"}</SectionHead>
      <div className="sheet overflow-hidden">
        {order.length > 0 && (
          <Reorder.Group
            axis="y"
            values={order}
            onReorder={setOrder}
            as="ul"
            onPointerUp={() => {
              const ids = order.map((s) => s.id);
              if (ids.join() !== p.steps.map((s) => s.id).join()) m.reorderSteps.mutate({ id: p.id, ids });
            }}
          >
            {order.map((s) => (
              <StepRow key={s.id} p={p} s={s} />
            ))}
          </Reorder.Group>
        )}
        <form onSubmit={add} className={clsx("flex items-start gap-2 px-3.5 py-3 sm:px-5", order.length > 0 && "border-t border-rule")}>
          <Plus size={18} className="mt-2.5 shrink-0 text-ink-3" />
          <textarea
            rows={1}
            className="min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-3"
            placeholder={order.length ? "Add a step" : "Add the first step. Paste a list to add several at once."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) add(e);
            }}
            aria-label="New step"
          />
          {text.trim() && (
            <button className="btn-ink !py-1.5" type="submit">
              Add
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

function StepRow({ p, s }: { p: Project; s: ProjectStep }) {
  const m = useProjectMutations();
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [burst, setBurst] = useState(0);
  const done = !!s.doneAt;

  const save = () => {
    setEditing(false);
    if (title.trim() && title.trim() !== s.title) m.renameStep.mutate({ id: p.id, stepId: s.id, title: title.trim() });
    else setTitle(s.title);
  };

  return (
    <Reorder.Item value={s} dragListener={false} dragControls={controls} as="li" className="group relative flex items-center gap-2 border-b border-rule bg-sheet px-2 py-2 last:border-b-0 sm:px-3">
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `color-mix(in oklch, ${p.color} 8%, transparent)` }}
        initial={false}
        animate={{ clipPath: done ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
        transition={{ duration: done ? 0.55 : 0.25, ease: [0.16, 1, 0.3, 1] }}
      />
      <button
        onPointerDown={(e) => controls.start(e)}
        className="relative cursor-grab touch-none p-1 text-ink-3 opacity-60 hover:text-ink-2 hover:opacity-100 active:cursor-grabbing"
        aria-label={`Reorder ${s.title}`}
      >
        <GripVertical size={16} />
      </button>
      <button
        className="relative grid h-9 w-9 shrink-0 place-items-center"
        onClick={() => {
          if (!done) {
            stamped();
            setBurst((b) => b + 1);
          } else tap();
          m.toggleStep.mutate({ id: p.id, stepId: s.id, done: !done });
        }}
        aria-pressed={done}
        aria-label={done ? `Mark "${s.title}" not done` : `Mark "${s.title}" done`}
      >
        {burst > 0 && <InkBurst key={burst} color={p.color} seed={s.id + burst} />}
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <motion.span key="d" exit={{ opacity: 0, scale: 0.8 }}>
              <StampMark color={p.color} size={30} seed={s.id} />
            </motion.span>
          ) : (
            <motion.span key="o" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="block h-[26px] w-[26px] rounded-full border-[1.5px] border-dashed border-rule-strong" />
          )}
        </AnimatePresence>
      </button>
      {editing ? (
        <input
          autoFocus
          className="relative min-w-0 flex-1 rounded-[8px] border border-pen bg-sheet px-2 py-1.5 text-[15px] outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") (setTitle(s.title), setEditing(false));
          }}
          aria-label="Step title"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={clsx("relative min-w-0 flex-1 truncate py-1.5 text-left text-[15px]", done && "text-ink-2 line-through decoration-rule-strong")}>
          {s.title}
        </button>
      )}
      <button
        onClick={() => m.removeStep.mutate({ id: p.id, stepId: s.id })}
        className="relative rounded-[8px] p-1.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-well hover:text-red focus-visible:opacity-100 max-sm:opacity-60"
        aria-label={`Delete "${s.title}"`}
      >
        <X size={16} />
      </button>
    </Reorder.Item>
  );
}

/* ---------- recurring sessions ---------- */

function Sessions({ p }: { p: Project }) {
  const { data: habits = [] } = useHabits();
  const m = useProjectMutations();
  const qc = useQueryClient();
  const toast = useUI((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [time, setTime] = useState("20:00");
  const [busy, setBusy] = useState(false);
  const h = p.habitId ? habits.find((x) => x.id === p.habitId) : undefined;
  const course = p.kind === "COURSE";

  if (h)
    return (
      <section>
        <SectionHead>{course ? "Study sessions" : "Work sessions"}</SectionHead>
        <Link to={`/habits/${h.id}`} className="sheet flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-well/60">
          <HabitIcon icon={h.icon} color={h.color} size={38} radius={10} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{h.name}</span>
            <span className="block text-[13px] text-ink-2">
              {scheduleLabel(h)}
              {h.reminders[0] && ` · ${formatTime12(h.reminders[0].time)}`}
            </span>
            {streakText(h) && <span className="block text-[13px] font-semibold text-red">{streakText(h)}</span>}
          </span>
        </Link>
      </section>
    );

  const setup = async () => {
    if (!days.length) return;
    setBusy(true);
    try {
      const r = await api<{ habit: Habit }>("/habits", {
        method: "POST",
        body: {
          name: `${course ? "Study" : "Work on"}: ${p.title}`.slice(0, 80),
          icon: p.icon,
          color: p.color,
          category: course ? "Learning" : "Productivity",
          frequencyType: days.length === 7 ? "DAILY" : "WEEKLY_DAYS",
          daysOfWeek: days.length === 7 ? [] : days,
          reminders: [{ time, daysOfWeek: [], enabled: true }],
        },
      });
      await m.update.mutateAsync({ id: p.id, habitId: r.habit.id });
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast({ title: "Sessions added", body: `Reminder at ${formatTime12(time)} on ${days.length === 7 ? "every day" : days.map((d) => WEEKDAYS_SHORT[d]).join(", ")}.` });
      setOpen(false);
    } catch (e) {
      toast({ kind: "error", title: "Couldn't add sessions", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sheet px-5 py-5">
      <p className="text-[15px] font-semibold">{course ? "Study regularly" : "Work on it regularly"}</p>
      <p className="mt-1 text-[14px] text-ink-2">Get a reminder on set days. Each session counts as a habit check-in, so it builds a streak.</p>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 pt-4">
              <DayPicker value={days} onChange={setDays} small />
              <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button className={clsx("mt-3 w-full", open ? "btn-pen" : "btn-line")} onClick={() => (open ? setup() : setOpen(true))} disabled={busy || (open && !days.length)}>
        {open ? "Add sessions" : "Set up sessions"}
      </button>
    </section>
  );
}
