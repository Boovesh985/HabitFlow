import { motion } from "framer-motion";

/** Deterministic pseudo-random number in [0,1) from a string, so a stamp keeps its tilt across renders. */
export function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Shared SVG filters. Mount once near the root.
 * - ink-rough: wobbly rubber-stamp edge + tiny speckles where the ink didn't take.
 * - ink-soft: gentler version for small marks.
 */
export function InkDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="ink-rough" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="edge" />
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="3" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.2" result="speckle" />
          <feComposite in="edge" in2="speckle" operator="in" />
        </filter>
        <filter id="ink-soft" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="1" seed="11" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

/** A completed-day rubber stamp: a filled ink disc with a knocked-out tick. */
export function StampMark({
  color,
  size = 44,
  seed = "x",
  animate = true,
  soft = false,
}: {
  color: string;
  size?: number;
  seed?: string;
  animate?: boolean;
  soft?: boolean;
}) {
  const r = seeded(seed);
  const rotate = -14 + r * 28;
  const dx = (seeded(seed + "x") - 0.5) * 1.6;
  const dy = (seeded(seed + "y") - 0.5) * 1.6;
  return (
    <motion.svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      initial={animate ? { scale: 1.45, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1, rotate }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <g filter={`url(#${soft ? "ink-soft" : "ink-rough"})`} transform={`translate(${dx} ${dy})`}>
        <circle cx="24" cy="24" r="21" fill={color} />
        <circle cx="24" cy="24" r="17.5" fill="none" stroke="var(--sheet)" strokeOpacity="0.35" strokeWidth="1.2" />
        <path d="M15 24.5l6 6L33.5 17.5" fill="none" stroke="var(--sheet)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </motion.svg>
  );
}

/** An empty stamp slot: dashed ring, optionally filled from the bottom like an ink level. */
export function StampSlot({ size = 44, color, level = 0, label }: { size?: number; color: string; level?: number; label?: string }) {
  const lv = Math.max(0, Math.min(1, level));
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block" }} aria-hidden>
      <defs>
        <clipPath id={`lv-${size}-${Math.round(lv * 100)}-${color.replace(/[^a-z0-9]/gi, "")}`}>
          <rect x="0" y={48 - 48 * lv} width="48" height={48 * lv} />
        </clipPath>
      </defs>
      {lv > 0 && (
        <circle cx="24" cy="24" r="21" fill={color} opacity="0.28" clipPath={`url(#lv-${size}-${Math.round(lv * 100)}-${color.replace(/[^a-z0-9]/gi, "")})`} />
      )}
      <circle cx="24" cy="24" r="21" fill="none" stroke="var(--rule-strong)" strokeWidth="1.5" strokeDasharray="3.2 3.2" />
      {label && (
        <text x="24" y="28.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink-2)" style={{ fontFamily: "var(--font-display)" }}>
          {label}
        </text>
      )}
    </svg>
  );
}

/** Tally marks for count habits: groups of five, the fifth struck through. */
export function Tally({ count, target, color }: { count: number; target: number; color: string }) {
  if (target > 20) return null;
  const groups = Math.ceil(target / 5);
  return (
    <svg width={groups * 22} height="14" viewBox={`0 0 ${groups * 22} 14`} aria-hidden style={{ display: "block" }}>
      {Array.from({ length: target }, (_, i) => {
        const g = Math.floor(i / 5);
        const k = i % 5;
        const on = i < count;
        const stroke = on ? color : "var(--rule-strong)";
        if (k === 4) return <line key={i} x1={g * 22 + 0} y1="11" x2={g * 22 + 17} y2="3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />;
        const x = g * 22 + 2 + k * 4;
        return <line key={i} x1={x} y1="1.5" x2={x + (k % 2 ? 0.6 : -0.4)} y2="12.5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />;
      })}
    </svg>
  );
}

/** The big rubber stamp that lands on a finished page ("ALL DONE", "SHIPPED", "COMPLETED"). */
export function DoneStamp({ animate = true, className = "right-4 top-[68px]", text = "ALL DONE" }: { animate?: boolean; className?: string; text?: string }) {
  const w = Math.max(148, text.length * 17 + 20);
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute select-none ${className}`}
      initial={animate ? { scale: 2.2, opacity: 0, rotate: -4 } : false}
      animate={{ scale: 1, opacity: 1, rotate: -11 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      <svg width={w} height="62" viewBox={`0 0 ${w} 62`} style={{ overflow: "visible" }}>
        <g filter="url(#ink-rough)">
          <rect x="3" y="3" width={w - 6} height="56" rx="8" fill="none" stroke="var(--red)" strokeWidth="3.5" />
          <rect x="9" y="9" width={w - 18} height="44" rx="4" fill="none" stroke="var(--red)" strokeWidth="1.4" />
          <text x={w / 2} y="41" textAnchor="middle" fill="var(--red)" fontSize="27" fontWeight="800" letterSpacing="2" style={{ fontFamily: "var(--font-display)" }}>
            {text}
          </text>
        </g>
      </svg>
    </motion.div>
  );
}

/** Ink flecks thrown off when a stamp lands, plus one fading ring. Plays once per mount. */
export function InkBurst({ color, seed = "b" }: { color: string; seed?: string }) {
  const flecks = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2 + seeded(seed + i) * 0.5;
    const dist = 30 + seeded(seed + "d" + i) * 16;
    return {
      x: Math.cos(a) * dist,
      y: Math.sin(a) * dist,
      s: 3 + seeded(seed + "s" + i) * 4.5,
    };
  });
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <motion.span
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: color }}
        initial={{ scale: 0.9, opacity: 0.55 }}
        animate={{ scale: 1.9, opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
      {flecks.map((f, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{
            width: f.s,
            height: f.s,
            marginLeft: -f.s / 2,
            marginTop: -f.s / 2,
            background: i % 4 === 3 ? "var(--d2)" : color,
          }}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
          animate={{ x: f.x, y: f.y, scale: 1, opacity: 0 }}
          transition={{ duration: 0.62, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </span>
  );
}
