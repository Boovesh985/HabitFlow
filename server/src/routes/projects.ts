import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { notFound } from "../lib/http.js";
import { uid } from "../middleware/auth.js";
import { evaluateAchievements, profileStats } from "../services/gamification.js";

export const projectsRouter = Router();

const projectFields = z.object({
  kind: z.enum(["PROJECT", "COURSE"]),
  title: z.string().trim().min(1, "Give it a name").max(120),
  description: z.string().max(2000).nullish(),
  icon: z.string().max(16),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  deadline: z.string().datetime({ offset: true }).nullish(),
  totalUnits: z.number().int().min(1).max(10000).nullish(),
  unitLabel: z.string().trim().max(20).nullish(),
  habitId: z.string().uuid().nullish(),
  nudge: z.boolean(),
});

const createSchema = projectFields.extend({
  kind: projectFields.shape.kind.default("PROJECT"),
  icon: projectFields.shape.icon.default("target"),
  color: projectFields.shape.color.default("#2f45d6"),
  nudge: projectFields.shape.nudge.default(true),
  steps: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
});

const updateSchema = projectFields.partial().extend({
  completed: z.boolean().optional(),
  archived: z.boolean().optional(),
});

const withSteps = { steps: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } satisfies Prisma.ProjectInclude;
type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof withSteps }>;

export function projectView(p: ProjectRow) {
  const stepsDone = p.steps.filter((s) => s.doneAt).length;
  // Courses with a unit count track progress by units; everything else by checklist.
  const byUnits = p.kind === "COURSE" && !!p.totalUnits;
  const progress = byUnits ? Math.min(1, p.unitsDone / p.totalUnits!) : p.steps.length ? stepsDone / p.steps.length : p.completedAt ? 1 : 0;
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    description: p.description,
    icon: p.icon,
    color: p.color,
    deadline: p.deadline,
    totalUnits: p.totalUnits,
    unitsDone: p.unitsDone,
    unitLabel: p.unitLabel,
    habitId: p.habitId,
    nudge: p.nudge,
    lastActivityAt: p.lastActivityAt,
    completedAt: p.completedAt,
    archivedAt: p.archivedAt,
    createdAt: p.createdAt,
    progress,
    stepsDone,
    steps: p.steps.map((s) => ({ id: s.id, title: s.title, doneAt: s.doneAt })),
    nextStep: p.steps.find((s) => !s.doneAt)?.title ?? null,
  };
}

async function own(userId: string, id: string) {
  const p = await prisma.project.findFirst({ where: { id, userId }, include: withSteps });
  if (!p) throw notFound("Project");
  return p;
}

/** Progress events earn XP and can unlock achievements; send both back with the project. */
async function reply(userId: string, id: string, rewarding: boolean) {
  const project = projectView(await own(userId, id));
  if (!rewarding) return { project };
  return { project, newAchievements: await evaluateAchievements(userId), profile: await profileStats(userId) };
}

const touch = (id: string) => prisma.project.update({ where: { id }, data: { lastActivityAt: new Date() } });

projectsRouter.get("/", async (req, res) => {
  const all = req.query.all === "true";
  const projects = await prisma.project.findMany({
    where: {
      userId: uid(req),
      ...(all ? {} : { archivedAt: null }),
    },
    include: withSteps,
    orderBy: [{ completedAt: { sort: "desc", nulls: "first" } }, { deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
  res.json({ projects: projects.map(projectView) });
});

projectsRouter.get("/:id", async (req, res) => {
  res.json({ project: projectView(await own(uid(req), req.params.id)) });
});

projectsRouter.post("/", async (req, res) => {
  const userId = uid(req);
  const { steps, deadline, habitId, ...body } = createSchema.parse(req.body);
  if (habitId && !(await prisma.habit.findFirst({ where: { id: habitId, userId } }))) throw notFound("Habit");
  const p = await prisma.project.create({
    data: {
      ...body,
      userId,
      habitId: habitId ?? null,
      deadline: deadline ? new Date(deadline) : null,
      steps: steps?.length ? { create: steps.map((title, i) => ({ title, sortOrder: i })) } : undefined,
    },
  });
  res.status(201).json(await reply(userId, p.id, false));
});

projectsRouter.patch("/:id", async (req, res) => {
  const userId = uid(req);
  const existing = await own(userId, req.params.id);
  const { completed, archived, deadline, habitId, ...rest } = updateSchema.parse(req.body);
  if (habitId && !(await prisma.habit.findFirst({ where: { id: habitId, userId } }))) throw notFound("Habit");
  const deadlineChanged = deadline !== undefined && (deadline ? new Date(deadline).getTime() : null) !== existing.deadline?.getTime();
  await prisma.project.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(habitId !== undefined ? { habitId } : {}),
      // A new deadline restarts the countdown reminders.
      ...(deadlineChanged ? { deadline: deadline ? new Date(deadline) : null, deadlineStage: 0 } : {}),
      ...(completed !== undefined ? { completedAt: completed ? new Date() : null } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      lastActivityAt: new Date(),
    },
  });
  res.json(await reply(userId, existing.id, completed === true));
});

projectsRouter.delete("/:id", async (req, res) => {
  const r = await prisma.project.deleteMany({ where: { id: req.params.id, userId: uid(req) } });
  if (!r.count) throw notFound("Project");
  res.json({ ok: true });
});

/* ---------- steps ---------- */

projectsRouter.post("/:id/steps", async (req, res) => {
  const userId = uid(req);
  const p = await own(userId, req.params.id);
  const { titles } = z.object({ titles: z.array(z.string().trim().min(1).max(200)).min(1).max(100) }).parse(req.body);
  const start = p.steps.length ? Math.max(...p.steps.map((s) => s.sortOrder)) + 1 : 0;
  await prisma.projectStep.createMany({ data: titles.map((title, i) => ({ projectId: p.id, title, sortOrder: start + i })) });
  await touch(p.id);
  res.status(201).json(await reply(userId, p.id, false));
});

projectsRouter.patch("/:id/steps/:stepId", async (req, res) => {
  const userId = uid(req);
  const p = await own(userId, req.params.id);
  const step = p.steps.find((s) => s.id === req.params.stepId);
  if (!step) throw notFound("Step");
  const body = z.object({ title: z.string().trim().min(1).max(200).optional(), done: z.boolean().optional() }).parse(req.body);
  await prisma.projectStep.update({
    where: { id: step.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.done !== undefined ? { doneAt: body.done ? (step.doneAt ?? new Date()) : null } : {}),
    },
  });
  await touch(p.id);
  res.json(await reply(userId, p.id, body.done === true));
});

projectsRouter.delete("/:id/steps/:stepId", async (req, res) => {
  const userId = uid(req);
  const p = await own(userId, req.params.id);
  const r = await prisma.projectStep.deleteMany({ where: { id: req.params.stepId, projectId: p.id } });
  if (!r.count) throw notFound("Step");
  res.json(await reply(userId, p.id, false));
});

projectsRouter.post("/:id/steps/reorder", async (req, res) => {
  const userId = uid(req);
  const p = await own(userId, req.params.id);
  const { ids } = z.object({ ids: z.array(z.string()).max(500) }).parse(req.body);
  const mine = new Set(p.steps.map((s) => s.id));
  await prisma.$transaction(ids.filter((id) => mine.has(id)).map((id, i) => prisma.projectStep.update({ where: { id }, data: { sortOrder: i } })));
  res.json(await reply(userId, p.id, false));
});

/* ---------- course units ---------- */

projectsRouter.post("/:id/units", async (req, res) => {
  const userId = uid(req);
  const p = await own(userId, req.params.id);
  const { delta } = z.object({ delta: z.number().int().min(-100).max(100) }).parse(req.body);
  const next = Math.max(0, Math.min(p.totalUnits ?? Number.MAX_SAFE_INTEGER, p.unitsDone + delta));
  await prisma.project.update({ where: { id: p.id }, data: { unitsDone: next, lastActivityAt: new Date() } });
  res.json(await reply(userId, p.id, delta > 0));
});
