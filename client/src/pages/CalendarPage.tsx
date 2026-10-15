import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import {
  WEEKDAY_LABELS,
  dayOfWeek,
  enumerateDays,
  isoDateSchema,
  todayISODate,
  type HolidayCreateInput,
  type ISODate,
} from '@gantt/shared';
import { z } from 'zod';
import { useCreateHoliday, useDeleteHoliday, useProject, useUpdateCalendar } from '../api/queries.js';
import { PageHeading } from '../components/layout/AppShell.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { CheckboxRow, Input } from '../components/ui/Field.js';
import { ErrorState, LoadingBlock } from '../components/ui/Feedback.js';
import { ConfirmDialog } from '../components/ui/Modal.js';
import { useToast } from '../hooks/useToast.js';
import { cn } from '../lib/cn.js';
import { formatISODateLong } from '../lib/format.js';

const holidayFormSchema = z.object({
  date: isoDateSchema,
  name: z.string().trim().min(1, { message: 'Nama hari libur wajib diisi' }).max(120),
});

type HolidayFormValues = z.infer<typeof holidayFormSchema>;

const WEEK_START_ORDER = [1, 2, 3, 4, 5, 6, 0];

function monthKeyOf(value: ISODate): string {
  return value.slice(0, 7);
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function monthGrid(monthKey: string): ISODate[] {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const startOffset = (first.getUTCDay() + 6) % 7; // Senin sebagai awal minggu
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - startOffset);
  const endOffset = (7 - ((last.getUTCDay() + 6) % 7) - 1) % 7;
  const end = new Date(last);
  end.setUTCDate(end.getUTCDate() + endOffset);
  return enumerateDays(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
}

export function CalendarPage({ projectId }: { projectId: string }): JSX.Element {
  const { success, error: errorToast } = useToast();
  const projectQuery = useProject(projectId);
  const updateCalendar = useUpdateCalendar(projectId);
  const createHoliday = useCreateHoliday(projectId);
  const deleteHoliday = useDeleteHoliday(projectId);

  const [weekendDays, setWeekendDays] = useState<number[]>([]);
  const [monthKey, setMonthKey] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; date: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: todayISODate(), name: '' },
  });

  useEffect(() => {
    if (!projectQuery.data) return;
    if (weekendDays.length === 0) setWeekendDays(projectQuery.data.project.weekendDays);
    if (!monthKey) setMonthKey(monthKeyOf(projectQuery.data.project.startDate));
  }, [projectQuery.data, weekendDays.length, monthKey]);

  const holidays = useMemo(() => projectQuery.data?.holidays ?? [], [projectQuery.data?.holidays]);
  const holidayDates = useMemo(() => new Set(holidays.map((holiday) => holiday.date)), [holidays]);

  if (projectQuery.isLoading) return <LoadingBlock label="Memuat kalender proyek..." />;
  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ErrorState
        description={projectQuery.error instanceof Error ? projectQuery.error.message : 'Kalender tidak dapat dimuat.'}
        onRetry={() => void projectQuery.refetch()}
      />
    );
  }

  const snapshot = projectQuery.data;
  const savedWeekendDays = snapshot.project.weekendDays;
  const changed =
    weekendDays.length !== savedWeekendDays.length ||
    [...weekendDays].sort().join(',') !== [...savedWeekendDays].sort().join(',');

  const toggleDay = (day: number): void => {
    setWeekendDays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) return current;
        return current.filter((value) => value !== day);
      }
      const next = [...current, day].sort((a, b) => a - b);
      if (next.length === 7) return current;
      return next;
    });
  };

  const grid = monthKey ? monthGrid(monthKey) : [];
  const today = todayISODate();

  const submitHoliday = handleSubmit((values) => {
    createHoliday.mutate(values as HolidayCreateInput, {
      onSuccess: () => {
        success('Hari libur ditambahkan', 'Jadwal diperbarui');
        reset({ date: values.date, name: '' });
      },
      onError: (mutationError) =>
        errorToast('Gagal menambah hari libur', mutationError instanceof Error ? mutationError.message : undefined),
    });
  });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeading
        title="Kalender proyek"
        description="Tentukan akhir pekan dan hari libur. Durasi tugas hanya menghitung hari kerja, sehingga jadwal bergeser otomatis."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader
            title="Hari kerja dan akhir pekan"
            description="Hari yang ditandai akan dilewati saat menghitung durasi dan dependensi."
          />
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {WEEKDAY_LABELS.map((label, index) => (
                <CheckboxRow
                  key={label}
                  label={label}
                  description={weekendDays.includes(index) ? 'Akhir pekan' : 'Hari kerja'}
                  checked={weekendDays.includes(index)}
                  onChange={() => toggleDay(index)}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="primary"
                icon={<Save className="h-4 w-4" aria-hidden />}
                disabled={!changed}
                loading={updateCalendar.isPending}
                onClick={() => {
                  updateCalendar.mutate(
                    { weekendDays: [...weekendDays].sort((a, b) => a - b) },
                    {
                      onSuccess: () => success('Jadwal diperbarui'),
                      onError: (mutationError) =>
                        errorToast(
                          'Gagal menyimpan kalender',
                          mutationError instanceof Error ? mutationError.message : undefined,
                        ),
                    },
                  );
                }}
              >
                Simpan akhir pekan
              </Button>
              {changed ? (
                <Button variant="ghost" onClick={() => setWeekendDays(savedWeekendDays)}>
                  Batalkan perubahan
                </Button>
              ) : (
                <span className="text-xs text-ink-3">Tidak ada perubahan yang belum disimpan.</span>
              )}
            </div>

            {weekendDays.length === 6 ? (
              <p className="text-xs text-warning">
                Hampir seluruh hari ditandai sebagai akhir pekan. Minimal satu hari kerja harus tersedia.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Kalender bulanan"
            description="Hari non-kerja ditandai abu-abu, hari libur ditandai kuning."
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            actions={
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="Bulan sebelumnya"
                  icon={<ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
                  onClick={() => setMonthKey((current) => shiftMonth(current, -1))}
                />
                <span className="w-40 text-center text-xs font-semibold text-ink-2">
                  {monthKey ? monthLabel(monthKey) : ''}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label="Bulan berikutnya"
                  icon={<ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                  onClick={() => setMonthKey((current) => shiftMonth(current, 1))}
                />
              </div>
            }
          />
          <div className="px-5 py-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-ink-3">
              {WEEK_START_ORDER.map((day) => (
                <span key={day}>{WEEKDAY_LABELS[day].slice(0, 3)}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {grid.map((date) => {
                const inMonth = monthKeyOf(date) === monthKey;
                const isHoliday = holidayDates.has(date);
                const isWeekend = weekendDays.includes(dayOfWeek(date));
                const isToday = date === today;
                const holiday = holidays.find((item) => item.date === date);
                return (
                  <div
                    key={date}
                    title={holiday ? `${formatISODateLong(date)} — ${holiday.name}` : formatISODateLong(date)}
                    className={cn(
                      'flex min-h-[42px] flex-col items-start justify-start rounded-md border px-1.5 py-1 text-[11px]',
                      inMonth ? 'border-line bg-surface' : 'border-transparent bg-surface-2/40 text-ink-3',
                      isHoliday && inMonth ? 'border-warning/40 bg-warning-bg' : '',
                      !isHoliday && isWeekend && inMonth ? 'bg-surface-2 text-ink-3' : '',
                      isToday ? 'ring-2 ring-brand-600' : '',
                    )}
                  >
                    <span className={cn('tabular font-semibold', inMonth ? 'text-ink-2' : 'text-ink-3')}>
                      {Number(date.slice(8, 10))}
                    </span>
                    {isHoliday && inMonth ? (
                      <span className="line-clamp-2 text-[10px] leading-tight text-warning">{holiday?.name}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Hari libur khusus"
          description="Hari libur dikurangi dari durasi tugas yang melewatinya."
        />
        <div className="flex flex-col gap-4 px-5 py-4">
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto] sm:items-start"
            onSubmit={(event) => {
              event.preventDefault();
              void submitHoliday();
            }}
          >
            <Input label="Tanggal" type="date" required error={errors.date?.message} {...register('date')} />
            <Input
              label="Nama hari libur"
              required
              placeholder="Contoh: Hari Raya Natal"
              error={errors.name?.message}
              {...register('name')}
            />
            <div className="flex items-end">
              <Button
                variant="secondary"
                type="submit"
                icon={<Plus className="h-4 w-4" aria-hidden />}
                loading={createHoliday.isPending}
              >
                Tambah hari libur
              </Button>
            </div>
          </form>

          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {holidays.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-ink-3">Belum ada hari libur khusus.</li>
            ) : null}
            {holidays.map((holiday) => (
              <li key={holiday.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="tabular w-32 shrink-0 text-xs font-semibold text-ink-3">
                    {formatISODateLong(holiday.date)}
                  </span>
                  <span className="truncate text-sm font-medium text-ink">{holiday.name}</span>
                </div>
                <button
                  type="button"
                  className="rounded p-1.5 text-ink-3 transition hover:bg-danger-bg hover:text-danger"
                  aria-label={`Hapus hari libur ${holiday.name}`}
                  onClick={() => setDeleteTarget({ id: holiday.id, name: holiday.name, date: holiday.date })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus hari libur?"
        message={`Hari libur "${deleteTarget?.name ?? ''}" pada ${deleteTarget ? formatISODateLong(deleteTarget.date) : ''} akan dihapus dan jadwal dihitung ulang.`}
        confirmLabel="Hapus hari libur"
        loading={deleteHoliday.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteHoliday.mutate(deleteTarget.id, {
            onSuccess: () => {
              success('Hari libur dihapus', 'Jadwal diperbarui');
              setDeleteTarget(null);
            },
            onError: (mutationError) => {
              errorToast('Gagal menghapus hari libur', mutationError instanceof Error ? mutationError.message : undefined);
              setDeleteTarget(null);
            },
          });
        }}
      />

      <p className="text-xs text-ink-3">
        Rentang proyek: mulai {formatISODateLong(snapshot.project.startDate)}
        {snapshot.tasks.length > 0
          ? ` · tugas terakhir selesai ${formatISODateLong(
              snapshot.tasks.reduce(
                (acc, task) => (task.scheduledEnd > acc ? task.scheduledEnd : acc),
                snapshot.tasks[0].scheduledEnd,
              ),
            )}`
          : ''}
        {
          ' · akhir pekan saat ini: '
        }
        {snapshot.project.weekendDays.map((day) => WEEKDAY_LABELS[day]).join(', ')}
      </p>
    </div>
  );
}
