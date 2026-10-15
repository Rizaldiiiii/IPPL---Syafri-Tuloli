import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import { computeCosts, dailyRate, detectOverAllocations, formatIDR, taskCost } from './cost.js';
import { scheduleTasks } from './scheduler.js';
import { SchedulerTask } from './types.js';

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

const andi = { id: 'r1', name: 'Andi Pratama', role: 'Project Manager', salary: 15_000_000 };
const budi = { id: 'r2', name: 'Budi Santoso', role: 'Backend Developer', salary: 12_000_000 };

describe('cost', () => {
  it('menghitung tarif harian sebagai gaji / 22', () => {
    expect(dailyRate(15_000_000)).toBeCloseTo(681_818.1818, 3);
    expect(dailyRate(22_000_000)).toBe(1_000_000);
  });

  it('menghitung biaya tugas dari durasi dan persentase alokasi', () => {
    const scheduled = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [task({ id: 'a', durationDays: 10 })],
      dependencies: [],
      calendar,
    });
    const cost = taskCost(scheduled[0], [{ id: 'as1', taskId: 'a', resourceId: 'r1', allocationPercent: 50 }], [andi]);
    expect(cost).toBeCloseTo((15_000_000 / 22) * 10 * 0.5, 6);
  });

  it('memformat rupiah dengan pemisah titik', () => {
    expect(formatIDR(1_250_000)).toBe('Rp 1.250.000');
    expect(formatIDR(0)).toBe('Rp 0');
    expect(formatIDR(999)).toBe('Rp 999');
    expect(formatIDR(1_234_567.6)).toBe('Rp 1.234.568');
  });

  it('mendeteksi over-alokasi ketika dua tugas tumpang tindih', () => {
    const scheduled = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'a', durationDays: 3, position: 0 }),
        task({ id: 'b', durationDays: 3, position: 1 }),
      ],
      dependencies: [],
      calendar,
    });
    const assignments = [
      { id: 'as1', taskId: 'a', resourceId: 'r1', allocationPercent: 60 },
      { id: 'as2', taskId: 'b', resourceId: 'r1', allocationPercent: 60 },
    ];
    const warnings = detectOverAllocations({ calendar, tasks: scheduled, assignments, resources: [andi] });
    expect(warnings).toHaveLength(3);
    expect(warnings[0].totalPercent).toBe(120);
    expect(warnings[0].taskIds.sort()).toEqual(['a', 'b']);
  });

  it('tidak memperingatkan alokasi yang tidak tumpang tindih', () => {
    const scheduled = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'a', durationDays: 3, position: 0 }),
        task({ id: 'b', durationDays: 3, position: 1, startDate: '2026-11-02' }),
      ],
      dependencies: [],
      calendar,
    });
    const assignments = [
      { id: 'as1', taskId: 'a', resourceId: 'r1', allocationPercent: 100 },
      { id: 'as2', taskId: 'b', resourceId: 'r1', allocationPercent: 100 },
    ];
    expect(detectOverAllocations({ calendar, tasks: scheduled, assignments, resources: [andi] })).toHaveLength(0);
  });

  it('tidak memperingatkan alokasi total tepat 100 persen', () => {
    const scheduled = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'a', durationDays: 2, position: 0 }),
        task({ id: 'b', durationDays: 2, position: 1 }),
      ],
      dependencies: [],
      calendar,
    });
    const assignments = [
      { id: 'as1', taskId: 'a', resourceId: 'r1', allocationPercent: 50 },
      { id: 'as2', taskId: 'b', resourceId: 'r1', allocationPercent: 50 },
    ];
    expect(detectOverAllocations({ calendar, tasks: scheduled, assignments, resources: [andi] })).toHaveLength(0);
  });

  it('mengabaikan tugas induk pada perhitungan biaya', () => {
    const scheduled = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'p', position: 0, startDate: '2026-10-19' }),
        task({ id: 'c', parentId: 'p', position: 0, durationDays: 2 }),
      ],
      dependencies: [],
      calendar,
    });
    const summary = computeCosts({
      calendar,
      tasks: scheduled,
      assignments: [
        { id: 'as1', taskId: 'c', resourceId: 'r1', allocationPercent: 100 },
        { id: 'as2', taskId: 'p', resourceId: 'r2', allocationPercent: 100 },
      ],
      resources: [andi, budi],
    });
    expect(summary.perTask).toHaveLength(1);
    expect(summary.perTask[0].taskId).toBe('c');
    expect(summary.totalCost).toBeCloseTo((15_000_000 / 22) * 2, 6);
    expect(summary.perResource.find((item) => item.resourceId === 'r2')?.plannedDays).toBe(0);
  });
});
