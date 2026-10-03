import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { api, getServerUrl } from "./api";
import { addDays, localDay, parseDay } from "./dates";
import { isNative } from "./platform";
import type { Habit, Task, Project } from "./types";

/* ------------------------------------------------------------------ */
/* Web: service worker + Web Push (server sends the reminders)         */
/* ------------------------------------------------------------------ */

export async function registerServiceWorker() {
  if (isNative || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    // Tell the SW where the API lives so notification actions can reach it.
    const send = () =>
      reg.active?.postMessage({
        type: "config",
        apiBase: getServerUrl() || location.origin,
      });
    if (reg.active) send();
    navigator.serviceWorker.ready.then(send);
    return reg;
  } catch (err) {
    console.warn("Service worker registration failed", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type NotifyStatus = "granted" | "denied" | "default" | "unsupported";

export async function notificationStatus(): Promise<NotifyStatus> {
  if (isNative) {
    const p = await LocalNotifications.checkPermissions();
    return p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "default";
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission;
}

export async function enableNotifications(): Promise<NotifyStatus> {
  if (isNative) {
    const p = await LocalNotifications.requestPermissions();
    if (p.display !== "granted") return "denied";
    await setupNativeChannels();
    return "granted";
  }
  const status = await notificationStatus();
  if (status === "unsupported") return status;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm;
  const { vapidPublicKey } = await api<{ vapidPublicKey: string | null }>("/auth/config", { auth: false });
  if (!vapidPublicKey) throw new Error("This server has no push keys configured");
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) throw new Error("Service worker unavailable");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  await api("/push/subscribe", { method: "POST", body: sub.toJSON() });
  return "granted";
}

export async function disableWebPush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/push/unsubscribe", {
      method: "POST",
      body: { endpoint: sub.endpoint },
    }).catch(() => {});
    await sub.unsubscribe();
  }
}

export async function sendTestNotification() {
  if (isNative) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999_999,
          title: "🎉 Notifications are working",
          body: "You'll get reminders exactly when you set them.",
          channelId: "reminders",
          schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
        },
      ],
    });
    return 1;
  }
  const r = await api<{ sent: number }>("/push/test", { method: "POST" });
  return r.sent;
}

/* ------------------------------------------------------------------ */
/* Android: exact local alarms scheduled on-device (works offline)     */
/* ------------------------------------------------------------------ */

const HORIZON_DAYS = 21;
const MAX_PENDING = 450; // stay below Android's ~500 alarm limit

async function setupNativeChannels() {
  await LocalNotifications.createChannel({
    id: "reminders",
    name: "Habit reminders",
    description: "Reminders for your habits",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: "#8b5cf6",
  }).catch(() => {});
  await LocalNotifications.createChannel({
    id: "tasks",
    name: "Task reminders",
    description: "Reminders for your tasks",
    importance: 5,
    vibration: true,
  }).catch(() => {});
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: "HABIT",
        actions: [
          { id: "done", title: "✅ Done" },
          { id: "snooze", title: "⏰ 10 min" },
        ],
      },
    ],
  });
}

/** Stable 31-bit id from a string, so rescheduling replaces rather than duplicates. */
function nid(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

function reminderDays(h: Habit, rDays: number[]) {
  if (rDays.length) return rDays;
  if (h.frequencyType === "WEEKLY_DAYS" && h.daysOfWeek.length) return h.daysOfWeek;
  return [0, 1, 2, 3, 4, 5, 6];
}

/**
 * Rebuild every pending reminder on the device. Called whenever habits or tasks change and when
 * the app resumes. Today's reminder is skipped for habits already completed today.
 */
export async function syncNativeReminders(habits: Habit[], tasks: Task[] = [], projects: Project[] = []) {
  if (!isNative) return;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return;
  await setupNativeChannels();

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length)
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });

  const now = Date.now();
  const today = localDay();
  const out: LocalNotificationSchema[] = [];
  const todayDow = parseDay(today).getDay();
  const nextMonday = addDays(today, todayDow === 0 ? 1 : 8 - todayDow);

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = addDays(today, i);
    const dow = parseDay(day).getDay();
    for (const h of habits) {
      if (h.archived || day < h.startDate) continue;
      if (i === 0 && h.kind === "BUILD" && (h.stats.doneToday || h.stats.todayStatus === "SKIPPED")) continue;
      // A weekly target that's already met needs no more reminders until next week (weeks start on Monday).
      if (h.stats.weekProgress && h.stats.weekProgress.done >= h.stats.weekProgress.target && day < nextMonday) continue;
      for (const r of h.reminders) {
        if (!r.enabled || !reminderDays(h, r.daysOfWeek).includes(dow)) continue;
        const [hh, mm] = r.time.split(":").map(Number);
        const at = parseDay(day);
        at.setHours(hh, mm, 0, 0);
        if (at.getTime() <= now) continue;
        const streak = h.stats.currentStreak;
        out.push({
          id: nid(`${h.id}|${r.time}|${day}`),
          title: h.name,
          body:
            r.message ||
            (h.kind === "QUIT"
              ? `${streak} days clean. Keep it going.`
              : streak > 0
              ? `Keep your ${streak}-${h.stats.streakUnit === "weeks" ? "week" : "day"} streak alive.`
              : "Show up today. That's the whole job."),
          channelId: "reminders",
          actionTypeId: h.kind === "BUILD" ? "HABIT" : undefined,
          extra: { type: "habit", habitId: h.id, date: day },
          schedule: { at, allowWhileIdle: true },
          smallIcon: "ic_stat_habitflow",
          iconColor: h.color,
        });
      }
    }
  }

  for (const t of tasks) {
    if (t.completedAt || !t.remindAt) continue;
    const at = new Date(t.remindAt);
    if (at.getTime() <= now) continue;
    out.push({
      id: nid(`task|${t.id}`),
      title: t.title,
      body: t.notes || "Reminder for your task",
      channelId: "tasks",
      extra: { type: "task", taskId: t.id },
      schedule: { at, allowWhileIdle: true },
      smallIcon: "ic_stat_habitflow",
    });
  }

  // Project deadlines: 3 days, 1 day and 3 hours before, then at the deadline. Plus a nudge a week after the last progress.
  for (const p of projects) {
    if (p.completedAt || p.archivedAt) continue;
    const next = p.steps.find((s) => !s.doneAt)?.title;
    const line = p.kind === "COURSE" && p.totalUnits ? `${p.unitsDone} of ${p.totalUnits} ${p.unitLabel || "lessons"} done.` : next ? `Next: ${next}` : "Open it and add the next step.";
    if (p.deadline) {
      const due = new Date(p.deadline).getTime();
      for (const [before, title] of [
        [72 * 3600_000, "3 days left"],
        [24 * 3600_000, "Due tomorrow"],
        [3 * 3600_000, "Due in 3 hours"],
        [0, "Due now"],
      ] as const) {
        const at = new Date(due - before);
        if (at.getTime() <= now) continue;
        out.push({
          id: nid(`project|${p.id}|${before}|${p.deadline}`),
          title: `${title}: ${p.title}`,
          body: before === 0 ? "Mark it complete, or open it and move the deadline." : line,
          channelId: "tasks",
          extra: { type: "project", projectId: p.id },
          schedule: { at, allowWhileIdle: true },
          smallIcon: "ic_stat_habitflow",
          iconColor: p.color,
        });
      }
    }
    if (p.nudge) {
      const at = new Date(new Date(p.lastActivityAt).getTime() + 7 * 86_400_000);
      at.setHours(19, 0, 0, 0);
      if (at.getTime() > now)
        out.push({
          id: nid(`project-nudge|${p.id}|${p.lastActivityAt}`),
          title: `${p.title} has been quiet for a week`,
          body: line,
          channelId: "tasks",
          extra: { type: "project", projectId: p.id },
          schedule: { at, allowWhileIdle: true },
          smallIcon: "ic_stat_habitflow",
          iconColor: p.color,
        });
    }
  }

  out.sort((a, b) => a.schedule!.at!.getTime() - b.schedule!.at!.getTime());
  const batch = out.slice(0, MAX_PENDING);
  if (batch.length) await LocalNotifications.schedule({ notifications: batch });
}

export async function snoozeNative(n: { title?: string; body?: string; extra?: unknown }, minutes = 10) {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: nid(`snooze|${Date.now()}`),
        title: `⏰ ${n.title ?? "Reminder"}`,
        body: n.body ?? "Snooze is over!",
        channelId: "reminders",
        actionTypeId: "HABIT",
        extra: n.extra,
        schedule: {
          at: new Date(Date.now() + minutes * 60_000),
          allowWhileIdle: true,
        },
        smallIcon: "ic_stat_habitflow",
      },
    ],
  });
}

/** Android 12+: exact alarms make reminders fire on the minute instead of "roughly then". */
export async function exactAlarmStatus(): Promise<"granted" | "denied" | "n/a"> {
  if (!isNative) return "n/a";
  try {
    const s = await LocalNotifications.checkExactNotificationSetting();
    return s.exact_alarm === "granted" ? "granted" : "denied";
  } catch {
    return "n/a";
  }
}

export async function requestExactAlarms() {
  if (!isNative) return;
  await LocalNotifications.changeExactNotificationSetting();
}
