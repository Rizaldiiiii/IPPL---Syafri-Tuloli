import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Coins, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { resourceCreateSchema } from '@gantt/shared';
import {
  useAnalysis,
  useCreateResource,
  useDeleteResource,
  useProject,
  useUpdateResource,
} from '../api/queries.js';
import { PageHeading } from '../components/layout/AppShell.js';
import { Avatar, Badge, Card, CardHeader, StatTile } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Field.js';
import { ErrorState, InlineAlert, LoadingBlock } from '../components/ui/Feedback.js';
import { ConfirmDialog, Modal } from '../components/ui/Modal.js';
import { useToast } from '../hooks/useToast.js';
import { formatDecimal, formatIDR } from '../lib/format.js';

type ResourceFormValues = z.infer<typeof resourceCreateSchema>;

const EMPTY_VALUES: ResourceFormValues = { name: '', email: '', role: '', salary: 0 };

export function TeamPage({ projectId }: { projectId: string }): JSX.Element {
  const { success, error: errorToast } = useToast();
  const projectQuery = useProject(projectId);
  const analysisQuery = useAnalysis(projectId);
  const createResource = useCreateResource(projectId);
  const updateResource = useUpdateResource(projectId);
  const deleteResource = useDeleteResource(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceCreateSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!formOpen) return;
    const resource = projectQuery.data?.resources.find((item) => item.id === editingId);
    reset(
      resource
        ? { name: resource.name, email: resource.email, role: resource.role, salary: resource.salary }
        : EMPTY_VALUES,
    );
  }, [formOpen, editingId, projectQuery.data, reset]);

  if (projectQuery.isLoading || analysisQuery.isLoading) {
    return <LoadingBlock label="Memuat data tim..." />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ErrorState
        description={projectQuery.error instanceof Error ? projectQuery.error.message : 'Data tim tidak dapat dimuat.'}
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  const snapshot = projectQuery.data;
  const costs = analysisQuery.data?.costs;
  const overAllocations = costs?.overAllocations ?? [];
  const totalCost = costs?.totalCost ?? 0;
  const tasksById = new Map(snapshot.tasks.map((task) => [task.id, task]));

  const submit = handleSubmit((values) => {
    if (editingId) {
      updateResource.mutate(
        { resourceId: editingId, input: values },
        {
          onSuccess: () => {
            success('Anggota tim diperbarui');
            setFormOpen(false);
            setEditingId(null);
          },
          onError: (mutationError) =>
            errorToast('Gagal menyimpan anggota', mutationError instanceof Error ? mutationError.message : undefined),
        },
      );
      return;
    }
    createResource.mutate(values, {
      onSuccess: () => {
        success('Anggota tim ditambahkan');
        setFormOpen(false);
      },
      onError: (mutationError) =>
        errorToast('Gagal menambah anggota', mutationError instanceof Error ? mutationError.message : undefined),
    });
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeading
        title="Tim dan alokasi"
        description="Kelola anggota tim, lihat tugas yang dialokasikan, biaya per anggota, dan peringatan beban kerja."
        actions={
          <Button
            variant="primary"
            icon={<UserPlus className="h-4 w-4" aria-hidden />}
            onClick={() => {
              setEditingId(null);
              setFormOpen(true);
            }}
          >
            Tambah anggota
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Jumlah anggota"
          value={`${snapshot.resources.length} orang`}
          icon={<Users className="h-4 w-4" aria-hidden />}
          tone="brand"
        />
        <StatTile
          label="Total biaya rencana"
          value={formatIDR(totalCost)}
          icon={<Coins className="h-4 w-4" aria-hidden />}
          tone="success"
        />
        <StatTile
          label="Peringatan over-alokasi"
          value={`${overAllocations.length} hari`}
          hint="Total alokasi > 100% pada hari kerja yang sama"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          tone={overAllocations.length > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {overAllocations.length > 0 ? (
        <InlineAlert tone="warning" title="Beberapa anggota dialokasikan melebihi 100%">
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {overAllocations.slice(0, 8).map((warning) => (
              <li key={`${warning.resourceId}-${warning.date}`}>
                {warning.resourceName} · {warning.date} · total {warning.totalPercent}% (
                {warning.taskIds
                  .map((taskId) => tasksById.get(taskId)?.name ?? taskId)
                  .join(', ')}
                )
              </li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}

      <Card>
        <CardHeader
          title="Daftar anggota tim"
          description="Gaji bulanan dipakai untuk menghitung tarif harian (gaji / 22)."
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-3">
                <th scope="col" className="px-4 py-2.5 font-bold">Anggota</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Peran</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Gaji / bulan</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Tarif / hari</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Tugas dialokasikan</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Biaya</th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.resources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-3">
                    Belum ada anggota tim. Tambahkan anggota untuk mulai mengalokasikan pekerjaan.
                  </td>
                </tr>
              ) : null}
              {snapshot.resources.map((resource) => {
                const ownAssignments = snapshot.assignments.filter(
                  (assignment) => assignment.resourceId === resource.id,
                );
                const summary = costs?.perResource.find((item) => item.resourceId === resource.id);
                const hasWarning = overAllocations.some((warning) => warning.resourceId === resource.id);
                return (
                  <tr key={resource.id} className="border-b border-line/70 align-top last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={resource.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{resource.name}</p>
                          <p className="truncate text-xs text-ink-3">{resource.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{resource.role}</td>
                    <td className="tabular px-3 py-3 text-right text-ink-2">{formatIDR(resource.salary)}</td>
                    <td className="tabular px-3 py-3 text-right text-ink-2">
                      {formatIDR(resource.salary / 22)}
                    </td>
                    <td className="px-3 py-3">
                      {ownAssignments.length === 0 ? (
                        <span className="text-xs text-ink-3">Belum ada alokasi</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {ownAssignments.map((assignment) => (
                            <span
                              key={assignment.id}
                              className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2"
                              title={`${tasksById.get(assignment.taskId)?.name ?? 'Tugas'} · ${assignment.allocationPercent}%`}
                            >
                              {tasksById.get(assignment.taskId)?.name ?? 'Tugas'} · {assignment.allocationPercent}%
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="tabular px-3 py-3 text-right font-semibold text-ink">
                      {summary ? formatIDR(summary.cost) : formatIDR(0)}
                      <span className="block text-[11px] font-normal text-ink-3">
                        {summary ? `${formatDecimal(summary.plannedDays)} hari-orang` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {hasWarning ? <Badge tone="warning">Over-alokasi</Badge> : null}
                        <button
                          type="button"
                          className="rounded p-1.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
                          aria-label={`Ubah ${resource.name}`}
                          onClick={() => {
                            setEditingId(resource.id);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-ink-3 transition hover:bg-danger-bg hover:text-danger"
                          aria-label={`Hapus ${resource.name}`}
                          onClick={() => setDeleteTarget({ id: resource.id, name: resource.name })}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        title={editingId ? 'Ubah anggota tim' : 'Tambah anggota tim'}
        description="Gaji dipakai untuk menghitung biaya tugas: tarif harian = gaji bulanan / 22."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              loading={createResource.isPending || updateResource.isPending}
              icon={<Plus className="h-4 w-4" aria-hidden />}
            >
              {editingId ? 'Simpan perubahan' : 'Tambah anggota'}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input label="Nama lengkap" required error={errors.name?.message} {...register('name')} />
          <Input
            label="Email"
            type="email"
            required
            error={errors.email?.message}
            placeholder="nama@example.com"
            {...register('email')}
          />
          <Input
            label="Peran"
            required
            error={errors.role?.message}
            placeholder="Contoh: Backend Developer"
            {...register('role')}
          />
          <Input
            label="Gaji per bulan (rupiah)"
            type="number"
            min={0}
            required
            hint="Contoh: 12000000"
            error={errors.salary?.message}
            {...register('salary', { valueAsNumber: true })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus anggota tim?"
        message={`"${deleteTarget?.name ?? ''}" beserta seluruh alokasinya pada tugas akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus anggota"
        loading={deleteResource.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteResource.mutate(deleteTarget.id, {
            onSuccess: () => {
              success('Anggota tim dihapus');
              setDeleteTarget(null);
            },
            onError: (mutationError) => {
              errorToast('Gagal menghapus anggota', mutationError instanceof Error ? mutationError.message : undefined);
              setDeleteTarget(null);
            },
          });
        }}
      />
    </div>
  );
}
