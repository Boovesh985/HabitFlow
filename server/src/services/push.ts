import webpush from "web-push";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { config } from "../config.js";

export const pushEnabled = !!(config.vapid.publicKey && config.vapid.privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
} else {
  console.warn("[push] VAPID keys not configured: web push notifications are disabled");
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, unknown>;
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 },
        );
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        else console.error("[push] send failed", code, (err as Error).message);
      }
    }),
  );
  return sent;
}

/** Short-lived token embedded in a notification so its action buttons work without a session. */
export function actionToken(userId: string, habitId: string, date: string) {
  return jwt.sign({ sub: userId, typ: "action", habitId, date }, config.jwtSecret, { expiresIn: "36h" });
}

export function verifyActionToken(token: string) {
  const p = jwt.verify(token, config.jwtSecret) as { sub: string; typ: string; habitId: string; date: string };
  if (p.typ !== "action") throw new Error("wrong token type");
  return p;
}
