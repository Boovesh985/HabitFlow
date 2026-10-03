import { flushSync } from "react-dom";
import { StatusBar, Style } from "@capacitor/status-bar";
import { deskByKey, deskTokens, toHex } from "./desks";
import { isNative } from "./platform";
import { INKS, useUI } from "./store";

/** Paint the desk + theme into CSS variables. Runs before first paint too (see bottom of file). */
export function applyTheme() {
  const { theme, accent, desk } = useUI.getState();
  const root = document.documentElement;
  const d = deskByKey(desk);
  const dark = !!d.alwaysDark || theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.desk = desk;
  const ink = INKS.find((i) => i.key === accent);
  const tokens = deskTokens(d, dark, ink && ink.key !== "desk" ? (dark ? ink.dark : ink.light) : undefined);
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
  const bar = toHex(getComputedStyle(root).getPropertyValue("--ground").trim() || tokens["--ground"]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bar);
  if (isNative) {
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: bar }).catch(() => {});
  }
}
applyTheme();

/** Switch desks with a circular wipe from the point that was tapped (View Transitions where supported). */
export function switchDesk(key: string, at?: { x: number; y: number }) {
  const root = document.documentElement;
  const go = () => {
    flushSync(() => useUI.getState().setDesk(key));
    applyTheme();
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  if (!doc.startViewTransition || reduce) return go();
  root.style.setProperty("--vt-x", at ? `${at.x}px` : "50%");
  root.style.setProperty("--vt-y", at ? `${at.y}px` : "50%");
  doc.startViewTransition(go);
}
