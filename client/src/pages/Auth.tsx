import { motion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { api } from "../lib/api";
import { localDay, parseDay } from "../lib/dates";
import { useAuth } from "../lib/store";
import { Wordmark } from "../components/Layout";
import { DoneStamp, InkDefs, StampMark, StampSlot } from "../components/Stamp";
import { Highlight, PasswordInput, Segmented, Spinner, Tape } from "../components/ui";

const DEMO = [
  { name: "Drink water", meta: "8 glasses", color: "#0f7c86" },
  { name: "Read 20 pages", meta: "12-day streak", color: "#d86a1f" },
  { name: "Walk 8k steps", meta: "Every day", color: "#2f7d55" },
  { name: "Meditate", meta: "7:30 am", color: "#7a3fa8" },
];

/** Today's page, stamping itself one habit at a time. */
function DemoPage() {
  const day = localDay();
  const d = parseDay(day);
  const sunday = d.getDay() === 0;
  const [stamped, setStamped] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setStamped(DEMO.length);
    const timers = DEMO.map((_, i) => setTimeout(() => setStamped(i + 1), 900 + i * 650));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative w-full max-w-[400px] rotate-[-1.2deg]" aria-hidden>
      <Tape className="-top-1 -left-5" rotate={-34} width={74} />
      <Tape className="-top-1 -right-5" rotate={34} width={74} color="var(--d3)" />
      <div className="sheet relative w-full overflow-hidden !rounded-[16px]">
        <div className={clsx("flex items-center justify-between px-5 py-2.5 text-white", sunday ? "bg-red" : "bg-binding")}>
          <span className="numeral text-[22px] font-bold">{d.toLocaleDateString(undefined, { month: "long" })}</span>
          <span className="mono opacity-80">{d.getFullYear()}</span>
        </div>
        <div className="perforation -mt-1" />
        <div className="px-5 pt-1 pb-2">
          <div className={clsx("numeral text-[120px] font-black", sunday ? "text-red" : "text-ink")}>{d.getDate()}</div>
          <div className={clsx("numeral -mt-1 text-[28px] font-bold", sunday ? "text-red" : "text-ink")}>
            {d.toLocaleDateString(undefined, { weekday: "long" })}
          </div>
        </div>
        <ul className="border-t border-rule">
          {DEMO.map((h, i) => (
            <li key={h.name} className="flex items-center gap-3 border-b border-rule px-5 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className={clsx("text-[15px] font-semibold", i < stamped && "text-ink-2")}>{h.name}</div>
                <div className="text-[13px] text-ink-3">{h.meta}</div>
              </div>
              <div className="h-9 w-9">
                {i < stamped ? <StampMark color={h.color} size={36} seed={h.name + day} /> : <StampSlot color={h.color} size={36} />}
              </div>
            </li>
          ))}
        </ul>
        {stamped === DEMO.length && <DoneStamp />}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [regOpen, setRegOpen] = useState(true);
  const { login, register } = useAuth();

  useEffect(() => {
    api<{ allowRegistration: boolean }>("/auth/config", { auth: false })
      .then((c) => setRegOpen(c.allowRegistration))
      .catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh overflow-x-clip">
      <InkDefs />
      <div className="mx-auto grid min-h-dvh max-w-[1120px] items-center gap-10 px-5 py-8 lg:grid-cols-[1fr_420px] lg:gap-16 lg:px-8">
        <div className="flex flex-col gap-8">
          <Wordmark />
          <div>
            <h1 className="numeral max-w-[12ch] text-[56px] font-extrabold sm:text-[72px]">
              Every day gets a <Highlight delay={0.4}>page.</Highlight>
            </h1>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
              Stamp each habit as you do it. Miss a day and you'll see the gap. Keep going and the pages pile up into streaks.
            </p>
          </div>
          <div className="hidden justify-start sm:flex lg:pl-2">
            <DemoPage />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="sheet w-full p-6 sm:p-8"
        >
          <h2 className="numeral text-[34px] font-bold">{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            {mode === "login" ? "Pick up where you left off." : "Takes half a minute."}
          </p>

          {regOpen && (
            <div className="mt-6">
              <Segmented
                id="auth"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setErr(null);
                }}
                options={[
                  { value: "login", label: "Sign in" },
                  { value: "register", label: "New account" },
                ]}
              />
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <label className="field-label" htmlFor="name">
                  Your name
                </label>
                <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </div>
            )}
            <div>
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "register" && <p className="mt-1.5 text-[13px] text-ink-3">At least 8 characters.</p>}
            </div>


            {err && (
              <p className="rounded-[10px] bg-red-soft px-3.5 py-2.5 text-[15px] text-red" role="alert">
                {err}
              </p>
            )}

            <button className="btn-pen w-full !py-3" disabled={busy}>
              {busy ? <Spinner className="!border-sheet/40 !border-t-sheet" /> : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
