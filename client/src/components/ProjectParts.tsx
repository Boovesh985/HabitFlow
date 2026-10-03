import { motion } from "framer-motion";
import { CalendarClock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import type { Project } from "../lib/types";
import { byUnits, countdown, progressText } from "../lib/projects";
import { useProjectMutations } from "../lib/hooks";
import { stamped } from "../lib/celebrate";
import { HabitIcon } from "./HabitIcon";
import { StampMark } from "./Stamp";

/**
 * Progress as a track: one segment per step for checklists (up to 30),
 * a continuous bar for course units or long lists.
 */
export function ProgressTrack({ project: p, height = 8 }: { project: Project; height?: number }) {
  const segments = !byUnits(p) && p.steps.length > 0 && p.steps.length <= 30;
  if (segments)
    return (
      <div className="flex gap-[3px]" style={{ height }} aria-hidden>
        {p.steps.map((s, i) => (
          <motion.span
            key={s.id}
            className="flex-1 rounded-[2px]"
            initial={false}
            animate={{ backgroundColor: s.doneAt ? p.color : "var(--well)" }}
            transition={{ duration: 0.3, delay: i * 0.01 }}
          />
        ))}
      </div>
    );
  return (
    <div className="overflow-hidden rounded-full bg-well" style={{ height }} aria-hidden>
      <motion.div
        className="h-full rounded-full"
        style={{ background: p.color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(p.progress * 100)}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function Countdown({ deadline, className }: { deadline: string | null; className?: string }) {
  const c = countdown(deadline);
  if (!c) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold whitespace-nowrap",
        c.tone === "late" ? "bg-red text-sheet" : c.tone === "soon" ? "bg-red-soft text-red" : "bg-well text-ink-2",
        className,
      )}
    >
      <CalendarClock size={13} strokeWidth={2.4} />
      {c.label}
    </span>
  );
}

/** A ledger row for a project: what it is, how far along, what's next, and when it's due. */
export function ProjectRow({ project: p, quick, index = 0 }: { project: Project; quick?: boolean; index?: number }) {
  const m = useProjectMutations();
  const next = p.steps.find((s) => !s.doneAt);
  const done = !!p.completedAt;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.045, ease: [0.16, 1, 0.3, 1] }}
      className="relative border-b border-rule last:border-b-0"
    >
      <Link to={`/projects/${p.id}`} className="flex items-start gap-3 px-3.5 py-3.5 transition-colors hover:bg-well/60 sm:gap-4 sm:px-5">
        <span className="relative mt-0.5">
          <HabitIcon icon={p.icon} color={p.color} size={42} />
          {done && (
            <span className="absolute -right-2 -bottom-2">
              <StampMark color={p.color} size={22} seed={p.id} animate={false} soft />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={clsx("truncate text-[16px] leading-6 font-semibold", done && "text-ink-2")}>{p.title}</span>
            <span className="mono !text-[11px] tracking-wide text-ink-3 uppercase">{p.kind === "COURSE" ? "Course" : "Project"}</span>
          </span>
          <span className="mt-2 block">
            <ProgressTrack project={p} />
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink-2">
            <span>
              <span className="font-semibold text-ink">{Math.round(p.progress * 100)}%</span> · {progressText(p)}
            </span>
            {!done && <Countdown deadline={p.deadline} />}
            {done && <span>Completed {new Date(p.completedAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
          </span>
          {!done && next && !quick && (
            <span className="mt-1 block truncate text-[13.5px] text-ink-2">
              Next: <span className="text-ink">{next.title}</span>
            </span>
          )}
        </span>
        {!quick && <ChevronRight size={18} className="mt-3 shrink-0 text-ink-3" />}
      </Link>
      {quick && !done && next && (
        // On Today, the next step can be ticked off without opening the project.
        <div className="-mt-1.5 flex items-center gap-3 px-3.5 pb-3.5 pl-[68px] sm:pl-[78px]">
          <button
            onClick={() => {
              stamped();
              m.toggleStep.mutate({ id: p.id, stepId: next.id, done: true });
            }}
            className="group flex min-w-0 items-center gap-2 rounded-full border border-dashed border-rule-strong py-1 pr-3 pl-1 text-left text-[14px] transition-colors hover:border-solid hover:bg-well"
            aria-label={`Mark "${next.title}" done`}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-rule-strong transition-colors group-hover:border-solid" style={{ borderColor: p.color }} />
            <span className="truncate">
              <span className="text-ink-2">Next:</span> {next.title}
            </span>
          </button>
        </div>
      )}
    </motion.li>
  );
}
