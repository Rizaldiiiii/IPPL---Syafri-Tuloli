/**
 * Mesin penjadwalan (blueprint 6.3-6.6).
 *
 * Dipakai server sebagai sumber kebenaran dan client untuk pratinjau saat drag.
 * Tidak ada logika penjadwalan yang boleh diduplikasi di luar modul ini.
 */

import { ProjectCalendar, isWorkingDay, nextWorkingDay, shiftWorkingDays, workingDaysBetween } from './calendar.js';
import { ISODate, maxISODate } from './dates.js';
import { ScheduledTask, SchedulerDependency, SchedulerTask } from './types.js';

export class CyclicDependencyError extends Error {
  readonly code = 'CYCLE_DETECTED';

  constructor(message = 'Dependensi membentuk siklus') {
    super(message);
    this.name = 'CyclicDependencyError';
  }
}

/** Level maksimum kedalaman sub-tugas. */
export const MAX_TASK_DEPTH = 3;

/** Bidang minimum yang dibutuhkan untuk menyusun hierarki tugas. */
export interface OrderedNode {
  id: string;
  parentId: string | null;
  position: number;
}

/** Membangun peta `parentId` ke daftar anak yang sudah diurutkan menurut `position`. */
export function buildChildrenMap<T extends OrderedNode>(tasks: T[]): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    const bucket = map.get(key);
    if (bucket) bucket.push(task);
    else map.set(key, [task]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => (a.position - b.position) || a.id.localeCompare(b.id));
  }
  return map;
}

/** Id tugas yang punya minimal satu anak (tugas induk / summary). */
export function collectSummaryIds(tasks: OrderedNode[]): Set<string> {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (task.parentId) ids.add(task.parentId);
  }
  return ids;
}

/** Urutan tampilan WBS (depth-first mengikuti `position`). */
export function flattenTasks<T extends OrderedNode>(tasks: T[]): T[] {
  const childrenMap = buildChildrenMap(tasks);
  const ordered: T[] = [];
  const visit = (parentId: string | null): void => {
    for (const task of childrenMap.get(parentId) ?? []) {
      ordered.push(task);
      visit(task.id);
    }
  };
  visit(null);
  return ordered;
}

export interface ScheduleInput {
  projectStartDate: ISODate;
  tasks: SchedulerTask[];
  dependencies: SchedulerDependency[];
  calendar: ProjectCalendar;
}

/**
 * Menghitung `scheduledStart` dan `scheduledEnd` seluruh tugas.
 *
 * Urutan: topologis tugas daun (Kahn), lalu roll-up tugas induk dari bawah ke atas.
 */
export function scheduleTasks(input: ScheduleInput): ScheduledTask[] {
  const { tasks, dependencies, calendar } = input;
  const summaryIds = collectSummaryIds(tasks);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const childrenMap = buildChildrenMap(tasks);

  const leafTasks = tasks.filter((task) => !summaryIds.has(task.id));
  const leafIds = new Set(leafTasks.map((task) => task.id));

  const incoming = new Map<string, SchedulerDependency[]>();
  const outgoing = new Map<string, SchedulerDependency[]>();
  for (const dependency of dependencies) {
    if (!leafIds.has(dependency.predecessorId) || !leafIds.has(dependency.successorId)) continue;
    const inList = incoming.get(dependency.successorId) ?? [];
    inList.push(dependency);
    incoming.set(dependency.successorId, inList);
    const outList = outgoing.get(dependency.predecessorId) ?? [];
    outList.push(dependency);
    outgoing.set(dependency.predecessorId, outList);
  }

  // Kahn: hitung derajat masuk lalu proses tugas yang siap.
  const pendingCount = new Map<string, number>();
  for (const task of leafTasks) {
    pendingCount.set(task.id, (incoming.get(task.id) ?? []).length);
  }
  const queue = leafTasks.filter((task) => (pendingCount.get(task.id) ?? 0) === 0).map((task) => task.id);
  const topological: string[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    topological.push(currentId);
    for (const dependency of outgoing.get(currentId) ?? []) {
      const remaining = (pendingCount.get(dependency.successorId) ?? 0) - 1;
      pendingCount.set(dependency.successorId, remaining);
      if (remaining === 0) queue.push(dependency.successorId);
    }
  }
  if (topological.length !== leafTasks.length) {
    throw new CyclicDependencyError('Dependensi membentuk siklus sehingga jadwal tidak dapat dihitung');
  }

  const scheduled = new Map<string, ScheduledTask>();

  for (const taskId of topological) {
    const task = byId.get(taskId);
    if (!task) continue;
    const bounds: ISODate[] = [task.startDate];
    for (const dependency of incoming.get(taskId) ?? []) {
      const predecessor = scheduled.get(dependency.predecessorId);
      if (!predecessor) continue;
      if (dependency.type === 'FS') {
        bounds.push(shiftWorkingDays(calendar, predecessor.scheduledEnd, 1 + dependency.lagDays));
      } else {
        bounds.push(shiftWorkingDays(calendar, predecessor.scheduledStart, dependency.lagDays));
      }
    }
    const scheduledStart = nextWorkingDay(calendar, maxISODate(bounds));
    const scheduledEnd = shiftWorkingDays(calendar, scheduledStart, Math.max(1, task.durationDays) - 1);
    scheduled.set(taskId, {
      ...task,
      durationDays: Math.max(1, task.durationDays),
      scheduledStart,
      scheduledEnd,
      isSummary: false,
      children: [],
      level: 0,
    });
  }

  // Roll-up tugas induk dari level terdalam ke akar.
  const depthCache = new Map<string, number>();
  const depthOf = (taskId: string): number => {
    const cached = depthCache.get(taskId);
    if (cached !== undefined) return cached;
    let depth = 0;
    let cursor = byId.get(taskId)?.parentId ?? null;
    const guard = new Set<string>();
    while (cursor) {
      if (guard.has(cursor)) throw new CyclicDependencyError('Struktur sub-tugas membentuk siklus');
      guard.add(cursor);
      depth += 1;
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    depthCache.set(taskId, depth);
    return depth;
  };

  const orderedTasks = [...tasks].sort((a, b) => depthOf(b.id) - depthOf(a.id));
  for (const task of orderedTasks) {
    if (!summaryIds.has(task.id)) continue;
    const children = (childrenMap.get(task.id) ?? [])
      .map((child) => scheduled.get(child.id))
      .filter((child): child is ScheduledTask => child !== undefined);
    if (children.length === 0) continue;

    const childStarts = children.map((child) => child.scheduledStart);
    const childEnds = children.map((child) => child.scheduledEnd);
    const scheduledStart = childStarts.reduce((acc, value) => (value < acc ? value : acc));
    const scheduledEnd = childEnds.reduce((acc, value) => (value > acc ? value : acc));
    const totalWeight = children.reduce((sum, child) => sum + child.durationDays, 0);
    const weightedProgress = totalWeight > 0
      ? children.reduce((sum, child) => sum + child.progress * child.durationDays, 0) / totalWeight
      : 0;

    const scheduledStartWorking = isWorkingDay(calendar, scheduledStart) ? scheduledStart : nextWorkingDay(calendar, scheduledStart);

    scheduled.set(task.id, {
      ...task,
      durationDays: Math.max(1, workingDaysBetween(calendar, scheduledStartWorking, scheduledEnd)),
      scheduledStart,
      scheduledEnd,
      progress: Math.round(Math.min(100, Math.max(0, weightedProgress))),
      isSummary: true,
      children: children.map((child) => child.id),
      level: depthOf(task.id),
    });
  }

  const wbsOrder = new Map(flattenTasks(tasks).map((task, index) => [task.id, index]));
  return tasks
    .map((task) => {
      const result = scheduled.get(task.id);
      if (!result) throw new Error(`Tugas ${task.id} tidak terjadwal`);
      return { ...result, isSummary: summaryIds.has(task.id), level: depthOf(task.id) };
    })
    .sort((a, b) => (wbsOrder.get(a.id) ?? 0) - (wbsOrder.get(b.id) ?? 0));
}

/**
 * Menggeser tugas (drag bar) dengan menetapkan `startDate` baru.
 * Mengembalikan tanggal awal yang benar-benar dipakai setelah dibatasi predecessor.
 */
export function previewStartDateShift(
  input: ScheduleInput,
  taskId: string,
  targetDate: ISODate,
): { startDate: ISODate; scheduledStart: ISODate; blocked: boolean } {
  const nextTasks = input.tasks.map((task) =>
    task.id === taskId ? { ...task, startDate: targetDate } : task,
  );
  const result = scheduleTasks({ ...input, tasks: nextTasks });
  const scheduled = result.find((task) => task.id === taskId);
  if (!scheduled) throw new Error(`Tugas ${taskId} tidak ditemukan`);
  return {
    startDate: scheduled.startDate,
    scheduledStart: scheduled.scheduledStart,
    blocked: scheduled.scheduledStart > targetDate,
  };
}

/** Menghitung `durationDays` dari hasil resize tepi kanan bar. */
export function durationFromDrag(
  calendar: ProjectCalendar,
  scheduledStart: ISODate,
  targetEnd: ISODate,
): number {
  const end = nextWorkingDay(calendar, targetEnd);
  return Math.max(1, workingDaysBetween(calendar, scheduledStart, end));
}
