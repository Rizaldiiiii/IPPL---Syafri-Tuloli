import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  MAX_DEPENDENCY_LAG,
  MAX_TASK_DURATION,
  hexColorSchema,
  isoDateSchema,
  prioritySchema,
  type DependencyDTO,
  type DependencyType,
  type Priority,
  type ProjectSnapshotDTO,
  type ResourceDTO,
  type TaskDTO,
} from '@gantt/shared';
import {
  useCreateAssignment,
  useCreateDependency,
  useDeleteAssignment,
  useDeleteDependency,
  useMoveTask,
} from '../../api/queries.js';
import { useToast } from '../../hooks/useToast.js';
import { formatIDR } from '../../lib/format.js';
import { Button } from '../ui/Button.js';
import { Input, Select, Textarea } from '../ui/Field.js';
import { Modal } from '../ui/Modal.js';

const formSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nama tugas wajib diisi' }).max(200, { message: 'Nama maksimal 200 karakter' }),
  description: z.string().trim().max(2000, { message: 'Deskripsi maksimal 2000 karakter' }),
  parentId: z.string(),
  durationDays: z
    .number({ invalid_type_error: 'Durasi wajib diisi' })
    .int({ message: 'Durasi harus bilangan bulat' })
    .min(1, { message: 'Durasi minimal 1 hari' })
    .max(MAX_TASK_DURATION, { message: `Durasi maksimal ${MAX_TASK_DURATION} hari` }),
  startDate: isoDateSchema,
  priority: prioritySchema,
  color: hexColorSchema,
  progress: z.number().int().min(0, { message: 'Progres minimal 0' }).max(100, { message: 'Progres maksimal 100' }),
});

export type TaskFormValues = z.infer<typeof formSchema>;

export interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  snapshot: ProjectSnapshotDTO;
  /** `null` berarti membuat tugas baru. */
  task: TaskDTO | null;
  defaultParentId: string | null;
  saving: boolean;
  onSubmit: (values: {
    name: string;
    description: string | null;
    parentId: string | null;
    durationDays: number;
    startDate: string;
    priority: Priority;
    color: string;
    progress: number;
    optimisticDays: number | null;
    pessimisticDays: number | null;
  }) => void;
  onDelete?: () => void;
}

function parseOptionalInt(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

export function TaskDialog({
  open,
  onClose,
  snapshot,
  task,
  defaultParentId,
  saving,
  onSubmit,
  onDelete,
}: TaskDialogProps): JSX.Element | null {
  const { push } = useToast();
  const projectId = snapshot.project.id;
  const isEdit = task !== null;
  const isSummary = task?.isSummary ?? false;

  const [optimistic, setOptimistic] = useState('');
  const [pessimistic, setPessimistic] = useState('');
  const [newDependency, setNewDependency] = useState<{ predecessorId: string; type: DependencyType; lagDays: string }>({
    predecessorId: '',
    type: 'FS',
    lagDays: '0',
  });
  const [newAssignment, setNewAssignment] = useState({ resourceId: '', allocationPercent: '100' });

  const createDependency = useCreateDependency(projectId);
  const deleteDependency = useDeleteDependency(projectId);
  const createAssignment = useCreateAssignment(projectId);
  const deleteAssignment = useDeleteAssignment(projectId);
  const moveTask = useMoveTask(projectId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      parentId: defaultParentId ?? '',
      durationDays: 1,
      startDate: snapshot.project.startDate,
      priority: 'MEDIUM',
      color: '#2563EB',
      progress: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: task?.name ?? '',
      description: task?.description ?? '',
      parentId: task?.parentId ?? defaultParentId ?? '',
      durationDays: task?.durationDays ?? 1,
      startDate: task?.startDate ?? snapshot.project.startDate,
      priority: task?.priority ?? 'MEDIUM',
      color: task?.color ?? '#2563EB',
      progress: task?.progress ?? 0,
    });
    setOptimistic(task?.optimisticDays ? String(task.optimisticDays) : '');
    setPessimistic(task?.pessimisticDays ? String(task.pessimisticDays) : '');
    setNewDependency({ predecessorId: '', type: 'FS', lagDays: '0' });
    setNewAssignment({ resourceId: '', allocationPercent: '100' });
  }, [open, task, defaultParentId, snapshot.project.startDate, reset]);

  const tasksById = useMemo(() => new Map(snapshot.tasks.map((item) => [item.id, item])), [snapshot.tasks]);

  const dependenciesOfTask = task
    ? snapshot.dependencies.filter((dependency) => dependency.successorId === task.id)
    : [];
  const assignmentsOfTask = task ? snapshot.assignments.filter((assignment) => assignment.taskId === task.id) : [];

  const summaryIds = new Set(snapshot.tasks.filter((item) => item.isSummary).map((item) => item.id));

  const predecessorOptions = snapshot.tasks.filter(
    (candidate) =>
      !candidate.isSummary &&
      candidate.id !== task?.id &&
      !dependenciesOfTask.some((dependency) => dependency.predecessorId === candidate.id),
  );

  const parentOptions = snapshot.tasks.filter((candidate) => {
    if (!summaryIds.has(candidate.id) && candidate.id !== task?.parentId) return false;
    if (candidate.id === task?.id) return false;
    if (task && candidate.id === task.id) return false;
    // Tidak boleh memindahkan tugas ke dalam sub-tugasnya sendiri.
    let cursor: string | null = candidate.parentId;
    const guard = new Set<string>();
    while (cursor) {
      if (cursor === task?.id) return false;
      if (guard.has(cursor)) break;
      guard.add(cursor);
      cursor = tasksById.get(cursor)?.parentId ?? null;
    }
    return true;
  });

  const handleAddDependency = async (): Promise<void> => {
    if (!task || !newDependency.predecessorId) {
      push({ variant: 'warning', title: 'Pilih tugas pendahulu terlebih dahulu' });
      return;
    }
    try {
      await createDependency.mutateAsync({
        taskId: task.id,
        input: {
          predecessorId: newDependency.predecessorId,
          type: newDependency.type,
          lagDays: Number(newDependency.lagDays) || 0,
        },
      });
      setNewDependency({ predecessorId: '', type: 'FS', lagDays: '0' });
      push({ variant: 'success', title: 'Dependensi ditambahkan', description: 'Jadwal sudah dihitung ulang.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dependensi gagal ditambahkan.';
      push({ variant: 'error', title: 'Dependensi ditolak', description: message });
    }
  };

  const handleRemoveDependency = async (dependency: DependencyDTO): Promise<void> => {
    try {
      await deleteDependency.mutateAsync(dependency.id);
      push({ variant: 'success', title: 'Dependensi dihapus' });
    } catch (error) {
      push({
        variant: 'error',
        title: 'Dependensi gagal dihapus',
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleAddAssignment = async (): Promise<void> => {
    if (!task || !newAssignment.resourceId) {
      push({ variant: 'warning', title: 'Pilih anggota tim terlebih dahulu' });
      return;
    }
    const percent = Number(newAssignment.allocationPercent);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      push({ variant: 'warning', title: 'Alokasi harus antara 1% sampai 100%' });
      return;
    }
    try {
      await createAssignment.mutateAsync({
        taskId: task.id,
        input: { resourceId: newAssignment.resourceId, allocationPercent: Math.round(percent) },
      });
      setNewAssignment({ resourceId: '', allocationPercent: '100' });
      push({ variant: 'success', title: 'Alokasi ditambahkan' });
    } catch (error) {
      push({
        variant: 'error',
        title: 'Alokasi gagal ditambahkan',
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string): Promise<void> => {
    try {
      await deleteAssignment.mutateAsync(assignmentId);
      push({ variant: 'success', title: 'Alokasi dihapus' });
    } catch (error) {
      push({
        variant: 'error',
        title: 'Alokasi gagal dihapus',
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const submit = handleSubmit(async (values) => {
    const nextParentId = values.parentId.length > 0 ? values.parentId : null;
    if (isEdit && task && nextParentId !== task.parentId) {
      try {
        await moveTask.mutateAsync({ taskId: task.id, input: { parentId: nextParentId, position: 9999 } });
      } catch (error) {
        push({
          variant: 'error',
          title: 'Tugas gagal dipindahkan',
          description: error instanceof Error ? error.message : undefined,
        });
        return;
      }
    }
    onSubmit({
      name: values.name,
      description: values.description.trim().length > 0 ? values.description : null,
      parentId: nextParentId,
      durationDays: values.durationDays,
      startDate: values.startDate,
      priority: values.priority,
      color: values.color,
      progress: values.progress,
      optimisticDays: parseOptionalInt(optimistic),
      pessimisticDays: parseOptionalInt(pessimistic),
    });
  });

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEdit ? `Ubah tugas · ${task?.name ?? ''}` : 'Tambah tugas'}
      description={
        isSummary
          ? 'Tugas induk: durasi, tanggal, dan progres dihitung otomatis dari sub-tugas.'
          : 'Isi detail tugas, lalu atur dependensi dan penanggung jawabnya.'
      }
      footer={
        <>
          {isEdit && onDelete ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:bg-danger-bg"
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
              onClick={onDelete}
            >
              Hapus tugas
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            {isEdit ? 'Simpan perubahan' : 'Tambah tugas'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <section className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nama tugas"
            required
            placeholder="Contoh: Penyusunan spesifikasi"
            error={errors.name?.message}
            containerClassName="sm:col-span-2"
            {...register('name')}
          />
          <Textarea
            label="Deskripsi"
            placeholder="Keterangan singkat mengenai tugas ini"
            error={errors.description?.message}
            containerClassName="sm:col-span-2"
            {...register('description')}
          />
          <Select label="Tugas induk" hint="Kosongkan untuk menjadikan tugas level teratas." {...register('parentId')}>
            <option value="">— Tanpa induk —</option>
            {parentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {'\u00A0'.repeat(candidate.level * 3)}
                {candidate.name}
              </option>
            ))}
          </Select>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Durasi (hari kerja)"
            type="number"
            min={1}
            required
            disabled={isSummary}
            hint={isSummary ? 'Dihitung dari sub-tugas' : undefined}
            error={errors.durationDays?.message}
            {...register('durationDays', { valueAsNumber: true })}
          />
          <Input
            label="Mulai paling awal"
            type="date"
            required
            disabled={isSummary}
            hint={isSummary ? 'Dihitung dari sub-tugas' : 'Boleh mundur bila menunggu pendahulu'}
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <Input
            label="Progres (%)"
            type="number"
            min={0}
            max={100}
            disabled={isSummary}
            hint={isSummary ? 'Rata-rata berbobot sub-tugas' : undefined}
            error={errors.progress?.message}
            {...register('progress', { valueAsNumber: true })}
          />
          <Select label="Prioritas" {...register('priority')}>
            <option value="LOW">Rendah</option>
            <option value="MEDIUM">Sedang</option>
            <option value="HIGH">Tinggi</option>
          </Select>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-color" className="text-[13px] font-semibold text-ink-2">
              Warna indikator
            </label>
            <div className="flex items-center gap-2">
              <input
                id="task-color"
                type="color"
                className="h-10 w-14 cursor-pointer rounded border border-line-strong bg-surface p-1"
                {...register('color')}
              />
              <span className="text-xs text-ink-3">Warna bar pada grafik Gantt</span>
            </div>
            {errors.color ? <p className="text-xs font-medium text-danger">{errors.color.message}</p> : null}
          </div>
          <Input
            label="Estimasi optimistis (hari)"
            type="number"
            min={1}
            placeholder="Kosongkan bila tidak dipakai"
            value={optimistic}
            onChange={(event) => setOptimistic(event.target.value)}
          />
          <Input
            label="Estimasi pesimistis (hari)"
            type="number"
            min={1}
            placeholder="Kosongkan bila tidak dipakai"
            value={pessimistic}
            onChange={(event) => setPessimistic(event.target.value)}
          />
        </section>

        {!isEdit ? (
          <p className="rounded-md border border-info/25 bg-info-bg px-4 py-3 text-xs text-ink-2">
            Dependensi dan alokasi anggota tim dapat ditambahkan setelah tugas disimpan.
          </p>
        ) : isSummary ? (
          <p className="rounded-md border border-info/25 bg-info-bg px-4 py-3 text-xs text-ink-2">
            Tugas induk tidak memiliki dependensi dan alokasi. Kelola keduanya pada sub-tugas.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-md border border-line p-4">
              <h3 className="text-sm font-semibold text-ink">Dependensi (pendahulu)</h3>
              <p className="mt-0.5 text-xs text-ink-3">
                FS: penerus mulai setelah pendahulu selesai. SS: penerus mulai bersamaan dengan pendahulu.
              </p>

              <ul className="mt-3 flex flex-col gap-2">
                {dependenciesOfTask.length === 0 ? (
                  <li className="text-xs text-ink-3">Belum ada pendahulu.</li>
                ) : null}
                {dependenciesOfTask.map((dependency) => (
                  <li
                    key={dependency.id}
                    className="flex items-center justify-between gap-2 rounded border border-line bg-surface-2/60 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-xs font-medium text-ink-2">
                      {tasksById.get(dependency.predecessorId)?.name ?? 'Tugas tidak ditemukan'}
                    </span>
                    <span className="tabular shrink-0 text-[11px] font-semibold text-ink-3">
                      {dependency.type} · jeda {dependency.lagDays} hari
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveDependency(dependency)}
                      className="rounded p-1 text-ink-3 transition hover:bg-danger-bg hover:text-danger"
                      aria-label="Hapus dependensi"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                <Select
                  label="Tugas pendahulu"
                  value={newDependency.predecessorId}
                  onChange={(event) =>
                    setNewDependency((current) => ({ ...current, predecessorId: event.target.value }))
                  }
                >
                  <option value="">— Pilih tugas —</option>
                  {predecessorOptions.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Tipe"
                  value={newDependency.type}
                  onChange={(event) =>
                    setNewDependency((current) => ({
                      ...current,
                      type: event.target.value as DependencyType,
                    }))
                  }
                >
                  <option value="FS">FS</option>
                  <option value="SS">SS</option>
                </Select>
                <Input
                  label="Jeda"
                  type="number"
                  min={-MAX_DEPENDENCY_LAG}
                  max={MAX_DEPENDENCY_LAG}
                  value={newDependency.lagDays}
                  onChange={(event) =>
                    setNewDependency((current) => ({ ...current, lagDays: event.target.value }))
                  }
                />
                <Button
                  variant="secondary"
                  icon={<Plus className="h-4 w-4" aria-hidden />}
                  onClick={() => void handleAddDependency()}
                  loading={createDependency.isPending}
                >
                  Tambah
                </Button>
              </div>
            </section>

            <section className="rounded-md border border-line p-4">
              <h3 className="text-sm font-semibold text-ink">Penanggung jawab</h3>
              <p className="mt-0.5 text-xs text-ink-3">
                Alokasi 100% berarti satu orang penuh pada tugas ini.
              </p>

              <ul className="mt-3 flex flex-col gap-2">
                {assignmentsOfTask.length === 0 ? (
                  <li className="text-xs text-ink-3">Belum ada anggota yang dialokasikan.</li>
                ) : null}
                {assignmentsOfTask.map((assignment) => {
                  const resource = snapshot.resources.find((item) => item.id === assignment.resourceId);
                  return (
                    <li
                      key={assignment.id}
                      className="flex items-center justify-between gap-2 rounded border border-line bg-surface-2/60 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-xs font-medium text-ink-2">
                        {resource?.name ?? 'Anggota tidak ditemukan'}
                      </span>
                      <span className="tabular shrink-0 text-[11px] font-semibold text-ink-3">
                        {assignment.allocationPercent}%
                        {resource ? ` · ${formatIDR(resource.salary / 22)}/hari` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveAssignment(assignment.id)}
                        className="rounded p-1 text-ink-3 transition hover:bg-danger-bg hover:text-danger"
                        aria-label="Hapus alokasi"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <Select
                  label="Anggota tim"
                  value={newAssignment.resourceId}
                  onChange={(event) =>
                    setNewAssignment((current) => ({ ...current, resourceId: event.target.value }))
                  }
                >
                  <option value="">— Pilih anggota —</option>
                  {snapshot.resources
                    .filter(
                      (resource: ResourceDTO) =>
                        !assignmentsOfTask.some((assignment) => assignment.resourceId === resource.id),
                    )
                    .map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name} · {resource.role}
                      </option>
                    ))}
                </Select>
                <Input
                  label="Alokasi (%)"
                  type="number"
                  min={1}
                  max={100}
                  value={newAssignment.allocationPercent}
                  onChange={(event) =>
                    setNewAssignment((current) => ({ ...current, allocationPercent: event.target.value }))
                  }
                />
                <Button
                  variant="secondary"
                  icon={<Plus className="h-4 w-4" aria-hidden />}
                  onClick={() => void handleAddAssignment()}
                  loading={createAssignment.isPending}
                >
                  Tambah
                </Button>
              </div>
            </section>
          </div>
        )}
      </form>
    </Modal>
  );
}
