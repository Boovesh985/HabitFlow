import { motion } from "framer-motion";
import { Brain, Dumbbell, HeartPulse, Shield, Sparkles, type LucideIcon } from "lucide-react";
import type { Overview } from "../lib/types";

/** Five attributes, each fed by the categories of the habits that train it. */
export const STATS: { key: string; name: string; icon: LucideIcon; color: string; categories: string[]; trains: string }[] = [
  { key: "str", name: "Strength", icon: Dumbbell, color: "oklch(0.64 0.21 27)", categories: ["Fitness"], trains: "Gym, steps, sport" },
  { key: "int", name: "Intellect", icon: Brain, color: "oklch(0.66 0.14 250)", categories: ["Learning", "Productivity"], trains: "DSA, courses, projects" },
  { key: "vit", name: "Vitality", icon: HeartPulse, color: "oklch(0.68 0.15 150)", categories: ["Health"], trains: "Water, food, sleep" },
  { key: "dis", name: "Discipline", icon: Shield, color: "oklch(0.76 0.15 70)", categories: ["Mind", "General", "Finance"], trains: "Routines, quitting, money" },
  { key: "pre", name: "Presence", icon: Sparkles, color: "oklch(0.68 0.16 330)", categories: ["Self-care", "Social", "Creativity"], trains: "Skincare, people, craft" },
];

/** Levels grow on a square curve: level n needs n² completions, so early levels come fast and later ones are earned. */
export function statLevel(done: number) {
  const level = Math.floor(Math.sqrt(done));
  const floor = level * level;
  const next = (level + 1) * (level + 1);
  return { level, progress: (done - floor) / (next - floor), toNext: next - done };
}

const SEGMENTS = 10;

export function CharacterSheet({ categories, compact, profile }: { categories: Overview["categories"]; compact?: boolean; profile?: Overview["profile"] }) {
  const done = new Map(categories.map((c) => [c.name, c.done]));
  // Project steps and course lessons are mental work: they train Intellect.
  const bonus: Record<string, number> = { int: (profile?.projectSteps ?? 0) + (profile?.courseUnits ?? 0) };
  return (
    <ul className="space-y-3.5">
      {STATS.map((s, i) => {
        const total = s.categories.reduce((a, c) => a + (done.get(c) ?? 0), 0) + (bonus[s.key] ?? 0);
        const { level, progress, toNext } = statLevel(total);
        const lit = Math.round(progress * SEGMENTS);
        return (
          <li key={s.key} className="grid grid-cols-[32px_1fr_auto] items-center gap-x-3 gap-y-1.5">
            <span className="row-span-2 grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: `color-mix(in oklch, ${s.color} 18%, var(--sheet))`, color: s.color }}>
              <s.icon size={17} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 truncate text-[14.5px] font-semibold">
              {s.name}
              {!compact && <span className="ml-2 text-[13px] font-normal text-ink-3">{s.trains}</span>}
            </span>
            <span className="text-[13px] text-ink-2">
              Lv <span className="numeral text-[22px] font-extrabold text-ink">{level}</span>
            </span>
            <span className="col-span-2 flex gap-[3px]" aria-label={`${s.name} level ${level}, ${toNext} completions to the next level`} role="img">
              {Array.from({ length: SEGMENTS }, (_, j) => (
                <motion.span
                  key={j}
                  className="h-2 flex-1 rounded-[2px]"
                  initial={{ opacity: 0.25, scaleY: 0.4 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ duration: 0.35, delay: 0.15 + i * 0.06 + j * 0.025, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: j < lit ? s.color : "var(--well)" }}
                />
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
