/**
 * Skema validasi zod yang dipakai server (validasi input) dan client (validasi form).
 * Satu sumber kebenaran agar pesan error konsisten.
 */

import { z } from 'zod';
import { isISODate } from './dates.js';
import { MAX_TASK_DEPTH } from './scheduler.js';

export const isoDateSchema = z
  .string()
  .refine((value) => isISODate(value), { message: 'Tanggal harus berformat YYYY-MM-DD yang valid' });

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { message: 'Warna harus berformat heksadesimal, contoh #2563EB' });

export const weekendDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, { message: 'Minimal satu hari kerja harus tersedia' })
  .max(6, { message: 'Akhir pekan tidak boleh mencakup ketujuh hari' })
  .refine((days) => new Set(days).size === days.length, { message: 'Hari akhir pekan tidak boleh duplikat' });

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const dependencyTypeSchema = z.enum(['FS', 'SS']);

export const MAX_DEPENDENCY_LAG = 365;
export const MAX_TASK_DURATION = 3650;

/* ------------------------------------------------------------------ auth */

export const registerSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nama wajib diisi' }).max(120, { message: 'Nama maksimal 120 karakter' }),
  email: z.string().trim().toLowerCase().email({ message: 'Format email tidak valid' }),
  password: z.string().min(8, { message: 'Password minimal 8 karakter' }).max(200, { message: 'Password maksimal 200 karakter' }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Format email tidak valid' }),
  password: z.string().min(1, { message: 'Password wajib diisi' }),
});

/* --------------------------------------------------------------- project */

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nama proyek wajib diisi' }).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: isoDateSchema,
  weekendDays: weekendDaysSchema.optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nama proyek wajib diisi' }).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: isoDateSchema.optional(),
});

export const calendarUpdateSchema = z.object({
  weekendDays: weekendDaysSchema,
});

export const holidayCreateSchema = z.object({
  date: isoDateSchema,
  name: z.string().trim().min(1, { message: 'Nama hari libur wajib diisi' }).max(120),
});

/* ------------------------------------------------------------------ task */

export const taskCreateSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nama tugas wajib diisi' }).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  parentId: z.string().min(1).optional().nullable(),
  durationDays: z.number().int().min(1, { message: 'Durasi minimal 1 hari' }).max(MAX_TASK_DURATION),
  startDate: isoDateSchema,
  priority: prioritySchema.default('MEDIUM'),
  color: hexColorSchema.default('#2563EB'),
  progress: z.number().int().min(0).max(100).default(0),
  optimisticDays: z.number().int().min(1).max(MAX_TASK_DURATION).optional().nullable(),
  pessimisticDays: z.number().int().min(1).max(MAX_TASK_DURATION).optional().nullable(),
});

/** Field yang boleh diubah. Field terjadwal dihitung server dan tidak diterima dari client. */
export const taskUpdateSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Nama tugas wajib diisi' }).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    durationDays: z.number().int().min(1).max(MAX_TASK_DURATION).optional(),
    startDate: isoDateSchema.optional(),
    priority: prioritySchema.optional(),
    color: hexColorSchema.optional(),
    progress: z.number().int().min(0).max(100).optional(),
    optimisticDays: z.number().int().min(1).max(MAX_TASK_DURATION).optional().nullable(),
    pessimisticDays: z.number().int().min(1).max(MAX_TASK_DURATION).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Tidak ada perubahan yang dikirim' });

export const taskMoveSchema = z.object({
  parentId: z.string().min(1).nullable(),
  position: z.number().int().min(0),
});

/* ------------------------------------------------------------ dependency */

export const dependencyCreateSchema = z.object({
  predecessorId: z.string().min(1, { message: 'Tugas pendahulu wajib dipilih' }),
  type: dependencyTypeSchema.default('FS'),
  lagDays: z
    .number()
    .int()
    .min(-MAX_DEPENDENCY_LAG, { message: `Jeda minimal -${MAX_DEPENDENCY_LAG} hari` })
    .max(MAX_DEPENDENCY_LAG, { message: `Jeda maksimal ${MAX_DEPENDENCY_LAG} hari` })
    .default(0),
});

export const dependencyUpdateSchema = z
  .object({
    type: dependencyTypeSchema.optional(),
    lagDays: z.number().int().min(-MAX_DEPENDENCY_LAG).max(MAX_DEPENDENCY_LAG).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Tidak ada perubahan yang dikirim' });

/* -------------------------------------------------------------- resource */

export const resourceCreateSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nama anggota wajib diisi' }).max(120),
  email: z.string().trim().toLowerCase().email({ message: 'Format email tidak valid' }),
  role: z.string().trim().min(1, { message: 'Peran wajib diisi' }).max(120),
  salary: z.number().int().min(0, { message: 'Gaji tidak boleh negatif' }).max(1_000_000_000),
});

export const resourceUpdateSchema = resourceCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Tidak ada perubahan yang dikirim' },
);

export const assignmentCreateSchema = z.object({
  resourceId: z.string().min(1, { message: 'Anggota tim wajib dipilih' }),
  allocationPercent: z
    .number()
    .int()
    .min(1, { message: 'Alokasi minimal 1%' })
    .max(100, { message: 'Alokasi maksimal 100%' })
    .default(100),
});

export const assignmentUpdateSchema = z.object({
  allocationPercent: z.number().int().min(1).max(100),
});

/* ------------------------------------------------------------------ tipe */

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type CalendarUpdateInput = z.infer<typeof calendarUpdateSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskMoveInput = z.infer<typeof taskMoveSchema>;
export type DependencyCreateInput = z.infer<typeof dependencyCreateSchema>;
export type DependencyUpdateInput = z.infer<typeof dependencyUpdateSchema>;
export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;

export const TASK_DEPTH_LIMIT = MAX_TASK_DEPTH;
