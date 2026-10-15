import { describe, expect, it } from 'vitest';
import { addDays, dayOfWeek, isISODate, minISODate, maxISODate, parseISODate, toISODate } from './dates.js';

describe('dates', () => {
  it('memvalidasi format tanggal ISO', () => {
    expect(isISODate('2026-10-19')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('19-10-2026')).toBe(false);
    expect(isISODate('2026-13-01')).toBe(false);
  });

  it('memproses tanggal sebagai UTC tanpa pergeseran hari', () => {
    const date = parseISODate('2026-10-19');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(9);
    expect(date.getUTCDate()).toBe(19);
    expect(toISODate(date)).toBe('2026-10-19');
  });

  it('menambah dan mengurangi hari kalender', () => {
    expect(addDays('2026-10-23', 3)).toBe('2026-10-26');
    expect(addDays('2026-10-26', -3)).toBe('2026-10-23');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('mengembalikan hari dalam seminggu dengan 0 = Minggu', () => {
    expect(dayOfWeek('2026-10-19')).toBe(1);
    expect(dayOfWeek('2026-10-25')).toBe(0);
    expect(dayOfWeek('2026-10-24')).toBe(6);
  });

  it('mengambil tanggal minimum dan maksimum', () => {
    expect(minISODate(['2026-10-19', '2026-01-02', '2026-12-31'])).toBe('2026-01-02');
    expect(maxISODate(['2026-10-19', '2026-01-02', '2026-12-31'])).toBe('2026-12-31');
  });
});
