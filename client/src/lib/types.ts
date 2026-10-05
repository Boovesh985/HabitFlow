export type Frequency = "DAILY" | "WEEKLY_DAYS" | "TIMES_PER_WEEK";
export type CheckInStatus = "DONE" | "SKIPPED" | "FROZEN" | "SLIP";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  timezone: string;
  createdAt: string;
}

export interface Reminder {
  id?: string;
  time: string;
  daysOfWeek: number[];
  message?: string | null;
  enabled: boolean;
}

export interface CheckIn {
  id: string;
  habitId: string;
  date: string;
  count: number;
  status: CheckInStatus;
  note: string | null;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  streakUnit: "days" | "weeks";
  completionRate: number;
  totalDone: number;
  dueToday: boolean;
  doneToday: boolean;
  todayCount: number;
  todayStatus: CheckInStatus | null;
  weekProgress: { done: number; target: number } | null;
}

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  category: string;
  kind: "BUILD" | "QUIT";
  frequencyType: Frequency;
  daysOfWeek: number[];
  timesPerWeek: number;
  targetCount: number;
  unit: string | null;
  startDate: string;
  sortOrder: number;
  stackAfterId: string | null;
  archived: boolean;
  reminders: Reminder[];
  todayNote: string | null;
  stats: HabitStats;
  recent: CheckIn[];
  history?: CheckIn[];
}

export type HabitInput = Partial<
  Pick<
    Habit,
    | "name"
    | "description"
    | "icon"
    | "color"
    | "category"
    | "kind"
    | "frequencyType"
    | "daysOfWeek"
    | "timesPerWeek"
    | "targetCount"
    | "unit"
    | "startDate"
    | "stackAfterId"
  >
> & { reminders?: Reminder[] };

export interface Profile {
  level: number;
  xp: number;
  levelFloor: number;
  nextLevelXp: number;
  progress: number;
  totalCheckIns: number;
  focusMinutes: number;
  focusSessions: number;
  moodEntries: number;
  tasksCompleted: number;
  achievements: number;
  streakFreezes: number;
  projectSteps: number;
  courseUnits: number;
  projectsDone: number;
  coursesDone: number;
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  unlocked?: boolean;
  unlockedAt?: string | null;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  priority: number;
  dueAt: string | null;
  remindAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type ProjectKind = "PROJECT" | "COURSE";

export interface ProjectStep {
  id: string;
  title: string;
  doneAt: string | null;
}

export interface Project {
  id: string;
  kind: ProjectKind;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  deadline: string | null;
  totalUnits: number | null;
  unitsDone: number;
  unitLabel: string | null;
  habitId: string | null;
  nudge: boolean;
  lastActivityAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  progress: number;
  stepsDone: number;
  steps: ProjectStep[];
  nextStep: string | null;
}

export interface Overview {
  today: string;
  profile: Profile;
  heatmap: { date: string; done: number; due: number }[];
  weekdays: { weekday: number; rate: number }[];
  categories: { name: string; done: number; habits: number }[];
  completion: { last7: number; prev7: number; last30: number };
  focusByDay: { date: string; minutes: number }[];
  leaderboard: {
    id: string;
    name: string;
    icon: string;
    color: string;
    kind: "BUILD" | "QUIT";
    currentStreak: number;
    bestStreak: number;
    streakUnit: "days" | "weeks";
    completionRate: number;
  }[];
}
