/**
 * Setiap akses data dibatasi oleh pemilik proyek dari token JWT.
 * Data milik pengguna lain selalu dijawab 404 agar keberadaannya tidak terungkap.
 */

import type { Request } from 'express';
import type { Assignment, Dependency, Holiday, Project, Resource, Task } from '@prisma/client';
import { prisma } from '../db.js';
import { notFound, unauthorized } from './errors.js';

export function currentUserId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

export async function getOwnedProject(userId: string, projectId: string): Promise<Project> {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
  if (!project) throw notFound('Proyek tidak ditemukan.');
  return project;
}

export async function getOwnedTask(userId: string, taskId: string): Promise<Task> {
  const task = await prisma.task.findFirst({ where: { id: taskId, project: { ownerId: userId } } });
  if (!task) throw notFound('Tugas tidak ditemukan.');
  return task;
}

export async function getOwnedDependency(userId: string, dependencyId: string): Promise<Dependency> {
  const dependency = await prisma.dependency.findFirst({
    where: { id: dependencyId, predecessor: { project: { ownerId: userId } } },
  });
  if (!dependency) throw notFound('Dependensi tidak ditemukan.');
  return dependency;
}

export async function getOwnedResource(userId: string, resourceId: string): Promise<Resource> {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, project: { ownerId: userId } },
  });
  if (!resource) throw notFound('Anggota tim tidak ditemukan.');
  return resource;
}

export async function getOwnedAssignment(userId: string, assignmentId: string): Promise<Assignment> {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, task: { project: { ownerId: userId } } },
  });
  if (!assignment) throw notFound('Alokasi tidak ditemukan.');
  return assignment;
}

export async function getOwnedHoliday(userId: string, holidayId: string): Promise<Holiday> {
  const holiday = await prisma.holiday.findFirst({
    where: { id: holidayId, project: { ownerId: userId } },
  });
  if (!holiday) throw notFound('Hari libur tidak ditemukan.');
  return holiday;
}

/** Kedalaman struktur tugas (akar = 0). */
export async function taskDepth(taskId: string): Promise<number> {
  let depth = 0;
  let cursor: string | null = taskId;
  const guard = new Set<string>();
  while (cursor) {
    if (guard.has(cursor)) break;
    guard.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.task.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!parent || !parent.parentId) break;
    depth += 1;
    cursor = parent.parentId;
  }
  return depth;
}
