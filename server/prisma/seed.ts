/**
 * Seed data contoh (blueprint Bagian 9).
 * Idempoten: menjalankan ulang akan menghapus proyek contoh milik user demo
 * lalu membuatnya kembali, sehingga tidak ada duplikasi data.
 */

import '../src/env.js';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { serializeWeekendDays } from '@gantt/shared';
import type { DependencyType, Priority } from '@gantt/shared';
import { recomputeProject } from '../src/services/recompute.js';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Demo12345';
const DEMO_NAME = 'Demo Pengguna';
const PROJECT_NAME = 'Pengembangan Aplikasi Mobile Toko Online';
const PROJECT_START = '2026-10-19';

interface SeedResource {
  name: string;
  email: string;
  role: string;
  salary: number;
}

interface SeedAssignment {
  role: string;
  percent: number;
}

interface SeedPredecessor {
  key: string;
  type: DependencyType;
  lagDays: number;
}

interface SeedTask {
  key: string;
  name: string;
  parentKey: string | null;
  durationDays: number;
  priority: Priority;
  progress: number;
  color: string;
  assignments: SeedAssignment[];
  predecessors: SeedPredecessor[];
  optimisticDays?: number;
  pessimisticDays?: number;
}

const RESOURCES: SeedResource[] = [
  { name: 'Andi Pratama', email: 'andi.pratama@example.com', role: 'Project Manager', salary: 15_000_000 },
  { name: 'Budi Santoso', email: 'budi.santoso@example.com', role: 'Backend Developer', salary: 12_000_000 },
  { name: 'Citra Lestari', email: 'citra.lestari@example.com', role: 'UI/UX Designer', salary: 10_000_000 },
  { name: 'Dewi Anggraini', email: 'dewi.anggraini@example.com', role: 'QA Engineer', salary: 9_000_000 },
];

const GROUPS: { key: string; name: string; color: string }[] = [
  { key: '1', name: 'Perencanaan', color: '#2563EB' },
  { key: '2', name: 'Desain', color: '#7C3AED' },
  { key: '3', name: 'Pengembangan', color: '#0F766E' },
  { key: '4', name: 'Pengujian', color: '#B45309' },
  { key: '5', name: 'Peluncuran', color: '#BE123C' },
];

const TASKS: SeedTask[] = [
  // 1 Perencanaan
  {
    key: '1.1',
    name: 'Kickoff dan kebutuhan',
    parentKey: '1',
    durationDays: 3,
    priority: 'HIGH',
    progress: 100,
    color: '#2563EB',
    assignments: [{ role: 'Project Manager', percent: 100 }],
    predecessors: [],
  },
  {
    key: '1.2',
    name: 'Penyusunan spesifikasi',
    parentKey: '1',
    durationDays: 4,
    priority: 'HIGH',
    progress: 60,
    color: '#2563EB',
    assignments: [{ role: 'Project Manager', percent: 100 }],
    predecessors: [{ key: '1.1', type: 'FS', lagDays: 0 }],
  },
  // 2 Desain
  {
    key: '2.1',
    name: 'Riset dan wireframe',
    parentKey: '2',
    durationDays: 5,
    priority: 'MEDIUM',
    progress: 40,
    color: '#7C3AED',
    assignments: [{ role: 'UI/UX Designer', percent: 100 }],
    predecessors: [{ key: '1.2', type: 'SS', lagDays: 2 }],
  },
  {
    key: '2.2',
    name: 'Desain UI high-fidelity',
    parentKey: '2',
    durationDays: 6,
    priority: 'MEDIUM',
    progress: 20,
    color: '#7C3AED',
    assignments: [{ role: 'UI/UX Designer', percent: 100 }],
    predecessors: [{ key: '2.1', type: 'FS', lagDays: 0 }],
  },
  // 3 Pengembangan
  {
    key: '3.1',
    name: 'Rancang database dan API',
    parentKey: '3',
    durationDays: 5,
    priority: 'HIGH',
    progress: 100,
    color: '#0F766E',
    assignments: [{ role: 'Backend Developer', percent: 100 }],
    predecessors: [{ key: '1.2', type: 'FS', lagDays: 0 }],
  },
  {
    key: '3.2',
    name: 'Implementasi backend',
    parentKey: '3',
    durationDays: 10,
    priority: 'HIGH',
    progress: 30,
    color: '#0F766E',
    assignments: [{ role: 'Backend Developer', percent: 100 }],
    predecessors: [{ key: '3.1', type: 'FS', lagDays: 0 }],
    optimisticDays: 8,
    pessimisticDays: 15,
  },
  {
    key: '3.3',
    name: 'Implementasi frontend mobile',
    parentKey: '3',
    durationDays: 12,
    priority: 'HIGH',
    progress: 10,
    color: '#0F766E',
    assignments: [
      { role: 'Backend Developer', percent: 50 },
      { role: 'UI/UX Designer', percent: 50 },
    ],
    predecessors: [
      { key: '2.2', type: 'FS', lagDays: 0 },
      { key: '3.2', type: 'SS', lagDays: 3 },
    ],
  },
  // 4 Pengujian
  {
    key: '4.1',
    name: 'Skenario uji',
    parentKey: '4',
    durationDays: 3,
    priority: 'MEDIUM',
    progress: 0,
    color: '#B45309',
    assignments: [{ role: 'QA Engineer', percent: 100 }],
    predecessors: [{ key: '3.2', type: 'SS', lagDays: 4 }],
  },
  {
    key: '4.2',
    name: 'Integrasi dan uji sistem',
    parentKey: '4',
    durationDays: 6,
    priority: 'HIGH',
    progress: 0,
    color: '#B45309',
    assignments: [{ role: 'QA Engineer', percent: 100 }],
    predecessors: [
      { key: '3.2', type: 'FS', lagDays: 0 },
      { key: '3.3', type: 'FS', lagDays: 0 },
    ],
  },
  {
    key: '4.3',
    name: 'Perbaikan bug',
    parentKey: '4',
    durationDays: 4,
    priority: 'MEDIUM',
    progress: 0,
    color: '#B45309',
    assignments: [{ role: 'Backend Developer', percent: 100 }],
    predecessors: [{ key: '4.2', type: 'FS', lagDays: 0 }],
  },
  // 5 Peluncuran
  {
    key: '5.1',
    name: 'Persiapan rilis',
    parentKey: '5',
    durationDays: 2,
    priority: 'MEDIUM',
    progress: 0,
    color: '#BE123C',
    assignments: [{ role: 'Project Manager', percent: 100 }],
    predecessors: [{ key: '4.3', type: 'FS', lagDays: 1 }],
  },
  {
    key: '5.2',
    name: 'Rilis dan serah terima',
    parentKey: '5',
    durationDays: 1,
    priority: 'HIGH',
    progress: 0,
    color: '#BE123C',
    assignments: [{ role: 'Project Manager', percent: 100 }],
    predecessors: [{ key: '5.1', type: 'FS', lagDays: 0 }],
  },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME },
    create: { name: DEMO_NAME, email: DEMO_EMAIL, passwordHash },
  });
  process.stdout.write(`[seed] User demo siap: ${user.email}\n`);

  const existing = await prisma.project.findFirst({
    where: { ownerId: user.id, name: PROJECT_NAME },
  });
  if (existing) {
    await prisma.project.delete({ where: { id: existing.id } });
    process.stdout.write('[seed] Proyek contoh lama dihapus agar seed tetap idempoten.\n');
  }

  const project = await prisma.project.create({
    data: {
      ownerId: user.id,
      name: PROJECT_NAME,
      description:
        'Rencana pengembangan aplikasi mobile toko online: perencanaan, desain, pengembangan, pengujian, dan peluncuran.',
      startDate: PROJECT_START,
      weekendDays: serializeWeekendDays([0, 6]),
    },
  });

  await prisma.holiday.createMany({
    data: [
      { projectId: project.id, date: '2026-11-11', name: 'Libur internal (contoh)' },
      { projectId: project.id, date: '2026-12-25', name: 'Hari Raya Natal' },
    ],
  });

  const resources = new Map<string, string>();
  for (const resource of RESOURCES) {
    const created = await prisma.resource.create({
      data: { projectId: project.id, ...resource },
    });
    resources.set(created.role, created.id);
  }

  // Tugas induk dibuat lebih dahulu supaya anak dapat merujuknya.
  const taskIds = new Map<string, string>();
  for (const group of GROUPS) {
    const parent = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId: null,
        position: Number(group.key) - 1,
        name: group.name,
        description: `Kelompok pekerjaan ${group.name.toLowerCase()}.`,
        durationDays: 1,
        startDate: PROJECT_START,
        scheduledStart: PROJECT_START,
        scheduledEnd: PROJECT_START,
        priority: 'MEDIUM',
        color: group.color,
        progress: 0,
      },
    });
    taskIds.set(group.key, parent.id);
  }

  const childPositions = new Map<string, number>();
  for (const task of TASKS) {
    const parentId = task.parentKey ? taskIds.get(task.parentKey) : undefined;
    if (!parentId) throw new Error(`Tugas induk ${task.parentKey} tidak ditemukan`);
    const position = childPositions.get(task.parentKey as string) ?? 0;
    childPositions.set(task.parentKey as string, position + 1);

    const created = await prisma.task.create({
      data: {
        projectId: project.id,
        parentId,
        position,
        name: task.name,
        durationDays: task.durationDays,
        startDate: PROJECT_START,
        scheduledStart: PROJECT_START,
        scheduledEnd: PROJECT_START,
        priority: task.priority,
        color: task.color,
        progress: task.progress,
        optimisticDays: task.optimisticDays ?? null,
        pessimisticDays: task.pessimisticDays ?? null,
      },
    });
    taskIds.set(task.key, created.id);
  }

  for (const task of TASKS) {
    const taskId = taskIds.get(task.key);
    if (!taskId) continue;
    for (const predecessor of task.predecessors) {
      const predecessorId = taskIds.get(predecessor.key);
      if (!predecessorId) throw new Error(`Tugas pendahulu ${predecessor.key} tidak ditemukan`);
      await prisma.dependency.create({
        data: { predecessorId, successorId: taskId, type: predecessor.type, lagDays: predecessor.lagDays },
      });
    }
    for (const assignment of task.assignments) {
      const resourceId = resources.get(assignment.role);
      if (!resourceId) throw new Error(`Resource dengan peran ${assignment.role} tidak ditemukan`);
      await prisma.assignment.create({
        data: { taskId, resourceId, allocationPercent: assignment.percent },
      });
    }
  }

  const tasks = await recomputeProject(project.id);
  process.stdout.write(`[seed] ${tasks.length} tugas dijadwalkan ulang.\n`);
  process.stdout.write(`[seed] Selesai. Masuk dengan ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`[seed] Gagal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
