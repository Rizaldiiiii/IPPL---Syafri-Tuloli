import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../hooks/useToast.js';
import { snapshotFixture } from '../../tests/fixtures.js';
import { TaskDialog } from './TaskDialog.js';

function renderDialog(onSubmit = vi.fn()): { onSubmit: ReturnType<typeof vi.fn> } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TaskDialog
          open
          onClose={vi.fn()}
          snapshot={snapshotFixture()}
          task={null}
          defaultParentId={null}
          saving={false}
          onSubmit={onSubmit}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onSubmit };
}

describe('TaskDialog', () => {
  it('menampilkan pesan validasi ketika nama tugas kosong', async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Tambah tugas' }));

    expect(await screen.findByText('Nama tugas wajib diisi')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('menampilkan pesan validasi ketika durasi kosong', async () => {
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nama tugas/), 'Riset dan wireframe');
    await user.clear(screen.getByLabelText(/Durasi \(hari kerja\)/));
    await user.click(screen.getByRole('button', { name: 'Tambah tugas' }));

    expect(await screen.findByText('Durasi wajib diisi')).toBeInTheDocument();
  });

  it('mengirim nilai yang sudah divalidasi ke pemanggil', async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nama tugas/), 'Riset dan wireframe');
    await user.clear(screen.getByLabelText(/Durasi \(hari kerja\)/));
    await user.type(screen.getByLabelText(/Durasi \(hari kerja\)/), '5');
    await user.selectOptions(screen.getByLabelText('Prioritas'), 'HIGH');
    await user.click(screen.getByRole('button', { name: 'Tambah tugas' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Riset dan wireframe',
        durationDays: 5,
        priority: 'HIGH',
        parentId: null,
      }),
    );
  });

  it('menampilkan catatan bahwa dependensi dibuat setelah tugas disimpan', () => {
    renderDialog();
    expect(screen.getByText(/Dependensi dan alokasi anggota tim dapat ditambahkan setelah tugas disimpan/)).toBeInTheDocument();
  });
});
