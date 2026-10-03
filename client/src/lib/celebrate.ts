import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNative } from "./platform";
import { useUI } from "./store";

export function tap() {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  else navigator.vibrate?.(6);
}

let audio: AudioContext | null = null;

/** A short, synthesized rubber-stamp "thunk": a low knock plus a puff of noise. No audio files shipped. */
function thunk(weight = 1) {
  if (!useUI.getState().sounds) return;
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(170 * weight, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);

    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const noise = ctx.createBufferSource();
    const ng = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;
    noise.buffer = buf;
    ng.gain.value = 0.12;
    noise.connect(hp).connect(ng).connect(ctx.destination);
    noise.start(t);
  } catch {
    /* audio unavailable */
  }
}

/** Feedback for stamping a single habit. */
export function stamped() {
  thunk(1);
  if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  else navigator.vibrate?.(14);
}

/** Feedback for finishing the whole day. */
export function dayComplete() {
  thunk(0.8);
  setTimeout(() => thunk(0.7), 120);
  if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  else navigator.vibrate?.([18, 60, 26]);
}
