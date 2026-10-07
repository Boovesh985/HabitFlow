import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError, notFound } from "../lib/http.js";
import { addDays, isValidDay, toDate, todayInTz, type Day } from "../lib/dates.js";
import { uid } from "../middleware/auth.js";
import { checkInView, habitView } from "../services/habitView.js";
import { evaluateAchievements, profileStats } from "../services/gamification.js";

export const habitsRouter = Router();

/** The client sends its local calendar date; fall back to the user's stored timezone. */
export async function resolveToday(req: Request): Promise<Day> {
  const q = typeof req.query.date === "string" ? req.query.date : undefined;
  if (q && isValidDay(q)) return q;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) }, select: { timezone: true } });
  return todayInTz(user.timezone);
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");
const dow = z.array(z.number().int().min(0).max(6)).max(7);

const reminderSchema = z.object({
  time: hhmm,
  daysOfWeek: dow.default([]),
  message: z.string().max(140).nullish(),
  enabled: z.boolean().default(true),
});

// Field rules without defaults: used as-is for edits, so a partial update never resets unsent fields.
const habitFields = z.object({
  name: z.string().trim().min(1, "Give your habit a name").max(80),
  description: z.string().max(500).nullish(),
  icon: z.string().max(16),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  category: z.string().trim().max(40),
  kind: z.enum(["BUILD", "QUIT"]),
  frequencyType: z.enum(["DAILY", "WEEKLY_DAYS", "TIMES_PER_WEEK"]),
  daysOfWeek: dow,
  timesPerWeek: z.number().int().min(1).max(7),
  targetCount: z.number().int().min(1).max(1000),
  unit: z.string().max(20).nullish(),
  startDate: z.string().refine(isValidDay, "Invalid start date").optional(),
  stackAfterId: z.string().uuid().nullish(),
  reminders: z.array(reminderSchema).max(10).optional(),
});

const createHabitSchema = habitFields.extend({
  icon: habitFields.shape.icon.default("leaf"),
  color: habitFields.shape.color.default("#2f45d6"),
  category: habitFields.shape.category.default("General"),
  kind: habitFields.shape.kind.default("BUILD"),
  frequencyType: habitFields.shape.frequencyType.default("DAILY"),
  daysOfWeek: dow.default([]),
  timesPerWeek: habitFields.shape.timesPerWeek.default(3),
  targetCount: habitFields.shape.targetCount.default(1),
});

const updateHabitSchema = habitFields.partial();

const include = { checkIns: true, reminders: { orderBy: { time: "asc" as const } } };

async function ownHabit(userId: string, id: string) {
  const h = await prisma.habit.findFirst({ where: { id, userId }, include });
  if (!h) throw notFound("Habit");
  return h;
}

habitsRouter.get("/", async (req, res) => {
  const today = await resolveToday(req);
  const archived = req.query.archived === "true";
  const habits = await prisma.habit.findMany({
    where: { userId: uid(req), archivedAt: archived ? { not: null } : null },
    include,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ today, habits: habits.map((h) => habitView(h, today)) });
});

habitsRouter.post("/", async (req, res) => {
  const userId = uid(req);
  const today = await resolveToday(req);
  const { reminders, startDate, ...data } = createHabitSchema.parse(req.body);
  if (data.stackAfterId) await ownHabit(userId, data.stackAfterId);
  const count = await prisma.habit.count({ where: { userId } });
  const habit = await prisma.habit.create({
    data: {
      ...data,
      userId,
      sortOrder: count,
      startDate: toDate(startDate ?? today),
      reminders: reminders?.length ? { create: reminders.map((r) => ({ ...r, userId })) } : undefined,
    },
    include,
  });
  const newAchievements = await evaluateAchievements(userId, today);
  res.status(201).json({ habit: habitView(habit, today), newAchievements });
});

habitsRouter.get("/:id", async (req, res) => {
  const today = await resolveToday(req);
  const h = await ownHabit(uid(req), req.params.id);
  res.json({ habit: { ...habitView(h, today, 0), history: h.checkIns.map(checkInView) } });
});

habitsRouter.patch("/:id", async (req, res) => {
  const userId = uid(req);
  const today = await resolveToday(req);
  await ownHabit(userId, req.params.id);
  const { reminders, startDate, ...data } = updateHabitSchema.parse(req.body);
  if (data.stackAfterId) {
    if (data.stackAfterId === req.params.id) throw new HttpError(400, "A habit can't stack on itself");
    await ownHabit(userId, data.stackAfterId);
  }
  const habit = await prisma.$transaction(async (tx) => {
    if (reminders) {
      await tx.reminder.deleteMany({ where: { habitId: req.params.id } });
      if (reminders.length)
        await tx.reminder.createMany({ data: reminders.map((r) => ({ ...r, userId, habitId: req.params.id })) });
    }
    return tx.habit.update({
      where: { id: req.params.id },
      data: { ...data, ...(startDate ? { startDate: toDate(startDate) } : {}) },
      include,
    });
  });
  res.json({ habit: habitView(habit, today) });
});

habitsRouter.post("/:id/archive", async (req, res) => {
  const userId = uid(req);
  const today = await resolveToday(req);
  const h = await ownHabit(userId, req.params.id);
  const habit = await prisma.habit.update({
    where: { id: h.id },
    data: { archivedAt: h.archivedAt ? null : new Date() },
    include,
  });
  res.json({ habit: habitView(habit, today) });
});

habitsRouter.delete("/:id", async (req, res) => {
  const h = await ownHabit(uid(req), req.params.id);
  await prisma.habit.delete({ where: { id: h.id } });
  res.json({ ok: true });
});

habitsRouter.post("/reorder", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()).max(500) }).parse(req.body);
  const userId = uid(req);
  await prisma.$transaction(
    ids.map((id, i) => prisma.habit.updateMany({ where: { id, userId }, data: { sortOrder: i } })),
  );
  res.json({ ok: true });
});

const checkInSchema = z.object({
  status: z.enum(["DONE", "SKIPPED", "FROZEN", "SLIP"]).default("DONE"),
  count: z.number().int().min(0).max(100000).optional(),
  delta: z.number().int().min(-1000).max(1000).optional(),
  note: z.string().max(1000).nullish(),
});

habitsRouter.put("/:id/checkins/:date", async (req, res) => {
  const userId = uid(req);
  const { date } = req.params;
  if (!isValidDay(date)) throw new HttpError(400, "Invalid date");
  const today = await resolveToday(req);
  if (date > addDays(today, 1)) throw new HttpError(400, "You can't check in for the future");
  const habit = await ownHabit(userId, req.params.id);
  const body = checkInSchema.parse(req.body);
  const existing = habit.checkIns.find((c) => c.date.getTime() === toDate(date).getTime());

  if (body.status === "FROZEN") {
    if (date >= today) throw new HttpError(400, "Streak freezes can only repair past days");
    if (existing?.status !== "FROZEN") {
      const { streakFreezes } = await profileStats(userId);
      if (streakFreezes < 1) throw new HttpError(400, "No streak freezes left. Earn one every 25 completions!");
    }
  }

  let count = body.count ?? (body.status === "DONE" ? habit.targetCount : 0);
  if (body.delta !== undefined) {
    const base = existing?.status === "DONE" ? existing.count : 0;
    // Tapping +1 stops at the goal, so one tap of -1 always takes the last one back.
    count = Math.max(0, body.delta > 0 ? Math.min(Math.max(base, habit.targetCount), base + body.delta) : base + body.delta);
  }

  // Zero of a DONE habit means "nothing logged"; keep the row only if it still carries a note.
  const keepsNote = body.note !== undefined ? !!body.note : !!existing?.note;
  if (body.status === "DONE" && count === 0 && !keepsNote) {
    if (existing) await prisma.checkIn.delete({ where: { id: existing.id } });
  } else {
    await prisma.checkIn.upsert({
      where: { habitId_date: { habitId: habit.id, date: toDate(date) } },
      create: { habitId: habit.id, userId, date: toDate(date), status: body.status, count, note: body.note ?? null },
      update: { status: body.status, count, ...(body.note !== undefined ? { note: body.note } : {}) },
    });
  }

  const [fresh, newAchievements, profile] = await Promise.all([
    ownHabit(userId, habit.id),
    evaluateAchievements(userId, today),
    profileStats(userId),
  ]);
  res.json({ habit: habitView(fresh, today), newAchievements, profile });
});

habitsRouter.delete("/:id/checkins/:date", async (req, res) => {
  const userId = uid(req);
  const { date } = req.params;
  if (!isValidDay(date)) throw new HttpError(400, "Invalid date");
  const today = await resolveToday(req);
  const habit = await ownHabit(userId, req.params.id);
  await prisma.checkIn.deleteMany({ where: { habitId: habit.id, date: toDate(date) } });
  const [fresh, profile] = await Promise.all([ownHabit(userId, habit.id), profileStats(userId)]);
  res.json({ habit: habitView(fresh, today), profile });
});
