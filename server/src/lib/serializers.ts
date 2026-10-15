/**
 * Mengubah record Prisma menjadi bentuk JSON yang dikirim ke client.
 * `passwordHash` tidak pernah diserialisasi dan field turunan
 * (`isSummary`, `level`, `children`) dihitung dari hierarki tugas.
 */

import type { Assignment, Dependency, Holiday, Project, Resource, Task, User } from '@prisma/client';
import { collectSummaryIds, flattenTasks, parseWeekendDays } from '@gantt/shared';
import type {
  AssignmentDTO,
  DependencyDTO,
  HolidayDTO,
  Priority,
  ProjectDTO,
  ResourceDTO,
  TaskDTO,
  UserDTO,
} from '@gantt/shared';

export function serializeUser(user: Pick<User, 'id' | 'name' | 'email' | 'createdAt'>): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeProject(project: Project): ProjectDTO {
  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    description: project.description,
    startDate: project.startDate,
    weekendDays: parseWeekendDays(project.weekendDays),
    createdAt: project.createdAt.toISOString(),
  };
}

function depthOf(task: Task, byId: Map<string, Task>): number {
  let depth = 0;
  let cursor = task.parentId;
  const guard = new Set<string>();
  while (cursor) {
    if (guard.has(cursor)) break;
    guard.add(cursor);
    depth += 1;
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return depth;
}

export function serializeTask(task: Task, byId: Map<string, Task>, summaryIds: Set<string>): TaskDTO {
  return {
    id: task.id,
    projectId: task.projectId,
    parentId: task.parentId,
    position: task.position,
    name: task.name,
    description: task.description,
    durationDays: task.durationDays,
    startDate: task.startDate,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    priority: task.priority as Priority,
    color: task.color,
    progress: task.progress,
    optimisticDays: task.optimisticDays,
    pessimisticDays: task.pessimisticDays,
    isSummary: summaryIds.has(task.id),
    level: depthOf(task, byId),
    children: [],
  };
}

/** Serialisasi seluruh tugas proyek dalam urutan WBS. */
export function serializeTasks(tasks: Task[]): TaskDTO[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const summaryIds = collectSummaryIds(tasks);
  const ordered = flattenTasks(tasks);
  const childrenOf = new Map<string, string[]>();
  for (const task of ordered) {
    if (!task.parentId) continue;
    const list = childrenOf.get(task.parentId) ?? [];
    list.push(task.id);
    childrenOf.set(task.parentId, list);
  }
  return ordered.map((task) => ({
    ...serializeTask(task, byId, summaryIds),
    children: childrenOf.get(task.id) ?? [],
  }));
}

export function serializeDependency(dependency: Dependency): DependencyDTO {
  return {
    id: dependency.id,
    predecessorId: dependency.predecessorId,
    successorId: dependency.successorId,
    type: dependency.type as DependencyDTO['type'],
    lagDays: dependency.lagDays,
  };
}

export function serializeResource(resource: Resource): ResourceDTO {
  return {
    id: resource.id,
    projectId: resource.projectId,
    name: resource.name,
    email: resource.email,
    role: resource.role,
    salary: resource.salary,
  };
}

export function serializeAssignment(assignment: Assignment): AssignmentDTO {
  return {
    id: assignment.id,
    taskId: assignment.taskId,
    resourceId: assignment.resourceId,
    allocationPercent: assignment.allocationPercent,
  };
}

export function serializeHoliday(holiday: Holiday): HolidayDTO {
  return {
    id: holiday.id,
    projectId: holiday.projectId,
    date: holiday.date,
    name: holiday.name,
  };
}
