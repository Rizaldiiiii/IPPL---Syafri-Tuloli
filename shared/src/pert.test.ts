import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import { computeCpm } from './cpm.js';
import { buildPertGraph, pertNodePosition } from './pert.js';
import { scheduleTasks } from './scheduler.js';
import { SchedulerDependency, SchedulerTask } from './types.js';

const calendar = createCalendar([0, 6], []);

function task(partial: Partial<SchedulerTask> & { id: string }): SchedulerTask {
  return {
    parentId: null,
    position: 0,
    name: partial.id,
    durationDays: 1,
    startDate: '2026-10-19',
    priority: 'MEDIUM',
    progress: 0,
    ...partial,
  };
}

describe('pert', () => {
  it('menyusun kolom berdasarkan kedalaman jalur terpanjang', () => {
    const tasks: SchedulerTask[] = [
      task({ id: 'A', durationDays: 1, position: 0 }),
      task({ id: 'B', durationDays: 1, position: 1 }),
      task({ id: 'C', durationDays: 1, position: 2 }),
    ];
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
      { id: 'd2', predecessorId: 'B', successorId: 'C', type: 'FS', lagDays: 0 },
    ];
    const scheduled = scheduleTasks({ projectStartDate: '2026-10-19', tasks, dependencies, calendar });
    const cpm = computeCpm({ projectStartDate: '2026-10-19', tasks: scheduled, dependencies, calendar });
    const pert = buildPertGraph({ tasks: scheduled, dependencies, cpm: cpm.activities, criticalPath: cpm.criticalPath });

    expect(pert.nodes.map((node) => [node.id, node.column])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ]);
    expect(pert.nodes.every((node) => node.critical)).toBe(true);
    expect(pert.edges.every((edge) => edge.critical)).toBe(true);
  });

  it('menghitung estimasi tiga titik dan variansi jalur kritis', () => {
    const tasks: SchedulerTask[] = [
      task({ id: 'A', durationDays: 10, position: 0, optimisticDays: 8, pessimisticDays: 15 }),
    ];
    const scheduled = scheduleTasks({ projectStartDate: '2026-10-19', tasks, dependencies: [], calendar });
    const cpm = computeCpm({ projectStartDate: '2026-10-19', tasks: scheduled, dependencies: [], calendar });
    const pert = buildPertGraph({
      tasks: scheduled,
      dependencies: [],
      cpm: cpm.activities,
      criticalPath: cpm.criticalPath,
    });

    const node = pert.nodes[0];
    // te = (8 + 4*10 + 15) / 6 = 10.5
    expect(node.expectedTime).toBeCloseTo(10.5, 6);
    // variansi = ((15 - 8) / 6)^2
    expect(node.variance).toBeCloseTo((7 / 6) ** 2, 6);
    expect(pert.criticalVariance).toBeCloseTo((7 / 6) ** 2, 6);
    expect(pert.criticalStandardDeviation).toBeCloseTo(7 / 6, 6);
  });

  it('tidak menandai node non-kritis sebagai kritis', () => {
    const tasks: SchedulerTask[] = [
      task({ id: 'A', durationDays: 3, position: 0 }),
      task({ id: 'B', durationDays: 2, position: 1 }),
      task({ id: 'C', durationDays: 5, position: 2 }),
      task({ id: 'D', durationDays: 1, position: 3 }),
    ];
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
      { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
      { id: 'd3', predecessorId: 'B', successorId: 'D', type: 'FS', lagDays: 0 },
      { id: 'd4', predecessorId: 'C', successorId: 'D', type: 'FS', lagDays: 0 },
    ];
    const scheduled = scheduleTasks({ projectStartDate: '2026-10-19', tasks, dependencies, calendar });
    const cpm = computeCpm({ projectStartDate: '2026-10-19', tasks: scheduled, dependencies, calendar });
    const pert = buildPertGraph({ tasks: scheduled, dependencies, cpm: cpm.activities, criticalPath: cpm.criticalPath });

    const criticalIds = pert.nodes.filter((node) => node.critical).map((node) => node.id).sort();
    expect(criticalIds).toEqual(['A', 'C', 'D']);
    expect(pert.nodes.find((node) => node.id === 'B')?.slack).toBe(3);
  });

  it('menghitung posisi node pada kanvas', () => {
    expect(pertNodePosition({ column: 0, row: 0 })).toEqual({ x: 24, y: 24 });
    expect(pertNodePosition({ column: 1, row: 2 }).x).toBe(24 + 168 + 72);
  });
});
