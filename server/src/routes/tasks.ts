import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound } from "../lib/http.js";
import { uid } from "../middleware/auth.js";
import { evaluateAchievements, profileStats } from "../services/gamification.js";

export const tasksRouter = Router();

const taskSchema = z.object({
  title: z.string().trim().min(1, "Task needs a title").max(200),
  notes: z.string().max(2000).nullish(),
  priority: z.number().int().min(0).max(2).default(1),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  remindAt: z.string().datetime({ offset: true }).nullish(),
});

const view = (t: Awaited<ReturnType<typeof prisma.task.findFirstOrThrow>>) => ({
  id: t.id,
  title: t.title,
  notes: t.notes,
  priority: t.priority,
  dueAt: t.dueAt,
  remindAt: t.remindAt,
  completedAt: t.completedAt,
  createdAt: t.createdAt,
});

tasksRouter.get("/", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: {
      userId: uid(req),
      // Keep completed tasks visible for a week.
      OR: [{ completedAt: null }, { completedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }],
    },
    orderBy: [{ completedAt: { sort: "desc", nulls: "first" } }, { dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
  });
  res.json({ tasks: tasks.map(view) });
});

tasksRouter.post("/", async (req, res) => {
  const body = taskSchema.parse(req.body);
  const task = await prisma.task.create({
    data: {
      ...body,
      userId: uid(req),
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      remindAt: body.remindAt ? new Date(body.remindAt) : null,
    },
  });
  res.status(201).json({ task: view(task) });
});

tasksRouter.patch("/:id", async (req, res) => {
  const userId = uid(req);
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw notFound("Task");
  const body = taskSchema.partial().extend({ completed: z.boolean().optional() }).parse(req.body);
  const { completed, dueAt, remindAt, ...rest } = body;
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
      ...(remindAt !== undefined ? { remindAt: remindAt ? new Date(remindAt) : null, reminderSentAt: null } : {}),
      ...(completed !== undefined ? { completedAt: completed ? new Date() : null } : {}),
    },
  });
  const extra = completed
    ? { newAchievements: await evaluateAchievements(userId), profile: await profileStats(userId) }
    : {};
  res.json({ task: view(task), ...extra });
});

tasksRouter.delete("/:id", async (req, res) => {
  const result = await prisma.task.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!result.count) throw notFound("Task");
  res.json({ ok: true });
});
