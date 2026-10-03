/**
 * Desks: the colored surface the day sheets sit on. Each desk is a full template:
 * ground color + printed pattern + a set of cut-paper shapes + its own pen, binding,
 * highlighter and washi tape. Sheets stay paper-white so reading never suffers.
 */

export type Pattern = "halftone" | "waves" | "seeds" | "grid" | "plus" | "dots" | "focus";
export type ShapeKind = "disc" | "half" | "burst" | "ring" | "squiggle" | "asterisk" | "leaf" | "wave" | "sun" | "arch" | "star" | "rising" | "slash" | "chevrons";

export interface DeskShape {
  kind: ShapeKind;
  /** d1 | d2 | d3 */
  tone: 1 | 2 | 3;
  /** CSS position, percentages of the viewport */
  x: string;
  y: string;
  size: number;
  rot: number;
  /** parallax strength, 0..1 */
  depth: number;
}

export interface Desk {
  key: string;
  name: string;
  blurb: string;
  hue: number;
  chroma: number;
  lightness: number;
  pen: { light: string; dark: string };
  binding: string;
  d1: string;
  d2: string;
  d3: string;
  /** highlighter: always the lightest, brightest of the three */
  hl: string;
  pattern: Pattern;
  shapes: DeskShape[];
  /** A desk that is always dark, whatever the Light/Dark setting says. */
  alwaysDark?: boolean;
  /** Hand-tuned tokens that replace the derived ones. */
  tokens?: Record<string, string>;
}

// Shapes sit around the edges so content sheets cover the middle on every screen size.
const EDGE = {
  tl: { x: "-6%", y: "6%" },
  tr: { x: "82%", y: "-4%" },
  ml: { x: "-9%", y: "46%" },
  mr: { x: "88%", y: "38%" },
  bl: { x: "6%", y: "78%" },
  br: { x: "78%", y: "74%" },
};

export const DESKS: Desk[] = [
  {
    key: "arc",
    name: "Redemption arc",
    blurb: "Charcoal, ember and blood red. Always dark.",
    hue: 30,
    chroma: 0.012,
    lightness: 0.165,
    pen: { light: "oklch(0.72 0.17 50)", dark: "oklch(0.72 0.17 50)" },
    binding: "oklch(0.5 0.2 27)",
    d1: "oklch(0.58 0.22 27)",
    d2: "oklch(0.8 0.16 70)",
    d3: "oklch(0.55 0.03 250)",
    hl: "oklch(0.66 0.19 42 / 0.6)",
    pattern: "focus",
    alwaysDark: true,
    tokens: {
      "--ground": "oklch(0.165 0.012 30)",
      "--sheet": "oklch(0.215 0.012 30)",
      "--well": "oklch(0.26 0.014 30)",
      "--rule": "oklch(0.3 0.014 30)",
      "--rule-strong": "oklch(0.41 0.018 30)",
      "--ink": "oklch(0.96 0.008 70)",
      "--ink-2": "oklch(0.79 0.014 60)",
      "--ink-3": "oklch(0.64 0.014 50)",
      "--red": "oklch(0.66 0.21 27)",
      "--red-soft": "oklch(0.3 0.08 27)",
      "--binding": "oklch(0.5 0.2 27)",
      "--hl": "oklch(0.66 0.19 42 / 0.6)",
      "--pattern-ink": "oklch(0.215 0.016 30)",
      "--paper-shadow": "0 1px 0 oklch(0.12 0.01 30), 0 20px 40px -22px oklch(0 0 0 / 0.8)",
      "--shape-opacity": "0.55",
    },
    shapes: [
      { kind: "rising", tone: 1, x: "74%", y: "-8%", size: 340, rot: 0, depth: 0.5 },
      { kind: "slash", tone: 1, x: "-7%", y: "40%", size: 230, rot: 0, depth: 0.3 },
      { kind: "chevrons", tone: 2, x: "80%", y: "72%", size: 200, rot: 0, depth: 0.7 },
      { kind: "half", tone: 3, x: "4%", y: "80%", size: 240, rot: 180, depth: 0.4 },
      { kind: "asterisk", tone: 2, x: "93%", y: "56%", size: 70, rot: 0, depth: 0.9 },
    ],
  },
  {
    key: "pool",
    name: "Pool day",
    blurb: "Chlorine blue with coral and lemon.",
    hue: 215,
    chroma: 0.085,
    lightness: 0.87,
    pen: { light: "oklch(0.48 0.16 252)", dark: "oklch(0.76 0.12 245)" },
    binding: "oklch(0.4 0.13 252)",
    d1: "oklch(0.72 0.16 28)",
    d2: "oklch(0.93 0.15 105)",
    d3: "oklch(0.55 0.15 252)",
    hl: "oklch(0.93 0.15 105)",
    pattern: "waves",
    shapes: [
      { kind: "sun", tone: 2, ...EDGE.tr, size: 280, rot: 0, depth: 0.5 },
      {
        kind: "wave",
        tone: 3,
        x: "-4%",
        y: "64%",
        size: 340,
        rot: -6,
        depth: 0.3,
      },
      { kind: "disc", tone: 1, ...EDGE.ml, size: 170, rot: 0, depth: 0.6 },
      { kind: "ring", tone: 1, ...EDGE.br, size: 180, rot: 0, depth: 0.8 },
      {
        kind: "squiggle",
        tone: 3,
        x: "93%",
        y: "58%",
        size: 160,
        rot: 10,
        depth: 0.9,
      },
    ],
  },
  {
    key: "riso",
    name: "Riso print",
    blurb: "Fluoro pink, riso blue, sunny yellow.",
    hue: 355,
    chroma: 0.085,
    lightness: 0.875,
    pen: { light: "oklch(0.5 0.2 262)", dark: "oklch(0.75 0.14 262)" },
    binding: "oklch(0.44 0.18 262)",
    d1: "oklch(0.6 0.19 258)",
    d2: "oklch(0.91 0.16 100)",
    d3: "oklch(0.68 0.21 35)",
    hl: "oklch(0.92 0.16 100)",
    pattern: "halftone",
    shapes: [
      { kind: "disc", tone: 1, ...EDGE.tr, size: 300, rot: 0, depth: 0.5 },
      { kind: "half", tone: 2, ...EDGE.ml, size: 260, rot: 90, depth: 0.25 },
      { kind: "burst", tone: 3, ...EDGE.br, size: 200, rot: 12, depth: 0.7 },
      { kind: "squiggle", tone: 1, ...EDGE.bl, size: 220, rot: -8, depth: 0.4 },
      {
        kind: "ring",
        tone: 3,
        x: "93%",
        y: "58%",
        size: 110,
        rot: 0,
        depth: 0.9,
      },
    ],
  },
  {
    key: "garden",
    name: "Allotment",
    blurb: "Leaf green, tomato red, marigold.",
    hue: 140,
    chroma: 0.09,
    lightness: 0.87,
    pen: { light: "oklch(0.45 0.12 155)", dark: "oklch(0.78 0.13 150)" },
    binding: "oklch(0.36 0.09 155)",
    d1: "oklch(0.65 0.2 30)",
    d2: "oklch(0.85 0.16 78)",
    d3: "oklch(0.52 0.13 155)",
    hl: "oklch(0.88 0.15 85)",
    pattern: "seeds",
    shapes: [
      { kind: "leaf", tone: 3, ...EDGE.tr, size: 300, rot: 20, depth: 0.5 },
      { kind: "disc", tone: 1, ...EDGE.ml, size: 190, rot: 0, depth: 0.4 },
      { kind: "star", tone: 2, ...EDGE.br, size: 210, rot: 0, depth: 0.7 },
      { kind: "leaf", tone: 2, ...EDGE.bl, size: 180, rot: -40, depth: 0.3 },
      {
        kind: "asterisk",
        tone: 1,
        x: "93%",
        y: "58%",
        size: 90,
        rot: 0,
        depth: 0.9,
      },
    ],
  },
  {
    key: "marigold",
    name: "Marigold",
    blurb: "Hot yellow with violet ink and pink.",
    hue: 82,
    chroma: 0.13,
    lightness: 0.885,
    pen: { light: "oklch(0.46 0.19 295)", dark: "oklch(0.76 0.14 295)" },
    binding: "oklch(0.38 0.15 295)",
    d1: "oklch(0.55 0.19 295)",
    d2: "oklch(0.8 0.12 355)",
    d3: "oklch(0.65 0.2 32)",
    hl: "oklch(0.84 0.11 355)",
    pattern: "grid",
    shapes: [
      { kind: "arch", tone: 1, ...EDGE.tr, size: 280, rot: 0, depth: 0.5 },
      { kind: "burst", tone: 2, ...EDGE.ml, size: 230, rot: 0, depth: 0.35 },
      { kind: "disc", tone: 3, ...EDGE.br, size: 190, rot: 0, depth: 0.7 },
      { kind: "squiggle", tone: 1, ...EDGE.bl, size: 200, rot: 6, depth: 0.45 },
      {
        kind: "asterisk",
        tone: 3,
        x: "93%",
        y: "58%",
        size: 84,
        rot: 0,
        depth: 0.9,
      },
    ],
  },
  {
    key: "lilac",
    name: "Lilac",
    blurb: "Soft violet, acid lime, orange.",
    hue: 300,
    chroma: 0.075,
    lightness: 0.855,
    pen: { light: "oklch(0.45 0.19 278)", dark: "oklch(0.76 0.13 280)" },
    binding: "oklch(0.37 0.15 278)",
    d1: "oklch(0.9 0.17 125)",
    d2: "oklch(0.74 0.17 52)",
    d3: "oklch(0.5 0.19 278)",
    hl: "oklch(0.91 0.17 125)",
    pattern: "plus",
    shapes: [
      { kind: "star", tone: 1, ...EDGE.tr, size: 280, rot: 8, depth: 0.5 },
      { kind: "ring", tone: 3, ...EDGE.ml, size: 220, rot: 0, depth: 0.35 },
      { kind: "half", tone: 2, ...EDGE.br, size: 220, rot: -90, depth: 0.7 },
      { kind: "disc", tone: 1, ...EDGE.bl, size: 150, rot: 0, depth: 0.45 },
      {
        kind: "squiggle",
        tone: 2,
        x: "93%",
        y: "58%",
        size: 150,
        rot: -12,
        depth: 0.9,
      },
    ],
  },
  {
    key: "paper",
    name: "Plain paper",
    blurb: "The quiet original. No shapes.",
    hue: 266,
    chroma: 0.008,
    lightness: 0.962,
    pen: { light: "oklch(0.49 0.21 266)", dark: "oklch(0.72 0.15 266)" },
    binding: "oklch(0.24 0.03 266)",
    d1: "oklch(0.49 0.21 266)",
    d2: "oklch(0.57 0.2 30)",
    d3: "oklch(0.52 0.12 155)",
    hl: "oklch(0.9 0.08 266)",
    pattern: "dots",
    shapes: [],
  },
];

export const DEFAULT_DESK = "arc";

export const deskByKey = (k: string) => DESKS.find((d) => d.key === k) ?? DESKS[0];

/** Every semantic token the CSS uses, derived from a desk for light or dark. */
export function deskTokens(desk: Desk, dark: boolean, penOverride?: string): Record<string, string> {
  const base = derived(desk, dark || !!desk.alwaysDark, penOverride);
  if (!desk.tokens) return base;
  const pen = base["--pen"];
  return { ...base, ...desk.tokens, "--pen-soft": `color-mix(in oklch, ${pen} 20%, ${desk.tokens["--sheet"] ?? base["--sheet"]})` };
}

function derived(desk: Desk, dark: boolean, penOverride?: string): Record<string, string> {
  const h = desk.hue;
  const pen = penOverride ?? (dark ? desk.pen.dark : desk.pen.light);
  const plain = desk.key === "paper";
  if (!dark) {
    return {
      "--ground": `oklch(${desk.lightness} ${desk.chroma} ${h})`,
      "--sheet": `oklch(0.995 0.004 ${h})`,
      "--well": `oklch(0.956 0.014 ${h})`,
      "--rule": `oklch(0.905 0.016 ${h})`,
      "--rule-strong": `oklch(0.79 0.024 ${h})`,
      "--ink": `oklch(0.21 0.03 ${h})`,
      "--ink-2": `oklch(0.4 0.032 ${h})`,
      "--ink-3": `oklch(0.54 0.028 ${h})`,
      "--pen": pen,
      "--pen-soft": `color-mix(in oklch, ${pen} 13%, oklch(0.995 0.004 ${h}))`,
      "--red": "oklch(0.56 0.2 28)",
      "--red-soft": "oklch(0.94 0.035 28)",
      "--ok": "oklch(0.52 0.12 155)",
      "--binding": desk.binding,
      "--d1": desk.d1,
      "--d2": desk.d2,
      "--d3": desk.d3,
      "--hl": desk.hl,
      "--pattern-ink": plain ? `oklch(0.84 0.02 ${h})` : `oklch(${desk.lightness - 0.06} ${desk.chroma + 0.03} ${h})`,
      "--paper-shadow": `0 1px 0 oklch(0.82 0.035 ${h}), 0 16px 34px -20px oklch(0.3 0.1 ${h} / 0.5)`,
      "--shape-opacity": "1",
    };
  }
  return {
    "--ground": `oklch(0.2 ${plain ? 0.015 : 0.045} ${h})`,
    "--sheet": `oklch(0.245 ${plain ? 0.018 : 0.028} ${h})`,
    "--well": `oklch(0.29 0.03 ${h})`,
    "--rule": `oklch(0.33 0.03 ${h})`,
    "--rule-strong": `oklch(0.44 0.035 ${h})`,
    "--ink": `oklch(0.955 0.01 ${h})`,
    "--ink-2": `oklch(0.79 0.025 ${h})`,
    "--ink-3": `oklch(0.64 0.025 ${h})`,
    "--pen": pen,
    "--pen-soft": `color-mix(in oklch, ${pen} 22%, oklch(0.245 0.028 ${h}))`,
    "--red": "oklch(0.71 0.17 28)",
    "--red-soft": "oklch(0.32 0.07 28)",
    "--ok": "oklch(0.75 0.12 155)",
    "--binding": `color-mix(in oklch, ${desk.binding} 70%, black)`,
    "--d1": desk.d1,
    "--d2": desk.d2,
    "--d3": desk.d3,
    "--hl": `color-mix(in oklch, ${pen} 38%, transparent)`,
    "--pattern-ink": `oklch(0.27 ${plain ? 0.02 : 0.06} ${h})`,
    "--paper-shadow": `0 1px 0 oklch(0.14 0.02 ${h}), 0 18px 38px -22px oklch(0 0 0 / 0.75)`,
    "--shape-opacity": "0.34",
  };
}

/** Resolve any CSS color to #rrggbb (for the status bar and theme-color meta). */
export function toHex(css: string) {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch {
    return "#f3f4f8";
  }
}
