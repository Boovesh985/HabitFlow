import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "error" },
    ...(process.env.NODE_ENV === "development" ? [{ emit: "stdout", level: "warn" } as const] : []),
  ],
});

/**
 * Scale-to-zero Postgres (Neon) suspends after ~5 idle minutes and drops open connections.
 * Close the pool after 4 quiet minutes so the next query opens a fresh connection instead of
 * reusing a dead one. Prisma reconnects on its own at the next query.
 */
const IDLE_MS = 4 * 60_000;
let lastUse = Date.now();
let busy = 0;
let connected = true;

prisma.$on("query", () => {
  lastUse = Date.now();
  connected = true;
});

/** Mark the database as in use until the returned release function is called. */
export function holdDb() {
  busy++;
  lastUse = Date.now();
  connected = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    busy--;
    lastUse = Date.now();
  };
}

setInterval(() => {
  if (connected && busy === 0 && Date.now() - lastUse > IDLE_MS) {
    connected = false;
    prisma.$disconnect().catch(() => {});
  }
}, 30_000).unref();
