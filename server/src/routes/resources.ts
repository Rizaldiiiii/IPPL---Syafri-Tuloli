import { Router } from 'express';
import { resourceCreateSchema, resourceUpdateSchema } from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { currentUserId, getOwnedProject, getOwnedResource } from '../lib/ownership.js';
import { serializeResource } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const resourceRouter = Router();

resourceRouter.use(requireAuth);

resourceRouter.get(
  '/projects/:id/resources',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    const resources = await prisma.resource.findMany({
      where: { projectId: project.id },
      orderBy: { name: 'asc' },
    });
    res.json({ resources: resources.map(serializeResource) });
  }),
);

resourceRouter.post(
  '/projects/:id/resources',
  validateBody(resourceCreateSchema),
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    const input = req.body as { name: string; email: string; role: string; salary: number };
    const resource = await prisma.resource.create({
      data: {
        projectId: project.id,
        name: input.name,
        email: input.email,
        role: input.role,
        salary: input.salary,
      },
    });
    res.status(201).json({ resource: serializeResource(resource) });
  }),
);

resourceRouter.patch(
  '/resources/:id',
  validateBody(resourceUpdateSchema),
  asyncHandler(async (req, res) => {
    const resource = await getOwnedResource(currentUserId(req), req.params.id);
    const input = req.body as { name?: string; email?: string; role?: string; salary?: number };
    const updated = await prisma.resource.update({
      where: { id: resource.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.salary !== undefined ? { salary: input.salary } : {}),
      },
    });
    res.json({ resource: serializeResource(updated) });
  }),
);

resourceRouter.delete(
  '/resources/:id',
  asyncHandler(async (req, res) => {
    const resource = await getOwnedResource(currentUserId(req), req.params.id);
    // Menghapus anggota juga menghapus seluruh alokasinya.
    await prisma.resource.delete({ where: { id: resource.id } });
    res.status(204).end();
  }),
);
