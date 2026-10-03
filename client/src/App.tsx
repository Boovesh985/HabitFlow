import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { App as CapApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { api, setUnauthorizedHandler, withDay } from "./lib/api";
import { localDay } from "./lib/dates";
import { useHabits, useProjects, useTasks } from "./lib/hooks";
import { registerServiceWorker, snoozeNative, syncNativeReminders } from "./lib/notifications";
import { isNative } from "./lib/platform";
import { useAuth, useUI } from "./lib/store";
import { applyTheme } from "./lib/theme";
import type { Habit } from "./lib/types";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { DeskBackground } from "./components/Desk";

const AuthPage = lazy(() => import("./pages/Auth"));
const TodayPage = lazy(() => import("./pages/Today"));
const HabitsPage = lazy(() => import("./pages/Habits"));
const HabitDetailPage = lazy(() => import("./pages/HabitDetail"));
const StatsPage = lazy(() => import("./pages/Stats"));
const TasksPage = lazy(() => import("./pages/Tasks"));
const ProjectsPage = lazy(() => import("./pages/Projects"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetail"));
const FocusPage = lazy(() => import("./pages/Focus"));
const AchievementsPage = lazy(() => import("./pages/Achievements"));
const SettingsPage = lazy(() => import("./pages/Settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});


function useThemeEffect() {
  const theme = useUI((s) => s.theme);
  const accent = useUI((s) => s.accent);
  const desk = useUI((s) => s.desk);
  useEffect(() => {
    applyTheme();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", applyTheme);
    return () => mq.removeEventListener("change", applyTheme);
  }, [theme, accent, desk]);
}

/** Side effects that only make sense while signed in. */
function SignedInEffects() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const today = useUI((s) => s.today);
  const { data: habits } = useHabits();
  const { data: tasks } = useTasks();
  const { data: projects } = useProjects();

  // Keep on-device alarms in sync with the latest habits / tasks (debounced).
  useEffect(() => {
    if (!isNative || !habits) return;
    const t = setTimeout(() => syncNativeReminders(habits, tasks ?? [], projects ?? []).catch((e) => console.warn("sync reminders failed", e)), 800);
    return () => clearTimeout(t);
  }, [habits, tasks, projects]);

  useEffect(() => {
    if (!isNative) return;
    const subs = [
      LocalNotifications.addListener("localNotificationActionPerformed", async ({ actionId, notification }) => {
        const extra = (notification.extra ?? {}) as { type?: string; habitId?: string; date?: string };
        if (extra.type === "habit" && extra.habitId) {
          if (actionId === "done") {
            const list = qc.getQueryData<Habit[]>(["habits", localDay(), false]);
            const h = list?.find((x) => x.id === extra.habitId);
            const body = h && h.targetCount > 1 ? { status: "DONE", delta: 1 } : { status: "DONE" };
            await api(withDay(`/habits/${extra.habitId}/checkins/${extra.date ?? localDay()}`, localDay()), { method: "PUT", body }).catch(() => {});
            qc.invalidateQueries();
            useUI.getState().toast({ kind: "success", icon: "✅", title: "Checked in from notification" });
          } else if (actionId === "snooze") {
            await snoozeNative(notification, 10);
          } else nav(`/habits/${extra.habitId}`);
        } else if (extra.type === "task") nav("/tasks");
        else if (extra.type === "project" && (extra as { projectId?: string }).projectId) nav(`/projects/${(extra as { projectId?: string }).projectId}`);
      }),
      CapApp.addListener("resume", () => {
        useUI.getState().setToday(localDay());
        qc.invalidateQueries();
      }),
      CapApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else CapApp.minimizeApp();
      }),
    ];
    return () => {
      subs.forEach((p) => p.then((s) => s.remove()));
    };
  }, [qc, nav]);

  // The service worker tells us when a notification action changed data.
  useEffect(() => {
    if (isNative || !navigator.serviceWorker) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "refresh") qc.invalidateQueries();
      if (e.data?.type === "navigate" && e.data.url) nav(e.data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [qc, nav]);

  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["overview"] });
  }, [today, qc]);

  return null;
}

function Routed() {
  const status = useAuth((s) => s.status);
  if (status === "loading") return <FullSpinner />;
  if (status === "guest")
    return (
      <Suspense fallback={<FullSpinner />}>
        <Routes>
          <Route path="*" element={<AuthPage />} />
        </Routes>
      </Suspense>
    );
  return (
    <>
      <SignedInEffects />
      <Suspense fallback={<FullSpinner />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TodayPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="habits/:id" element={<HabitDetailPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="focus" element={<FocusPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

function FullSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useThemeEffect();

  useEffect(() => {
    bootstrap();
    setUnauthorizedHandler(() => {
      queryClient.clear();
      useAuth.setState({ user: null, status: "guest" });
    });
    registerServiceWorker();
    // Roll "today" over at midnight without a reload.
    const id = setInterval(() => {
      const d = localDay();
      if (d !== useUI.getState().today) useUI.getState().setToday(d);
    }, 30_000);
    return () => clearInterval(id);
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <DeskBackground />
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
