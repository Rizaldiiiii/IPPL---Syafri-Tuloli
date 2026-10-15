/**
 * Kalender proyek: akhir pekan yang dapat dikonfigurasi dan daftar hari libur.
 * Semua fungsi murni dan hanya memakai operasi tanggal UTC.
 */

import { ISODate, addDays, dayOfWeek } from './dates.js';

export interface ProjectCalendar {
  /** Hari akhir pekan, 0 = Minggu sampai 6 = Sabtu. */
  weekendDays: number[];
  /** Tanggal libur dalam format `YYYY-MM-DD`. */
  holidays: Set<ISODate>;
}

/** Default: Sabtu dan Minggu. */
export const DEFAULT_WEEKEND_DAYS: number[] = [0, 6];

export const WEEKDAY_LABELS: string[] = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

/** Mengubah daftar angka menjadi daftar unik terurut, hanya 0-6 valid. */
export function normalizeWeekendDays(days: number[]): number[] {
  const unique = new Set<number>();
  for (const day of days) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new Error(`Hari akhir pekan tidak valid: ${day}`);
    }
    unique.add(day);
  }
  return [...unique].sort((a, b) => a - b);
}

/** Melempar error bila ketujuh hari ditandai sebagai akhir pekan. */
export function assertWeekendDaysValid(days: number[]): void {
  const normalized = normalizeWeekendDays(days);
  if (normalized.length === 0) {
    throw new Error('Minimal satu hari kerja harus tersedia (akhir pekan tidak boleh kosong)');
  }
  if (normalized.length >= 7) {
    throw new Error('Akhir pekan tidak boleh mencakup ketujuh hari');
  }
}

/** Membaca kolom `Project.weekendDays` menjadi daftar angka. */
export function parseWeekendDays(value: string): number[] {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return [...DEFAULT_WEEKEND_DAYS];
  return normalizeWeekendDays(parts.map((part) => Number(part)));
}

/** Menulis daftar angka menjadi kolom `Project.weekendDays`. */
export function serializeWeekendDays(days: number[]): string {
  return normalizeWeekendDays(days).join(',');
}

export function createCalendar(weekendDays: number[] = DEFAULT_WEEKEND_DAYS, holidays: ISODate[] = []): ProjectCalendar {
  return {
    weekendDays: normalizeWeekendDays(weekendDays),
    holidays: new Set(holidays),
  };
}

/** Hari kerja = bukan akhir pekan dan bukan hari libur. */
export function isWorkingDay(calendar: ProjectCalendar, date: ISODate): boolean {
  if (calendar.holidays.has(date)) return false;
  return !calendar.weekendDays.includes(dayOfWeek(date));
}

/** Hari kerja berikutnya; mengembalikan `date` sendiri bila sudah hari kerja. */
export function nextWorkingDay(calendar: ProjectCalendar, date: ISODate): ISODate {
  let cursor = date;
  for (let guard = 0; guard < 4000; guard += 1) {
    if (isWorkingDay(calendar, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  throw new Error('Tidak ada hari kerja yang ditemukan dalam rentang wajar');
}

/** Hari kerja sebelumnya; mengembalikan `date` sendiri bila sudah hari kerja. */
export function previousWorkingDay(calendar: ProjectCalendar, date: ISODate): ISODate {
  let cursor = date;
  for (let guard = 0; guard < 4000; guard += 1) {
    if (isWorkingDay(calendar, cursor)) return cursor;
    cursor = addDays(cursor, -1);
  }
  throw new Error('Tidak ada hari kerja yang ditemukan dalam rentang wajar');
}

/**
 * Menggeser `date` sebanyak `offset` hari kerja (boleh negatif).
 * `date` harus merupakan hari kerja.
 */
export function shiftWorkingDays(calendar: ProjectCalendar, date: ISODate, offset: number): ISODate {
  if (!isWorkingDay(calendar, date)) {
    throw new Error(`Tanggal ${date} bukan hari kerja, tidak bisa digeser`);
  }
  if (offset === 0) return date;
  const step = offset > 0 ? 1 : -1;
  let cursor = date;
  for (let index = 0; index < Math.abs(offset); index += 1) {
    cursor = addDays(cursor, step);
    cursor = step > 0 ? nextWorkingDay(calendar, cursor) : previousWorkingDay(calendar, cursor);
  }
  return cursor;
}

/** Jumlah hari kerja antara `from` dan `to`, inklusif. Mengembalikan 0 bila `from` > `to`. */
export function workingDaysBetween(calendar: ProjectCalendar, from: ISODate, to: ISODate): number {
  if (from > to) return 0;
  let cursor = from;
  let count = 0;
  for (let guard = 0; guard < 40000; guard += 1) {
    if (cursor > to) break;
    if (isWorkingDay(calendar, cursor)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** Daftar hari kerja dalam rentang inklusif. */
export function enumerateWorkingDays(calendar: ProjectCalendar, from: ISODate, to: ISODate): ISODate[] {
  const result: ISODate[] = [];
  if (from > to) return result;
  let cursor = from;
  for (let guard = 0; guard < 40000; guard += 1) {
    if (cursor > to) break;
    if (isWorkingDay(calendar, cursor)) result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}

/** Daftar seluruh tanggal dalam rentang inklusif. */
export function enumerateDays(from: ISODate, to: ISODate): ISODate[] {
  const result: ISODate[] = [];
  if (from > to) return result;
  let cursor = from;
  for (let guard = 0; guard < 40000; guard += 1) {
    if (cursor > to) break;
    result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}
