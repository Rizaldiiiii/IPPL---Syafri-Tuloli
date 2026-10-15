/**
 * Utilitas tanggal berbasis UTC murni.
 *
 * Semua tanggal di aplikasi direpresentasikan sebagai string ISO `YYYY-MM-DD`
 * dan diproses pada tengah malam UTC. Ini menghindari pergeseran satu hari
 * ketika runtime berada di zona waktu non-UTC.
 */

export type ISODate = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Memeriksa apakah string berupa tanggal ISO `YYYY-MM-DD` yang benar-benar ada. */
export function isISODate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Mengubah string ISO menjadi `Date` pada tengah malam UTC. */
export function parseISODate(value: ISODate): Date {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Tanggal tidak valid: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) throw new Error(`Tanggal tidak valid: ${value}`);
  return date;
}

/** Mengubah `Date` menjadi string ISO `YYYY-MM-DD` memakai komponen UTC. */
export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Menambah (atau mengurangi) sejumlah hari kalender. */
export function addDays(value: ISODate, days: number): ISODate {
  const date = parseISODate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** Hari dalam seminggu, 0 = Minggu sampai 6 = Sabtu. */
export function dayOfWeek(value: ISODate): number {
  return parseISODate(value).getUTCDay();
}

/** Perbandingan leksikografis aman untuk format `YYYY-MM-DD`. */
export function compareISODate(a: ISODate, b: ISODate): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Selisih hari kalender antara `from` dan `to` (boleh negatif). */
export function daysBetween(from: ISODate, to: ISODate): number {
  const milliseconds = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(milliseconds / 86_400_000);
}

/** Tanggal hari ini menurut waktu lokal, dikembalikan sebagai `YYYY-MM-DD`. */
export function todayISODate(): ISODate {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Nilai terkecil dari daftar tanggal. */
export function minISODate(values: ISODate[]): ISODate {
  if (values.length === 0) throw new Error('minISODate membutuhkan minimal satu tanggal');
  return values.reduce((acc, value) => (value < acc ? value : acc));
}

/** Nilai terbesar dari daftar tanggal. */
export function maxISODate(values: ISODate[]): ISODate {
  if (values.length === 0) throw new Error('maxISODate membutuhkan minimal satu tanggal');
  return values.reduce((acc, value) => (value > acc ? value : acc));
}

/** Format panjang berbahasa Indonesia, contoh `Sen, 19 Okt 2026`. */
export function formatISODateLong(value: ISODate): string {
  const date = parseISODate(value);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Format pendek berbahasa Indonesia, contoh `19 Okt 2026`. */
export function formatISODateShort(value: ISODate): string {
  const date = parseISODate(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
