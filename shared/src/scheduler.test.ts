import { describe, expect, it } from 'vitest';
import { createCalendar } from './calendar.js';
import { CyclicDependencyError, scheduleTasks } from './scheduler.js';
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

function find(tasks: ScheduledTask[], id: string): ScheduledTask {
  const found = tasks.find((item) => item.id === id);
  if (!found) throw new Error(`Tugas ${id} tidak ditemukan`);
  return found;
}

describe('scheduler - vektor uji wajib (6.11)', () => {
  it('durasi 3 hari mulai Jumat 2026-10-23 berakhir Selasa 2026-10-27', () => {
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [task({ id: 'a', startDate: '2026-10-23', durationDays: 3 })],
      dependencies: [],
      calendar,
    });
    expect(find(result, 'a').scheduledStart).toBe('2026-10-23');
    expect(find(result, 'a').scheduledEnd).toBe('2026-10-27');
  });

  it('FS lag 0 menjadikan penerus mulai Rabu 2026-10-28', () => {
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
    ];
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'a', startDate: '2026-10-23', durationDays: 3 }),
        task({ id: 'b', startDate: '2026-10-19', durationDays: 2, position: 1 }),
      ],
      dependencies,
      calendar,
    });
    expect(find(result, 'b').scheduledStart).toBe('2026-10-28');
  });

  it('SS lag 2 menjadikan penerus mulai Selasa 2026-10-27', () => {
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'a', successorId: 'b', type: 'SS', lagDays: 2 },
    ];
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'a', startDate: '2026-10-23', durationDays: 3 }),
        task({ id: 'b', startDate: '2026-10-19', durationDays: 2, position: 1 }),
      ],
      dependencies,
      calendar,
    });
    expect(find(result, 'b').scheduledStart).toBe('2026-10-27');
  });

  it('hari libur Senin 2026-10-26 menggeser akhir menjadi Rabu 2026-10-28', () => {
    const holidayCalendar = createCalendar([0, 6], ['2026-10-26']);
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [task({ id: 'a', startDate: '2026-10-23', durationDays: 3 })],
      dependencies: [],
      calendar: holidayCalendar,
    });
    expect(find(result, 'a').scheduledEnd).toBe('2026-10-28');
  });
});

describe('scheduler - aturan umum', () => {
  it('startDate berfungsi sebagai batas mulai paling awal', () => {
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [task({ id: 'a', startDate: '2026-11-01', durationDays: 2 })],
      dependencies: [],
      calendar,
    });
    expect(find(result, 'a').scheduledStart).toBe('2026-11-02');
  });

  it('batas predecessor yang lebih awal tidak memajukan startDate', () => {
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
    ];
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'a', startDate: '2026-10-19', durationDays: 1 }),
        task({ id: 'b', startDate: '2026-11-02', durationDays: 1, position: 1 }),
      ],
      dependencies,
      calendar,
    });
    expect(find(result, 'b').scheduledStart).toBe('2026-11-02');
  });

  it('lag negatif memungkinkan tumpang tindih', () => {
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: -2 },
    ];
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [
        task({ id: 'a', startDate: '2026-10-19', durationDays: 5 }), // 19-23 Okt
        task({ id: 'b', startDate: '2026-10-19', durationDays: 2, position: 1 }),
      ],
      dependencies,
      calendar,
    });
    expect(find(result, 'b').scheduledStart).toBe('2026-10-22');
  });

  it('menggeser jadwal ketika akhir pekan berubah', () => {
    const fridayWeekend = createCalendar([5, 6], []);
    const result = scheduleTasks({
      projectStartDate: '2026-10-19',
      tasks: [task({ id: 'a', startDate: '2026-10-22', durationDays: 3 })],
      dependencies: [],
      calendar: fridayWeekend,
    });
    // Kamis 22, Sabtu-Minggu menjadi hari kerja, Jumat 23 adalah akhir pekan.
    expect(find(result, 'a').scheduledStart).toBe('2026-10-22');
    expect(find(result, 'a').scheduledEnd).toBe('2026-10-26');
  });

  it('menolak dependensi yang membentuk siklus', () => {
    const dependencies: SchedulerDependency[] = [
      { id: 'd1', predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 },
      { id: 'd2', predecessorId: 'b', successorId: 'a', type: 'FS', lagDays: 0 },
    ];
    expect(() =>
      scheduleTasks({
        projectStartDate: '2026-10-19',
        tasks: [task({ id: 'a' }), task({ id: 'b', position: 1 })],
        dependencies,
        calendar,
      }),
    ).toThrow(CyclicDependencyError);
  });
});

describe('scheduler - tugas induk', () => {
  const tasks: SchedulerTask[] = [
    task({ id: 'p', name: 'Perencanaan', durationDays: 1, startDate: '2026-10-19', position: 0 }),
    task({ id: 'c1', parentId: 'p', name: 'Kickoff', durationDays: 3, startDate: '2026-10-19', position: 0, progress: 100 }),
    task({ id: 'c2', parentId: 'p', name: 'Spesifikasi', durationDays: 4, startDate: '2026-10-23', position: 1, progress: 50 }),
  ];

  it('menghitung rentang dan durasi induk dari anak', () => {
    const result = scheduleTasks({ projectStartDate: '2026-10-19', tasks, dependencies: [], calendar });
    const parent = find(result, 'p');
    expect(parent.isSummary).toBe(true);
    // c1: 19-21 Okt, c2: 23,26,27,28 Okt -> 19 Okt sampai 28 Okt, 8 hari kerja.
    expect(parent.scheduledStart).toBe('2026-10-19');
    expect(parent.scheduledEnd).toBe('2026-10-28');
    expect(parent.durationDays).toBe(8);
  });

  it('menghitung progres berbobot durasi', () => {
    const result = scheduleTasks({ projectStartDate: '2026-10-19', tasks, dependencies: [], calendar });
    // (100*3 + 50*4) / 7 = 71.43 -> 71
    expect(find(result, 'p').progress).toBe(71);
  });

  it('mendukung tiga level kedalaman', () => {
    const nested: SchedulerTask[] = [
      task({ id: 'root', position: 0 }),
      task({ id: 'mid', parentId: 'root', position: 0 }),
      task({ id: 'leaf', parentId: 'mid', position: 0, durationDays: 2 }),
    ];
    const result = scheduleTasks({ projectStartDate: '2026-10-19', tasks: nested, dependencies: [], calendar });
    expect(find(result, 'leaf').level).toBe(2);
    expect(find(result, 'mid').level).toBe(1);
    expect(find(result, 'root').level).toBe(0);
  });
});
