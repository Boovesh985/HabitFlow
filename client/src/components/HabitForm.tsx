import { AnimatePresence, motion } from "framer-motion";
import { BellPlus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import clsx from "clsx";
import type { Habit, HabitInput, Reminder } from "../lib/types";
import { useHabits, useSaveHabit } from "../lib/hooks";
import { useUI } from "../lib/store";
import { WEEKDAYS_LETTER, WEEKDAYS_SHORT } from "../lib/dates";
import { NumberInput, Segmented, Sheet, Spinner } from "./ui";
import { HABIT_ICONS, HABIT_ICON_NAMES, HabitIcon } from "./HabitIcon";

export const ICONS = HABIT_ICON_NAMES;

/** Ink colors: they read like stamp pads and pens, and stay legible on both sheets. */
export const COLORS = [
  { hex: "#2f45d6", name: "Ballpoint" },
  { hex: "#d6402b", name: "Red pen" },
  { hex: "#2f7d55", name: "Ledger green" },
  { hex: "#0f7c86", name: "Teal" },
  { hex: "#b98a12", name: "Mustard" },
  { hex: "#d86a1f", name: "Marigold" },
  { hex: "#7a3fa8", name: "Stamp violet" },
  { hex: "#b8346a", name: "Rose" },
  { hex: "#5d6b1e", name: "Olive" },
  { hex: "#475066", name: "Graphite" },
];

const CATEGORIES = ["General", "Health", "Fitness", "Mind", "Learning", "Productivity", "Self-care", "Finance", "Social", "Creativity"];

type Template = HabitInput & { name: string };
const at = (time: string, daysOfWeek: number[] = []) => [{ time, daysOfWeek, enabled: true }];

/** Starter templates, grouped the way people actually plan their day. */
export const PACKS: { name: string; items: Template[] }[] = [
  {
    name: "Redemption arc",
    items: [
      { name: "Gym session", icon: "dumbbell", color: "#d6402b", category: "Fitness", frequencyType: "TIMES_PER_WEEK", timesPerWeek: 5, reminders: at("18:00") },
      { name: "Solve DSA problems", icon: "code", color: "#2f45d6", category: "Learning", targetCount: 3, unit: "problems", reminders: at("20:00") },
      { name: "Drink 3 litres", icon: "droplet", color: "#0f7c86", category: "Health", targetCount: 6, unit: "bottles", reminders: [...at("10:00"), ...at("14:00"), ...at("18:00")] },
      { name: "Morning skincare", icon: "sparkles", color: "#b8346a", category: "Self-care", reminders: at("07:30") },
      { name: "Night skincare", icon: "bath", color: "#7a3fa8", category: "Self-care", reminders: at("22:30") },
      { name: "Hit protein goal", icon: "utensils", color: "#d86a1f", category: "Health" },
      { name: "10k steps", icon: "footprints", color: "#2f7d55", category: "Fitness" },
      { name: "Sleep by 11", icon: "bed", color: "#475066", category: "Health", reminders: at("22:45") },
      { name: "No junk food", icon: "apple", color: "#5d6b1e", category: "Health", kind: "QUIT" },
      { name: "No doomscrolling", icon: "no-phone", color: "#2f45d6", category: "Mind", kind: "QUIT" },
    ],
  },
  {
    name: "Morning",
    items: [
      {
        name: "Wake up by 6:30",
        icon: "sun",
        color: "#d86a1f",
        category: "Health",
        reminders: at("06:30"),
      },
      {
        name: "Drink water",
        icon: "droplet",
        color: "#0f7c86",
        category: "Health",
        targetCount: 8,
        unit: "glasses",
        reminders: [...at("10:00"), ...at("15:00")],
      },
      {
        name: "Make the bed",
        icon: "bed",
        color: "#7a3fa8",
        category: "General",
      },
      {
        name: "Morning pages",
        icon: "pen",
        color: "#b8346a",
        category: "Mind",
        targetCount: 3,
        unit: "pages",
        reminders: at("07:00"),
      },
      {
        name: "Stretch 10 minutes",
        icon: "leaf",
        color: "#2f7d55",
        category: "Fitness",
        reminders: at("07:15"),
      },
    ],
  },
  {
    name: "Body",
    items: [
      {
        name: "Workout",
        icon: "dumbbell",
        color: "#d6402b",
        category: "Fitness",
        frequencyType: "TIMES_PER_WEEK",
        timesPerWeek: 4,
      },
      {
        name: "Walk 8k steps",
        icon: "footprints",
        color: "#2f7d55",
        category: "Fitness",
      },
      {
        name: "Cycle",
        icon: "bike",
        color: "#0f7c86",
        category: "Fitness",
        frequencyType: "TIMES_PER_WEEK",
        timesPerWeek: 3,
      },
      {
        name: "Swim",
        icon: "waves",
        color: "#2f45d6",
        category: "Fitness",
        frequencyType: "TIMES_PER_WEEK",
        timesPerWeek: 2,
      },
      {
        name: "Eat greens",
        icon: "salad",
        color: "#5d6b1e",
        category: "Health",
      },
      {
        name: "Take vitamins",
        icon: "pill",
        color: "#b98a12",
        category: "Health",
        reminders: at("09:00"),
      },
      {
        name: "Floss",
        icon: "brush",
        color: "#475066",
        category: "Health",
        reminders: at("22:15"),
      },
    ],
  },
  {
    name: "Mind",
    items: [
      {
        name: "Meditate",
        icon: "brain",
        color: "#7a3fa8",
        category: "Mind",
        reminders: at("07:30"),
      },
      {
        name: "Journal",
        icon: "pen",
        color: "#b8346a",
        category: "Mind",
        reminders: at("22:00"),
      },
      {
        name: "Three good things",
        icon: "heart",
        color: "#d6402b",
        category: "Mind",
        reminders: at("21:45"),
      },
      {
        name: "Call family",
        icon: "call",
        color: "#d86a1f",
        category: "Social",
        frequencyType: "WEEKLY_DAYS",
        daysOfWeek: [0],
      },
      {
        name: "Sleep by 11",
        icon: "moon",
        color: "#2f45d6",
        category: "Health",
        reminders: at("22:30"),
      },
    ],
  },
  {
    name: "Learn & work",
    items: [
      {
        name: "Read 20 pages",
        icon: "book",
        color: "#d86a1f",
        category: "Learning",
        reminders: at("21:30"),
      },
      {
        name: "Learn a language",
        icon: "languages",
        color: "#0f7c86",
        category: "Learning",
        targetCount: 15,
        unit: "minutes",
      },
      {
        name: "Code for an hour",
        icon: "code",
        color: "#2f45d6",
        category: "Learning",
      },
      {
        name: "Deep work blocks",
        icon: "timer",
        color: "#475066",
        category: "Productivity",
        targetCount: 2,
        unit: "blocks",
        frequencyType: "WEEKLY_DAYS",
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      {
        name: "Practice guitar",
        icon: "guitar",
        color: "#b8346a",
        category: "Creativity",
        frequencyType: "TIMES_PER_WEEK",
        timesPerWeek: 4,
      },
      {
        name: "Sketch",
        icon: "palette",
        color: "#7a3fa8",
        category: "Creativity",
        frequencyType: "TIMES_PER_WEEK",
        timesPerWeek: 3,
      },
    ],
  },
  {
    name: "Home & money",
    items: [
      {
        name: "Track spending",
        icon: "piggybank",
        color: "#2f7d55",
        category: "Finance",
        reminders: at("21:00"),
      },
      {
        name: "Tidy for 10 minutes",
        icon: "sparkles",
        color: "#b98a12",
        category: "General",
      },
      {
        name: "Water the plants",
        icon: "flower",
        color: "#5d6b1e",
        category: "General",
        frequencyType: "WEEKLY_DAYS",
        daysOfWeek: [1, 4],
      },
      {
        name: "Walk the dog",
        icon: "dog",
        color: "#d86a1f",
        category: "General",
        targetCount: 2,
        unit: "walks",
      },
      {
        name: "Cook at home",
        icon: "utensils",
        color: "#d6402b",
        category: "Health",
        frequencyType: "TIMES_PER_WEEK",
        timesPerWeek: 5,
      },
    ],
  },
  {
    name: "Quit",
    items: [
      {
        name: "No smoking",
        icon: "no-smoking",
        color: "#475066",
        category: "Health",
        kind: "QUIT",
      },
      {
        name: "No social media",
        icon: "no-phone",
        color: "#2f45d6",
        category: "Productivity",
        kind: "QUIT",
      },
      {
        name: "No alcohol",
        icon: "no-alcohol",
        color: "#b8346a",
        category: "Health",
        kind: "QUIT",
      },
    ],
  },
];

export const TEMPLATES: Template[] = PACKS.flatMap((p) => p.items);

const blank = (): Required<Omit<HabitInput, "startDate">> & {
  startDate?: string;
} => ({
  name: "",
  description: "",
  icon: "leaf",
  color: "#2f45d6",
  category: "General",
  kind: "BUILD",
  frequencyType: "DAILY",
  daysOfWeek: [1, 2, 3, 4, 5],
  timesPerWeek: 3,
  targetCount: 1,
  unit: "",
  stackAfterId: null,
  reminders: [],
});

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

export function HabitForm({ open, onClose, habit }: { open: boolean; onClose: () => void; habit?: Habit | null }) {
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  const [pickIcon, setPickIcon] = useState(false);
  const [pack, setPack] = useState(0);
  const save = useSaveHabit();
  const { data: habits = [] } = useHabits();
  const toast = useUI((s) => s.toast);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPickIcon(false);
    if (habit) {
      setF({
        name: habit.name,
        description: habit.description ?? "",
        icon: habit.icon,
        color: habit.color,
        category: habit.category,
        kind: habit.kind,
        frequencyType: habit.frequencyType,
        daysOfWeek: habit.daysOfWeek.length ? habit.daysOfWeek : [1, 2, 3, 4, 5],
        timesPerWeek: habit.timesPerWeek,
        targetCount: habit.targetCount,
        unit: habit.unit ?? "",
        stackAfterId: habit.stackAfterId,
        reminders: habit.reminders,
        startDate: habit.startDate,
      });
    } else setF(blank());
  }, [open, habit]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.name.trim()) return setErr("Give the habit a name.");
    if (f.frequencyType === "WEEKLY_DAYS" && !f.daysOfWeek.length) return setErr("Pick at least one day of the week.");
    try {
      await save.mutateAsync({
        id: habit?.id,
        data: {
          ...f,
          description: f.description || null,
          unit: f.unit || null,
          daysOfWeek: f.frequencyType === "WEEKLY_DAYS" ? f.daysOfWeek : [],
          targetCount: f.kind === "QUIT" ? 1 : f.targetCount,
          reminders: f.reminders.map(({ time, daysOfWeek, message, enabled }) => ({
            time,
            daysOfWeek,
            message: message || null,
            enabled,
          })),
        },
      });
      toast({
        title: habit ? "Habit saved" : `${f.name.trim()} added`,
        body: habit ? undefined : "It's on today's page.",
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const updateReminder = (i: number, patch: Partial<Reminder>) =>
    set(
      "reminders",
      f.reminders.map((r, j) => (j === i ? { ...r, ...patch } : r))
    );

  return (
    <Sheet open={open} onClose={onClose} title={habit ? "Edit habit" : "New habit"} wide>
      <form onSubmit={submit} className="space-y-5">
        {!habit && (
          <div>
            <p className="mb-2 text-[13px] text-ink-2">Start from a template, or write your own below.</p>
            <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-2" role="tablist" aria-label="Template packs">
              {PACKS.map((p, i) => (
                <button
                  type="button"
                  role="tab"
                  key={p.name}
                  aria-selected={pack === i}
                  onClick={() => setPack(i)}
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                    pack === i ? "bg-ink text-sheet" : "text-ink-2 hover:bg-well hover:text-ink"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pack}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap gap-2"
              >
                {PACKS[pack].items.map((t) => {
                  const on = f.name === t.name;
                  return (
                    <button
                      type="button"
                      key={t.name}
                      onClick={() =>
                        setF({
                          ...blank(),
                          ...t,
                          reminders: t.reminders ?? [],
                        } as typeof f)
                      }
                      aria-pressed={on}
                      className="flex shrink-0 items-center gap-2 rounded-[12px] border py-1.5 pr-3.5 pl-1.5 text-[14px] font-semibold whitespace-nowrap transition-colors"
                      style={{
                        borderColor: on ? t.color : "var(--rule-strong)",
                        background: on ? `color-mix(in oklch, ${t.color} 12%, var(--sheet))` : "var(--sheet)",
                      }}
                    >
                      <HabitIcon icon={t.icon ?? "leaf"} color={t.color ?? "#2f45d6"} size={30} radius={8} />
                      {t.name}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <Group title="What">
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
              <label className="field-label" htmlFor="hname">
                Name
              </label>
              <input id="hname" className="field" placeholder="Morning run" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {pickIcon && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
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
                          f.icon === ic && "bg-sheet text-ink ring-2 ring-ink"
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
                  style={{
                    background: c.hex,
                    boxShadow: f.color === c.hex ? `0 0 0 2px var(--sheet), 0 0 0 4px ${c.hex}` : undefined,
                  }}
                  aria-label={c.name}
                  aria-pressed={f.color === c.hex}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <Segmented
            id="kind"
            value={f.kind}
            onChange={(v) => set("kind", v)}
            options={[
              { value: "BUILD", label: "Do it" },
              { value: "QUIT", label: "Stop doing it" },
            ]}
          />
        </Group>

        {f.kind === "BUILD" && (
          <Group title="How often">
            <Segmented
              id="freq"
              value={f.frequencyType}
              onChange={(v) => set("frequencyType", v)}
              options={[
                { value: "DAILY", label: "Every day" },
                { value: "WEEKLY_DAYS", label: "Some days" },
                { value: "TIMES_PER_WEEK", label: "Times a week" },
              ]}
            />
            {f.frequencyType === "WEEKLY_DAYS" && (
              <div className="flex justify-between gap-1.5">
                <DayPicker value={f.daysOfWeek} onChange={(v) => set("daysOfWeek", v)} />
              </div>
            )}
            {f.frequencyType === "TIMES_PER_WEEK" && (
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    type="button"
                    key={n}
                    className="pill flex-1 justify-center"
                    aria-pressed={f.timesPerWeek === n}
                    onClick={() => set("timesPerWeek", n)}
                  >
                    {n}×
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <div>
                <label className="field-label" htmlFor="target">
                  Each day
                </label>
                <NumberInput id="target" min={1} max={1000} className="field" value={f.targetCount} onChange={(n) => set("targetCount", n)} />
              </div>
              <div>
                <label className="field-label" htmlFor="unit">
                  Unit
                </label>
                <input
                  id="unit"
                  className="field"
                  placeholder="times, glasses, pages"
                  value={f.unit ?? ""}
                  onChange={(e) => set("unit", e.target.value)}
                  maxLength={20}
                />
              </div>
            </div>
          </Group>
        )}

        <Group title="Reminders" hint={f.reminders.length ? `${f.reminders.length} set` : undefined}>
          {f.reminders.length === 0 && (
            <p className="text-[15px] text-ink-2">No reminders. Add one and we'll nudge you at that time, unless you've already done it.</p>
          )}
          <AnimatePresence initial={false}>
            {f.reminders.map((r, i) => (
              <motion.div
                key={i}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 rounded-[12px] border border-rule bg-well p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      className="field !w-[124px]"
                      value={r.time}
                      onChange={(e) => updateReminder(i, { time: e.target.value })}
                      required
                      aria-label="Reminder time"
                    />
                    <input
                      className="field"
                      placeholder="Message (optional)"
                      value={r.message ?? ""}
                      onChange={(e) => updateReminder(i, { message: e.target.value })}
                      maxLength={140}
                      aria-label="Reminder message"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "reminders",
                          f.reminders.filter((_, j) => j !== i)
                        )
                      }
                      className="btn-quiet !p-2 hover:!text-red"
                      aria-label="Remove reminder"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DayPicker small value={r.daysOfWeek} onChange={(v) => updateReminder(i, { daysOfWeek: v })} />
                    <span className="text-[13px] text-ink-3">
                      {r.daysOfWeek.length ? r.daysOfWeek.map((d) => WEEKDAYS_SHORT[d]).join(", ") : "Whenever the habit is due"}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            className="btn-line"
            onClick={() => set("reminders", [...f.reminders, { time: "09:00", daysOfWeek: [], enabled: true }])}
            disabled={f.reminders.length >= 10}
          >
            <BellPlus size={16} /> Add a reminder
          </button>
        </Group>

        <Group title="Details" hint="Optional">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="cat">
                Category
              </label>
              <select id="cat" className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="stack">
                Do it right after
              </label>
              <select id="stack" className="field" value={f.stackAfterId ?? ""} onChange={(e) => set("stackAfterId", e.target.value || null)}>
                <option value="">Nothing in particular</option>
                {habits
                  .filter((h) => h.id !== habit?.id)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="desc">
              Why it matters to you
            </label>
            <textarea
              id="desc"
              rows={2}
              className="field resize-none"
              placeholder="You'll see this on the habit's page on the days you need it."
              value={f.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              maxLength={500}
            />
          </div>
        </Group>

        {err && (
          <p className="rounded-[10px] bg-red-soft px-3.5 py-2.5 text-[15px] text-red" role="alert">
            {err}
          </p>
        )}

        <button type="submit" className="btn-pen w-full !py-3" disabled={save.isPending}>
          {save.isPending ? <Spinner className="!border-sheet/40 !border-t-sheet" /> : habit ? "Save changes" : "Add habit"}
        </button>
      </form>
    </Sheet>
  );
}

export function DayPicker({ value, onChange, small }: { value: number[]; onChange: (v: number[]) => void; small?: boolean; color?: string }) {
  return (
    <div className={clsx("flex", small ? "gap-1" : "w-full justify-between gap-1.5")} role="group" aria-label="Days of the week">
      {WEEKDAYS_LETTER.map((l, d) => {
        const on = value.includes(d);
        return (
          <button
            type="button"
            key={d}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            aria-pressed={on}
            aria-label={WEEKDAYS_SHORT[d]}
            className={clsx(
              "grid place-items-center rounded-full border font-semibold transition-colors",
              small ? "h-7 w-7 text-[12px]" : "h-10 w-10 text-[14px]",
              on ? "border-ink bg-ink text-sheet" : "border-rule-strong bg-sheet text-ink-2 hover:text-ink",
              !on && d === 0 && "text-red"
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
