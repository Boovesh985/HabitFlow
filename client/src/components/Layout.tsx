import { AnimatePresence, motion } from "framer-motion";
import { Award, BarChart3, FolderKanban, CalendarDays, ListTodo, LogOut, Plus, Settings, Timer, Rows3 } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import clsx from "clsx";
import { APP_TIMEZONE } from "../lib/dates";
import { useAuth } from "../lib/store";
import { useProfile } from "../lib/hooks";
import type { Habit } from "../lib/types";
import { HabitForm } from "./HabitForm";
import { ProjectForm, useProjectForm } from "./ProjectForm";
import { InkDefs } from "./Stamp";
import { Loading, MenuItem, Monogram, Popover, Toasts } from "./ui";

export const useHabitForm = create<{
  open: boolean;
  habit: Habit | null;
  show: (h?: Habit | null) => void;
  close: () => void;
}>((set) => ({
  open: false,
  habit: null,
  show: (habit = null) => set({ open: true, habit }),
  close: () => set({ open: false }),
}));

const NAV = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/habits", label: "Habits", icon: Rows3 },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/stats", label: "Insights", icon: BarChart3 },
];

/** Wordmark: a small date-stamp mark and the name set in the calendar face. */
export function Wordmark({ compact, nameFromSm }: { compact?: boolean; nameFromSm?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden>
        <circle cx="30" cy="30" r="17" fill="var(--d3)" opacity="0.9" />
        <g filter="url(#ink-soft)">
          <circle cx="22" cy="22" r="19" fill="var(--pen)" />
          <path d="M13.5 22.5l5.5 5.5L31 16" fill="none" stroke="var(--sheet)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      {!compact && <span className={clsx("numeral text-[26px] font-extrabold tracking-[0.01em]", nameFromSm && "hidden sm:inline")}>HabitFlow</span>}
    </span>
  );
}

function AccountMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { data: p } = useProfile();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-rule-strong bg-sheet py-1 pr-3 pl-1 transition-colors hover:bg-well"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
      >
        <Monogram name={user?.name ?? ""} />
        {p && (
          <span className="text-sm font-semibold whitespace-nowrap">
            Lv <span className="numeral text-[17px]">{p.level}</span>
          </span>
        )}
      </button>
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)} width={230}>
        <div className="border-b border-rule px-3 pt-2 pb-2.5">
          <div className="truncate text-[15px] font-semibold">{user?.name}</div>
          {p && (
            <>
              <div className="mt-0.5 text-sm text-ink-2">
                {p.xp.toLocaleString()} XP · {p.nextLevelXp - p.xp} to level {p.level + 1}
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-well">
                <div className="h-full rounded-full bg-pen" style={{ width: `${p.progress * 100}%` }} />
              </div>
            </>
          )}
        </div>
        <div className="pt-1">
          <MenuItem icon={<Award size={16} />} onClick={() => (setOpen(false), nav("/achievements"))}>
            Achievements
          </MenuItem>
          <MenuItem icon={<Settings size={16} />} onClick={() => (setOpen(false), nav("/settings"))}>
            Settings
          </MenuItem>
          <MenuItem
            icon={<LogOut size={16} />}
            onClick={() => {
              qc.clear();
              logout();
            }}
          >
            Sign out
          </MenuItem>
        </div>
      </Popover>
    </>
  );
}

/** The add/edit sheets subscribe to their own stores, so opening one doesn't re-render the page under it. */
function FormHosts() {
  const form = useHabitForm();
  const pform = useProjectForm();
  return (
    <>
      <HabitForm open={form.open} habit={form.habit} onClose={form.close} />
      <ProjectForm open={pform.open} project={pform.project} kind={pform.kind} onClose={pform.close} />
    </>
  );
}

export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  const showForm = useHabitForm((s) => s.show);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <InkDefs />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sheet"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-[color-mix(in_oklch,var(--ink)_12%,transparent)] bg-ground/88 backdrop-blur-[8px] safe-top">
        <div className="mx-auto flex h-[60px] max-w-[1180px] items-center gap-6 px-4 sm:px-6">
          <NavLink to="/" aria-label="HabitFlow, today">
            <Wordmark nameFromSm />
          </NavLink>
          <nav className="hidden h-full items-stretch gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  clsx(
                    "relative isolate flex items-center px-3 text-[15px] font-semibold transition-colors",
                    isActive ? "text-ink" : "text-ink-2 hover:text-ink"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-1.5 top-1/2 -z-10 h-[15px] -skew-x-12 rounded-[3px] bg-hl"
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                    {n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <LiveClock />
            <button onClick={() => showForm()} className="btn-pen !px-3 sm:!px-4" aria-label="New habit">
              <Plus size={18} strokeWidth={2.5} />
              <span className="hidden whitespace-nowrap sm:inline lg:hidden xl:inline">New habit</span>
            </button>
            <AccountMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1180px] px-4 pt-6 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-6 lg:pt-10 lg:pb-16">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<Loading />}>{outlet}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-sheet safe-bottom lg:hidden" aria-label="Main">
        <div className="mx-auto flex max-w-[600px] items-stretch justify-around">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                clsx(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-2 text-[11.5px] font-semibold",
                  isActive ? "text-ink" : "text-ink-3"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative grid h-8 w-12 place-items-center">
                    {isActive && (
                      <motion.span
                        layoutId="tab-mark"
                        className="absolute inset-0 rounded-full bg-hl"
                        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}
                    <n.icon size={21} strokeWidth={isActive ? 2.4 : 1.9} className="relative" />
                  </span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <Toasts />
      <FormHosts />
    </div>
  );
}

const clockFormat = new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

/** Live India Standard Time clock for the top bar. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="numeral flex items-baseline gap-1 text-[14px] font-semibold whitespace-nowrap tabular-nums text-ink sm:text-[17px]" aria-label="Current time in India">
      {clockFormat.format(now).toUpperCase()}
      <span className="text-[11px] font-bold tracking-wide text-ink-3">IST</span>
    </time>
  );
}
