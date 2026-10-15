/**
 * Critical Path Method (blueprint 6.8), hanya untuk tugas daun.
 *
 * Ordinal hari kerja: `ord(d)` = jumlah hari kerja dari awal proyek (ordinal 0)
 * sampai `d`. Semua perhitungan memakai ordinal sehingga lag dalam hari kerja
 * dapat dijumlahkan langsung.
 */

import { ProjectCalendar, workingDaysBetween, nextWorkingDay, shiftWorkingDays } from './calendar.js';
import { ISODate } from './dates.js';
import { CpmActivity, CpmResult, ScheduledTask, SchedulerDependency } from './types.js';

export interface CpmInput {
  projectStartDate: ISODate;
  tasks: ScheduledTask[];
  dependencies: SchedulerDependency[];
  calendar: ProjectCalendar;
}

/** Ordinal hari kerja sebuah tanggal relatif terhadap awal proyek. */
export function ordinalOf(calendar: ProjectCalendar, projectStartDate: ISODate, date: ISODate): number {
  return Math.max(0, workingDaysBetween(calendar, projectStartDate, date) - 1);
}

/** Tanggal dari ordinal hari kerja. */
export function dateFromOrdinal(
  calendar: ProjectCalendar,
  projectStartDate: ISODate,
  ordinal: number,
): ISODate {
  const firstWorkingDay = nextWorkingDay(calendar, projectStartDate);
  return shiftWorkingDays(calendar, firstWorkingDay, Math.max(0, ordinal));
}

function topologicalOrder(ids: string[], dependencies: SchedulerDependency[]): string[] {
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const dependency of dependencies) {
    if (!indegree.has(dependency.predecessorId) || !indegree.has(dependency.successorId)) continue;
    const list = outgoing.get(dependency.predecessorId) ?? [];
    list.push(dependency.successorId);
    outgoing.set(dependency.predecessorId, list);
    indegree.set(dependency.successorId, (indegree.get(dependency.successorId) ?? 0) + 1);
  }
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  return ordered;
}

/**
 * Tautan yang "kencang": predecessor selesai (atau mulai) tepat saat penerus
 * boleh mulai. Hanya tautan kencang antar tugas kritis yang membentuk jalur kritis.
 */
export function isTightLink(
  predecessor: Pick<CpmActivity, 'es' | 'ef'>,
  successor: Pick<CpmActivity, 'es'>,
  type: SchedulerDependency['type'],
  lagDays: number,
): boolean {
  return type === 'FS'
    ? predecessor.ef + 1 + lagDays === successor.es
    : predecessor.es + lagDays === successor.es;
}

export function computeCpm(input: CpmInput): CpmResult {
  const { projectStartDate, tasks, dependencies, calendar } = input;
  const leaves = tasks.filter((task) => !task.isSummary);
  const leafIds = new Set(leaves.map((task) => task.id));
  const activeDependencies = dependencies.filter(
    (dependency) => leafIds.has(dependency.predecessorId) && leafIds.has(dependency.successorId),
  );

  const activities = new Map<string, CpmActivity>();
  for (const task of leaves) {
    activities.set(task.id, {
      id: task.id,
      name: task.name,
      durationDays: task.durationDays,
      es: ordinalOf(calendar, projectStartDate, task.scheduledStart),
      ef: ordinalOf(calendar, projectStartDate, task.scheduledEnd),
      ls: 0,
      lf: 0,
      totalFloat: 0,
      critical: false,
    });
  }

  const projectEnd = activities.size > 0
    ? Math.max(...[...activities.values()].map((activity) => activity.ef))
    : 0;

  const successors = new Map<string, SchedulerDependency[]>();
  for (const dependency of activeDependencies) {
    const list = successors.get(dependency.predecessorId) ?? [];
    list.push(dependency);
    successors.set(dependency.predecessorId, list);
  }

  const ordered = topologicalOrder(
    leaves.map((task) => task.id),
    activeDependencies,
  );

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const activity = activities.get(ordered[index]);
    if (!activity) continue;
    const outgoing = successors.get(activity.id) ?? [];
    let lf = projectEnd;
    if (outgoing.length > 0) {
      lf = Number.POSITIVE_INFINITY;
      for (const dependency of outgoing) {
        const successor = activities.get(dependency.successorId);
        if (!successor) continue;
        const candidate = dependency.type === 'FS'
          ? successor.ls - 1 - dependency.lagDays
          : successor.ls - dependency.lagDays + activity.durationDays - 1;
        if (candidate < lf) lf = candidate;
      }
      if (!Number.isFinite(lf)) lf = projectEnd;
    }
    activity.lf = lf;
    activity.ls = lf - activity.durationDays + 1;
    activity.totalFloat = Math.max(0, activity.ls - activity.es);
    activity.critical = activity.totalFloat === 0;
  }

  const criticalIds = new Set(
    [...activities.values()].filter((activity) => activity.critical).map((activity) => activity.id),
  );

  // Tepi yang "kencang": predecessor selesai tepat saat penerus boleh mulai.
  const tight = new Map<string, string[]>();
  const hasTightIncoming = new Set<string>();
  for (const dependency of activeDependencies) {
    if (!criticalIds.has(dependency.predecessorId) || !criticalIds.has(dependency.successorId)) continue;
    const predecessor = activities.get(dependency.predecessorId);
    const successor = activities.get(dependency.successorId);
    if (!predecessor || !successor) continue;
    if (!isTightLink(predecessor, successor, dependency.type, dependency.lagDays)) continue;
    const list = tight.get(predecessor.id) ?? [];
    list.push(successor.id);
    tight.set(predecessor.id, list);
    hasTightIncoming.add(successor.id);
  }

  const longestFromMemo = new Map<string, string[]>();
  const longestFrom = (id: string): string[] => {
    const cached = longestFromMemo.get(id);
    if (cached) return cached;
    const next = tight.get(id) ?? [];
    let best: string[] = [];
    for (const successorId of next) {
      const candidate = longestFrom(successorId);
      if (candidate.length > best.length) best = candidate;
    }
    const result = [id, ...best];
    longestFromMemo.set(id, result);
    return result;
  };

  let chain: string[] = [];
  for (const id of criticalIds) {
    if (hasTightIncoming.has(id)) continue;
    const candidate = longestFrom(id);
    if (candidate.length > chain.length) chain = candidate;
  }
  if (chain.length === 0 && criticalIds.size > 0) {
    // Seluruh tugas kritis membentuk siklus taut (tidak seharusnya terjadi pada DAG).
    const only = [...criticalIds][0];
    chain = longestFrom(only);
  }

  const activityList = [...activities.values()].sort((a, b) => a.es - b.es || a.name.localeCompare(b.name));

  return {
    projectEnd,
    projectStart: projectStartDate,
    projectFinish: dateFromOrdinal(calendar, projectStartDate, projectEnd),
    activities: activityList,
    byId: Object.fromEntries(activityList.map((activity) => [activity.id, activity])),
    criticalPath: chain,
  };
}
