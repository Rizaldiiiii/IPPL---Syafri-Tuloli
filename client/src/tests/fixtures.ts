import {
  createCalendar,
  scheduleTasks,
  type AssignmentDTO,
  type DependencyDTO,
  type HolidayDTO,
  type ProjectSnapshotDTO,
  type ResourceDTO,
  type SchedulerDependency,
  type SchedulerTask,
  type TaskDTO,
} from '@gantt/shared';

export const PROJECT_START = '2026-10-19';

/** Tugas contoh yang mengikuti vektor uji 6.11. */
export function buildScheduledTasks(
  tasks: SchedulerTask[],
  dependencies: SchedulerDependency[],
): TaskDTO[] {
  const calendar = createCalendar([0, 6], []);
  const scheduled = scheduleTasks({ projectStartDate: PROJECT_START, tasks, dependencies, calendar });
  return scheduled.map((task) => ({
    id: task.id,
    projectId: 'proyek-1',
    parentId: task.parentId,
    position: task.position,
    name: task.name,
    description: null,
    durationDays: task.durationDays,
    startDate: task.startDate,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    priority: task.priority,
    color: '#2563EB',
    progress: task.progress,
    optimisticDays: task.optimisticDays ?? null,
    pessimisticDays: task.pessimisticDays ?? null,
    isSummary: task.isSummary,
    level: task.level,
    children: task.children,
  }));
}

/** Fixture empat tugas: A(3) -> B(2), A -> C(5), B dan C -> D(1). */
export function cpmFixture(): { tasks: TaskDTO[]; dependencies: DependencyDTO[] } {
  const tasks: SchedulerTask[] = [
    { id: 'A', parentId: null, position: 0, name: 'A', durationDays: 3, startDate: PROJECT_START, priority: 'HIGH', progress: 100 },
    { id: 'B', parentId: null, position: 1, name: 'B', durationDays: 2, startDate: PROJECT_START, priority: 'MEDIUM', progress: 50 },
    { id: 'C', parentId: null, position: 2, name: 'C', durationDays: 5, startDate: PROJECT_START, priority: 'HIGH', progress: 20 },
    { id: 'D', parentId: null, position: 3, name: 'D', durationDays: 1, startDate: PROJECT_START, priority: 'LOW', progress: 0 },
  ];
  const dependencies: DependencyDTO[] = [
    { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS', lagDays: 0 },
    { id: 'd2', predecessorId: 'A', successorId: 'C', type: 'FS', lagDays: 0 },
    { id: 'd3', predecessorId: 'B', successorId: 'D', type: 'FS', lagDays: 0 },
    { id: 'd4', predecessorId: 'C', successorId: 'D', type: 'FS', lagDays: 0 },
  ];
  return {
    tasks: buildScheduledTasks(
      tasks,
      dependencies.map((dependency) => ({ ...dependency })),
    ),
    dependencies,
  };
}

const RESOURCES: ResourceDTO[] = [
  { id: 'r1', projectId: 'proyek-1', name: 'Andi Pratama', email: 'andi@example.com', role: 'Project Manager', salary: 15_000_000 },
  { id: 'r2', projectId: 'proyek-1', name: 'Budi Santoso', email: 'budi@example.com', role: 'Backend Developer', salary: 12_000_000 },
];

const ASSIGNMENTS: AssignmentDTO[] = [
  { id: 'as1', taskId: 'A', resourceId: 'r1', allocationPercent: 100 },
];

const HOLIDAYS: HolidayDTO[] = [
  { id: 'h1', projectId: 'proyek-1', date: '2026-10-26', name: 'Libur internal (contoh)' },
];

/** Snapshot proyek lengkap untuk test komponen. */
export function snapshotFixture(): ProjectSnapshotDTO {
  const { tasks, dependencies } = cpmFixture();
  return {
    project: {
      id: 'proyek-1',
      ownerId: 'user-1',
      name: 'Pengembangan Aplikasi Mobile Toko Online',
      description: 'Contoh proyek',
      startDate: PROJECT_START,
      weekendDays: [0, 6],
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    tasks,
    dependencies,
    resources: RESOURCES,
    assignments: ASSIGNMENTS,
    holidays: HOLIDAYS,
  };
}
