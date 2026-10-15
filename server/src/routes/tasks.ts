import { Router } from 'express';
import {
  MAX_TASK_DEPTH,
  taskCreateSchema,
  taskMoveSchema,
  taskUpdateSchema,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { currentUserId, getOwnedProject, getOwnedTask, taskDepth } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recomputeProject } from '../services/recompute.js';

export const taskRouter = Router();

taskRouter.use(requireAuth);

async function hasChildren(taskId: string): Promise<boolean> {
  const count = await prisma.task.count({ where: { parentId: taskId } });
  return count > 0;
}

async function hasDependenciesOrAssignments(taskId: string): Promise<boolean> {
  const [dependencies, assignments] = await Promise.all([
    prisma.dependency.count({
      where: { OR: [{ predecessorId: taskId }, { successorId: taskId }] },
    }),
    prisma.assignment.count({ where: { taskId } }),
  ]);
  return dependencies > 0 || assignments > 0;
}

/** Tinggi subtree sebuah tugas (0 untuk tugas daun). */
async function subtreeHeight(taskId: string): Promise<number> {
  const children = await prisma.task.findMany({ where: { parentId: taskId }, select: { id: true } });
  if (children.length === 0) return 0;
  let maxChildHeight = 0;
  for (const child of children) {
    maxChildHeight = Math.max(maxChildHeight, await subtreeHeight(child.id));
  }
  return maxChildHeight + 1;
}

/** Memvalidasi calon tugas induk: ada di proyek yang sama, belum punya dependensi/alokasi. */
async function assertCanBecomeParent(projectId: string, parentId: string): Promise<void> {
  const parent = await prisma.task.findFirst({ where: { id: parentId, projectId } });
  if (!parent) throw notFound('Tugas induk tidak ditemukan.');
  if (await hasDependenciesOrAssignments(parentId)) {
    throw conflict(
      'Tugas yang sudah memiliki dependensi atau alokasi tidak dapat dijadikan tugas induk. Hapus dependensi dan alokasinya terlebih dahulu.',
    );
  }
}

taskRouter.post(
  '/projects/:id/tasks',
  validateBody(taskCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const project = await getOwnedProject(userId, req.params.id);
    const input = req.body as {
      name: string;
      description?: string | null;
      parentId?: string | null;
      durationDays: number;
      startDate: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      color: string;
      progress: number;
      optimisticDays?: number | null;
      pessimisticDays?: number | null;
    };

    let parentId: string | null = input.parentId ?? null;
    if (parentId) {
      await assertCanBecomeParent(project.id, parentId);
      const parentDepth = await taskDepth(parentId);
      if (parentDepth + 1 > MAX_TASK_DEPTH - 1) {
        throw badRequest(`Sub-tugas maksimal ${MAX_TASK_DEPTH} level.`);
      }
    } else {
      parentId = null;
    }

    const siblings = await prisma.task.findMany({
      where: { projectId: project.id, parentId },
      select: { position: true },
    });
    const position = siblings.reduce((max, sibling) => Math.max(max, sibling.position), -1) + 1;

    const created = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId,
        position,
        name: input.name,
        description: input.description ?? null,
        durationDays: input.durationDays,
        startDate: input.startDate,
        scheduledStart: input.startDate,
        scheduledEnd: input.startDate,
        priority: input.priority,
        color: input.color,
        progress: input.progress,
        optimisticDays: input.optimisticDays ?? null,
        pessimisticDays: input.pessimisticDays ?? null,
      },
    });

    const tasks = await recomputeProject(project.id);
    const task = tasks.find((item) => item.id === created.id);
    if (!task) throw notFound('Tugas tidak ditemukan setelah perhitungan ulang.');
    res.status(201).json({ task, tasks });
  }),
);

taskRouter.patch(
  '/tasks/:id',
  validateBody(taskUpdateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const task = await getOwnedTask(userId, req.params.id);
    const input = req.body as {
      name?: string;
      description?: string | null;
      durationDays?: number;
      startDate?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
      color?: string;
      progress?: number;
      optimisticDays?: number | null;
      pessimisticDays?: number | null;
    };

    if (await hasChildren(task.id)) {
      const computedFields = ['durationDays', 'startDate', 'progress'] as const;
      const attempted = computedFields.filter((field) => input[field] !== undefined);
      if (attempted.length > 0) {
        throw badRequest(
          'Tugas induk hanya dapat diubah nama, deskripsi, warna, dan prioritasnya. Durasi, tanggal, dan progres dihitung otomatis dari sub-tugas.',
          { fields: attempted },
        );
      }
    }

    await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(input.optimisticDays !== undefined ? { optimisticDays: input.optimisticDays } : {}),
        ...(input.pessimisticDays !== undefined ? { pessimisticDays: input.pessimisticDays } : {}),
      },
    });

    const tasks = await recomputeProject(task.projectId);
    const updated = tasks.find((item) => item.id === task.id);
    if (!updated) throw notFound('Tugas tidak ditemukan setelah perhitungan ulang.');
    res.json({ task: updated, tasks });
  }),
);

taskRouter.delete(
  '/tasks/:id',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const task = await getOwnedTask(userId, req.params.id);
    const projectId = task.projectId;

    // Menghapus tugas induk juga menghapus anak, dependensi, dan alokasinya.
    await prisma.task.delete({ where: { id: task.id } });

    const remaining = await prisma.task.findMany({
      where: { projectId, parentId: task.parentId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await prisma.$transaction(
      remaining.map((sibling, index) =>
        prisma.task.update({ where: { id: sibling.id }, data: { position: index } }),
      ),
    );

    const tasks = await recomputeProject(projectId);
    res.json({ tasks });
  }),
);

taskRouter.post(
  '/tasks/:id/move',
  validateBody(taskMoveSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const task = await getOwnedTask(userId, req.params.id);
    const { parentId, position } = req.body as { parentId: string | null; position: number };

    if (parentId === task.id) {
      throw badRequest('Tugas tidak dapat dipindahkan ke dalam dirinya sendiri.');
    }

    let isDescendant = false;
    if (parentId) {
      await assertCanBecomeParent(task.projectId, parentId);
      const height = await subtreeHeight(task.id);
      const parentDepth = await taskDepth(parentId);
      if (parentDepth + 1 + height > MAX_TASK_DEPTH - 1) {
        throw badRequest(`Sub-tugas maksimal ${MAX_TASK_DEPTH} level.`);
      }

      let cursor: string | null = parentId;
      const guard = new Set<string>();
      while (cursor) {
        if (cursor === task.id) {
          isDescendant = true;
          break;
        }
        if (guard.has(cursor)) break;
        guard.add(cursor);
        const parent: { parentId: string | null } | null = await prisma.task.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = parent?.parentId ?? null;
      }
      if (isDescendant) {
        throw badRequest('Tugas tidak dapat dipindahkan ke dalam sub-tugasnya sendiri.');
      }
    }

    const previousParentId = task.parentId;
    const siblings = await prisma.task.findMany({
      where: { projectId: task.projectId, parentId, NOT: { id: task.id } },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const ordered = siblings.map((sibling) => sibling.id);
    ordered.splice(Math.min(Math.max(0, position), ordered.length), 0, task.id);

    const leftovers = await prisma.task.findMany({
      where: {
        projectId: task.projectId,
        parentId: previousParentId,
        NOT: { id: task.id },
      },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    await prisma.$transaction([
      ...ordered.map((id, index) =>
        prisma.task.update({ where: { id }, data: { position: index, parentId } }),
      ),
      ...(previousParentId !== parentId
        ? leftovers.map((sibling, index) =>
            prisma.task.update({ where: { id: sibling.id }, data: { position: index } }),
          )
        : []),
    ]);

    const tasks = await recomputeProject(task.projectId);
    res.json({ tasks });
  }),
);
