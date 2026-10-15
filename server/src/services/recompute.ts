/**
 * Menjalankan ulang mesin penjadwalan `shared` dan menyimpan hasilnya.
 *
 * Server adalah sumber kebenaran: setiap perubahan tugas, dependensi, durasi,
 * atau kalender memanggil `recomputeProject` dan mengembalikan seluruh daftar
 * tugas terbaru kepada client.
 */

import type { Dependency, Holiday, Task } from '@prisma/client';
import {
  CyclicDependencyError,
  createCalendar,
  parseWeekendDays,
  scheduleTasks,
} from '@gantt/shared';
import type {
  Priority,
  ScheduledTask,
  SchedulerDependency,
  SchedulerTask,
  TaskDTO,
} from '@gantt/shared';
import { prisma } from '../db.js';
import { ApiError, notFound } from '../lib/errors.js';
import { serializeTasks } from '../lib/serializers.js';

export interface ProjectScheduleSource {
  id: string;
  startDate: string;
  weekendDays: string;
  tasks: Task[];
  holidays: Holiday[];
}

export function buildSchedulerTasks(tasks: Task[]): SchedulerTask[] {
  return tasks.map((task) => ({
    id: task.id,
    parentId: task.parentId,
    position: task.position,
    name: task.name,
    durationDays: task.durationDays,
    startDate: task.startDate,
    priority: task.priority as Priority,
    progress: task.progress,
  }));
}

export function buildSchedulerDependencies(dependencies: Dependency[]): SchedulerDependency[] {
  return dependencies.map((dependency) => ({
    id: dependency.id,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type as SchedulerDependency['type'],
    lagDays: dependency.lagDays,
  }));
}

/** Menghitung jadwal dari data yang sudah dimuat tanpa query tambahan. */
export function computeSchedule(
  project: Pick<ProjectScheduleSource, 'startDate' | 'weekendDays' | 'tasks' | 'holidays'>,
  dependencies: Dependency[],
): ScheduledTask[] {
  const calendar = createCalendar(
    parseWeekendDays(project.weekendDays),
    project.holidays.map((holiday) => holiday.date),
  );
  try {
    return scheduleTasks({
      projectStartDate: project.startDate,
      tasks: buildSchedulerTasks(project.tasks),
      dependencies: buildSchedulerDependencies(dependencies),
      calendar,
    });
  } catch (error) {
    if (error instanceof CyclicDependencyError) {
      throw new ApiError(422, 'CYCLE_DETECTED', error.message);
    }
    throw error;
  }
}

async function persistSchedule(projectId: string, scheduled: ScheduledTask[]): Promise<TaskDTO[]> {
  await prisma.$transaction(
    scheduled.map((task) =>
      prisma.task.update({
        where: { id: task.id },
        data: {
          scheduledStart: task.scheduledStart,
          scheduledEnd: task.scheduledEnd,
          durationDays: task.durationDays,
          ...(task.isSummary ? { progress: task.progress } : {}),
        },
      }),
    ),
  );
  const tasks = await prisma.task.findMany({ where: { projectId } });
  return serializeTasks(tasks);
}

/** Menghitung ulang jadwal sebuah proyek dan mengembalikan seluruh tugas terbaru. */
export async function recomputeProject(projectId: string): Promise<TaskDTO[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { tasks: true, holidays: true },
  });
  if (!project) throw notFound('Proyek tidak ditemukan.');
  const dependencies = await prisma.dependency.findMany({
    where: { predecessor: { projectId } },
  });
  const scheduled = computeSchedule(project, dependencies);
  return persistSchedule(projectId, scheduled);
}
