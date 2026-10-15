/**
 * Tipe domain bersama antara server dan client.
 * Bentuk ini mengikuti model data pada Bagian 5 blueprint.
 */

import { ISODate } from './dates.js';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type DependencyType = 'FS' | 'SS';

export const PRIORITY_VALUES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];
export const DEPENDENCY_TYPE_VALUES: DependencyType[] = ['FS', 'SS'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
};

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'Selesai-Mulai (FS)',
  SS: 'Mulai-Mulai (SS)',
};

/** Tugas sebagaimana dipakai mesin penjadwalan. */
export interface SchedulerTask {
  id: string;
  parentId: string | null;
  position: number;
  name: string;
  durationDays: number;
  startDate: ISODate;
  priority: Priority;
  progress: number;
  /** Estimasi tiga titik (opsional), hanya dipakai diagram PERT. */
  optimisticDays?: number | null;
  pessimisticDays?: number | null;
}

export interface SchedulerDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

/** Hasil perhitungan jadwal untuk satu tugas. */
export interface ScheduledTask extends SchedulerTask {
  scheduledStart: ISODate;
  scheduledEnd: ISODate;
  /** Tugas induk (summary) yang punya anak. */
  isSummary: boolean;
  children: string[];
  /** 0 untuk tugas akar, bertambah satu tiap level. */
  level: number;
}

export interface CpmActivity {
  id: string;
  name: string;
  durationDays: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalFloat: number;
  critical: boolean;
}

export interface CpmResult {
  /** Ordinal hari kerja berakhirnya proyek. */
  projectEnd: number;
  projectStart: ISODate;
  projectFinish: ISODate;
  activities: CpmActivity[];
  byId: Record<string, CpmActivity>;
  criticalPath: string[];
}

export interface PertNodeInput {
  id: string;
  name: string;
  durationDays: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  critical: boolean;
  column: number;
  row: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
  expectedTime: number | null;
  variance: number | null;
}

export interface PertEdge {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
  critical: boolean;
}

export interface PertResult {
  nodes: PertNodeInput[];
  edges: PertEdge[];
  criticalPath: string[];
  criticalVariance: number;
  criticalStandardDeviation: number;
  width: number;
  height: number;
}

export interface CostBreakdownItem {
  taskId: string;
  taskName: string;
  resourceId: string;
  resourceName: string;
  allocationPercent: number;
  dailyRate: number;
  cost: number;
}

export interface TaskCostSummary {
  taskId: string;
  taskName: string;
  durationDays: number;
  cost: number;
}

export interface ResourceCostSummary {
  resourceId: string;
  resourceName: string;
  role: string;
  salary: number;
  dailyRate: number;
  plannedDays: number;
  cost: number;
}

export interface OverAllocationWarning {
  resourceId: string;
  resourceName: string;
  date: ISODate;
  totalPercent: number;
  taskIds: string[];
}

export interface CostSummary {
  totalCost: number;
  perTask: TaskCostSummary[];
  perResource: ResourceCostSummary[];
  overAllocations: OverAllocationWarning[];
}

/* ------------------------------------------------- kontrak REST (DTO) */

/** Bentuk JSON yang dikirim API. Semua tanggal berupa string `YYYY-MM-DD`. */
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ProjectDTO {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  startDate: ISODate;
  weekendDays: number[];
  createdAt: string;
}

export interface TaskDTO {
  id: string;
  projectId: string;
  parentId: string | null;
  position: number;
  name: string;
  description: string | null;
  durationDays: number;
  startDate: ISODate;
  scheduledStart: ISODate;
  scheduledEnd: ISODate;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
  isSummary: boolean;
  level: number;
  children: string[];
}

export interface DependencyDTO {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ResourceDTO {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role: string;
  salary: number;
}

export interface AssignmentDTO {
  id: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

export interface HolidayDTO {
  id: string;
  projectId: string;
  date: ISODate;
  name: string;
}

export interface ProjectListItemDTO extends ProjectDTO {
  taskCount: number;
  resourceCount: number;
  scheduledStart: ISODate | null;
  scheduledEnd: ISODate | null;
}

/** Respons `GET /api/projects`. */
export interface ProjectListResponseDTO {
  projects: ProjectListItemDTO[];
}

/** Respons `GET /api/projects/:id`. */
export interface ProjectSnapshotDTO {
  project: ProjectDTO;
  tasks: TaskDTO[];
  dependencies: DependencyDTO[];
  resources: ResourceDTO[];
  assignments: AssignmentDTO[];
  holidays: HolidayDTO[];
}

/** Respons setiap mutasi yang mengubah jadwal. */
export interface TasksResponseDTO {
  tasks: TaskDTO[];
}

/** Respons `GET /api/projects/:id/analysis`. */
export interface AnalysisDTO {
  summary: {
    projectStart: ISODate;
    projectFinish: ISODate;
    totalWorkingDays: number;
    totalCost: number;
    criticalTaskCount: number;
  };
  cpm: CpmActivity[];
  criticalPath: string[];
  pert: PertResult;
  costs: CostSummary;
}

/** Bentuk error standar API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
