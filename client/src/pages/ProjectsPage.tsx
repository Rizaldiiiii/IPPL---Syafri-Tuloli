import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  CalendarRange,
  FolderKanban,
  GanttChartSquare,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { projectCreateSchema, todayISODate, WEEKDAY_LABELS } from '@gantt/shared';
import { useCreateProject, useDeleteProject, useProjects } from '../api/queries.js';
import { PageHeading } from '../components/layout/AppShell.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { CheckboxRow, Input, Textarea } from '../components/ui/Field.js';
import { EmptyState, ErrorState, SkeletonRows } from '../components/ui/Feedback.js';
import { ConfirmDialog, Modal } from '../components/ui/Modal.js';
import { useToast } from '../hooks/useToast.js';
import { formatISODateShort } from '../lib/format.js';

const projectFormSchema = projectCreateSchema.omit({ weekendDays: true });
type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function ProjectsPage(): JSX.Element {
  const navigate = useNavigate();
  const { success, error: errorToast } = useToast();
  const projectsQuery = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [weekendDays, setWeekendDays] = useState<number[]>([0, 6]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: '', description: '', startDate: todayISODate() },
  });

  const submit = handleSubmit((values) => {
    createProject.mutate(
      {
        name: values.name,
        description: values.description ?? null,
        startDate: values.startDate,
        weekendDays,
      },
      {
        onSuccess: (response) => {
          success('Proyek dibuat', 'Tambahkan tugas pertama pada halaman Gantt.');
          setFormOpen(false);
          reset({ name: '', description: '', startDate: todayISODate() });
          navigate(`/projects/${response.project.id}/gantt`);
        },
        onError: (mutationError) =>
          errorToast('Gagal membuat proyek', mutationError instanceof Error ? mutationError.message : undefined),
      },
    );
  });

  const projects = projectsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeading
        title="Proyek saya"
        description="Setiap proyek punya jadwal, tim, kalender, dan analisis jalur kritisnya sendiri."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => setFormOpen(true)}
          >
            Proyek baru
          </Button>
        }
      />

      {projectsQuery.isLoading ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : projectsQuery.isError ? (
        <Card>
          <ErrorState
            description={
              projectsQuery.error instanceof Error
                ? projectsQuery.error.message
                : 'Daftar proyek tidak dapat dimuat.'
            }
            onRetry={() => void projectsQuery.refetch()}
          />
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="h-6 w-6" aria-hidden />}
            title="Belum ada proyek"
            description="Buat proyek pertama Anda, lalu susun tugas, dependensi, dan tim di dalamnya."
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setFormOpen(true)}>
                Proyek baru
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                    <GanttChartSquare className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-ink" title={project.name}>
                      {project.name}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">
                      {project.description ?? 'Tanpa deskripsi'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded p-1.5 text-ink-3 transition hover:bg-danger-bg hover:text-danger"
                  aria-label={`Hapus proyek ${project.name}`}
                  onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="flex items-center gap-1.5 font-semibold text-ink-3">
                      <CalendarRange className="h-3.5 w-3.5" aria-hidden /> Rentang
                    </dt>
                    <dd className="mt-0.5 text-ink-2">
                      {project.scheduledStart && project.scheduledEnd
                        ? `${formatISODateShort(project.scheduledStart)} – ${formatISODateShort(project.scheduledEnd)}`
                        : `Mulai ${formatISODateShort(project.startDate)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 font-semibold text-ink-3">
                      <FolderKanban className="h-3.5 w-3.5" aria-hidden /> Tugas
                    </dt>
                    <dd className="tabular mt-0.5 text-ink-2">{project.taskCount} tugas</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 font-semibold text-ink-3">
                      <Users className="h-3.5 w-3.5" aria-hidden /> Tim
                    </dt>
                    <dd className="tabular mt-0.5 text-ink-2">{project.resourceCount} anggota</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink-3">Akhir pekan</dt>
                    <dd className="mt-0.5 text-ink-2">
                      {project.weekendDays.map((day) => WEEKDAY_LABELS[day].slice(0, 3)).join(', ') || '—'}
                    </dd>
                  </div>
                </dl>

                <Link
                  to={`/projects/${project.id}/gantt`}
                  className="mt-auto inline-flex items-center gap-1.5 self-start rounded-sm text-xs font-semibold text-brand-700 transition hover:gap-2.5"
                >
                  Buka proyek <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Proyek baru"
        description="Tentukan nama, tanggal mulai, dan hari akhir pekan yang berlaku untuk seluruh perhitungan durasi."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" loading={createProject.isPending} onClick={() => void submit()}>
              Buat proyek
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
          <Input
            label="Nama proyek"
            required
            placeholder="Contoh: Pengembangan Aplikasi Mobile Toko Online"
            error={errors.name?.message}
            {...register('name')}
          />
          <Textarea
            label="Deskripsi"
            placeholder="Tujuan dan ruang lingkup proyek"
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            label="Tanggal mulai"
            type="date"
            required
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold text-ink-2">Hari akhir pekan</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEEKDAY_LABELS.map((label, index) => (
                <CheckboxRow
                  key={label}
                  label={label}
                  checked={weekendDays.includes(index)}
                  onChange={() =>
                    setWeekendDays((current) => {
                      if (current.includes(index)) {
                        if (current.length === 1) return current;
                        return current.filter((value) => value !== index);
                      }
                      const next = [...current, index].sort((a, b) => a - b);
                      if (next.length === 7) return current;
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus proyek?"
        message={`Proyek "${deleteTarget?.name ?? ''}" beserta seluruh tugas, dependensi, tim, dan hari liburnya akan dihapus permanen.`}
        confirmLabel="Hapus proyek"
        loading={deleteProject.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProject.mutate(deleteTarget.id, {
            onSuccess: () => {
              success('Proyek dihapus');
              setDeleteTarget(null);
            },
            onError: (mutationError) => {
              errorToast('Gagal menghapus proyek', mutationError instanceof Error ? mutationError.message : undefined);
              setDeleteTarget(null);
            },
          });
        }}
      />
    </div>
  );
}
