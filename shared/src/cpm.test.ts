import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import { computeCpm, dateFromOrdinal, ordinalOf } from './cpm.js';
import { scheduleTasks } from './scheduler.js';
import { ScheduledTask, SchedulerDependency, SchedulerTask } from './types.js';

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

/** Vektor uji 6.11: A(3) -> B(2), A -> C(5), B dan C -> D(1), semua FS lag 0. */
function buildVector(): { tasks: ScheduledTask[]; dependencies: SchedulerDependency[] } {
  const tasks: SchedulerTask[] = [
    task({ id: 'A', name: 'A', durationDays: 3, startDate: '2026-10-19', position: 0 }),
    task({ id: 'B', name: 'B', durationDays: 2, startDate: '2026-10-19', position: 1 }),
    task({ id: 'C', name: 'C', durationDays: 5, startDate: '2026-10-19', position: 2 }),
    task({ id: 'D', name: 'D', durationDays: 1, startDate: '2026-10-19', position: 3 }),
  ];
  const dependencies: SchedulerDependency[] = [
    { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
    { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
    { id: 'd3', predecessorId: 'B', successorId: 'D', type: 'FS', lagDays: 0 },
    { id: 'd4', predecessorId: 'C', successorId: 'D', type: 'FS', lagDays: 0 },
  ];
  const scheduled = scheduleTasks({ projectStartDate: '2026-10-19', tasks, dependencies, calendar });
  return { tasks: scheduled, dependencies };
}

describe('cpm - vektor uji wajib (6.11)', () => {
  it('menghasilkan PE = 8 dengan A, C, D kritis dan float B = 3', () => {
    const { tasks, dependencies } = buildVector();
    const cpm = computeCpm({ projectStartDate: '2026-10-19', tasks, dependencies, calendar });

    expect(cpm.projectEnd).toBe(8);
    expect(cpm.byId.A.critical).toBe(true);
    expect(cpm.byId.C.critical).toBe(true);
    expect(cpm.byId.D.critical).toBe(true);
    expect(cpm.byId.B.critical).toBe(false);
    expect(cpm.byId.B.totalFloat).toBe(3);
    expect(cpm.byId.A.totalFloat).toBe(0);
    expect(cpm.byId.C.totalFloat).toBe(0);
  });

  it('menghasilkan jalur kritis A -> C -> D', () => {
    const { tasks, dependencies } = buildVector();
    const cpm = computeCpm({ projectStartDate: '2026-10-19', tasks, dependencies, calendar });
    expect(cpm.criticalPath).toEqual(['A', 'C', 'D']);
  });

  it('menerjemahkan ordinal menjadi tanggal', () => {
    const { tasks, dependencies } = buildVector();
    const cpm = computeCpm({ projectStartDate: '2026-10-19', tasks, dependencies, calendar });
    // Ordinal 8 = Kamis 2026-10-29 (19,20,21,22,23,26,27,28,29).
    expect(cpm.projectFinish).toBe('2026-10-29');
    expect(dateFromOrdinal(calendar, '2026-10-19', 8)).toBe('2026-10-29');
  });

  it('menghitung ordinal dari awal proyek', () => {
    expect(ordinalOf(calendar, '2026-10-19', '2026-10-19')).toBe(0);
    expect(ordinalOf(calendar, '2026-10-19', '2026-10-23')).toBe(4);
    expect(ordinalOf(calendar, '2026-10-19', '2026-10-26')).toBe(5);
  });

  it('menghitung float untuk rantai dengan jeda', () => {
    const tasks: SchedulerTask[] = [
      task({ id: 'A', durationDays: 2, startDate: '2026-10-19', position: 0 }),
      task({ id: 'B', durationDays: 2, startDate: '2026-10-19', position: 1 }),
      task({ id: 'C', durationDays: 2, startDate: '2026-10-19', position: 2 }),
    ];
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 2 },
      { id: 'd2', predecessorId: 'B', successorId: 'C', type: 'FS', lagDays: 0 },
    ];
    const scheduled = scheduleTasks({ projectStartDate: '2026-10-19', tasks, dependencies, calendar });
    const cpm = computeCpm({ projectStartDate: '2026-10-19', tasks: scheduled, dependencies, calendar });
    expect(cpm.byId.A.critical).toBe(true);
    expect(cpm.byId.B.critical).toBe(true);
    expect(cpm.criticalPath).toEqual(['A', 'B', 'C']);
  });
});
