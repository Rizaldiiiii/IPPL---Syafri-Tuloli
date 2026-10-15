import { Router } from 'express';
import { calendarUpdateSchema, holidayCreateSchema, serializeWeekendDays } from '@gantt/shared';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { conflict } from '../lib/errors.js';
import { currentUserId, getOwnedHoliday, getOwnedProject } from '../lib/ownership.js';
import { serializeHoliday, serializeProject } from '../lib/serializers.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recomputeProject } from '../services/recompute.js';

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.put(
  '/projects/:id/calendar',
  validateBody(calendarUpdateSchema),
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    const input = req.body as { weekendDays: number[] };

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { weekendDays: serializeWeekendDays(input.weekendDays) },
    });

    const tasks = await recomputeProject(project.id);
    res.json({ project: serializeProject(updated), tasks });
  }),
);

calendarRouter.post(
  '/projects/:id/holidays',
  validateBody(holidayCreateSchema),
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    const input = req.body as { date: string; name: string };

    const duplicate = await prisma.holiday.findUnique({
      where: { projectId_date: { projectId: project.id, date: input.date } },
    });
    if (duplicate) {
      throw conflict('Hari libur pada tanggal tersebut sudah ada.');
    }

    const holiday = await prisma.holiday.create({
      data: { projectId: project.id, date: input.date, name: input.name },
    });

    const tasks = await recomputeProject(project.id);
    res.status(201).json({ holiday: serializeHoliday(holiday), tasks });
  }),
);

calendarRouter.delete(
  '/holidays/:id',
  asyncHandler(async (req, res) => {
    const holiday = await getOwnedHoliday(currentUserId(req), req.params.id);
    const projectId = holiday.projectId;
    await prisma.holiday.delete({ where: { id: holiday.id } });
    const tasks = await recomputeProject(projectId);
    res.json({ tasks });
  }),
);
