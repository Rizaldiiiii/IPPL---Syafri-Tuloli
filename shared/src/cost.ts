/**
 * Biaya dan beban kerja (blueprint 6.10).
 *
 * Tarif harian = gaji bulanan / 22. Biaya tugas dihitung dari tarif harian,
 * durasi hari kerja, dan persentase alokasi tiap anggota.
 */

import { ProjectCalendar, enumerateDays, isWorkingDay } from './calendar.js';
import { ISODate } from './dates.js';
import {
  CostBreakdownItem,
  CostSummary,
  OverAllocationWarning,
  ResourceCostSummary,
  ScheduledTask,
  TaskCostSummary,
} from './types.js';

export const WORKING_DAYS_PER_MONTH = 22;
export const MAX_OVER_ALLOCATION_SCAN_DAYS = 3650;
export const MAX_OVER_ALLOCATION_WARNINGS = 200;

export interface ResourceLike {
  id: string;
  name: string;
  role: string;
  salary: number;
}

export interface AssignmentLike {
  id: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface CostInput {
  calendar: ProjectCalendar;
  tasks: ScheduledTask[];
  assignments: AssignmentLike[];
  resources: ResourceLike[];
}

export function dailyRate(salary: number): number {
  return salary / WORKING_DAYS_PER_MONTH;
}

/** Biaya satu tugas berdasarkan seluruh alokasinya. */
export function taskCost(
  task: Pick<ScheduledTask, 'id' | 'durationDays'>,
  assignments: AssignmentLike[],
  resources: ResourceLike[],
): number {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  return assignments
    .filter((assignment) => assignment.taskId === task.id)
    .reduce((total, assignment) => {
      const resource = resourceById.get(assignment.resourceId);
      if (!resource) return total;
      return total + dailyRate(resource.salary) * task.durationDays * (assignment.allocationPercent / 100);
    }, 0);
}

/** Peringatan ketika total alokasi seorang anggota melebihi 100% pada satu hari kerja. */
export function detectOverAllocations(input: CostInput): OverAllocationWarning[] {
  const { calendar, tasks, assignments, resources } = input;
  const leafById = new Map(
    tasks.filter((task) => !task.isSummary).map((task) => [task.id, task]),
  );
  const warnings: OverAllocationWarning[] = [];

  for (const resource of resources) {
    const allocations = assignments
      .filter((assignment) => assignment.resourceId === resource.id)
      .map((assignment) => {
        const task = leafById.get(assignment.taskId);
        return task ? { task, percent: assignment.allocationPercent } : null;
      })
      .filter((value): value is { task: ScheduledTask; percent: number } => value !== null);
    if (allocations.length < 2) continue;

    const starts = allocations.map((allocation) => allocation.task.scheduledStart).sort();
    const ends = allocations.map((allocation) => allocation.task.scheduledEnd).sort();
    const from: ISODate = starts[0];
    const to: ISODate = ends[ends.length - 1];
    const days = enumerateDays(from, to).slice(0, MAX_OVER_ALLOCATION_SCAN_DAYS);

    for (const date of days) {
      if (!isWorkingDay(calendar, date)) continue;
      const active = allocations.filter(
        (allocation) => allocation.task.scheduledStart <= date && allocation.task.scheduledEnd >= date,
      );
      if (active.length < 2) continue;
      const total = active.reduce((sum, allocation) => sum + allocation.percent, 0);
      if (total > 100) {
        warnings.push({
          resourceId: resource.id,
          resourceName: resource.name,
          date,
          totalPercent: total,
          taskIds: active.map((allocation) => allocation.task.id),
        });
        if (warnings.length >= MAX_OVER_ALLOCATION_WARNINGS) return warnings;
      }
    }
  }

  return warnings.sort((a, b) => a.date.localeCompare(b.date) || a.resourceName.localeCompare(b.resourceName));
}

/** Ringkasan biaya proyek: total, rincian per tugas, per anggota, dan peringatan over-alokasi. */
export function computeCosts(input: CostInput): CostSummary {
  const { tasks, assignments, resources } = input;
  const leaves = tasks.filter((task) => !task.isSummary);

  const perTask: TaskCostSummary[] = leaves.map((task) => ({
    taskId: task.id,
    taskName: task.name,
    durationDays: task.durationDays,
    cost: taskCost(task, assignments, resources),
  }));

  const perResource: ResourceCostSummary[] = resources.map((resource) => {
    const ownAssignments = assignments.filter((assignment) => assignment.resourceId === resource.id);
    let plannedDays = 0;
    for (const assignment of ownAssignments) {
      const task = leaves.find((candidate) => candidate.id === assignment.taskId);
      if (!task) continue;
      plannedDays += task.durationDays * (assignment.allocationPercent / 100);
    }
    return {
      resourceId: resource.id,
      resourceName: resource.name,
      role: resource.role,
      salary: resource.salary,
      dailyRate: dailyRate(resource.salary),
      plannedDays,
      cost: dailyRate(resource.salary) * plannedDays,
    };
  });

  return {
    totalCost: perTask.reduce((sum, item) => sum + item.cost, 0),
    perTask,
    perResource,
    overAllocations: detectOverAllocations(input),
  };
}

/** Rincian biaya per alokasi, dipakai halaman Tim. */
export function costBreakdown(input: CostInput): CostBreakdownItem[] {
  const { tasks, assignments, resources } = input;
  const leafById = new Map(tasks.filter((task) => !task.isSummary).map((task) => [task.id, task]));
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  const items: CostBreakdownItem[] = [];
  for (const assignment of assignments) {
    const task = leafById.get(assignment.taskId);
    const resource = resourceById.get(assignment.resourceId);
    if (!task || !resource) continue;
    const rate = dailyRate(resource.salary);
    items.push({
      taskId: task.id,
      taskName: task.name,
      resourceId: resource.id,
      resourceName: resource.name,
      allocationPercent: assignment.allocationPercent,
      dailyRate: rate,
      cost: rate * task.durationDays * (assignment.allocationPercent / 100),
    });
  }
  return items;
}

/** Format rupiah Indonesia, contoh `Rp 1.250.000`. */
export function formatIDR(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp ${grouped}`;
}

/** Format angka desimal dengan pemisah koma, contoh `1,25`. */
export function formatDecimal(value: number, fractionDigits = 2): string {
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Format persen ringkas, contoh `125%`. */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
}

export function sum(numbers: number[]): number {
  return numbers.reduce((total, value) => total + value, 0);
}
