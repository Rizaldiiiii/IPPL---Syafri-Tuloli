import { Router } from 'express';
import { dependencyCreateSchema, dependencyUpdateSchema } from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ApiError, badRequest, notFound } from '../lib/errors.js';
import { currentUserId, getOwnedDependency, getOwnedTask } from '../lib/ownership.js';
import { serializeDependency } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recomputeProject } from '../services/recompute.js';

export const dependencyRouter = Router();

dependencyRouter.use(requireAuth);

/** Menolak dependensi pada tugas induk: hanya tugas daun yang boleh punya dependensi. */
async function assertLeaf(taskId: string, label: string): Promise<void> {
  const children = await prisma.task.count({ where: { parentId: taskId } });
  if (children > 0) {
    throw new ApiError(422, 'BUSINESS_RULE_VIOLATION', `${label} adalah tugas induk. Hanya tugas daun yang dapat memiliki dependensi.`);
  }
}

/** Menelusuri apakah `from` dapat mencapai `to` melalui dependensi yang ada. */
async function isReachable(from: string, to: string): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const outgoing = await prisma.dependency.findMany({
      where: { predecessorId: current },
      select: { successorId: true },
    });
    for (const dependency of outgoing) stack.push(dependency.successorId);
  }
  return false;
}

dependencyRouter.post(
  '/tasks/:id/dependencies',
  validateBody(dependencyCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const successor = await getOwnedTask(userId, req.params.id);
    const input = req.body as { predecessorId: string; type: 'FS' | 'SS'; lagDays: number };

    if (input.predecessorId === successor.id) {
      throw badRequest('Tugas tidak dapat menjadi pendahulu bagi dirinya sendiri.');
    }

    const predecessor = await prisma.task.findFirst({
      where: { id: input.predecessorId, projectId: successor.projectId },
    });
    if (!predecessor) throw notFound('Tugas pendahulu tidak ditemukan pada proyek ini.');

    await assertLeaf(predecessor.id, `Tugas "${predecessor.name}"`);
    await assertLeaf(successor.id, `Tugas "${successor.name}"`);

    const duplicate = await prisma.dependency.findUnique({
      where: {
        predecessorId_successorId: {
          predecessorId: predecessor.id,
          successorId: successor.id,
        },
      },
    });
    if (duplicate) {
      throw badRequest('Dependensi antara kedua tugas tersebut sudah ada.');
    }

    if (await isReachable(successor.id, predecessor.id)) {
      throw new ApiError(422, 'CYCLE_DETECTED', 'Dependensi ini membentuk siklus. Periksa kembali urutan tugas.');
    }

    const created = await prisma.dependency.create({
      data: {
        predecessorId: predecessor.id,
        successorId: successor.id,
        type: input.type,
        lagDays: input.lagDays,
      },
    });

    const tasks = await recomputeProject(successor.projectId);
    res.status(201).json({ dependency: serializeDependency(created), tasks });
  }),
);

dependencyRouter.patch(
  '/dependencies/:id',
  validateBody(dependencyUpdateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const dependency = await getOwnedDependency(userId, req.params.id);
    const input = req.body as { type?: 'FS' | 'SS'; lagDays?: number };

    const updated = await prisma.dependency.update({
      where: { id: dependency.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.lagDays !== undefined ? { lagDays: input.lagDays } : {}),
      },
    });

    const predecessor = await prisma.task.findUnique({ where: { id: dependency.predecessorId } });
    if (!predecessor) throw notFound('Tugas pendahulu tidak ditemukan.');
    const tasks = await recomputeProject(predecessor.projectId);
    res.json({ dependency: serializeDependency(updated), tasks });
  }),
);

dependencyRouter.delete(
  '/dependencies/:id',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const dependency = await getOwnedDependency(userId, req.params.id);
    const predecessor = await prisma.task.findUnique({ where: { id: dependency.predecessorId } });
    if (!predecessor) throw notFound('Tugas pendahulu tidak ditemukan.');

    await prisma.dependency.delete({ where: { id: dependency.id } });
    const tasks = await recomputeProject(predecessor.projectId);
    res.json({ tasks });
  }),
);
