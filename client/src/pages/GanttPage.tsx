import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CalendarCheck2, Crown, Plus, RotateCcw, Sparkles } from 'lucide-react';
import {
  createCalendar,
  durationFromDrag,
  isWorkingDay,
  nextWorkingDay,
  scheduleTasks,
  type Priority,
  type SchedulerDependency,
  type TaskDTO,
} from '@gantt/shared';
import { useAnalysis, useCreateTask, useDeleteTask, useProject, useUpdateTask } from '../api/queries.js';
import { GanttTimeline } from '../components/gantt/GanttTimeline.js';
import { TaskTable } from '../components/gantt/TaskTable.js';
import { TaskDialog } from '../components/tasks/TaskDialog.js';
import { PageHeading } from '../components/layout/AppShell.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { ConfirmDialog } from '../components/ui/Modal.js';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback.js';
import { useToast } from '../hooks/useToast.js';
import { cn } from '../lib/cn.js';
import { ZOOM_OPTIONS, buildWbsNumbers, computeTimeRange, pxPerDay, type ZoomLevel } from '../lib/gantt.js';

interface DragState {
  taskId: string;
  mode: 'move' | 'resize';
  startClientX: number;
  originalStart: string;
  originalEnd: string;
  currentDeltaDays: number;
  blocked: boolean;
}

export function GanttPage({ projectId }: { projectId: string }): JSX.Element {
  const { success, error: errorToast, info } = useToast();
  const projectQuery = useProject(projectId);
  const analysisQuery = useAnalysis(projectId);

  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [highlightCritical, setHighlightCritical] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dialogTask, setDialogTask] = useState<TaskDTO | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskDTO | null>(null);
  const [previewTasks, setPreviewTasks] = useState<TaskDTO[] | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Disimpan dalam ref agar listener drag tidak dipasang ulang setiap render.
  const updateTaskRef = useRef(updateTask);
  updateTaskRef.current = updateTask;
  const toastRef = useRef({ success, error: errorToast, info });
  toastRef.current = { success, error: errorToast, info };

  const snapshot = projectQuery.data;

  const calendar = useMemo(
    () =>
      snapshot
        ? createCalendar(
            snapshot.project.weekendDays,
            snapshot.holidays.map((holiday) => holiday.date),
          )
        : null,
    [snapshot],
  );

  const schedulerDependencies: SchedulerDependency[] = useMemo(
    () =>
      (snapshot?.dependencies ?? []).map((dependency) => ({
        id: dependency.id,
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
        type: dependency.type,
        lagDays: dependency.lagDays,
      })),
    [snapshot],
  );

  /** Menjalankan mesin `shared` di client untuk pratinjau selama drag (6.7). */
  const runPreview = useCallback(
    (taskId: string, mode: 'move' | 'resize', targetDate: string): TaskDTO[] | null => {
      if (!snapshot || !calendar) return null;
      const source = snapshot.tasks.map((task) => ({ ...task }));
      const target = source.find((task) => task.id === taskId);
      if (!target) return null;

      if (mode === 'move') {
        target.startDate = targetDate;
      } else {
        target.durationDays = durationFromDrag(calendar, target.scheduledStart, targetDate);
      }

      try {
        const scheduled = scheduleTasks({
          projectStartDate: snapshot.project.startDate,
          tasks: source,
          dependencies: schedulerDependencies,
          calendar,
        });
        const byId = new Map(scheduled.map((task) => [task.id, task]));
        return source.map((task) => {
          const result = byId.get(task.id);
          if (!result) return task;
          return {
            ...task,
            durationDays: result.durationDays,
            progress: result.progress,
            scheduledStart: result.scheduledStart,
            scheduledEnd: result.scheduledEnd,
            isSummary: result.isSummary,
          };
        });
      } catch {
        return null;
      }
    },
    [snapshot, calendar, schedulerDependencies],
  );

  const handleBarPointerDown = useCallback(
    (event: ReactPointerEvent<SVGElement>, task: TaskDTO, mode: 'move' | 'resize') => {
      if (event.button !== 0 || task.isSummary) return;
      event.preventDefault();
      setSelectedTaskId(task.id);
      const state: DragState = {
        taskId: task.id,
        mode,
        startClientX: event.clientX,
        originalStart: task.scheduledStart,
        originalEnd: task.scheduledEnd,
        currentDeltaDays: 0,
        blocked: false,
      };
      dragRef.current = state;
      setDrag(state);
    },
    [],
  );

  useEffect(() => {
    if (!drag || !calendar || !snapshot) return;

    const toast = (): typeof toastRef.current => toastRef.current;

    const handleMove = (event: PointerEvent): void => {
      const state = dragRef.current;
      if (!state || !calendar || !snapshot) return;
      const unit = pxPerDay(zoom);
      const deltaDays = Math.round((event.clientX - state.startClientX) / unit);
      if (deltaDays === state.currentDeltaDays) return;

      const base = state.mode === 'move' ? state.originalStart : state.originalEnd;
      const raw = new Date(`${base}T00:00:00Z`);
      raw.setUTCDate(raw.getUTCDate() + deltaDays);
      const rawISO = raw.toISOString().slice(0, 10);
      const snapped = isWorkingDay(calendar, rawISO) ? rawISO : nextWorkingDay(calendar, rawISO);

      const next: DragState = { ...state, currentDeltaDays: deltaDays };
      const preview = runPreview(state.taskId, state.mode, snapped);
      if (preview) {
        const dragged = preview.find((task) => task.id === state.taskId);
        next.blocked = state.mode === 'move' && dragged ? dragged.scheduledStart > snapped : false;
        setPreviewTasks(preview);
      } else {
        next.blocked = false;
        setPreviewTasks(null);
      }
      dragRef.current = next;
      setDrag(next);
    };

    const handleUp = (): void => {
      const state = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setPreviewTasks(null);

      if (!state || !calendar || !snapshot || state.currentDeltaDays === 0) return;

      const base = state.mode === 'move' ? state.originalStart : state.originalEnd;
      const raw = new Date(`${base}T00:00:00Z`);
      raw.setUTCDate(raw.getUTCDate() + state.currentDeltaDays);
      const rawISO = raw.toISOString().slice(0, 10);
      const snapped = isWorkingDay(calendar, rawISO) ? rawISO : nextWorkingDay(calendar, rawISO);

      if (state.mode === 'move') {
        updateTaskRef.current.mutate(
          { taskId: state.taskId, input: { startDate: snapped } },
          {
            onSuccess: (response) => {
              const updated = response.task;
              if (updated.scheduledStart > snapped) {
                toast().info(
                  'Bar dikembalikan ke batas predecessor',
                  `Tugas baru dapat mulai pada ${updated.scheduledStart}.`,
                );
              } else {
                toast().success('Tanggal mulai diperbarui');
              }
            },
            onError: (mutationError) => {
              toast().error(
                'Gagal memindahkan tugas',
                mutationError instanceof Error ? mutationError.message : undefined,
              );
            },
          },
        );
      } else {
        const durationDays = durationFromDrag(calendar, state.originalStart, snapped);
        updateTaskRef.current.mutate(
          { taskId: state.taskId, input: { durationDays } },
          {
            onSuccess: () => toast().success('Durasi tugas diperbarui'),
            onError: (mutationError) => {
              toast().error(
                'Gagal mengubah durasi',
                mutationError instanceof Error ? mutationError.message : undefined,
              );
            },
          },
        );
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [drag, calendar, snapshot, zoom, runPreview]);

  const displayTasks = previewTasks ?? snapshot?.tasks ?? [];

  const wbs = useMemo(() => buildWbsNumbers(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const visibleTasks = useMemo(() => {
    if (!snapshot) return [];
    const byId = new Map(snapshot.tasks.map((task) => [task.id, task]));
    const isHidden = (task: TaskDTO): boolean => {
      let cursor = task.parentId;
      const guard = new Set<string>();
      while (cursor) {
        if (collapsed.has(cursor)) return true;
        if (guard.has(cursor)) break;
        guard.add(cursor);
        cursor = byId.get(cursor)?.parentId ?? null;
      }
      return false;
    };
    return displayTasks.filter((task) => !isHidden(task));
  }, [displayTasks, collapsed, snapshot]);

  const range = useMemo(() => {
    if (!snapshot) return null;
    return computeTimeRange(displayTasks, snapshot.project.startDate, zoom);
  }, [snapshot, displayTasks, zoom]);

  const criticalIds = useMemo(
    () => new Set(analysisQuery.data?.criticalPath ?? []),
    [analysisQuery.data],
  );

  const toggleCollapse = useCallback((taskId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleSubmitTask = (values: {
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
  }): void => {
    if (dialogTask) {
      updateTask.mutate(
        { taskId: dialogTask.id, input: values },
        {
          onSuccess: () => {
            success('Tugas diperbarui', 'Jadwal sudah dihitung ulang.');
            setDialogOpen(false);
            setDialogTask(null);
          },
          onError: (mutationError) => {
            errorToast('Gagal menyimpan tugas', mutationError instanceof Error ? mutationError.message : undefined);
          },
        },
      );
      return;
    }
    createTask.mutate(values, {
      onSuccess: () => {
        success('Tugas ditambahkan', 'Jadwal sudah dihitung ulang.');
        setDialogOpen(false);
      },
      onError: (mutationError) => {
        errorToast('Gagal menambah tugas', mutationError instanceof Error ? mutationError.message : undefined);
      },
    });
  };

  if (projectQuery.isLoading) {
    return <LoadingBlock label="Memuat proyek..." />;
  }

  if (projectQuery.isError || !snapshot || !calendar) {
    return (
      <ErrorState
        description={
          projectQuery.error instanceof Error
            ? projectQuery.error.message
            : 'Proyek tidak dapat dimuat. Periksa data atau coba lagi.'
        }
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <PageHeading
        title={snapshot.project.name}
        description={`Mulai ${snapshot.project.startDate} · ${snapshot.tasks.length} tugas · ${snapshot.resources.length} anggota tim`}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
              onClick={() => {
                const container = document.getElementById('gantt-scroll');
                if (container) container.scrollLeft = 0;
              }}
            >
              Awal
            </Button>
            <Button
              variant={highlightCritical ? 'primary' : 'secondary'}
              size="sm"
              icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}
              onClick={() => setHighlightCritical((value) => !value)}
              aria-pressed={highlightCritical}
            >
              Sorot jalur kritis
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => {
                setDialogTask(null);
                setDialogOpen(true);
              }}
            >
              Tambah tugas
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2 sm:px-6">
        <div className="flex items-center gap-1 rounded border border-line p-0.5" role="group" aria-label="Skala waktu">
          {ZOOM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setZoom(option.value)}
              aria-pressed={zoom === option.value}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-semibold transition',
                zoom === option.value ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-surface-2',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant="ghost"
          icon={<CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />}
          onClick={() => {
            const container = document.getElementById('gantt-scroll');
            if (!container || !range) return;
            const unit = pxPerDay(zoom);
            const from = new Date(`${range.from}T00:00:00Z`).getTime();
            const now = new Date();
            const today = new Date(
              `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00Z`,
            ).getTime();
            const offset = ((today - from) / 86_400_000) * unit;
            container.scrollLeft = Math.max(0, offset - container.clientWidth / 3);
          }}
        >
          Hari ini
        </Button>

        <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-3">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm border border-line-strong bg-danger-bg" aria-hidden /> Libur
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm border border-line-strong bg-surface-2" aria-hidden /> Akhir pekan
          </span>
          {selectedTaskId ? (
            <button
              type="button"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline"
              onClick={() => {
                const task = snapshot.tasks.find((item) => item.id === selectedTaskId);
                if (task) {
                  setDialogTask(task);
                  setDialogOpen(true);
                }
              }}
            >
              Ubah tugas terpilih
            </button>
          ) : null}
        </span>
      </div>

      {drag ? (
        <p className="border-b border-line bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-700 sm:px-6" role="status">
          {drag.blocked
            ? 'Pratinjau: bar dibatasi oleh pendahulu dan akan kembali ke batas tersebut.'
            : `Pratinjau ${drag.mode === 'move' ? 'perpindahan' : 'durasi'} · ${drag.currentDeltaDays} hari`}
        </p>
      ) : null}

      {snapshot.tasks.length === 0 ? (
        <div className="p-6">
          <Card>
            <EmptyState
              icon={<Crown className="h-6 w-6" aria-hidden />}
              title="Proyek ini belum punya tugas"
              description="Mulai dengan membuat kelompok pekerjaan, lalu tambahkan sub-tugas di dalamnya."
              action={
                <Button
                  variant="primary"
                  icon={<Plus className="h-4 w-4" aria-hidden />}
                  onClick={() => {
                    setDialogTask(null);
                    setDialogOpen(true);
                  }}
                >
                  Tambah tugas pertama
                </Button>
              }
            />
          </Card>
        </div>
      ) : (
        <div id="gantt-scroll" className="min-h-0 flex-1 overflow-auto">
          <div className="flex min-w-max">
            <TaskTable
              tasks={visibleTasks}
              wbs={wbs}
              assignments={snapshot.assignments}
              resources={snapshot.resources}
              selectedTaskId={selectedTaskId}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              onSelectTask={setSelectedTaskId}
              onOpenTask={(taskId) => {
                const task = snapshot.tasks.find((item) => item.id === taskId);
                if (task) {
                  setDialogTask(task);
                  setDialogOpen(true);
                }
              }}
            />
            {range ? (
              <GanttTimeline
                tasks={visibleTasks}
                dependencies={snapshot.dependencies}
                range={range}
                zoom={zoom}
                calendar={calendar}
                criticalIds={criticalIds}
                highlightCritical={highlightCritical}
                selectedTaskId={selectedTaskId}
                draggingTaskId={drag?.taskId ?? null}
                onSelectTask={setSelectedTaskId}
                onOpenTask={(taskId) => {
                  const task = snapshot.tasks.find((item) => item.id === taskId);
                  if (task) {
                    setDialogTask(task);
                    setDialogOpen(true);
                  }
                }}
                onBarPointerDown={handleBarPointerDown}
              />
            ) : null}
          </div>
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setDialogTask(null);
        }}
        snapshot={snapshot}
        task={dialogTask}
        defaultParentId={null}
        saving={createTask.isPending || updateTask.isPending}
        onSubmit={handleSubmitTask}
        onDelete={
          dialogTask
            ? () => {
                setDeleteTarget(dialogTask);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus tugas?"
        message={`Tugas "${deleteTarget?.name ?? ''}" beserta seluruh sub-tugas, dependensi, dan alokasinya akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus tugas"
        loading={deleteTask.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteTask.mutate(deleteTarget.id, {
            onSuccess: () => {
              success('Tugas dihapus', 'Jadwal sudah dihitung ulang.');
              setDeleteTarget(null);
              setDialogOpen(false);
              setDialogTask(null);
            },
            onError: (mutationError) => {
              errorToast('Gagal menghapus tugas', mutationError instanceof Error ? mutationError.message : undefined);
              setDeleteTarget(null);
            },
          });
        }}
      />

    </div>
  );
}
