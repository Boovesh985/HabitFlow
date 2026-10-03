import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { create } from "zustand";
import { api } from "../lib/api";
import { useHabits, useProjectMutations } from "../lib/hooks";
import { joinDeadline, splitDeadline } from "../lib/projects";
import { useUI } from "../lib/store";
import { formatTime12, WEEKDAYS_SHORT } from "../lib/dates";
import type { Habit, Project, ProjectKind } from "../lib/types";
import { COLORS, DayPicker, ICONS } from "./HabitForm";
import { HABIT_ICONS, HabitIcon } from "./HabitIcon";
import { Segmented, Sheet, Spinner, Toggle } from "./ui";

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-rule pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[16px] font-bold" aria-hidden>
          {title}
        </h3>
        {hint && <span className="text-[13px] text-ink-3">{hint}</span>}
      </div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

/** One shared form, mounted in Layout; anything can open it. */
export const useProjectForm = create<{ open: boolean; project: Project | null; kind: ProjectKind; show: (p?: Project | null, kind?: ProjectKind) => void; close: () => void }>((set) => ({
  open: false,
  project: null,
  kind: "PROJECT",
  show: (project = null, kind = "PROJECT") => set({ open: true, project, kind }),
  close: () => set({ open: false }),
}));

const blank = (kind: ProjectKind = "PROJECT") => ({
  kind,
  title: "",
  description: "",
  icon: kind === "COURSE" ? "study" : "target",
  color: kind === "COURSE" ? "#0f7c86" : "#2f45d6",
  date: "",
  time: "18:00",
  totalUnits: "",
  unitLabel: "lessons",
  steps: "",
  nudge: true,
  sessions: false,
  sessionDays: [1, 2, 3, 4, 5],
  sessionTime: "20:00",
});

/** Create or edit a project / course. A new one can also get a recurring study-session habit with reminders. */
export function ProjectForm({ open, onClose, project, kind = "PROJECT", onSaved }: { open: boolean; onClose: () => void; project?: Project | null; kind?: ProjectKind; onSaved?: (p: Project) => void }) {
  const [f, setF] = useState(blank);
  const [pickIcon, setPickIcon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const m = useProjectMutations();
  const qc = useQueryClient();
  const toast = useUI((s) => s.toast);
  const { data: habits = [] } = useHabits();
  const linked = project?.habitId ? habits.find((h) => h.id === project.habitId) : undefined;

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPickIcon(false);
    if (project) {
      const d = splitDeadline(project.deadline);
      setF({
        ...blank(project.kind),
        kind: project.kind,
        title: project.title,
        description: project.description ?? "",
        icon: project.icon,
        color: project.color,
        date: d.date,
        time: d.time,
        totalUnits: project.totalUnits ? String(project.totalUnits) : "",
        unitLabel: project.unitLabel ?? "lessons",
        nudge: project.nudge,
      });
    } else setF(blank(kind));
  }, [open, project, kind]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const course = f.kind === "COURSE";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return setErr("Give it a name.");
    if (f.sessions && !f.sessionDays.length) return setErr("Pick at least one day for study sessions.");
    setErr(null);
    setBusy(true);
    try {
      let habitId: string | null | undefined = project ? undefined : null;
      if (!project && f.sessions) {
        // The recurring part lives as a normal habit, so it gets streaks and actionable reminders for free.
        const r = await api<{ habit: Habit }>("/habits", {
          method: "POST",
          body: {
            name: `${course ? "Study" : "Work on"}: ${f.title.trim()}`.slice(0, 80),
            icon: f.icon,
            color: f.color,
            category: course ? "Learning" : "Productivity",
            frequencyType: f.sessionDays.length === 7 ? "DAILY" : "WEEKLY_DAYS",
            daysOfWeek: f.sessionDays.length === 7 ? [] : f.sessionDays,
            reminders: [{ time: f.sessionTime, daysOfWeek: [], enabled: true }],
          },
        });
        habitId = r.habit.id;
        qc.invalidateQueries({ queryKey: ["habits"] });
      }
      const units = parseInt(f.totalUnits, 10);
      const data = {
        kind: f.kind,
        title: f.title.trim(),
        description: f.description.trim() || null,
        icon: f.icon,
        color: f.color,
        deadline: joinDeadline(f.date, f.time),
        totalUnits: course && units > 0 ? units : null,
        unitLabel: course ? f.unitLabel.trim() || "lessons" : null,
        nudge: f.nudge,
        ...(habitId !== undefined ? { habitId } : {}),
      };
      const r = project
        ? await m.update.mutateAsync({ id: project.id, ...data })
        : await m.create.mutateAsync({
            ...data,
            steps: f.steps
              .split("\n")
              .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
              .filter(Boolean),
          });
      toast({ title: project ? "Saved" : `${data.title} added`, body: project ? undefined : f.date ? "Deadline reminders are set." : undefined });
      onSaved?.(r.project);
      onClose();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={project ? `Edit ${course ? "course" : "project"}` : course ? "New course" : "New project"} wide>
      <form onSubmit={submit} className="space-y-5">
        <Group title="What">
          {!project && (
            <Segmented<ProjectKind>
              id="pkind"
              value={f.kind}
              onChange={(k) => setF((x) => ({ ...x, kind: k, ...(x.title ? {} : { icon: blank(k).icon, color: blank(k).color }) }))}
              options={[
                { value: "PROJECT", label: "Project" },
                { value: "COURSE", label: "Course" },
              ]}
            />
          )}
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => setPickIcon((p) => !p)}
              className="shrink-0 rounded-[11px] ring-1 ring-rule-strong transition-shadow hover:ring-ink"
              aria-label="Choose icon"
              aria-expanded={pickIcon}
            >
              <HabitIcon icon={f.icon} color={f.color} size={46} />
            </button>
            <div className="flex-1">
              <label className="field-label" htmlFor="ptitle">
                Name
              </label>
              <input
                id="ptitle"
                className="field"
                placeholder={course ? "Name of the course" : "Name of the project"}
                value={f.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <AnimatePresence initial={false}>
            {pickIcon && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-8 gap-1 rounded-[12px] border border-rule bg-well p-2 sm:grid-cols-13">
                  {ICONS.map((ic) => {
                    const Icon = HABIT_ICONS[ic];
                    return (
                      <button
                        type="button"
                        key={ic}
                        onClick={() => (set("icon", ic), setPickIcon(false))}
                        className={clsx(
                          "grid aspect-square place-items-center rounded-[8px] text-ink-2 transition-colors hover:bg-sheet hover:text-ink",
                          f.icon === ic && "bg-sheet text-ink ring-2 ring-ink",
                        )}
                        aria-label={ic.replace("-", " ")}
                        aria-pressed={f.icon === ic}
                      >
                        <Icon size={19} strokeWidth={2} />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div>
            <span className="field-label">Ink</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => set("color", c.hex)}
                  className="h-8 w-8 rounded-full transition-transform active:scale-90"
                  style={{ background: c.hex, boxShadow: f.color === c.hex ? `0 0 0 2px var(--sheet), 0 0 0 4px ${c.hex}` : undefined }}
                  aria-label={c.name}
                  aria-pressed={f.color === c.hex}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="pdesc">
              Notes <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <textarea
              id="pdesc"
              className="field min-h-[72px] resize-y"
              placeholder={course ? "Where it lives, what you want out of it" : "Who it's for, what done looks like"}
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={2000}
            />
          </div>
        </Group>

        <Group title="Deadline" hint="Reminders 3 days, 1 day and 3 hours before">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <input type="date" className="field mono" value={f.date} onChange={(e) => set("date", e.target.value)} aria-label="Deadline date" />
            <input type="time" className="field" value={f.time} onChange={(e) => set("time", e.target.value)} aria-label="Deadline time" disabled={!f.date} />
          </div>
          {f.date && (
            <button type="button" className="text-[14px] font-semibold text-ink-2 hover:text-ink" onClick={() => set("date", "")}>
              Remove deadline
            </button>
          )}
        </Group>

        {course && (
          <Group title="Size" hint="Leave empty to track by checklist instead">
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div>
                <label className="field-label" htmlFor="punits">
                  Total
                </label>
                <input id="punits" className="field" inputMode="numeric" placeholder="20" value={f.totalUnits} onChange={(e) => set("totalUnits", e.target.value.replace(/\D/g, "").slice(0, 5))} />
              </div>
              <div>
                <label className="field-label" htmlFor="plabel">
                  Counted in
                </label>
                <input id="plabel" className="field" placeholder="lessons" value={f.unitLabel} onChange={(e) => set("unitLabel", e.target.value)} maxLength={20} />
              </div>
            </div>
          </Group>
        )}

        {!project && (
          <Group title={course ? "Modules or steps" : "Steps"} hint="One per line. You can add more later">
            <textarea
              className="field min-h-[110px] resize-y"
              placeholder={course ? "Module 1\nModule 2\nFinal assignment" : "First step\nSecond step\nHand it in"}
              value={f.steps}
              onChange={(e) => set("steps", e.target.value)}
            />
          </Group>
        )}

        <Group title="Reminders">
          {!project ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[15px] font-semibold">{course ? "Study sessions" : "Work sessions"}</div>
                  <div className="text-[13.5px] text-ink-2">Adds a habit with a reminder on these days, so showing up builds a streak.</div>
                </div>
                <Toggle on={f.sessions} onChange={(v) => set("sessions", v)} label="Regular sessions" />
              </div>
              <AnimatePresence initial={false}>
                {f.sessions && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <DayPicker value={f.sessionDays} onChange={(v) => set("sessionDays", v)} small />
                      <input type="time" className="field !w-auto" value={f.sessionTime} onChange={(e) => set("sessionTime", e.target.value)} aria-label="Session reminder time" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : linked ? (
            <p className="text-[14.5px] text-ink-2">
              Sessions: <span className="font-semibold text-ink">{linked.name}</span>
              {linked.reminders[0] && ` at ${formatTime12(linked.reminders[0].time)}`}
              {linked.daysOfWeek.length > 0 && linked.daysOfWeek.length < 7 && ` on ${linked.daysOfWeek.map((d) => WEEKDAYS_SHORT[d]).join(", ")}`}. Edit it from Habits.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[15px] font-semibold">Nudge me if it goes quiet</div>
              <div className="text-[13.5px] text-ink-2">After a week with no progress, a reminder at 7 pm with the next step.</div>
            </div>
            <Toggle on={f.nudge} onChange={(v) => set("nudge", v)} label="Weekly nudge" />
          </div>
        </Group>

        {err && (
          <p className="rounded-[10px] bg-red-soft px-3.5 py-2.5 text-[15px] text-red" role="alert">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-rule pt-4">
          <button type="button" className="btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-pen" disabled={busy}>
            {busy && <Spinner className="!h-4 !w-4 !border-sheet/40 !border-t-sheet" />}
            {project ? "Save" : course ? "Add course" : "Add project"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
