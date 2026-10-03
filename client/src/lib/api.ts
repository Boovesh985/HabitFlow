const TOKENS_KEY = "hf_tokens";

// Older versions let you type a server address; that's gone, so drop any saved one.
try {
  localStorage.removeItem("hf_server");
} catch {
  /* storage unavailable */
}

/**
 * Where the API lives. Empty = the same origin as the website (dev proxy or the all-in-one server).
 * The Android app gets it at build time from VITE_API_URL (set when the server is deployed).
 */
export function getServerUrl(): string {
  return (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const tokens = {
  get(): Tokens | null {
    try {
      return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "null");
    } catch {
      return null;
    }
  },
  set(t: Tokens | null) {
    if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKENS_KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  const t = tokens.get();
  if (!t) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${getServerUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: t.refreshToken }),
      });
      if (!res.ok) return false;
      tokens.set(await res.json());
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const doFetch = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const t = tokens.get();
    if (auth && t) headers.Authorization = `Bearer ${t.accessToken}`;
    return fetch(`${getServerUrl()}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (res.status === 401 && auth && tokens.get()) {
    if (await refresh()) res = await doFetch();
    else {
      tokens.set(null);
      onUnauthorized();
    }
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.details);
  return data as T;
}

/** Append the device's local date so the server knows what "today" is for the user. */
export const withDay = (path: string, day: string) => `${path}${path.includes("?") ? "&" : "?"}date=${day}`;
