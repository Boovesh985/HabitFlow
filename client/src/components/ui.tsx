import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useUI } from "../lib/store";
import { StampMark } from "./Stamp";

const EXPO = [0.16, 1, 0.3, 1] as const;

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[oklch(0.2_0.03_266/0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={clsx(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[18px] border border-rule bg-sheet shadow-[0_-10px_40px_-20px_oklch(0.2_0.05_266/0.5)] sm:rounded-[16px]",
              wide ? "sm:max-w-[640px]" : "sm:max-w-[460px]"
            )}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.32, ease: EXPO }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
              <h2 className="numeral text-[26px] font-bold">{title}</h2>
              <button onClick={onClose} className="btn-quiet !p-2" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pt-5 pb-6 safe-bottom">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Fixed-position popover anchored to a trigger; rendered in a portal so it is never clipped. */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  width = 200,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    up: boolean;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const up = r.bottom + 220 > window.innerHeight;
      setPos({
        top: up ? r.top - 6 : r.bottom + 6,
        left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8),
        up,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchor]);

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={ref}
          role="menu"
          className="fixed z-50 rounded-[12px] border border-rule bg-sheet p-1 shadow-[0_18px_40px_-18px_oklch(0.2_0.05_266/0.45)]"
          style={{
            top: pos.top,
            left: pos.left,
            width,
            translateY: pos.up ? "-100%" : 0,
          }}
          initial={{ opacity: 0, y: pos.up ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: EXPO }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[15px] transition-colors hover:bg-well",
        danger ? "text-red" : "text-ink"
      )}
    >
      {icon && <span className={danger ? "text-red" : "text-ink-2"}>{icon}</span>}
      {children}
    </button>
  );
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            layout
            key={t.id}
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ duration: 0.3, ease: EXPO }}
            className={clsx(
              "pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[12px] px-4 py-3 text-left shadow-[0_14px_36px_-16px_oklch(0.15_0.05_266/0.6)]",
              t.kind === "error" ? "bg-red text-sheet" : "bg-ink text-sheet"
            )}
          >
            {t.kind === "achievement" && (
              <span className="mt-0.5 shrink-0">
                <StampMark color="var(--pen)" size={24} seed={t.title} soft />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-6">{t.title}</span>
              {t.body && <span className="block text-sm leading-5 opacity-80">{t.body}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** A strip of washi tape. Position it with className; the tape color defaults to the desk's second ink. */
export function Tape({ className, rotate = -4, color, width }: { className?: string; rotate?: number; color?: string; width?: number }) {
  return (
    <span
      aria-hidden
      className={clsx("tape", className)}
      style={{
        rotate: `${rotate}deg`,
        width,
        ...(color ? { ["--tape" as string]: color } : null),
      }}
    />
  );
}

/** Highlighter swipe behind a run of text. The text is always visible; only the marker animates. */
export function Highlight({ children, delay = 0.12, color = "var(--hl)" }: { children: ReactNode; delay?: number; color?: string }) {
  return (
    <span className="relative inline-block isolate">
      <motion.span
        aria-hidden
        className="absolute -inset-x-[0.12em] bottom-[0.04em] -z-10 h-[0.46em] rounded-[3px]"
        style={{ background: color, originX: 0, skewX: -8 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay, ease: EXPO }}
      />
      {children}
    </span>
  );
}

/** Hand-drawn underline that draws itself once. */
export function Scribble({ color = "var(--d3)", className }: { color?: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 12" preserveAspectRatio="none" className={clsx("block h-[0.35em] w-full", className)}>
      <motion.path
        d="M2 8 C 22 2, 38 11, 58 6 S 96 2, 118 7"
        fill="none"
        stroke={color}
        strokeWidth="3.4"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EXPO }}
      />
    </svg>
  );
}

export function PageTitle({ children, aside, sub }: { children: ReactNode; aside?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-dashed border-[color-mix(in_oklch,var(--ink)_22%,transparent)] pb-4 sm:mb-8">
      <div className="min-w-0">
        <h1 className="numeral text-[44px] font-extrabold sm:text-[56px]">
          <Highlight>{children}</Highlight>
        </h1>
        {sub && <p className="mt-2 max-w-[60ch] text-[15px] text-ink-2">{sub}</p>}
      </div>
      {aside}
    </header>
  );
}

export function SectionHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px] bg-d3" />
        {children}
      </h2>
      {aside && <span className="text-sm text-ink-2">{aside}</span>}
    </div>
  );
}

export function Empty({ title, body, action, mark }: { title: string; body: string; action?: ReactNode; mark?: ReactNode }) {
  return (
    <div className="sheet flex flex-col items-start gap-3 px-6 py-8 sm:px-8">
      {mark}
      <h3 className="numeral text-[30px] font-bold">{title}</h3>
      <p className="max-w-[52ch] text-[15px] text-ink-2">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={clsx("h-5 w-5 animate-spin rounded-full border-2 border-rule border-t-pen", className)} role="status" aria-label="Loading" />;
}

export function Loading() {
  return (
    <div className="grid h-56 place-items-center">
      <Spinner />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  id: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex rounded-[10px] border border-rule-strong bg-well p-0.5" role="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={on}
            key={o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative flex-1 rounded-[8px] font-semibold transition-colors duration-150",
              size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-[15px]",
              on ? "text-ink" : "text-ink-2 hover:text-ink"
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[8px] border border-rule bg-sheet shadow-[0_1px_2px_oklch(0.2_0.03_266/0.12)]"
                transition={{ duration: 0.25, ease: EXPO }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={clsx("relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200", on ? "border-pen bg-pen" : "border-rule-strong bg-well")}
    >
      <motion.span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-sheet shadow-sm"
        animate={{ left: on ? 23 : 3 }}
        transition={{ duration: 0.22, ease: EXPO }}
      />
    </button>
  );
}

/** A thin bar used for rates and progress; no gradients, just ink on a well. */
export function Bar({ value, color = "var(--pen)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx("h-1.5 overflow-hidden rounded-full bg-well", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        transition={{ duration: 0.6, ease: EXPO }}
      />
    </div>
  );
}

/** Initials in a circle, in the user's ink. */
export function Monogram({ name, size = 28 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "·";
  return (
    <span
      className="numeral grid shrink-0 place-items-center rounded-full bg-pen font-bold text-sheet"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        lineHeight: 1,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Password field with a show / hide toggle. Takes every normal input prop except type. */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className={clsx("relative", className)}>
      <input {...props} type={shown ? "text" : "password"} className="field !pr-11" autoCapitalize="off" spellCheck={false} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[10px] text-ink-3 transition-colors hover:text-ink"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/**
 * Whole-number field that can be cleared while typing. A value in range is committed as you type;
 * leaving the field empty or out of range snaps it back to the nearest allowed number.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max = 100000,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const text = e.target.value.replace(/\D/g, "");
        setDraft(text);
        const n = Number(text);
        if (text && n >= min && n <= max) onChange(n);
      }}
      onBlur={(e) => {
        focused.current = false;
        const next = draft ? clamp(Number(draft)) : value;
        setDraft(String(next));
        if (next !== value) onChange(next);
        props.onBlur?.(e);
      }}
    />
  );
}
