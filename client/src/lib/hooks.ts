import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, withDay } from "./api";
import { useUI } from "./store";
import type { Achievement, CheckInStatus, Habit, HabitInput, Overview, Profile, Project, Task } from "./types";

export const qk = {
  habits: (day: string, archived = false) => ["habits", day, archived] as const,
  habit: (id: string, day: string) => ["habit", id, day] as const,
  overview: (day: string) => ["overview", day] as const,
  profile: ["profile"] as const,
  achievements: ["achievements"] as const,
  tasks: ["tasks"] as const,
  focus: ["focus"] as const,
  projects: ["projects"] as const,
};

export function useHabits(archived = false) {
  const day = useUI((s) => s.today);
  return useQuery({
    queryKey: qk.habits(day, archived),
    queryFn: () => api<{ habits: Habit[] }>(withDay(`/habits?archived=${archived}`, day)).then((r) => r.habits),
  });
}

export function useHabit(id: string | undefined) {
  const day = useUI((s) => s.today);
  return useQuery({
    queryKey: qk.habit(id ?? "", day),
    enabled: !!id,
    queryFn: () => api<{ habit: Habit }>(withDay(`/habits/${id}`, day)).then((r) => r.habit),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: () => api<{ profile: Profile }>("/stats/profile").then((r) => r.profile),
  });
}

export function useOverview() {
  const day = useUI((s) => s.today);
  return useQuery({
    queryKey: qk.overview(day),
    queryFn: () => api<Overview>(withDay("/stats/overview", day)),
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: qk.achievements,
    queryFn: () => api<{ achievements: Achievement[] }>("/stats/achievements").then((r) => r.achievements),
  });
}

interface CheckInResult {
  habit: Habit;
  newAchievements?: Achievement[];
  profile: Profile;
}

/** Applies a check-in optimistically so taps feel instant, then reconciles with the server. */
export function useCheckIn() {
  const qc = useQueryClient();
  const day = useUI((s) => s.today);
  const achievementToasts = useUI((s) => s.achievementToasts);

  return useMutation({
    mutationFn: (v: { habitId: string; date?: string; status?: CheckInStatus; delta?: number; count?: number; note?: string | null; remove?: boolean }) => {
      const date = v.date ?? day;
      if (v.remove) return api<CheckInResult>(withDay(`/habits/${v.habitId}/checkins/${date}`, day), { method: "DELETE" });
      return api<CheckInResult>(withDay(`/habits/${v.habitId}/checkins/${date}`, day), {
        method: "PUT",
        body: {
          status: v.status ?? "DONE",
          delta: v.delta,
          count: v.count,
          note: v.note,
        },
      });
    },
    onMutate: async (v) => {
      if ((v.date ?? day) !== day) return;
      const key = qk.habits(day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Habit[]>(key);
      qc.setQueryData<Habit[]>(key, (list) =>
        list?.map((h) => {
          if (h.id !== v.habitId) return h;
          let count = h.stats.todayCount;
          if (v.remove) count = 0;
          else if (v.delta !== undefined) count = Math.max(0, v.delta > 0 ? Math.min(Math.max(count, h.targetCount), count + v.delta) : count + v.delta);
          else if (v.count !== undefined) count = v.count;
          else if (v.status === "DONE" || !v.status) count = h.targetCount;
          const doneToday = !v.remove && (v.status ?? "DONE") === "DONE" && count >= h.targetCount;
          const streakBump = doneToday && !h.stats.doneToday ? 1 : !doneToday && h.stats.doneToday ? -1 : 0;
          return {
            ...h,
            stats: {
              ...h.stats,
              todayCount: count,
              doneToday,
              todayStatus: v.remove ? null : v.status ?? "DONE",
              currentStreak: Math.max(0, h.stats.currentStreak + (h.kind === "BUILD" && h.frequencyType !== "TIMES_PER_WEEK" ? streakBump : 0)),
            },
          };
        })
      );
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
      useUI.getState().toast({
        kind: "error",
        title: "Couldn't save check-in",
        body: (err as Error).message,
      });
    },
    onSuccess: (r) => {
      qc.setQueryData<Habit[]>(qk.habits(day), (list) => list?.map((h) => (h.id === r.habit.id ? r.habit : h)));
      if (r.profile) qc.setQueryData(qk.profile, r.profile);
      achievementToasts(r.newAchievements);
      if (r.newAchievements?.length) qc.invalidateQueries({ queryKey: qk.achievements });
    },
    onSettled: (_r, _e, v) => {
      qc.invalidateQueries({ queryKey: ["habit", v.habitId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useSaveHabit() {
  const qc = useQueryClient();
  const day = useUI((s) => s.today);
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: HabitInput }) =>
      id
        ? api<{ habit: Habit }>(withDay(`/habits/${id}`, day), {
            method: "PATCH",
            body: data,
          })
        : api<{ habit: Habit; newAchievements?: Achievement[] }>(withDay("/habits", day), { method: "POST", body: data }),
    onSuccess: (r) => {
      useUI.getState().achievementToasts((r as { newAchievements?: Achievement[] }).newAchievements);
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habit"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useHabitAction() {
  const qc = useQueryClient();
  const day = useUI((s) => s.today);
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "archive" | "delete" }) =>
      action === "delete" ? api(`/habits/${id}`, { method: "DELETE" }) : api(withDay(`/habits/${id}/archive`, day), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useReorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api("/habits/reorder", { method: "POST", body: { ids } }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });
}

export function useTasks() {
  return useQuery({
    queryKey: qk.tasks,
    queryFn: () => api<{ tasks: Task[] }>("/tasks").then((r) => r.tasks),
  });
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: qk.tasks });
  const create = useMutation({
    mutationFn: (t: Partial<Task>) => api<{ task: Task }>("/tasks", { method: "POST", body: t }),
    onSuccess: done,
  });
  const update = useMutation({
    mutationFn: ({ id, ...t }: Partial<Task> & { id: string; completed?: boolean }) =>
      api<{ task: Task; newAchievements?: Achievement[]; profile?: Profile }>(`/tasks/${id}`, { method: "PATCH", body: t }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: qk.tasks });
      const prev = qc.getQueryData<Task[]>(qk.tasks);
      if (v.completed !== undefined)
        qc.setQueryData<Task[]>(qk.tasks, (l) =>
          l?.map((t) =>
            t.id === v.id
              ? {
                  ...t,
                  completedAt: v.completed ? new Date().toISOString() : null,
                }
              : t
          )
        );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.tasks, ctx.prev),
    onSuccess: (r) => {
      useUI.getState().achievementToasts(r.newAchievements);
      if (r.profile) qc.setQueryData(qk.profile, r.profile);
    },
    onSettled: done,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: done,
  });
  return { create, update, remove };
}

export interface FocusSessionRow {
  id: string;
  habitId: string | null;
  durationSec: number;
  startedAt: string;
  habit: { name: string; icon: string; color: string } | null;
}

export function useFocusSessions() {
  return useQuery({
    queryKey: qk.focus,
    queryFn: () => api<{ sessions: FocusSessionRow[] }>("/focus").then((r) => r.sessions),
  });
}

export function useLogFocus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { habitId?: string | null; durationSec: number }) =>
      api<{ newAchievements?: Achievement[]; profile: Profile }>("/focus", {
        method: "POST",
        body: b,
      }),
    onSuccess: (r) => {
      useUI.getState().achievementToasts(r.newAchievements);
      qc.setQueryData(qk.profile, r.profile);
      qc.invalidateQueries({ queryKey: qk.focus });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

/* ---------- projects ---------- */

export function useProjects() {
  return useQuery({
    queryKey: qk.projects,
    queryFn: () => api<{ projects: Project[] }>("/projects").then((r) => r.projects),
  });
}

export type ProjectInput = Partial<Omit<Project, "id" | "steps" | "progress" | "stepsDone" | "nextStep">> & { steps?: string[] };

interface ProjectResult {
  project: Project;
  newAchievements?: Achievement[];
  profile?: Profile;
}

/** Every project mutation returns the fresh project; patch it into the list so the UI never flickers. */
export function useProjectMutations() {
  const qc = useQueryClient();
  const put = (r: ProjectResult) => {
    qc.setQueryData<Project[]>(qk.projects, (l) => (l?.some((p) => p.id === r.project.id) ? l.map((p) => (p.id === r.project.id ? r.project : p)) : [r.project, ...(l ?? [])]));
    if (r.profile) qc.setQueryData(qk.profile, r.profile);
    useUI.getState().achievementToasts(r.newAchievements);
    if (r.newAchievements?.length) qc.invalidateQueries({ queryKey: qk.achievements });
    if (r.profile) qc.invalidateQueries({ queryKey: ["overview"] });
  };
  const fail = (e: Error) => {
    qc.invalidateQueries({ queryKey: qk.projects });
    useUI.getState().toast({ kind: "error", title: "Couldn't save", body: e.message });
  };
  // Optimistically edit one project in the cached list.
  const patchLocal = async (id: string, fn: (p: Project) => Project) => {
    await qc.cancelQueries({ queryKey: qk.projects });
    qc.setQueryData<Project[]>(qk.projects, (l) => l?.map((p) => (p.id === id ? fn(p) : p)));
  };

  const create = useMutation({
    mutationFn: (data: ProjectInput) => api<ProjectResult>("/projects", { method: "POST", body: data }),
    onSuccess: put,
    onError: fail,
  });
  const update = useMutation({
    mutationFn: ({ id, ...data }: ProjectInput & { id: string; completed?: boolean; archived?: boolean }) =>
      api<ProjectResult>(`/projects/${id}`, { method: "PATCH", body: data }),
    onSuccess: put,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: (_r, id) => qc.setQueryData<Project[]>(qk.projects, (l) => l?.filter((p) => p.id !== id)),
    onError: fail,
  });
  const addSteps = useMutation({
    mutationFn: ({ id, titles }: { id: string; titles: string[] }) => api<ProjectResult>(`/projects/${id}/steps`, { method: "POST", body: { titles } }),
    onSuccess: put,
    onError: fail,
  });
  const toggleStep = useMutation({
    mutationFn: ({ id, stepId, done }: { id: string; stepId: string; done: boolean }) =>
      api<ProjectResult>(`/projects/${id}/steps/${stepId}`, { method: "PATCH", body: { done } }),
    onMutate: ({ id, stepId, done }) =>
      patchLocal(id, (p) => {
        const steps = p.steps.map((s) => (s.id === stepId ? { ...s, doneAt: done ? new Date().toISOString() : null } : s));
        const stepsDone = steps.filter((s) => s.doneAt).length;
        const byUnits = p.kind === "COURSE" && !!p.totalUnits;
        return { ...p, steps, stepsDone, progress: byUnits ? p.progress : steps.length ? stepsDone / steps.length : 0, nextStep: steps.find((s) => !s.doneAt)?.title ?? null };
      }),
    onSuccess: put,
    onError: fail,
  });
  const renameStep = useMutation({
    mutationFn: ({ id, stepId, title }: { id: string; stepId: string; title: string }) =>
      api<ProjectResult>(`/projects/${id}/steps/${stepId}`, { method: "PATCH", body: { title } }),
    onSuccess: put,
    onError: fail,
  });
  const removeStep = useMutation({
    mutationFn: ({ id, stepId }: { id: string; stepId: string }) => api<ProjectResult>(`/projects/${id}/steps/${stepId}`, { method: "DELETE" }),
    onMutate: ({ id, stepId }) => patchLocal(id, (p) => ({ ...p, steps: p.steps.filter((s) => s.id !== stepId) })),
    onSuccess: put,
    onError: fail,
  });
  const reorderSteps = useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) => api<ProjectResult>(`/projects/${id}/steps/reorder`, { method: "POST", body: { ids } }),
    onMutate: ({ id, ids }) =>
      patchLocal(id, (p) => {
        const byId = new Map(p.steps.map((s) => [s.id, s]));
        return { ...p, steps: ids.map((x) => byId.get(x)!).filter(Boolean) };
      }),
    onSuccess: put,
    onError: fail,
  });
  const units = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => api<ProjectResult>(`/projects/${id}/units`, { method: "POST", body: { delta } }),
    onMutate: ({ id, delta }) =>
      patchLocal(id, (p) => {
        const unitsDone = Math.max(0, Math.min(p.totalUnits ?? Infinity, p.unitsDone + delta));
        return { ...p, unitsDone, progress: p.totalUnits ? unitsDone / p.totalUnits : p.progress };
      }),
    onSuccess: put,
    onError: fail,
  });
  return { create, update, remove, addSteps, toggleStep, renameStep, removeStep, reorderSteps, units };
}
