import {
  addDays,
  compareISODate,
  daysBetween,
  enumerateDays,
  dayOfWeek,
  type ISODate,
  type TaskDTO,
} from '@gantt/shared';

export type ZoomLevel = 'day' | 'week' | 'month';

export const ZOOM_OPTIONS: { value: ZoomLevel; label: string; pxPerDay: number }[] = [
  { value: 'day', label: 'Hari', pxPerDay: 38 },
  { value: 'week', label: 'Minggu', pxPerDay: 16 },
  { value: 'month', label: 'Bulan', pxPerDay: 6 },
];

export const ROW_HEIGHT = 40;
export const HEADER_HEIGHT = 56;
export const BAR_HEIGHT = 20;
export const BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT) / 2;
export const SUMMARY_BAR_HEIGHT = 12;
export const TIMELINE_PADDING_DAYS = 3;
export const TABLE_WIDTH = 560;

export function pxPerDay(zoom: ZoomLevel): number {
  return ZOOM_OPTIONS.find((option) => option.value === zoom)?.pxPerDay ?? 16;
}

export function xForDate(date: ISODate, from: ISODate, pxPerDayValue: number): number {
  return daysBetween(from, date) * pxPerDayValue;
}

export function dateFromX(x: number, from: ISODate, pxPerDayValue: number): ISODate {
  return addDays(from, Math.round(x / pxPerDayValue));
}

export interface TimeRange {
  from: ISODate;
  to: ISODate;
  days: ISODate[];
  width: number;
}

export function computeTimeRange(tasks: TaskDTO[], projectStart: ISODate, zoom: ZoomLevel): TimeRange {
  const starts = tasks.map((task) => task.scheduledStart);
  const ends = tasks.map((task) => task.scheduledEnd);
  starts.push(projectStart);
  ends.push(projectStart);

  const min = starts.reduce((acc, value) => (compareISODate(value, acc) < 0 ? value : acc), starts[0]);
  const max = ends.reduce((acc, value) => (compareISODate(value, acc) > 0 ? value : acc), ends[0]);

  const from = addDays(min, -TIMELINE_PADDING_DAYS);
  const to = addDays(max, TIMELINE_PADDING_DAYS);
  const days = enumerateDays(from, to);
  return { from, to, days, width: days.length * pxPerDay(zoom) };
}

export interface MonthGroup {
  key: string;
  label: string;
  x: number;
  width: number;
}

export interface Tick {
  key: string;
  date: ISODate;
  label: string;
  x: number;
  width: number;
}

const MONTH_LABEL = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_LABEL = new Intl.DateTimeFormat('id-ID', { day: 'numeric', timeZone: 'UTC' });
const WEEKDAY_LABEL = new Intl.DateTimeFormat('id-ID', { weekday: 'narrow', timeZone: 'UTC' });

function parseUTC(date: ISODate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function buildMonthGroups(range: TimeRange, zoom: ZoomLevel): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let current: MonthGroup | null = null;
  for (const day of range.days) {
    const key = day.slice(0, 7);
    if (!current || current.key !== key) {
      current = {
        key,
        label: MONTH_LABEL.format(parseUTC(day)),
        x: xForDate(day, range.from, pxPerDay(zoom)),
        width: 0,
      };
      groups.push(current);
    }
    current.width += pxPerDay(zoom);
  }
  return groups;
}

/** Baris bawah header: hari (zoom Hari), minggu (zoom Minggu), atau penanda mingguan (zoom Bulan). */
export function buildTicks(range: TimeRange, zoom: ZoomLevel): Tick[] {
  const unit = pxPerDay(zoom);

  if (zoom === 'day') {
    return range.days.map((day) => ({
      key: day,
      date: day,
      label: DAY_LABEL.format(parseUTC(day)),
      x: xForDate(day, range.from, unit),
      width: unit,
    }));
  }

  // Zoom minggu/bulan: satu penanda per minggu, dimulai pada hari Senin.
  const startIndexes: number[] = [];
  range.days.forEach((day, index) => {
    if (index === 0 || dayOfWeek(day) === 1) startIndexes.push(index);
  });

  return startIndexes.map((startIndex, position) => {
    const day = range.days[startIndex];
    const endIndex = startIndexes[position + 1] ?? range.days.length;
    const dayOfMonth = Number(day.slice(8, 10));
    const month = Number(day.slice(5, 7));
    const showLabel = zoom === 'week' ? true : position % 2 === 0 || dayOfMonth <= 7;
    return {
      key: day,
      date: day,
      label: showLabel ? (zoom === 'week' ? `${dayOfMonth}/${month}` : DAY_LABEL.format(parseUTC(day))) : '',
      x: xForDate(day, range.from, unit),
      width: (endIndex - startIndex) * unit,
    };
  });
}

export function weekdayNarrow(date: ISODate): string {
  return WEEKDAY_LABEL.format(parseUTC(date));
}

export interface BarGeometry {
  x: number;
  width: number;
  height: number;
  y: number;
}

export function barGeometry(task: TaskDTO, range: TimeRange, zoom: ZoomLevel, rowIndex: number): BarGeometry {
  const unit = pxPerDay(zoom);
  const x = xForDate(task.scheduledStart, range.from, unit);
  const calendarDays = daysBetween(task.scheduledStart, task.scheduledEnd) + 1;
  const width = Math.max(unit * 0.6, calendarDays * unit);
  const height = task.isSummary ? SUMMARY_BAR_HEIGHT : BAR_HEIGHT;
  const y = rowIndex * ROW_HEIGHT + (ROW_HEIGHT - height) / 2;
  return { x, width, height, y };
}

export function rowCenterY(rowIndex: number): number {
  return rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
}

/** Warna teks yang kontras untuk latar berwarna heksadesimal. */
export function readableTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#FFFFFF';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? '#0F172A' : '#FFFFFF';
}

export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Peta nomor WBS dari urutan dan level tugas.
 * Tugas harus sudah dalam urutan WBS (depth-first) dari server.
 */
export function buildWbsNumbers(tasks: TaskDTO[]): Map<string, string> {
  const counters: number[] = [];
  const result = new Map<string, string>();
  for (const task of tasks) {
    counters[task.level] = (counters[task.level] ?? 0) + 1;
    counters.length = task.level + 1;
    result.set(task.id, counters.join('.'));
  }
  return result;
}
