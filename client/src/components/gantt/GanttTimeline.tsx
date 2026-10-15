import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  formatISODateShort,
  isWorkingDay,
  todayISODate,
  type DependencyDTO,
  type ProjectCalendar,
  type TaskDTO,
} from '@gantt/shared';
import {
  HEADER_HEIGHT,
  ROW_HEIGHT,
  buildMonthGroups,
  buildTicks,
  barGeometry,
  pxPerDay,
  readableTextColor,
  weekdayNarrow,
  withAlpha,
  xForDate,
  type TimeRange,
  type ZoomLevel,
} from '../../lib/gantt.js';

export interface GanttTimelineProps {
  tasks: TaskDTO[];
  dependencies: DependencyDTO[];
  range: TimeRange;
  zoom: ZoomLevel;
  calendar: ProjectCalendar;
  criticalIds: Set<string>;
  highlightCritical: boolean;
  selectedTaskId: string | null;
  draggingTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onBarPointerDown: (event: ReactPointerEvent<SVGElement>, task: TaskDTO, mode: 'move' | 'resize') => void;
}

function dependencyPath(
  predecessor: { x: number; width: number; y: number; height: number },
  successor: { x: number; width: number; y: number; height: number },
  type: DependencyDTO['type'],
): string {
  const startY = predecessor.y + predecessor.height / 2;
  const endY = successor.y + successor.height / 2;
  if (type === 'FS') {
    const startX = predecessor.x + predecessor.width;
    const endX = successor.x;
    const midX = Math.max(startX + 10, endX - 10);
    return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
  }
  const startX = predecessor.x;
  const endX = successor.x;
  const midX = Math.min(startX - 10, endX - 10);
  return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
}

export function GanttTimeline({
  tasks,
  dependencies,
  range,
  zoom,
  calendar,
  criticalIds,
  highlightCritical,
  selectedTaskId,
  draggingTaskId,
  onSelectTask,
  onOpenTask,
  onBarPointerDown,
}: GanttTimelineProps): JSX.Element {
  const unit = pxPerDay(zoom);
  const rowIndexById = new Map(tasks.map((task, index) => [task.id, index]));
  const monthGroups = buildMonthGroups(range, zoom);
  const ticks = buildTicks(range, zoom);
  const bodyHeight = Math.max(tasks.length * ROW_HEIGHT, ROW_HEIGHT);
  const today = todayISODate();
  const todayX = xForDate(today, range.from, unit);
  const todayInRange = today >= range.from && today <= range.to;

  const geometry = new Map(
    tasks.map((task, index) => [task.id, barGeometry(task, range, zoom, index)]),
  );

  const visibleDependencies = dependencies.filter(
    (dependency) => rowIndexById.has(dependency.predecessorId) && rowIndexById.has(dependency.successorId),
  );

  return (
    <div className="flex flex-col" style={{ width: range.width }}>
      <div className="sticky top-0 z-10 border-b border-line bg-surface" style={{ width: range.width }}>
        <svg width={range.width} height={HEADER_HEIGHT} role="presentation" aria-hidden>
          {monthGroups.map((group) => (
            <g key={group.key}>
              <rect x={group.x} y={0} width={group.width} height={28} fill="#F8FAFC" />
              <line
                x1={group.x}
                y1={0}
                x2={group.x}
                y2={HEADER_HEIGHT}
                stroke="#E2E8F0"
                strokeWidth={1}
              />
              <text x={group.x + 8} y={19} className="fill-ink-2" fontSize={11} fontWeight={700}>
                {group.label}
              </text>
            </g>
          ))}
          {ticks.map((tick) => {
            const date = tick.date;
            const working = isWorkingDay(calendar, date);
            return (
              <g key={tick.key}>
                <rect
                  x={tick.x}
                  y={28}
                  width={tick.width}
                  height={HEADER_HEIGHT - 28}
                  fill={working ? '#FFFFFF' : '#F1F5F9'}
                />
                <line
                  x1={tick.x}
                  y1={28}
                  x2={tick.x}
                  y2={HEADER_HEIGHT}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
                {zoom === 'day' ? (
                  <text
                    x={tick.x + tick.width / 2}
                    y={44}
                    textAnchor="middle"
                    fontSize={10}
                    className={working ? 'fill-ink-3' : 'fill-ink-3/70'}
                  >
                    {weekdayNarrow(date)}
                  </text>
                ) : null}
                {tick.label ? (
                  <text
                    x={tick.x + (zoom === 'day' ? tick.width / 2 : 4)}
                    y={zoom === 'day' ? 54 : 46}
                    textAnchor={zoom === 'day' ? 'middle' : 'start'}
                    fontSize={11}
                    fontWeight={600}
                    className={working ? 'fill-ink-2' : 'fill-ink-3'}
                  >
                    {tick.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <svg
        width={range.width}
        height={bodyHeight}
        role="img"
        aria-label={`Timeline Gantt berisi ${tasks.length} baris tugas`}
      >
        <defs>
          <marker
            id="gantt-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B" />
          </marker>
          <marker
            id="gantt-arrow-critical"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#B91C1C" />
          </marker>
        </defs>

        {tasks.map((task, index) => (
          <rect
            key={`row-${task.id}`}
            x={0}
            y={index * ROW_HEIGHT}
            width={range.width}
            height={ROW_HEIGHT}
            fill={index % 2 === 0 ? '#FFFFFF' : '#FCFDFE'}
          />
        ))}

        {range.days.map((day, index) => {
          if (isWorkingDay(calendar, day)) return null;
          const isHoliday = calendar.holidays.has(day);
          return (
            <rect
              key={`shade-${day}`}
              x={index * unit}
              y={0}
              width={unit}
              height={bodyHeight}
              fill={isHoliday ? '#FEF3C7' : '#F1F5F9'}
              opacity={isHoliday ? 0.75 : 1}
            />
          );
        })}

        {range.days.map((day, index) => {
          if (zoom !== 'day') return null;
          return (
            <line
              key={`grid-${day}`}
              x1={index * unit}
              y1={0}
              x2={index * unit}
              y2={bodyHeight}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
          );
        })}

        {tasks.map((task, index) => (
          <line
            key={`sep-${task.id}`}
            x1={0}
            y1={index * ROW_HEIGHT}
            x2={range.width}
            y2={index * ROW_HEIGHT}
            stroke="#F1F5F9"
            strokeWidth={1}
          />
        ))}

        {todayInRange ? (
          <g>
            <line
              x1={todayX + unit / 2}
              y1={0}
              x2={todayX + unit / 2}
              y2={bodyHeight}
              stroke="#B91C1C"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <text x={todayX + unit / 2 + 4} y={11} fontSize={10} fontWeight={700} fill="#B91C1C">
              Hari ini
            </text>
          </g>
        ) : null}

        <g>
          {visibleDependencies.map((dependency) => {
            const predecessor = geometry.get(dependency.predecessorId);
            const successor = geometry.get(dependency.successorId);
            if (!predecessor || !successor) return null;
            const isCritical =
              highlightCritical &&
              criticalIds.has(dependency.predecessorId) &&
              criticalIds.has(dependency.successorId);
            return (
              <path
                key={dependency.id}
                data-testid={`gantt-dep-${dependency.id}`}
                data-type={dependency.type}
                d={dependencyPath(predecessor, successor, dependency.type)}
                fill="none"
                stroke={isCritical ? '#B91C1C' : '#94A3B8'}
                strokeWidth={isCritical ? 2 : 1.25}
                markerEnd={`url(#${isCritical ? 'gantt-arrow-critical' : 'gantt-arrow'})`}
                pointerEvents="none"
              />
            );
          })}
        </g>

        <g>
          {tasks.map((task, index) => {
            const bar = barGeometry(task, range, zoom, index);
            const isCritical = highlightCritical && criticalIds.has(task.id);
            const isSelected = selectedTaskId === task.id;
            const isDragging = draggingTaskId === task.id;
            const labelColor = readableTextColor(task.color);
            const showLabel = bar.width > 54;
            const progressWidth = task.isSummary ? 0 : (bar.width * Math.min(100, task.progress)) / 100;

            return (
              <g key={task.id}>
                {task.isSummary ? (
                  <g data-testid={`gantt-bar-${task.id}`} data-summary="true">
                    <rect
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      rx={2}
                      fill={task.color}
                      onClick={() => onSelectTask(task.id)}
                      onDoubleClick={() => onOpenTask(task.id)}
                      className="cursor-pointer"
                    />
                    <path
                      d={`M ${bar.x} ${bar.y + bar.height + 4} l 8 6 l ${Math.max(
                        0,
                        bar.width - 16,
                      )} 0 l 8 -6 z`}
                      fill={task.color}
                      opacity={0.85}
                      pointerEvents="none"
                    />
                  </g>
                ) : (
                  <g
                    data-testid={`gantt-bar-${task.id}`}
                    data-task-name={task.name}
                    onPointerDown={(event) => onBarPointerDown(event, task, 'move')}
                    onClick={() => onSelectTask(task.id)}
                    onDoubleClick={() => onOpenTask(task.id)}
                    className="cursor-grab active:cursor-grabbing"
                    role="button"
                    tabIndex={0}
                    aria-label={`Tugas ${task.name}, ${formatISODateShort(task.scheduledStart)} sampai ${formatISODateShort(
                      task.scheduledEnd,
                    )}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onOpenTask(task.id);
                    }}
                  >
                    <rect
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      rx={4}
                      fill={withAlpha(task.color, 0.2)}
                    />
                    <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={4} fill="none" stroke={task.color} strokeWidth={1.5} />
                    <rect
                      x={bar.x}
                      y={bar.y}
                      width={progressWidth}
                      height={bar.height}
                      rx={4}
                      fill={task.color}
                    />
                    <rect
                      x={bar.x + bar.width - 6}
                      y={bar.y}
                      width={6}
                      height={bar.height}
                      fill="transparent"
                      className="cursor-ew-resize"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        onBarPointerDown(event, task, 'resize');
                      }}
                    />
                  </g>
                )}

                {(isSelected || isCritical || isDragging) && !task.isSummary ? (
                  <rect
                    x={bar.x - 2}
                    y={bar.y - 2}
                    width={bar.width + 4}
                    height={bar.height + 4}
                    rx={5}
                    fill="none"
                    stroke={isCritical ? '#B91C1C' : isSelected ? '#1D4ED8' : '#0F172A'}
                    strokeWidth={2}
                    strokeDasharray={isDragging ? '4 3' : undefined}
                    pointerEvents="none"
                  />
                ) : null}

                {showLabel && !task.isSummary ? (
                  <text
                    x={bar.x + 8}
                    y={bar.y + bar.height / 2 + 4}
                    fontSize={11}
                    fontWeight={600}
                    fill={progressWidth > 30 ? labelColor : '#0F172A'}
                    pointerEvents="none"
                  >
                    {task.name.length > 26 ? `${task.name.slice(0, 24)}…` : task.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
