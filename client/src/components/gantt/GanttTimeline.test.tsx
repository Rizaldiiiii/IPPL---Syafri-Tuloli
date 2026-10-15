import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createCalendar, type TaskDTO } from '@gantt/shared';
import { GanttTimeline } from './GanttTimeline.js';
import { computeTimeRange } from '../../lib/gantt.js';
import { cpmFixture, PROJECT_START } from '../../tests/fixtures.js';

function renderTimeline(highlightCritical: boolean): void {
  const { tasks, dependencies } = cpmFixture();
  const range = computeTimeRange(tasks, PROJECT_START, 'day');

  render(
    <GanttTimeline
      tasks={tasks}
      dependencies={dependencies}
      range={range}
      zoom="day"
      calendar={createCalendar([0, 6], [])}
      criticalIds={new Set(['A', 'C', 'D'])}
      highlightCritical={highlightCritical}
      selectedTaskId={null}
      draggingTaskId={null}
      onSelectTask={vi.fn()}
      onOpenTask={vi.fn()}
      onBarPointerDown={vi.fn()}
    />,
  );
}

describe('GanttTimeline', () => {
  it('menggambar bar untuk setiap tugas dari data', () => {
    renderTimeline(false);
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(screen.getByTestId(`gantt-bar-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByRole('img', { name: /Timeline Gantt berisi 4 baris tugas/ })).toBeInTheDocument();
  });

  it('menggambar panah dependensi FS dan SS dengan geometri siku-siku', () => {
    const tasks: TaskDTO[] = cpmFixture().tasks;
    const dependencies = [
      { id: 'fs1', predecessorId: 'A', successorId: 'B', type: 'FS' as const, lagDays: 0 },
      { id: 'ss1', predecessorId: 'A', successorId: 'C', type: 'SS' as const, lagDays: 2 },
    ];
    const range = computeTimeRange(tasks, PROJECT_START, 'day');

    render(
      <GanttTimeline
        tasks={tasks}
        dependencies={dependencies}
        range={range}
        zoom="day"
        calendar={createCalendar([0, 6], [])}
        criticalIds={new Set()}
        highlightCritical={false}
        selectedTaskId={null}
        draggingTaskId={null}
        onSelectTask={vi.fn()}
        onOpenTask={vi.fn()}
        onBarPointerDown={vi.fn()}
      />,
    );

    const fsArrow = screen.getByTestId('gantt-dep-fs1');
    const ssArrow = screen.getByTestId('gantt-dep-ss1');

    expect(fsArrow).toHaveAttribute('data-type', 'FS');
    expect(ssArrow).toHaveAttribute('data-type', 'SS');
    expect(fsArrow.getAttribute('d')).toMatch(/^M [\d.-]+ [\d.-]+ H [\d.-]+ V [\d.-]+ H [\d.-]+$/);
    expect(ssArrow.getAttribute('d')).toMatch(/^M [\d.-]+ [\d.-]+ H [\d.-]+ V [\d.-]+ H [\d.-]+$/);
  });

  it('menandai panah pada jalur kritis ketika sorotan aktif', () => {
    renderTimeline(true);
    expect(screen.getByTestId('gantt-dep-d2')).toHaveAttribute('marker-end', 'url(#gantt-arrow-critical)');
    expect(screen.getByTestId('gantt-dep-d1')).toHaveAttribute('marker-end', 'url(#gantt-arrow)');
  });

  it('memberi label aksesibel pada tiap bar tugas', () => {
    renderTimeline(false);
    expect(screen.getByRole('button', { name: /Tugas A/ })).toBeInTheDocument();
  });
});
