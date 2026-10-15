import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildPertGraph, computeCpm, computeCosts, createCalendar } from '@gantt/shared';
import { ToastProvider } from '../hooks/useToast.js';
import { GanttPage } from './GanttPage.js';
import { PROJECT_START, snapshotFixture } from '../tests/fixtures.js';

const snapshot = snapshotFixture();

const calendar = createCalendar(snapshot.project.weekendDays, snapshot.holidays.map((item) => item.date));
const cpm = computeCpm({
  projectStartDate: PROJECT_START,
  tasks: snapshot.tasks,
  dependencies: snapshot.dependencies,
  calendar,
});
const analysis = {
  summary: {
    projectStart: PROJECT_START,
    projectFinish: cpm.projectFinish,
    totalWorkingDays: cpm.projectEnd + 1,
    totalCost: computeCosts({
      calendar,
      tasks: snapshot.tasks,
      assignments: snapshot.assignments,
      resources: snapshot.resources,
    }).totalCost,
    criticalTaskCount: cpm.activities.filter((activity) => activity.critical).length,
  },
  cpm: cpm.activities,
  criticalPath: cpm.criticalPath,
  pert: buildPertGraph({
    tasks: snapshot.tasks,
    dependencies: snapshot.dependencies,
    cpm: cpm.activities,
    criticalPath: cpm.criticalPath,
  }),
  costs: computeCosts({
    calendar,
    tasks: snapshot.tasks,
    assignments: snapshot.assignments,
    resources: snapshot.resources,
  }),
};

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <GanttPage projectId="proyek-1" />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('GanttPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        const body = url.endsWith('/analysis') ? analysis : snapshot;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('menampilkan tabel tugas dan bar Gantt dari data server', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('gantt-bar-A')).toBeInTheDocument());

    // Tabel WBS di kiri.
    expect(screen.getByRole('heading', { level: 1, name: snapshot.project.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tugas A,/ })).toBeInTheDocument();

    // Panah dependensi FS dari A ke B.
    expect(screen.getByTestId('gantt-dep-d1')).toHaveAttribute('data-type', 'FS');
  });

  it('menyorot jalur kritis setelah tombol ditekan', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('gantt-bar-A')).toBeInTheDocument());

    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: /Sorot jalur kritis/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gantt-dep-d2')).toHaveAttribute('marker-end', 'url(#gantt-arrow-critical)');
  });

  it('membuka dialog tugas dari tombol tambah tugas', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('gantt-bar-A')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tambah tugas' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Nama tugas/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Mulai paling awal/)).toBeInTheDocument();
  });

  it('mengubah skala waktu menjadi minggu', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('gantt-bar-A')).toBeInTheDocument());

    const user = userEvent.setup();
    const weekButton = screen.getByRole('button', { name: 'Minggu' });
    expect(weekButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(weekButton);
    expect(weekButton).toHaveAttribute('aria-pressed', 'true');
  });
});
