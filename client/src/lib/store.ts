import { create } from "zustand";
import { api, tokens } from "./api";
import { APP_TIMEZONE, localDay } from "./dates";
import type { Achievement, User } from "./types";
import { DEFAULT_DESK, DESKS } from "./desks";

type AuthStatus = "loading" | "authed" | "guest";

interface AuthState {
  user: User | null;
  status: AuthStatus;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/** Retry timer for loading the profile when the server couldn't be reached at start-up. */
let profileRetry: ReturnType<typeof setTimeout> | undefined;
let profileRetryDelay = 3000;

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: "loading",
  async bootstrap() {
    clearTimeout(profileRetry);
    if (!tokens.get()) return set({ status: "guest" });
    try {
      const { user } = await api<{ user: User }>("/auth/me");
      profileRetryDelay = 3000;
      set({ user, status: "authed" });
      // The app runs on India Standard Time; pin the account to it so reminders and streak days use IST.
      const tz = APP_TIMEZONE;
      if (user.timezone !== tz) {
        api<{ user: User }>("/users/me", {
          method: "PATCH",
          body: { timezone: tz },
        })
          .then((r) => set({ user: r.user }))
          .catch(() => {});
      }
    } catch (e) {
      // Offline with a token: stay signed in optimistically; requests will retry.
      // But if the server answered (account gone, session revoked), sign out for real.
      const status = (e as { status?: number }).status ?? 0;
      if (status === 401 || status === 403 || status === 404) {
        tokens.set(null);
        return set({ user: null, status: "guest" });
      }
      if (!tokens.get()) return set({ status: "guest" });
      set({ status: "authed" });
      // The server may be waking up or the phone offline: keep trying until the profile loads,
      // otherwise the name and avatar stay blank for the whole session.
      profileRetry = setTimeout(() => {
        if (!get().user) get().bootstrap();
      }, profileRetryDelay);
      profileRetryDelay = Math.min(profileRetryDelay * 2, 60_000);
    }
  },
  async login(email, password) {
    const r = await api<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    tokens.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    clearTimeout(profileRetry);
    set({ user: r.user, status: "authed" });
  },
  async register(name, email, password) {
    const r = await api<AuthResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password, timezone: APP_TIMEZONE },
      auth: false,
    });
    tokens.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    set({ user: r.user, status: "authed" });
  },
  async logout() {
    const t = tokens.get();
    if (t)
      api("/auth/logout", {
        method: "POST",
        body: { refreshToken: t.refreshToken },
        auth: false,
      }).catch(() => {});
    tokens.set(null);
    clearTimeout(profileRetry);
    set({ user: null, status: "guest" });
  },
  setUser: (user) => set({ user }),
}));

export type ThemeMode = "dark" | "light" | "system";

/** Ink colors for the brand pen. "desk" uses the current desk's own pen. */
export const INKS = [
  {
    key: "desk",
    name: "Match the desk",
    light: "var(--pen)",
    dark: "var(--pen)",
  },
  {
    key: "blue",
    name: "Ballpoint blue",
    light: "oklch(0.49 0.21 266)",
    dark: "oklch(0.72 0.15 266)",
  },
  {
    key: "black",
    name: "Fountain black",
    light: "oklch(0.3 0.06 250)",
    dark: "oklch(0.86 0.03 250)",
  },
  {
    key: "green",
    name: "Ledger green",
    light: "oklch(0.47 0.12 160)",
    dark: "oklch(0.74 0.12 160)",
  },
  {
    key: "violet",
    name: "Stamp-pad violet",
    light: "oklch(0.45 0.19 300)",
    dark: "oklch(0.72 0.14 300)",
  },
  {
    key: "red",
    name: "Red pen",
    light: "oklch(0.52 0.19 28)",
    dark: "oklch(0.72 0.15 28)",
  },
] as const;

export interface Toast {
  id: number;
  title: string;
  body?: string;
  icon?: string;
  kind?: "info" | "success" | "error" | "achievement";
}

interface UIState {
  today: string;
  theme: ThemeMode;
  accent: string;
  desk: string;
  sounds: boolean;
  toasts: Toast[];
  setToday: (d: string) => void;
  setTheme: (t: ThemeMode) => void;
  setAccent: (c: string) => void;
  setDesk: (d: string) => void;
  setSounds: (s: boolean) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  achievementToasts: (list: Achievement[] | undefined) => void;
}

const read = (k: string, fallback: string) => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

let toastId = 1;

export const useUI = create<UIState>((set, get) => ({
  today: localDay(),
  theme: read("hf_theme", "system") as ThemeMode,
  accent: INKS.some((i) => i.key === read("hf_pen", "")) ? read("hf_pen", "desk") : "desk",
  desk: DESKS.some((d) => d.key === read("hf_desk", "")) ? read("hf_desk", DEFAULT_DESK) : DEFAULT_DESK,
  sounds: read("hf_sounds", "true") === "true",
  toasts: [],
  setToday: (today) => set({ today }),
  setTheme: (theme) => {
    write("hf_theme", theme);
    set({ theme });
  },
  setAccent: (accent) => {
    write("hf_pen", accent);
    set({ accent });
  },
  setDesk: (desk) => {
    write("hf_desk", desk);
    set({ desk });
  },
  setSounds: (sounds) => {
    write("hf_sounds", String(sounds));
    set({ sounds });
  },
  toast: (t) => {
    const id = toastId++;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.kind === "achievement" ? 5000 : 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  achievementToasts: (list) => {
    list?.forEach((a, i) =>
      setTimeout(
        () =>
          get().toast({
            kind: "achievement",
            icon: a.icon,
            title: `Achievement unlocked: ${a.title}`,
            body: a.description,
          }),
        i * 600
      )
    );
  },
}));
