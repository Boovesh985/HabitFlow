import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, formatDay, parseDay } from "../lib/dates";

export interface HeatCell {
  date: string;
  value: number; // 0..1
  label?: string;
}

const GAP = 3;
const LABEL_W = 30;

/** A year of days as ink dots: columns are weeks, rows are Sun..Sat. */
export function Heatmap({ cells, color = "var(--pen)", weeks = 53 }: { cells: HeatCell[]; color?: string; weeks?: number }) {
  const [hover, setHover] = useState<HeatCell | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [CELL, setCell] = useState(12);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setCell(Math.max(10, Math.min(17, Math.floor((el.clientWidth - LABEL_W) / weeks) - GAP)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks]);
  const grid = useMemo(() => {
    const map = new Map(cells.map((c) => [c.date, c]));
    const last = cells[cells.length - 1]?.date;
    if (!last) return [];
    const endDow = parseDay(last).getDay();
    const start = addDays(last, -(weeks * 7 - 1) + (6 - endDow));
    return Array.from({ length: weeks }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = addDays(start, w * 7 + d);
        return day > last ? null : map.get(day) ?? { date: day, value: 0 };
      })
    );
  }, [cells, weeks]);

  const months = useMemo(
    () =>
      grid
        .map((col, i) => {
          const first = col.find(Boolean);
          if (!first) return "";
          const prev = grid[i - 1]?.find(Boolean);
          return !prev || parseDay(prev.date).getMonth() !== parseDay(first.date).getMonth()
            ? parseDay(first.date).toLocaleDateString(undefined, {
                month: "short",
              })
            : "";
        })
        .map((m, i, all) => (m && all.slice(i + 1, i + 3).some(Boolean) ? "" : m)),
    [grid]
  );

  const fill = (v: number) => (v <= 0 ? "var(--well)" : `color-mix(in oklch, ${color} ${Math.round(30 + v * 70)}%, var(--sheet))`);

  return (
    <div ref={box}>
      <div className="overflow-x-auto pb-1" dir="rtl">
        <div dir="ltr" className="inline-block">
          <div className="flex" style={{ gap: GAP, paddingLeft: LABEL_W }}>
            {months.map((m, i) => (
              <div key={i} className="mono overflow-visible !text-[11px] whitespace-nowrap text-ink-3" style={{ width: CELL }}>
                {m}
              </div>
            ))}
          </div>
          <div className="mt-1 flex" style={{ gap: GAP }}>
            <div className="flex flex-col" style={{ gap: GAP, width: LABEL_W - GAP }} aria-hidden>
              {["", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => (
                <div key={i} className="mono !text-[10px] text-ink-3" style={{ height: CELL, lineHeight: `${CELL}px` }}>
                  {l}
                </div>
              ))}
            </div>
            {grid.map((col, i) => (
              <div key={i} className="flex flex-col" style={{ gap: GAP }}>
                {col.map((c, j) =>
                  c ? (
                    <button
                      key={c.date}
                      type="button"
                      onMouseEnter={() => setHover(c)}
                      onFocus={() => setHover(c)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => setHover(c)}
                      className="rounded-full transition-transform hover:scale-125"
                      style={{
                        width: CELL,
                        height: CELL,
                        background: fill(c.value),
                      }}
                      aria-label={`${formatDay(c.date, {
                        month: "short",
                        day: "numeric",
                      })}: ${c.label ?? Math.round(c.value * 100) + "%"}`}
                    />
                  ) : (
                    <div key={j} style={{ width: CELL, height: CELL }} />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap items-center justify-between gap-2 text-[13px] text-ink-2">
        <span aria-live="polite">
          {hover ? (
            <>
              <span className="font-semibold text-ink">
                {formatDay(hover.date, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>{" "}
              · {hover.label ?? `${Math.round(hover.value * 100)}%`}
            </>
          ) : (
            "Point at a day to see it."
          )}
        </span>
        <span className="flex items-center gap-1.5 text-ink-3" aria-hidden>
          Less
          {[0, 0.33, 0.66, 1].map((v) => (
            <span key={v} className="h-2.5 w-2.5 rounded-full" style={{ background: fill(v) }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
