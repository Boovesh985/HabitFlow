import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import { Archive, ArchiveRestore, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHabitAction, useHabits, useReorder } from "../lib/hooks";
import { useUI } from "../lib/store";
import { formatTime12 } from "../lib/dates";
import type { Habit } from "../lib/types";
import { scheduleLabel } from "../components/HabitCard";
import { HabitIcon } from "../components/HabitIcon";
import { useHabitForm } from "../components/Layout";
import { Bar, Empty, Loading, PageTitle, Segmented } from "../components/ui";

export default function HabitsPage() {
  const [view, setView] = useState<"active" | "archived">("active");
  const [cat, setCat] = useState("All");
  const { data: habits, isLoading } = useHabits(view === "archived");
  const reorder = useReorder();
  const form = useHabitForm();
  const [order, setOrder] = useState<Habit[]>([]);

  useEffect(() => setOrder(habits ?? []), [habits]);

  const categories = useMemo(() => ["All", ...new Set((habits ?? []).map((h) => h.category))], [habits]);
  const filtered = cat === "All" ? order : order.filter((h) => h.category === cat);
  const canDrag = cat === "All" && view === "active";

  return (
    <div>
      <PageTitle
        sub={view === "active" ? "Drag the handle to change the order on your Today page." : "Archived habits keep their full history. Restore one any time."}
        aside={
          <div className="w-[220px]">
            <Segmented id="hview" size="sm" value={view} onChange={setView} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
          </div>
        }
      >
        Habits
      </PageTitle>

      {categories.length > 2 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {categories.map((c) => (
            <button key={c} className="pill shrink-0" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty
          title={view === "archived" ? "Nothing archived" : "No habits yet"}
          body={view === "archived" ? "When you pause a habit, it rests here with its history intact." : "Add the first one. You can change everything about it later."}
          action={
            view === "active" && (
              <button className="btn-pen" onClick={() => form.show()}>
                <Plus size={18} /> New habit
              </button>
            )
          }
        />
      ) : (
        <div className="sheet overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_120px_140px] gap-4 border-b border-rule bg-well/60 px-5 py-2 text-[13px] font-semibold text-ink-2 md:grid md:pl-12">
            <span>Habit</span>
            <span>Streak</span>
            <span>Last 30 days</span>
            <span className="text-right">Actions</span>
          </div>
          <Reorder.Group axis="y" values={filtered} onReorder={(next) => canDrag && setOrder(next)}>
            {filtered.map((h) => (
              <Row key={h.id} habit={h} draggable={canDrag} onDrop={() => reorder.mutate(order.map((x) => x.id))} />
            ))}
          </Reorder.Group>
        </div>
      )}
    </div>
  );
}

function Row({ habit: h, draggable, onDrop }: { habit: Habit; draggable: boolean; onDrop: () => void }) {
  const controls = useDragControls();
  const action = useHabitAction();
  const form = useHabitForm();
  const toast = useUI((s) => s.toast);
  const [confirm, setConfirm] = useState(false);
  const unit = h.stats.streakUnit === "weeks" ? "w" : "d";

  return (
    <Reorder.Item
      value={h}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="relative border-b border-rule bg-sheet last:border-b-0"
      whileDrag={{ boxShadow: "0 18px 40px -18px oklch(0.2 0.05 266 / 0.45)", zIndex: 10 }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_150px_120px_140px] md:gap-4">
        {draggable ? (
          <button onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none p-1 text-ink-3 hover:text-ink-2 active:cursor-grabbing" aria-label={`Reorder ${h.name}`}>
            <GripVertical size={18} />
          </button>
        ) : (
          <span className="w-0" />
        )}

        <Link to={`/habits/${h.id}`} className="flex min-w-0 items-center gap-3">
          <HabitIcon icon={h.icon} color={h.color} size={40} radius={10} />
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold hover:underline">{h.name}</span>
            <span className="block truncate text-[13.5px] text-ink-2">
              {scheduleLabel(h)}
              {h.targetCount > 1 && ` · ${h.targetCount} ${h.unit ?? "times"}`}
              {h.reminders.length > 0 && <span className="mono ml-2 text-ink-3">{h.reminders.map((r) => formatTime12(r.time)).join(", ")}</span>}
            </span>
          </span>
        </Link>

        <div className="col-start-2 flex items-baseline gap-2 md:col-start-auto">
          <span className="numeral text-[26px] font-bold">{h.stats.currentStreak}</span>
          <span className="text-[13px] text-ink-2">
            {h.kind === "QUIT" ? "days clean" : unit === "w" ? "weeks" : "days"} · best {h.stats.bestStreak}
          </span>
        </div>

        <div className="col-start-2 hidden md:col-start-auto md:block">
          <div className="mb-1 text-[13px] font-semibold">{Math.round(h.stats.completionRate * 100)}%</div>
          <Bar value={h.stats.completionRate} color={h.color} />
        </div>

        <div className="col-start-3 row-start-1 flex justify-end gap-0.5 md:col-start-auto md:row-start-auto">
          {!h.archived && (
            <button className="btn-quiet !p-2" onClick={() => form.show(h)} aria-label={`Edit ${h.name}`} title="Edit">
              <Pencil size={16} />
            </button>
          )}
          <button
            className="btn-quiet !p-2"
            title={h.archived ? "Restore" : "Archive"}
            aria-label={h.archived ? `Restore ${h.name}` : `Archive ${h.name}`}
            onClick={() => action.mutate({ id: h.id, action: "archive" }, { onSuccess: () => toast({ title: h.archived ? `${h.name} restored` : `${h.name} archived` }) })}
          >
            {h.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          <button className="btn-quiet !p-2 hover:!text-red" title="Delete" aria-label={`Delete ${h.name}`} onClick={() => setConfirm(true)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-red-soft px-5 py-3">
              <p className="text-[15px]">Delete {h.name} and all its history? Archiving keeps the history.</p>
              <div className="flex shrink-0 gap-2">
                <button className="btn-quiet !py-1.5" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
                <button className="btn !py-1.5 bg-red text-sheet" onClick={() => action.mutate({ id: h.id, action: "delete" })}>
                  Delete habit
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}
