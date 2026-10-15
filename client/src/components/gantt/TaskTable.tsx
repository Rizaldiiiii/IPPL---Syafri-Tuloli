import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import type { AssignmentDTO, ResourceDTO, TaskDTO } from '@gantt/shared';
import { cn } from '../../lib/cn.js';
import { formatDate, priorityClass, priorityLabel } from '../../lib/format.js';

export interface TaskTableProps {
  tasks: TaskDTO[];
  wbs: Map<string, string>;
  assignments: AssignmentDTO[];
  resources: ResourceDTO[];
  selectedTaskId: string | null;
  collapsed: Set<string>;
  onToggleCollapse: (taskId: string) => void;
  onSelectTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
}

const GRID =
  'grid grid-cols-[44px_minmax(140px,1fr)_72px] lg:grid-cols-[44px_minmax(150px,1fr)_56px_84px_84px_72px_92px_64px] items-center gap-2';

export function TaskTable({
  tasks,
  wbs,
  assignments,
  resources,
  selectedTaskId,
  collapsed,
  onToggleCollapse,
  onSelectTask,
  onOpenTask,
}: TaskTableProps): JSX.Element {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));

  return (
    <div className="w-[420px] shrink-0 border-r border-line bg-surface lg:w-[680px]">
      <div className="sticky top-0 z-30 h-14 border-b border-line bg-surface">
        <div className={cn(GRID, 'h-full px-3 text-[11px] font-bold uppercase tracking-wide text-ink-3')}>
          <span>WBS</span>
          <span>Nama tugas</span>
          <span className="hidden justify-end lg:flex">Durasi</span>
          <span className="hidden lg:block">Mulai</span>
          <span className="hidden lg:block">Selesai</span>
          <span className="hidden lg:block">Prioritas</span>
          <span className="hidden lg:block">Penanggung jawab</span>
          <span className="justify-end lg:flex">Progres</span>
        </div>
      </div>

      <div>
        {tasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const isCollapsed = collapsed.has(task.id);
          const taskAssignments = assignments.filter((assignment) => assignment.taskId === task.id);
          const people = taskAssignments
            .map((assignment) => resourceById.get(assignment.resourceId)?.name)
            .filter((name): name is string => Boolean(name));

          return (
            <div
              key={task.id}
              className={cn(
                'h-10 border-b border-line/70 transition-colors',
                isSelected ? 'bg-brand-50' : 'hover:bg-surface-2/70',
              )}
              style={{ height: 40 }}
            >
              <div className={cn(GRID, 'h-full px-3')}>
                <span className="tabular text-[11px] font-semibold text-ink-3">{wbs.get(task.id) ?? '–'}</span>

                <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: task.level * 14 }}>
                  {task.isSummary ? (
                    <button
                      type="button"
                      onClick={() => onToggleCollapse(task.id)}
                      className="rounded p-0.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Buka' : 'Tutup'} sub-tugas ${task.name}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" aria-hidden />
                  )}
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: task.color }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    onDoubleClick={() => onOpenTask(task.id)}
                    className={cn(
                      'min-w-0 truncate text-left text-[13px]',
                      task.isSummary ? 'font-semibold text-ink' : 'font-medium text-ink-2',
                    )}
                    title={task.name}
                  >
                    {task.name}
                  </button>
                </div>

                <span className="tabular hidden justify-end text-xs text-ink-2 lg:flex">
                  {task.durationDays} hr
                </span>
                <span className="tabular hidden text-xs text-ink-2 lg:block">{formatDate(task.scheduledStart)}</span>
                <span className="tabular hidden text-xs text-ink-2 lg:block">{formatDate(task.scheduledEnd)}</span>

                <span className="hidden lg:block">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      priorityClass(task.priority),
                    )}
                  >
                    {priorityLabel(task.priority)}
                  </span>
                </span>

                <span className="hidden min-w-0 truncate text-xs text-ink-3 lg:block" title={people.join(', ')}>
                  {task.isSummary
                    ? `${task.children.length} sub-tugas`
                    : people.length > 0
                      ? people.join(', ')
                      : '–'}
                </span>

                <span className="flex items-center justify-end gap-1.5">
                  <span className="tabular text-[11px] font-semibold text-ink-2">{task.progress}%</span>
                  <span
                    className="hidden h-1.5 w-8 overflow-hidden rounded-full bg-surface-2 lg:block"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${task.progress}%`, backgroundColor: task.color }}
                    />
                  </span>
                </span>
              </div>
            </div>
          );
        })}

        {tasks.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-ink-3">
            <GripVertical className="h-4 w-4" aria-hidden />
            Belum ada tugas pada proyek ini.
          </div>
        ) : null}
      </div>
    </div>
  );
}
