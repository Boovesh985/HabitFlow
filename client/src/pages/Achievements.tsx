import { motion } from "framer-motion";
import {
  Bird,
  CalendarCheck,
  Crown,
  Flame,
  Footprints,
  Hourglass,
  Layers,
  ListChecks,
  Medal,
  Moon,
  Rocket,
  Smile,
  Star,
  Sunrise,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
  Blocks,
  Building2,
  GraduationCap,
  PackageCheck,
} from "lucide-react";
import clsx from "clsx";
import { useAchievements, useProfile } from "../lib/hooks";
import { formatDay } from "../lib/dates";
import type { Achievement } from "../lib/types";
import { seeded } from "../components/Stamp";
import { Bar, Loading, PageTitle } from "../components/ui";

const TIER: Record<Achievement["tier"], { color: string; label: string }> = {
  bronze: { color: "oklch(0.52 0.11 55)", label: "Bronze" },
  silver: { color: "oklch(0.5 0.03 266)", label: "Silver" },
  gold: { color: "oklch(0.62 0.13 85)", label: "Gold" },
  legendary: { color: "var(--red)", label: "Legendary" },
};

const ICONS: Record<string, LucideIcon> = {
  first_step: Footprints,
  ten_done: Flame,
  hundred_done: Medal,
  thousand_done: Rocket,
  streak_3: Target,
  streak_7: CalendarCheck,
  streak_30: Trophy,
  streak_100: Crown,
  collector: Layers,
  perfect_day: Star,
  early_bird: Sunrise,
  night_owl: Moon,
  focus_first: Timer,
  focus_master: Hourglass,
  mood_week: Smile,
  task_slayer: ListChecks,
  breaking_free: Bird,
  first_brick: Blocks,
  shipped: PackageCheck,
  graduate: GraduationCap,
  builder: Building2,
};

/** A circular rubber-stamp seal with the title running around the rim. */
function Seal({ a, i }: { a: Achievement; i: number }) {
  const t = TIER[a.tier];
  const color = a.unlocked ? t.color : "var(--rule-strong)";
  const rotate = a.unlocked ? -16 + seeded(a.key) * 32 : 0;
  const id = `seal-${a.key}`;
  const Icon = ICONS[a.key] ?? Star;
  return (
    <motion.svg
      viewBox="0 0 120 120"
      className="h-auto w-[124px]"
      initial={a.unlocked ? { scale: 1.3, opacity: 0, rotate } : { opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate }}
      transition={{ duration: 0.45, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden
    >
      <defs>
        <path id={`${id}-top`} d="M 18 60 A 42 42 0 0 1 102 60" />
        <path id={`${id}-bot`} d="M 22 62 A 38 38 0 0 0 98 62" />
      </defs>
      <g filter={a.unlocked ? "url(#ink-rough)" : undefined}>
        <circle cx="60" cy="60" r="55" fill="none" stroke={color} strokeWidth={a.unlocked ? 3.5 : 1.5} strokeDasharray={a.unlocked ? undefined : "4 4"} />
        <circle cx="60" cy="60" r="33" fill="none" stroke={color} strokeWidth="1.5" />
      </g>
      <g filter={a.unlocked ? "url(#ink-soft)" : undefined}>
        <text fontSize="11.5" fontWeight="800" letterSpacing="1.4" fill={color} style={{ fontFamily: "var(--font-display)" }}>
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
            {a.title.toUpperCase()}
          </textPath>
        </text>
        <text fontSize="9" fontWeight="700" letterSpacing="2.2" fill={color} style={{ fontFamily: "var(--font-display)" }}>
          <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle">
            {t.label.toUpperCase()}
          </textPath>
        </text>
      </g>
      <Icon x={44} y={44} width={32} height={32} color={color} strokeWidth={2} />
    </motion.svg>
  );
}

export default function AchievementsPage() {
  const { data: list, isLoading } = useAchievements();
  const { data: p } = useProfile();
  const unlocked = list?.filter((a) => a.unlocked) ?? [];
  const locked = list?.filter((a) => !a.unlocked) ?? [];

  return (
    <div>
      <PageTitle
        sub={list ? `${unlocked.length} of ${list.length} stamps collected. Each one is worth 50 XP.` : undefined}
        aside={
          p && (
            <div className="w-full max-w-[280px] text-right sm:w-[260px]">
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-[15px] font-semibold text-ink-2">Level</span>
                <span className="numeral text-[44px] font-extrabold">{p.level}</span>
              </div>
              <Bar value={p.progress} className="mt-1" />
              <div className="mt-1.5 text-[13px] text-ink-2">
                {p.xp.toLocaleString()} XP · {p.nextLevelXp - p.xp} to go
              </div>
            </div>
          )
        }
      >
        Achievements
      </PageTitle>

      {isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-10">
          {unlocked.length > 0 && <SealGrid title="Collected" items={unlocked} />}
          {locked.length > 0 && <SealGrid title="Still to earn" items={locked} offset={unlocked.length} />}
          <p className="max-w-[62ch] text-[14px] text-ink-2">
            XP comes from what you actually do: 10 per completed check-in, 1 per minute of focus, 5 per mood logged, 5 per task finished. Every 25 completions also earns
            a streak freeze.
          </p>
        </div>
      )}
    </div>
  );
}

function SealGrid({ title, items, offset = 0 }: { title: string; items: Achievement[]; offset?: number }) {
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-bold">{title}</h2>
      <ul className="sheet grid grid-cols-2 gap-x-4 gap-y-6 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((a, i) => (
          <li key={a.key} className="flex flex-col items-center text-center">
            <Seal a={a} i={offset + i} />
            <div className={clsx("mt-2 text-[15px] font-semibold", !a.unlocked && "text-ink-2")}>{a.title}</div>
            <p className="mt-0.5 max-w-[22ch] text-[13px] leading-snug text-ink-2">{a.description}</p>
            {a.unlocked && a.unlockedAt && <div className="mono mt-1 text-ink-3">{formatDay(a.unlockedAt, { month: "short", day: "numeric", year: "numeric" })}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
