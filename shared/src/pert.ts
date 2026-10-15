/**
 * Diagram PERT (blueprint 6.9): jaringan activity-on-node dari tugas daun.
 *
 * Tata letak: kolom = kedalaman jalur terpanjang dari node awal, baris = urutan
 * di dalam kolom. Node dan panah kritis berwarna merah (diatur di UI).
 */

import { isTightLink } from './cpm.js';
import { CpmActivity, PertEdge, PertNodeInput, PertResult, ScheduledTask, SchedulerDependency } from './types.js';

export const PERT_NODE_WIDTH = 168;
export const PERT_NODE_HEIGHT = 104;
export const PERT_GAP_X = 72;
export const PERT_GAP_Y = 28;
export const PERT_PADDING = 24;

export interface PertInput {
  tasks: ScheduledTask[];
  dependencies: SchedulerDependency[];
  cpm: CpmActivity[];
  criticalPath: string[];
}

export function buildPertGraph(input: PertInput): PertResult {
  const { tasks, dependencies, cpm, criticalPath } = input;
  const leaves = tasks.filter((task) => !task.isSummary);
  const leafIds = new Set(leaves.map((task) => task.id));
  const cpmById = new Map(cpm.map((activity) => [activity.id, activity]));
  const edges: PertEdge[] = dependencies
    .filter((dependency) => leafIds.has(dependency.predecessorId) && leafIds.has(dependency.successorId))
    .map((dependency) => ({
      predecessorId: dependency.predecessorId,
      successorId: dependency.successorId,
      type: dependency.type,
      lagDays: dependency.lagDays,
      critical: false,
    }));
  const predecessors = new Map<string, string[]>();
  for (const edge of edges) {
    const list = predecessors.get(edge.successorId) ?? [];
    list.push(edge.predecessorId);
    predecessors.set(edge.successorId, list);
  }

  const columnMemo = new Map<string, number>();
  const columnOf = (id: string): number => {
    const cached = columnMemo.get(id);
    if (cached !== undefined) return cached;
    const incoming = predecessors.get(id) ?? [];
    if (incoming.length === 0) {
      columnMemo.set(id, 0);
      return 0;
    }
    const value = Math.max(...incoming.map((predecessorId) => columnOf(predecessorId))) + 1;
    columnMemo.set(id, value);
    return value;
  };

  const byColumn = new Map<number, string[]>();
  for (const task of leaves) {
    const column = columnOf(task.id);
    const bucket = byColumn.get(column) ?? [];
    bucket.push(task.id);
    byColumn.set(column, bucket);
  }

  const criticalSet = new Set(criticalPath);
  const nodes: PertNodeInput[] = [];
  const rowIndex = new Map<string, number>();

  const sortedColumns = [...byColumn.keys()].sort((a, b) => a - b);
  for (const column of sortedColumns) {
    const ids = (byColumn.get(column) ?? []).sort((a, b) => {
      const activityA = cpmById.get(a);
      const activityB = cpmById.get(b);
      const esA = activityA?.es ?? 0;
      const esB = activityB?.es ?? 0;
      if (esA !== esB) return esA - esB;
      return (activityA?.name ?? '').localeCompare(activityB?.name ?? '');
    });
    ids.forEach((id, index) => rowIndex.set(id, index));
  }

  for (const task of leaves) {
    const activity = cpmById.get(task.id);
    const optimistic = task.optimisticDays ?? null;
    const pessimistic = task.pessimisticDays ?? null;
    const variance = optimistic !== null && pessimistic !== null
      ? ((pessimistic - optimistic) / 6) ** 2
      : null;
    const expectedTime = optimistic !== null && pessimistic !== null
      ? (optimistic + 4 * task.durationDays + pessimistic) / 6
      : null;
    nodes.push({
      id: task.id,
      name: task.name,
      durationDays: task.durationDays,
      es: activity?.es ?? 0,
      ef: activity?.ef ?? 0,
      ls: activity?.ls ?? 0,
      lf: activity?.lf ?? 0,
      slack: activity?.totalFloat ?? 0,
      critical: criticalSet.has(task.id),
      column: columnOf(task.id),
      row: rowIndex.get(task.id) ?? 0,
      optimisticDays: optimistic,
      pessimisticDays: pessimistic,
      expectedTime,
      variance,
    });
  }

  for (const edge of edges) {
    const predecessor = cpmById.get(edge.predecessorId);
    const successor = cpmById.get(edge.successorId);
    edge.critical =
      criticalSet.has(edge.predecessorId) &&
      criticalSet.has(edge.successorId) &&
      predecessor !== undefined &&
      successor !== undefined &&
      isTightLink(predecessor, successor, edge.type, edge.lagDays);
  }

  const criticalVariance = nodes
    .filter((node) => node.critical && node.variance !== null)
    .reduce((sum, node) => sum + (node.variance ?? 0), 0);

  const maxColumn = nodes.reduce((max, node) => Math.max(max, node.column), 0);
  const maxRow = nodes.reduce((max, node) => Math.max(max, node.row), 0);
  const width = PERT_PADDING * 2 + (maxColumn + 1) * PERT_NODE_WIDTH + maxColumn * PERT_GAP_X;
  const height = PERT_PADDING * 2 + (maxRow + 1) * PERT_NODE_HEIGHT + maxRow * PERT_GAP_Y;

  return {
    nodes,
    edges,
    criticalPath,
    criticalVariance,
    criticalStandardDeviation: Math.sqrt(criticalVariance),
    width: nodes.length === 0 ? 0 : width,
    height: nodes.length === 0 ? 0 : height,
  };
}

/** Koordinat kiri-atas sebuah node pada kanvas PERT. */
export function pertNodePosition(node: Pick<PertNodeInput, 'column' | 'row'>): { x: number; y: number } {
  return {
    x: PERT_PADDING + node.column * (PERT_NODE_WIDTH + PERT_GAP_X),
    y: PERT_PADDING + node.row * (PERT_NODE_HEIGHT + PERT_GAP_Y),
  };
}
