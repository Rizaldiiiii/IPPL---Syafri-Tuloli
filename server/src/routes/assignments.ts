import { Router } from 'express';
import { assignmentCreateSchema, assignmentUpdateSchema } from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ApiError, conflict, notFound } from '../lib/errors.js';
import { currentUserId, getOwnedAssignment, getOwnedTask } from '../lib/ownership.js';
import { serializeAssignment } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const assignmentRouter = Router();

assignmentRouter.use(requireAuth);

assignmentRouter.post(
  '/tasks/:id/assignments',
  validateBody(assignmentCreateSchema),
  asyncHandler(async (req, res) => {
    const userId = currentUserId(req);
    const task = await getOwnedTask(userId, req.params.id);
    const input = req.body as { resourceId: string; allocationPercent: number };

    const children = await prisma.task.count({ where: { parentId: task.id } });
    if (children > 0) {
      throw new ApiError(
        422,
        'BUSINESS_RULE_VIOLATION',
        'Tugas induk tidak dapat dialokasikan. Pilih tugas daun.',
      );
    }

    const resource = await prisma.resource.findFirst({
      where: { id: input.resourceId, projectId: task.projectId },
    });
    if (!resource) throw notFound('Anggota tim tidak ditemukan pada proyek ini.');

    const existing = await prisma.assignment.findUnique({
      where: { taskId_resourceId: { taskId: task.id, resourceId: resource.id } },
    });
    if (existing) {
      throw conflict('Anggota tersebut sudah dialokasikan pada tugas ini.');
    }

    const assignment = await prisma.assignment.create({
      data: {
        taskId: task.id,
        resourceId: resource.id,
        allocationPercent: input.allocationPercent,
      },
    });
    res.status(201).json({ assignment: serializeAssignment(assignment) });
  }),
);

assignmentRouter.patch(
  '/assignments/:id',
  validateBody(assignmentUpdateSchema),
  asyncHandler(async (req, res) => {
    const assignment = await getOwnedAssignment(currentUserId(req), req.params.id);
    const input = req.body as { allocationPercent: number };
    const updated = await prisma.assignment.update({
      where: { id: assignment.id },
      data: { allocationPercent: input.allocationPercent },
    });
    res.json({ assignment: serializeAssignment(updated) });
  }),
);

assignmentRouter.delete(
  '/assignments/:id',
  asyncHandler(async (req, res) => {
    const assignment = await getOwnedAssignment(currentUserId(req), req.params.id);
    await prisma.assignment.delete({ where: { id: assignment.id } });
    res.status(204).end();
  }),
);
