import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { DESKS, deskTokens } from "../lib/desks";
import { useUI } from "../lib/store";
import { switchDesk } from "../lib/theme";
import { tap } from "../lib/celebrate";
import { ShapeArt } from "./Desk";
import { StampMark } from "./Stamp";

/** Desk templates as small scenes: the ground, two of its shapes and a slip of paper stamped in its pen. */
export function DeskPicker() {
  const current = useUI((s) => s.desk);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Desk">
      {DESKS.map((d) => {
        const t = deskTokens(d, false);
        const on = current === d.key;
        const [a, b] = d.shapes;
        return (
          <motion.button
            key={d.key}
            type="button"
            role="radio"
            aria-checked={on}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              tap();
              switchDesk(d.key, { x: e.clientX, y: e.clientY });
            }}
            className="group text-left"
          >
            <span
              className="relative block aspect-[4/3] overflow-hidden rounded-[12px] transition-[box-shadow] duration-200"
              style={{
                background: t["--ground"],
                boxShadow: on ? "0 0 0 2.5px var(--ink), 0 0 0 5px var(--sheet)" : "inset 0 0 0 1px oklch(0 0 0 / 0.08)",
              }}
            >
              {a && (
                <svg
                  viewBox="0 0 100 100"
                  className="absolute -top-[18%] -right-[14%] w-[62%] transition-transform duration-500 group-hover:rotate-12"
                  style={{ mixBlendMode: d.alwaysDark ? "screen" : "multiply", opacity: d.alwaysDark ? 0.8 : 1 }}
                >
                  <ShapeArt kind={a.kind} color={d[`d${a.tone}`]} />
                </svg>
              )}
              {b && (
                <svg
                  viewBox="0 0 100 100"
                  className="absolute -bottom-[22%] -left-[12%] w-[55%] transition-transform duration-500 group-hover:-rotate-12"
                  style={{ mixBlendMode: d.alwaysDark ? "screen" : "multiply", opacity: d.alwaysDark ? 0.8 : 1 }}
                >
                  <ShapeArt kind={b.kind} color={d[`d${b.tone}`]} />
                </svg>
              )}
              <span
                className="absolute top-[24%] left-[22%] flex h-[56%] w-[52%] -rotate-3 flex-col rounded-[6px] p-[7%] shadow-[0_8px_18px_-10px_oklch(0.2_0.05_266/0.6)]"
                style={{ background: t["--sheet"] }}
              >
                <span className="block h-[16%] rounded-[2px]" style={{ background: d.binding }} />
                <span className="mt-auto flex items-end justify-between">
                  <span className="numeral text-[26px] font-black" style={{ color: t["--ink"] }}>
                    {new Date().getDate()}
                  </span>
                  <StampMark color={d.alwaysDark ? d.pen.dark : d.pen.light} size={22} seed={d.key} animate={false} soft />
                </span>
              </span>
              {on && (
                <span className="absolute top-2 left-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-sheet">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="mt-2 block text-[15px] font-semibold">{d.name}</span>
            <span className="block text-[13px] leading-snug text-ink-2">{d.blurb}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
