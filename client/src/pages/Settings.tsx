import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { INKS, useAuth, useUI, type ThemeMode } from "../lib/store";
import {
  disableWebPush,
  enableNotifications,
  exactAlarmStatus,
  notificationStatus,
  requestExactAlarms,
  sendTestNotification,
  syncNativeReminders,
  type NotifyStatus,
} from "../lib/notifications";
import { isNative } from "../lib/platform";
import type { Habit, Task, User as UserT } from "../lib/types";
import { Monogram, PageTitle, PasswordInput, Segmented, Spinner, Toggle } from "../components/ui";
import { DeskPicker } from "../components/DeskPicker";
import { deskByKey } from "../lib/desks";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[17px] font-bold">{title}</h2>
      <div className="sheet divide-y divide-rule overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ label, hint, children, stack }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; stack?: boolean }) {
  return (
    <div className={stack ? "space-y-3 px-5 py-4" : "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4"}>
      <div className="min-w-0 max-w-[52ch]">
        <div className="text-[15.5px] font-semibold">{label}</div>
        {hint && <div className="mt-0.5 text-[14px] text-ink-2">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const ui = useUI();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [notify, setNotify] = useState<NotifyStatus | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [exact, setExact] = useState<"granted" | "denied" | "n/a">("n/a");

  useEffect(() => {
    notificationStatus().then(setNotify);
    exactAlarmStatus().then(setExact);
    const onFocus = () => exactAlarmStatus().then(setExact);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const patch = async (body: Partial<UserT>, msg = "Saved") => {
    try {
      const r = await api<{ user: UserT }>("/users/me", { method: "PATCH", body });
      setUser(r.user);
      ui.toast({ title: msg });
    } catch (e) {
      ui.toast({ kind: "error", title: "Couldn't save", body: (e as Error).message });
    }
  };

  const turnOnNotifications = async () => {
    setBusy(true);
    try {
      const s = await enableNotifications();
      setNotify(s);
      if (s === "granted") {
        ui.toast({ title: "Notifications are on", body: "Reminders will arrive on this device." });
        if (isNative) {
          const habits = qc.getQueryData<Habit[]>(["habits", ui.today, false]) ?? [];
          const tasks = qc.getQueryData<Task[]>(["tasks"]) ?? [];
          await syncNativeReminders(habits, tasks);
        }
      } else if (s === "denied") ui.toast({ kind: "error", title: "Notifications are blocked", body: "Allow them for HabitFlow in your browser or phone settings, then try again." });
    } catch (e) {
      ui.toast({ kind: "error", title: "Couldn't turn on notifications", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const exportData = async (format: "json" | "csv") => {
    const data = await api<{ habits: (Habit & { checkIns: { date: string; status: string; count: number; note: string | null }[] })[] }>("/users/me/export");
    let blob: Blob;
    if (format === "json") blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    else {
      const rows = [["habit", "date", "status", "count", "note"]];
      for (const h of data.habits) for (const c of h.checkIns) rows.push([h.name, c.date, c.status, String(c.count), c.note ?? ""]);
      blob = new Blob([rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habitflow-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const notifyText =
    notify === "loading"
      ? "Checking…"
      : notify === "granted"
        ? "On for this device."
        : notify === "denied"
          ? "Blocked. Allow notifications for HabitFlow in your settings."
          : notify === "unsupported"
            ? "This browser can't receive push notifications. Try Chrome, Edge or the Android app."
            : "Off. Turn on to get your reminders.";

  return (
    <div className="max-w-[760px] space-y-9">
      <PageTitle>Settings</PageTitle>

      <Group title="Appearance">
        <Row label="Desk" hint="The colored surface your pages sit on. Each one brings its own pen, tape and shapes." stack>
          <DeskPicker />
        </Row>
        <Row label="Theme" hint={deskByKey(ui.desk).alwaysDark ? "This desk is always dark. Light and System apply to the other desks." : "System follows your phone or computer."}>
          <div className="w-full sm:w-[300px]">
            <Segmented<ThemeMode>
              id="theme"
              size="sm"
              value={ui.theme}
              onChange={ui.setTheme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
        </Row>
        <Row label="Ink" hint="The color of buttons, links and your progress marks. Match the desk to use its own pen." stack>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ink">
            {INKS.map((ink) => (
              <button
                key={ink.key}
                role="radio"
                aria-checked={ui.accent === ink.key}
                onClick={() => ui.setAccent(ink.key)}
                className="pill"
                aria-pressed={ui.accent === ink.key}
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: ink.key === "desk" ? "conic-gradient(var(--d1) 0 33%, var(--d2) 0 66%, var(--d3) 0)" : ink.light }} />
                {ink.name}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="Profile">
        <Row label={<span className="flex items-center gap-3"><Monogram name={user?.name ?? ""} size={40} /> {user?.name}</span>} hint={user?.email} />
        <Row label="Name" hint="Shown in your greeting on Today." stack>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) patch({ name: name.trim() }, "Name saved");
            }}
          >
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Name" />
            <button className="btn-ink shrink-0" disabled={!name.trim() || name.trim() === user?.name}>
              Save
            </button>
          </form>
        </Row>
        <Row label="Time zone" hint="Days, streaks and reminders all run on India Standard Time.">
          <span className="text-[15px] font-semibold">IST (UTC+5:30)</span>
        </Row>
      </Group>

      <Group title="Notifications">
        <Row label="Reminders on this device" hint={notifyText}>
          {notify !== "granted" ? (
            <button className="btn-pen" onClick={turnOnNotifications} disabled={busy || notify === "unsupported"}>
              {busy && <Spinner className="!h-4 !w-4 !border-sheet/40 !border-t-sheet" />} Turn on
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                className="btn-line"
                onClick={async () => {
                  try {
                    const n = await sendTestNotification();
                    ui.toast({ title: n ? "Test sent" : "No devices are subscribed", body: n ? "It should arrive in a few seconds." : "Turn notifications off and on again." });
                  } catch (e) {
                    ui.toast({ kind: "error", title: "Test failed", body: (e as Error).message });
                  }
                }}
              >
                Send a test
              </button>
              {!isNative && (
                <button className="btn-quiet" onClick={() => disableWebPush().then(() => setNotify("default"))}>
                  Turn off
                </button>
              )}
            </div>
          )}
        </Row>
        {exact === "denied" && notify === "granted" && (
          <Row label="Exact timing" hint="Android may delay reminders by several minutes unless HabitFlow can set exact alarms.">
            <button className="btn-line" onClick={() => requestExactAlarms()}>
              Allow exact alarms
            </button>
          </Row>
        )}
        <Row label="Sounds" hint="A soft stamp sound when you check something off.">
          <Toggle on={ui.sounds} onChange={ui.setSounds} label="Sounds" />
        </Row>
      </Group>


      <Group title="Your data">
        <Row label="Export" hint="Everything you've logged, as a file you keep.">
          <div className="flex gap-2">
            <button className="btn-line" onClick={() => exportData("json")}>
              JSON
            </button>
            <button className="btn-line" onClick={() => exportData("csv")}>
              CSV
            </button>
          </div>
        </Row>
      </Group>


      <Group title="Account">
        <PasswordRow />
        <Row label="Sign out" hint="You can sign back in on this device any time.">
          <button
            className="btn-line"
            onClick={() => {
              qc.clear();
              logout();
            }}
          >
            Sign out
          </button>
        </Row>
        <DeleteRow />
      </Group>

      <p className="text-[13px] text-ink-3">HabitFlow 1.1</p>
    </div>
  );
}

function PasswordRow() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const toast = useUI((s) => s.toast);
  return (
    <Row label="Password" hint="Changing it signs you out on your other devices." stack>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/users/me/password", { method: "PUT", body: { currentPassword: cur, newPassword: next } });
            setCur("");
            setNext("");
            toast({ title: "Password changed", body: "Your other devices have been signed out." });
          } catch (err) {
            toast({ kind: "error", title: (err as Error).message });
          }
        }}
      >
        <PasswordInput placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required aria-label="Current password" />
        <PasswordInput placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} autoComplete="new-password" required aria-label="New password" />
        <button className="btn-line">Change</button>
      </form>
    </Row>
  );
}

function DeleteRow() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const logout = useAuth((s) => s.logout);
  const toast = useUI((s) => s.toast);
  return (
    <Row label={<span className="text-red">Delete account</span>} hint="Permanently removes your account and every habit, note and check-in." stack={open}>
      {!open ? (
        <button className="btn-line !border-red/50 !text-red" onClick={() => setOpen(true)}>
          Delete account
        </button>
      ) : (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/users/me", { method: "DELETE", body: { password: pw } });
              logout();
            } catch (err) {
              toast({ kind: "error", title: (err as Error).message });
            }
          }}
        >
          <PasswordInput className="flex-1" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Your password, to confirm" required aria-label="Password" />
          <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn bg-red text-sheet">Delete everything</button>
        </form>
      )}
    </Row>
  );
}
