import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import { useTaskMutations, useTasks } from "../lib/hooks";
import { useUI } from "../lib/store";
import { addDays, parseDay } from "../lib/dates";
import { stamped, tap } from "../lib/celebrate";
import type { Task } from "../lib/types";
import { Empty, Loading, PageTitle, SectionHead, Sheet } from "../components/ui";

const PRIORITY = [
  { v: 0, label: "Low" },
  { v: 1, label: "Normal" },
  { v: 2, label: "High" },
];

const REMIND = [
  { v: "none", label: "No reminder" },
  { v: "0", label: "At the due time" },
  { v: "10", label: "10 minutes before" },
  { v: "60", label: "1 hour before" },
  { v: "1440", label: "1 day before" },
  { v: "custom", label: "Pick a time" },
];

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Due time, reminder and priority as edited in a form (datetime-local strings and a reminder choice). */
interface Timing {
  due: string;
  remind: string;
  customRemind: string;
  priority: number;
}

const BLANK_TIMING: Timing = { due: "", remind: "none", customRemind: "", priority: 1 };

/** Read a saved task back into form values, recognising the preset reminder offsets. */
function timingOf(t: Task): Timing {
  const due = t.dueAt ? toLocalInput(new Date(t.dueAt)) : "";
  let remind = "none";
  let customRemind = "";
  if (t.remindAt) {
    const before = t.dueAt ? (new Date(t.dueAt).getTime() - new Date(t.remindAt).getTime()) / 60000 : NaN;
    const preset = REMIND.find((r) => r.v !== "none" && r.v !== "custom" && Number(r.v) === before);
    if (preset) remind = preset.v;
    else {
      remind = "custom";
      customRemind = toLocalInput(new Date(t.remindAt));
    }
  }
  return { due, remind, customRemind, priority: t.priority };
}

/** Turn form values into the API's dueAt / remindAt, or a message explaining what's missing. */
function resolveTiming(f: Timing): { dueAt: string | null; remindAt: string | null } | { error: string } {
  const dueAt = f.due ? new Date(f.due) : null;
  let remindAt: Date | null = null;
  if (f.remind === "custom") {
    if (!f.customRemind) return { error: "Pick a reminder time, or choose No reminder." };
    remindAt = new Date(f.customRemind);
  } else if (f.remind !== "none") {
    if (!dueAt) return { error: "Set a due time first. That reminder is relative to the due time." };
    remindAt = new Date(dueAt.getTime() - Number(f.remind) * 60000);
  }
  return { dueAt: dueAt?.toISOString() ?? null, remindAt: remindAt?.toISOString() ?? null };
}

/** Due, reminder and priority fields, shared by the add box and the edit sheet. */
function TimingFields({ value: f, onChange, idPrefix }: { value: Timing; onChange: (f: Timing) => void; idPrefix: string }) {
  const set = (patch: Partial<Timing>) => onChange({ ...f, ...patch });
  const quick = (fn: () => Date) => set({ due: toLocalInput(fn()) });
  return (
    <>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-due`}>
          Due
        </label>
        <input id={`${idPrefix}-due`} type="datetime-local" className="field" value={f.due} onChange={(e) => set({ due: e.target.value })} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="pill !px-2.5 !py-1 !text-[13px]" onClick={() => quick(() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; })}>
            Today 6 pm
          </button>
          <button type="button" className="pill !px-2.5 !py-1 !text-[13px]" onClick={() => quick(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; })}>
            Tomorrow 9 am
          </button>
          {f.due && (
            <button type="button" className="pill !px-2.5 !py-1 !text-[13px]" onClick={() => set({ due: "", remind: f.remind === "custom" ? "custom" : "none" })}>
              No date
            </button>
          )}
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-remind`}>
          Reminder
        </label>
        <select id={`${idPrefix}-remind`} className="field" value={f.remind} onChange={(e) => set({ remind: e.target.value })}>
          {REMIND.map((r) => (
            <option key={r.v} value={r.v}>
              {r.label}
            </option>
          ))}
        </select>
        {f.remind === "custom" && (
          <input type="datetime-local" className="field mt-2" value={f.customRemind} onChange={(e) => set({ customRemind: e.target.value })} aria-label="Reminder time" />
        )}
      </div>
      <div>
        <span className="field-label">Priority</span>
        <div className="flex gap-1.5">
          {PRIORITY.map((p) => (
            <button type="button" key={p.v} className="pill flex-1 justify-center" aria-pressed={f.priority === p.v} onClick={() => set({ priority: p.v })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function TasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const today = useUI((s) => s.today);
  const [editing, setEditing] = useState<Task | null>(null);

  const groups = useMemo(() => {
    const start = parseDay(today).getTime();
    const end = parseDay(addDays(today, 1)).getTime();
    const g = { overdue: [] as Task[], today: [] as Task[], later: [] as Task[], someday: [] as Task[], done: [] as Task[] };
    for (const t of tasks ?? []) {
      if (t.completedAt) g.done.push(t);
      else if (!t.dueAt) g.someday.push(t);
      else {
        const d = new Date(t.dueAt).getTime();
        if (d < start) g.overdue.push(t);
        else if (d < end) g.today.push(t);
        else g.later.push(t);
      }
    }
    return g;
  }, [tasks, today]);

  return (
    <div className="max-w-[760px]">
      <PageTitle sub="One-off things to get done, each with its own reminder.">Tasks</PageTitle>
      <Composer />
      {isLoading ? (
        <Loading />
      ) : !tasks?.length ? (
        <div className="mt-8">
          <Empty title="Nothing on the list" body="Type a task above. Give it a due time and a reminder, and you'll get a notification when it matters." />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <Group title="Overdue" tasks={groups.overdue} tone="red" onEdit={setEditing} />
          <Group title="Today" tasks={groups.today} onEdit={setEditing} />
          <Group title="Coming up" tasks={groups.later} onEdit={setEditing} />
          <Group title="No date" tasks={groups.someday} onEdit={setEditing} />
          <Group title="Done this week" tasks={groups.done} onEdit={setEditing} />
        </div>
      )}
      <TaskEditor task={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Composer() {
  const { create } = useTaskMutations();
  const toast = useUI((s) => s.toast);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [timing, setTiming] = useState<Timing>(BLANK_TIMING);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const t = resolveTiming(timing);
    if ("error" in t) return toast({ kind: "error", title: "Check the reminder", body: t.error });
    try {
      await create.mutateAsync({ title: title.trim(), priority: timing.priority, ...t });
      setTitle("");
      setTiming(BLANK_TIMING);
      setOpen(false);
      toast({ title: "Task added", body: t.remindAt ? `Reminder at ${when(t.remindAt)}` : undefined });
    } catch (err) {
      toast({ kind: "error", title: "Couldn't add the task", body: (err as Error).message });
    }
  };

  return (
    <form onSubmit={submit} className="sheet overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <Plus size={20} className="ml-1 shrink-0 text-ink-3" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[16px] outline-none placeholder:text-ink-3"
          placeholder="Add a task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setOpen(true)}
          maxLength={200}
          aria-label="New task"
        />
        <button className="btn-ink" disabled={!title.trim() || create.isPending}>
          Add
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-4 border-t border-rule bg-well/50 px-4 py-4 sm:grid-cols-3">
              <TimingFields value={timing} onChange={setTiming} idPrefix="new" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function Group({ title, tasks, tone, onEdit }: { title: string; tasks: Task[]; tone?: "red"; onEdit: (t: Task) => void }) {
  if (!tasks.length) return null;
  return (
    <section>
      <SectionHead aside={String(tasks.length)}>
        <span className={tone === "red" ? "text-red" : undefined}>{title}</span>
      </SectionHead>
      <ul className="sheet overflow-hidden">
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <Row key={t.id} task={t} onEdit={onEdit} />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function Row({ task: t, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { update, remove } = useTaskMutations();
  const done = !!t.completedAt;
  return (
    <motion.li
      layout="position"
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      className="group flex items-center gap-3 border-b border-rule px-4 py-3 last:border-b-0 sm:px-5"
    >
      <button
        onClick={() => {
          if (done) tap();
          else stamped();
          update.mutate({ id: t.id, completed: !done });
        }}
        className={clsx("grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] border-[1.5px] transition-colors", done ? "border-ink bg-ink" : "border-rule-strong hover:border-pen")}
        aria-label={done ? `Mark ${t.title} not done` : `Complete ${t.title}`}
        aria-pressed={done}
      >
        {done && <Check size={14} className="text-sheet" strokeWidth={3} />}
      </button>
      <button type="button" onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${t.title}`}>
        <div className={clsx("truncate text-[15.5px]", done && "text-ink-3 line-through decoration-ink-3")}>
          {t.priority === 2 && !done && <span className="mr-1.5 font-bold text-red">!</span>}
          {t.title}
        </div>
        {(t.dueAt || (t.remindAt && !done) || t.notes) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
            {t.dueAt && <span className="mono">{when(t.dueAt)}</span>}
            {t.remindAt && !done && (
              <span className="flex items-center gap-1">
                <Bell size={12} /> <span className="mono">{when(t.remindAt)}</span>
              </span>
            )}
            {t.notes && <StickyNote size={12} className="text-ink-3" aria-label="Has notes" />}
          </div>
        )}
      </button>
      <button onClick={() => remove.mutate(t.id)} className="btn-quiet !p-2 opacity-60 group-hover:opacity-100 hover:!text-red" aria-label={`Delete ${t.title}`}>
        <Trash2 size={16} />
      </button>
    </motion.li>
  );
}

function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { update, remove } = useTaskMutations();
  const toast = useUI((s) => s.toast);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [timing, setTiming] = useState<Timing>(BLANK_TIMING);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setTiming(timingOf(task));
    setConfirmDelete(false);
  }, [task]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim()) return;
    const t = resolveTiming(timing);
    if ("error" in t) return toast({ kind: "error", title: "Check the reminder", body: t.error });
    const reminderChanged = t.remindAt !== task.remindAt;
    try {
      await update.mutateAsync({
        id: task.id,
        title: title.trim(),
        notes: notes.trim() || null,
        priority: timing.priority,
        dueAt: t.dueAt,
        // Only send the reminder when it changed, so an untouched reminder that already fired isn't re-armed.
        ...(reminderChanged ? { remindAt: t.remindAt } : {}),
      });
      toast({ title: "Task saved", body: reminderChanged && t.remindAt ? `Reminder at ${when(t.remindAt)}` : undefined });
      onClose();
    } catch (err) {
      toast({ kind: "error", title: "Couldn't save the task", body: (err as Error).message });
    }
  };

  return (
    <Sheet open={!!task} onClose={onClose} title="Edit task" wide>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="field-label" htmlFor="edit-title">
            Task
          </label>
          <input id="edit-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-notes">
            Notes <span className="font-normal text-ink-3">(optional, shown in the reminder)</span>
          </label>
          <textarea id="edit-notes" rows={3} className="field resize-none leading-relaxed" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TimingFields value={timing} onChange={setTiming} idPrefix="edit" />
        </div>
        <div className="flex items-center gap-2 pt-1">
          {confirmDelete ? (
            <>
              <button
                type="button"
                className="btn-line !border-red !text-red"
                onClick={() => {
                  if (task) remove.mutate(task.id);
                  onClose();
                }}
              >
                <Trash2 size={16} /> Delete for good
              </button>
              <button type="button" className="btn-quiet" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" className="btn-quiet hover:!text-red" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button className="btn-ink ml-auto" disabled={!title.trim() || update.isPending}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}
