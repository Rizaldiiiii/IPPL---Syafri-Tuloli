import { describe, expect, it } from 'vitest';
import {
  assertWeekendDaysValid,
  createCalendar,
  isWorkingDay,
  nextWorkingDay,
  parseWeekendDays,
  previousWorkingDay,
  serializeWeekendDays,
  shiftWorkingDays,
  workingDaysBetween,
} from './calendar.js';

const calendar = createCalendar([0, 6], []);

describe('kalender proyek', () => {
  it('mengenali hari kerja dan akhir pekan', () => {
    expect(isWorkingDay(calendar, '2026-10-23')).toBe(true); // Jumat
    expect(isWorkingDay(calendar, '2026-10-24')).toBe(false); // Sabtu
    expect(isWorkingDay(calendar, '2026-10-25')).toBe(false); // Minggu
    expect(isWorkingDay(calendar, '2026-10-26')).toBe(true); // Senin
  });

  it('mengenali hari libur', () => {
    const withHoliday = createCalendar([0, 6], ['2026-10-26']);
    expect(isWorkingDay(withHoliday, '2026-10-26')).toBe(false);
    expect(isWorkingDay(withHoliday, '2026-10-27')).toBe(true);
  });

  it('nextWorkingDay mengembalikan tanggal itu sendiri bila hari kerja', () => {
    expect(nextWorkingDay(calendar, '2026-10-23')).toBe('2026-10-23');
    expect(nextWorkingDay(calendar, '2026-10-24')).toBe('2026-10-26');
  });

  it('previousWorkingDay mengembalikan tanggal itu sendiri bila hari kerja', () => {
    expect(previousWorkingDay(calendar, '2026-10-26')).toBe('2026-10-26');
    expect(previousWorkingDay(calendar, '2026-10-25')).toBe('2026-10-23');
  });

  it('shiftWorkingDays maju dan mundur', () => {
    expect(shiftWorkingDays(calendar, '2026-10-23', 0)).toBe('2026-10-23');
    expect(shiftWorkingDays(calendar, '2026-10-23', 1)).toBe('2026-10-26');
    expect(shiftWorkingDays(calendar, '2026-10-23', 2)).toBe('2026-10-27');
    expect(shiftWorkingDays(calendar, '2026-10-27', -2)).toBe('2026-10-23');
  });

  it('shiftWorkingDays melewati hari libur', () => {
    const withHoliday = createCalendar([0, 6], ['2026-10-26']);
    expect(shiftWorkingDays(withHoliday, '2026-10-23', 1)).toBe('2026-10-27');
    expect(shiftWorkingDays(withHoliday, '2026-10-23', 2)).toBe('2026-10-28');
  });

  it('menolak tanggal bukan hari kerja pada shiftWorkingDays', () => {
    expect(() => shiftWorkingDays(calendar, '2026-10-24', 1)).toThrow(/bukan hari kerja/);
  });

  it('menghitung jumlah hari kerja secara inklusif', () => {
    expect(workingDaysBetween(calendar, '2026-10-23', '2026-10-27')).toBe(3);
    expect(workingDaysBetween(calendar, '2026-10-19', '2026-10-19')).toBe(1);
    expect(workingDaysBetween(calendar, '2026-10-24', '2026-10-25')).toBe(0);
    expect(workingDaysBetween(calendar, '2026-10-27', '2026-10-23')).toBe(0);
  });

  it('memvalidasi daftar akhir pekan', () => {
    expect(() => assertWeekendDaysValid([0, 1, 2, 3, 4, 5, 6])).toThrow(/ketujuh hari/);
    expect(() => assertWeekendDaysValid([])).toThrow(/Minimal satu hari kerja/);
    expect(() => assertWeekendDaysValid([0, 6])).not.toThrow();
  });

  it('membaca dan menulis kolom weekendDays', () => {
    expect(parseWeekendDays('0,6')).toEqual([0, 6]);
    expect(parseWeekendDays('6, 0')).toEqual([0, 6]);
    expect(parseWeekendDays('')).toEqual([0, 6]);
    expect(serializeWeekendDays([6, 0, 0])).toBe('0,6');
  });

  it('mendukung akhir pekan di luar Sabtu-Minggu', () => {
    const fridayWeekend = createCalendar([5, 6], []);
    expect(isWorkingDay(fridayWeekend, '2026-10-23')).toBe(false);
    expect(isWorkingDay(fridayWeekend, '2026-10-25')).toBe(true);
  });
});
