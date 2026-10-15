import { Router } from 'express';
import { projectCreateSchema, projectUpdateSchema, serializeWeekendDays } from '@gantt/shared';
import type { ProjectListResponseDTO, ProjectListItemDTO } from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getOwnedProject } from '../lib/ownership.js';
import { currentUserId } from '../lib/ownership.js';
import { serializeProject } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recomputeProject } from '../services/recompute.js';
import { getProjectSnapshot } from '../services/snapshot.js';

export const projectRouter = Router();

projectRouter.use(requireAuth);

projectRouter.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const projects = await prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: { select: { scheduledStart: true, scheduledEnd: true, parentId: true } },
        _count: { select: { resources: true } },
      },
    });

    const items: ProjectListItemDTO[] = projects.map((project) => {
      const starts = project.tasks.map((task) => task.scheduledStart).sort();
      const ends = project.tasks.map((task) => task.scheduledEnd).sort();
      return {
        ...serializeProject(project),
        taskCount: project.tasks.length,
        resourceCount: project._count.resources,
        scheduledStart: starts.length > 0 ? starts[0] : null,
        scheduledEnd: ends.length > 0 ? ends[ends.length - 1] : null,
      };
    });

    const body: ProjectListResponseDTO = { projects: items };
    res.json(body);
  }),
);

projectRouter.post(
  '/projects',
  validateBody(projectCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const input = req.body as {
      name: string;
      description?: string | null;
      startDate: string;
      weekendDays?: number[];
    };
    const project = await prisma.project.create({
      data: {
        ownerId: userId,
        name: input.name,
        description: input.description ?? null,
        startDate: input.startDate,
        weekendDays: serializeWeekendDays(input.weekendDays ?? [0, 6]),
      },
    });
    res.status(201).json({ project: serializeProject(project) });
  }),
);

projectRouter.get(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    res.json(await getProjectSnapshot(project.id));
  }),
);

projectRouter.patch(
  '/projects/:id',
  validateBody(projectUpdateSchema),
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    const input = req.body as { name?: string; description?: string | null; startDate?: string };

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      },
    });

    const tasks = await recomputeProject(project.id);
    res.json({ project: serializeProject(updated), tasks });
  }),
);

projectRouter.delete(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    await prisma.project.delete({ where: { id: project.id } });
    res.status(204).end();
  }),
);
