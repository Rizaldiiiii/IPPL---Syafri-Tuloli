import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildPertGraph, computeCpm, createCalendar } from '@gantt/shared';
import { PertDiagram } from './PertDiagram.js';
import { cpmFixture, PROJECT_START } from '../../tests/fixtures.js';

function buildFixture(): ReturnType<typeof buildPertGraph> {
  const { tasks, dependencies } = cpmFixture();
  const calendar = createCalendar([0, 6], []);
  const cpm = computeCpm({
    projectStartDate: PROJECT_START,
    tasks,
    dependencies,
    calendar,
  });
  return buildPertGraph({
    tasks,
    dependencies,
    cpm: cpm.activities,
    criticalPath: cpm.criticalPath,
  });
}

describe('PertDiagram', () => {
  it('menandai node kritis dan node dengan float', () => {
    render(<PertDiagram pert={buildFixture()} />);

    expect(screen.getByTestId('pert-node-A')).toHaveAttribute('data-critical', 'true');
    expect(screen.getByTestId('pert-node-C')).toHaveAttribute('data-critical', 'true');
    expect(screen.getByTestId('pert-node-D')).toHaveAttribute('data-critical', 'true');
    expect(screen.getByTestId('pert-node-B')).toHaveAttribute('data-critical', 'false');
  });

  it('menandai hanya panah jalur kritis sebagai kritis', () => {
    render(<PertDiagram pert={buildFixture()} />);

    expect(screen.getByTestId('pert-edge-A-C')).toHaveAttribute('data-critical', 'true');
    expect(screen.getByTestId('pert-edge-C-D')).toHaveAttribute('data-critical', 'true');
    expect(screen.getByTestId('pert-edge-A-B')).toHaveAttribute('data-critical', 'false');
    expect(screen.getByTestId('pert-edge-B-D')).toHaveAttribute('data-critical', 'false');
  });

  it('menampilkan durasi, ES/EF, LS/LF, dan slack tiap node', () => {
    render(<PertDiagram pert={buildFixture()} />);

    const label = screen.getByRole('img', { name: /Diagram jaringan PERT/ });
    expect(label).toBeInTheDocument();
    expect(screen.getAllByText('Durasi')).toHaveLength(4);
    expect(screen.getAllByText('Slack')).toHaveLength(4);
    // Tugas B punya float 3 hari.
    const nodeB = screen.getByTestId('pert-node-B');
    expect(nodeB.textContent).toContain('B');
    expect(nodeB.textContent).toContain('3');
  });
});
