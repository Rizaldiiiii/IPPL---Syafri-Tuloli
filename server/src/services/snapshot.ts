import type { ProjectSnapshotDTO } from '@gantt/shared';
import { prisma } from '../db.js';
import { notFound } from '../lib/errors.js';
import {
  serializeAssignment,
  serializeDependency,
  serializeHoliday,
  serializeProject,
  serializeResource,
  serializeTasks,
} from '../lib/serializers.js';

/**
 * Snapshot lengkap proyek: proyek, tugas, dependensi, resource, assignment, holiday.
 * Dipakai `GET /api/projects/:id` dan perhitungan analisis.
 */
export async function getProjectSnapshot(projectId: string): Promise<ProjectSnapshotDTO> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      holidays: { orderBy: { date: 'asc' } },
      resources: { orderBy: { name: 'asc' } },
    },
  });
  if (!project) throw notFound('Proyek tidak ditemukan.');

  const [tasks, dependencies, assignments] = await Promise.all([
    prisma.task.findMany({ where: { projectId } }),
    prisma.dependency.findMany({ where: { predecessor: { projectId } } }),
    prisma.assignment.findMany({ where: { task: { projectId } } }),
  ]);

  return {
    project: serializeProject(project),
    tasks: serializeTasks(tasks),
    dependencies: dependencies.map(serializeDependency),
    resources: project.resources.map(serializeResource),
    assignments: assignments.map(serializeAssignment),
    holidays: project.holidays.map(serializeHoliday),
  };
}
