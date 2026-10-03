import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useMemo, type CSSProperties } from "react";
import { deskByKey, type DeskShape, type Pattern, type ShapeKind } from "../lib/desks";
import { useUI } from "../lib/store";

const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;

/** Printed patterns are masks over a flat ink layer, so one definition works on every desk color. */
const PATTERNS: Record<Pattern, CSSProperties> = {
  halftone: {
    maskImage: "radial-gradient(circle, #000 1.7px, transparent 2.2px), linear-gradient(155deg, #000 10%, transparent 75%)",
    maskSize: "13px 13px, 100% 100%",
    maskComposite: "intersect",
    WebkitMaskComposite: "source-in",
  },
  waves: {
    maskImage: svg("<path d='M0 8 q12 -7 24 0 t24 0' fill='none' stroke='black' stroke-width='1.6'/>", 48, 18),
    maskSize: "48px 18px",
  },
  seeds: {
    maskImage: svg("<path d='M3 6h7M17 17h7' stroke='black' stroke-width='2' stroke-linecap='round'/>", 28, 22),
    maskSize: "28px 22px",
  },
  grid: {
    maskImage: svg("<path d='M28 0V28M0 28H28' stroke='black' stroke-width='1.2'/>", 28, 28),
    maskSize: "28px 28px",
  },
  plus: {
    maskImage: svg("<path d='M17 12v10M12 17h10' stroke='black' stroke-width='1.8' stroke-linecap='round'/>", 34, 34),
    maskSize: "34px 34px",
  },
  focus: {
    maskImage:
      "repeating-conic-gradient(from 0deg at 50% 38%, #000 0deg 0.55deg, transparent 0.55deg 3.4deg), radial-gradient(ellipse 70% 60% at 50% 38%, transparent 30%, #000 85%)",
    maskSize: "100% 100%, 100% 100%",
    maskComposite: "intersect",
    WebkitMaskComposite: "source-in",
  },
  dots: {
    maskImage: "radial-gradient(circle, #000 1px, transparent 1.4px)",
    maskSize: "22px 22px",
  },
};

function scallop(lobes: number, r1: number, r2: number) {
  const pts: string[] = [];
  for (let i = 0; i < lobes * 2; i++) {
    const a = (Math.PI * i) / lobes;
    const r = i % 2 ? r2 : r1;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}
const BURST = scallop(14, 49, 41);
const STAR = scallop(8, 49, 22);

/** Cut-paper shapes. Flat fills only; overlaps multiply like riso ink. */
export function ShapeArt({ kind, color }: { kind: ShapeKind; color: string }) {
  switch (kind) {
    case "disc":
      return <circle cx="50" cy="50" r="48" fill={color} />;
    case "half":
      return <path d="M2 52 A48 48 0 0 1 98 52 Z" fill={color} />;
    case "burst":
      return <polygon points={BURST} fill={color} />;
    case "star":
      return <polygon points={STAR} fill={color} strokeLinejoin="round" stroke={color} strokeWidth="4" />;
    case "ring":
      return <circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeWidth="16" />;
    case "squiggle":
      return <path d="M6 50 q11 -26 22 0 t22 0 t22 0 t22 0" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />;
    case "asterisk":
      return (
        <g stroke={color} strokeWidth="15" strokeLinecap="round">
          <path d="M50 8v84M13.6 29l72.8 42M13.6 71l72.8 -42" />
        </g>
      );
    case "leaf":
      return (
        <>
          <path d="M50 3C88 24 88 76 50 97C12 76 12 24 50 3Z" fill={color} />
          <path d="M50 14V90" stroke="var(--ground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        </>
      );
    case "wave":
      return <path d="M0 42q12.5 -16 25 0t25 0t25 0t25 0V100H0Z" fill={color} />;
    case "sun":
      return (
        <g fill={color}>
          <circle cx="50" cy="50" r="27" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="47" y="2" width="6" height="15" rx="3" transform={`rotate(${i * 30} 50 50)`} />
          ))}
        </g>
      );
    case "rising":
      return (
        <g fill={color}>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x="48.5" y="4" width="3" height="22" rx="1.5" transform={`rotate(${-80 + i * 20} 50 66)`} />
          ))}
          <path d="M16 66a34 34 0 0 1 68 0Z" />
          <path d="M14 72h72M20 80h60M28 88h44" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "slash":
      return (
        <g fill={color}>
          <path d="M14 92L72 6l7 3L24 96Z" />
          <path d="M34 96L86 18l6 4L42 98Z" opacity="0.85" />
          <path d="M6 74L50 10l5 3L13 80Z" opacity="0.7" />
        </g>
      );
    case "chevrons":
      return (
        <g fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 88l32 -24l32 24" opacity="0.45" />
          <path d="M18 62l32 -24l32 24" opacity="0.7" />
          <path d="M18 36l32 -24l32 24" />
        </g>
      );
    case "arch":
      return (
        <g fill="none" stroke={color} strokeWidth="9">
          <path d="M8 100V54a42 42 0 0 1 84 0V100" />
          <path d="M26 100V54a24 24 0 0 1 48 0V100" />
          <path d="M43 100V54a7 7 0 0 1 14 0V100" />
        </g>
      );
  }
}

const SPIN = new Set<ShapeKind>(["burst", "star", "asterisk", "sun"]);

function Shape({ s, i, still }: { s: DeskShape; i: number; still: boolean }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, (v) => (still ? 0 : -v * s.depth * 0.18));
  return (
    <motion.div
      className="absolute"
      style={{
        left: s.x,
        top: s.y,
        width: `clamp(${s.size * 0.6}px, ${(s.size / 9).toFixed(1)}vw, ${s.size * 1.3}px)`,
        aspectRatio: "1",
        y,
      }}
      initial={{ opacity: 0, scale: 0.6, rotate: s.rot - 25 }}
      animate={{ opacity: 1, scale: 1, rotate: s.rot }}
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.25 } }}
      transition={{
        duration: 0.9,
        delay: 0.05 + i * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        className={still ? undefined : SPIN.has(s.kind) ? "desk-spin" : "desk-drift"}
        style={{
          animationDuration: `${SPIN.has(s.kind) ? 90 + i * 20 : 18 + i * 5}s`,
          animationDelay: `${-i * 4}s`,
          overflow: "visible",
        }}
      >
        <ShapeArt kind={s.kind} color={`var(--d${s.tone})`} />
      </svg>
    </motion.div>
  );
}

/** The colored desk behind every screen: ground, printed pattern, drifting paper shapes. */
export function DeskBackground() {
  const key = useUI((s) => s.desk);
  const desk = deskByKey(key);
  const reduce = useReducedMotion() ?? false;
  const pattern = useMemo(() => PATTERNS[desk.pattern], [desk.pattern]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        key={desk.pattern}
        className="desk-pattern absolute inset-0"
        style={{
          background: "var(--pattern-ink)",
          WebkitMaskImage: pattern.maskImage as string,
          WebkitMaskSize: pattern.maskSize as string,
          ...pattern,
        }}
      />
      <div className="desk-shapes absolute inset-0" style={{ opacity: "var(--shape-opacity)" as unknown as number }}>
        <AnimatePresence>
          {desk.shapes.map((s, i) => (
            <Shape key={desk.key + i} s={s} i={i} still={reduce} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
