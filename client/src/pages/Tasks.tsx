import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import { useTaskMutations, useTasks } from "../lib/hooks";
import { useUI } from "../lib/store";
import { addDays, parseDay } from "../lib/dates";
import { stamped, tap } from "../lib/celebrate";
import type { Task } from "../lib/types";
import { Empty, Loading, PageTitle, SectionHead } from "../components/ui";

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

export default function TasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const today = useUI((s) => s.today);

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
          <Group title="Overdue" tasks={groups.overdue} tone="red" />
          <Group title="Today" tasks={groups.today} />
          <Group title="Coming up" tasks={groups.later} />
          <Group title="No date" tasks={groups.someday} />
          <Group title="Done this week" tasks={groups.done} />
        </div>
      )}
    </div>
  );
}

function Composer() {
  const { create } = useTaskMutations();
  const toast = useUI((s) => s.toast);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState("");
  const [remind, setRemind] = useState("none");
  const [customRemind, setCustomRemind] = useState("");
  const [priority, setPriority] = useState(1);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dueAt = due ? new Date(due) : null;
    let remindAt: Date | null = null;
    if (remind === "custom" && customRemind) remindAt = new Date(customRemind);
    else if (remind !== "none" && remind !== "custom") {
      if (!dueAt) return toast({ kind: "error", title: "Set a due time first", body: "That reminder is relative to the due time." });
      remindAt = new Date(dueAt.getTime() - Number(remind) * 60000);
    }
    try {
      await create.mutateAsync({ title: title.trim(), priority, dueAt: dueAt?.toISOString() ?? null, remindAt: remindAt?.toISOString() ?? null });
      setTitle("");
      setDue("");
      setRemind("none");
      setCustomRemind("");
      setPriority(1);
      setOpen(false);
      toast({ title: "Task added", body: remindAt ? `Reminder at ${when(remindAt.toISOString())}` : undefined });
    } catch (err) {
      toast({ kind: "error", title: "Couldn't add the task", body: (err as Error).message });
    }
  };

  const quick = (fn: () => Date) => setDue(toLocalInput(fn()));

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
              <div>
                <label className="field-label" htmlFor="due">Due</label>
                <input id="due" type="datetime-local" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" className="pill !px-2.5 !py-1 !text-[13px]" onClick={() => quick(() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; })}>
                    Today 6 pm
                  </button>
                  <button type="button" className="pill !px-2.5 !py-1 !text-[13px]" onClick={() => quick(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; })}>
                    Tomorrow 9 am
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="remind">Reminder</label>
                <select id="remind" className="field" value={remind} onChange={(e) => setRemind(e.target.value)}>
                  {REMIND.map((r) => (
                    <option key={r.v} value={r.v}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {remind === "custom" && <input type="datetime-local" className="field mt-2" value={customRemind} onChange={(e) => setCustomRemind(e.target.value)} aria-label="Reminder time" />}
              </div>
              <div>
                <span className="field-label">Priority</span>
                <div className="flex gap-1.5">
                  {PRIORITY.map((p) => (
                    <button type="button" key={p.v} className="pill flex-1 justify-center" aria-pressed={priority === p.v} onClick={() => setPriority(p.v)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function Group({ title, tasks, tone }: { title: string; tasks: Task[]; tone?: "red" }) {
  if (!tasks.length) return null;
  return (
    <section>
      <SectionHead aside={String(tasks.length)}>
        <span className={tone === "red" ? "text-red" : undefined}>{title}</span>
      </SectionHead>
      <ul className="sheet overflow-hidden">
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <Row key={t.id} task={t} />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

function Row({ task: t }: { task: Task }) {
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
      <div className="min-w-0 flex-1">
        <div className={clsx("truncate text-[15.5px]", done && "text-ink-3 line-through decoration-ink-3")}>
          {t.priority === 2 && !done && <span className="mr-1.5 font-bold text-red">!</span>}
          {t.title}
        </div>
        {(t.dueAt || (t.remindAt && !done)) && (
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-ink-2">
            {t.dueAt && <span className="mono">{when(t.dueAt)}</span>}
            {t.remindAt && !done && (
              <span className="flex items-center gap-1">
                <Bell size={12} /> <span className="mono">{when(t.remindAt)}</span>
              </span>
            )}
          </div>
        )}
      </div>
      <button onClick={() => remove.mutate(t.id)} className="btn-quiet !p-2 opacity-60 group-hover:opacity-100 hover:!text-red" aria-label={`Delete ${t.title}`}>
        <Trash2 size={16} />
      </button>
    </motion.li>
  );
}
