import {
  formatIDR,
  formatISODateLong,
  formatISODateShort,
  type ISODate,
  type Priority,
} from '@gantt/shared';

export { formatIDR, formatISODateLong, formatISODateShort };

const numberFormatter = new Intl.NumberFormat('id-ID');

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Angka desimal ringkas, maksimal dua angka di belakang koma. */
export function formatDecimal(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
}

export function formatDays(value: number): string {
  return `${numberFormatter.format(value)} hari`;
}

export function formatDate(value: ISODate): string {
  return formatISODateShort(value);
}

export function priorityLabel(priority: Priority): string {
  switch (priority) {
    case 'HIGH':
      return 'Tinggi';
    case 'MEDIUM':
      return 'Sedang';
    default:
      return 'Rendah';
  }
}

export function priorityClass(priority: Priority): string {
  switch (priority) {
    case 'HIGH':
      return 'bg-danger-bg text-danger border-danger/20';
    case 'MEDIUM':
      return 'bg-warning-bg text-warning border-warning/20';
    default:
      return 'bg-surface-2 text-ink-2 border-line';
  }
}

/** Nomor WBS dari urutan WBS dan level tugas. */
export function wbsNumber(index: number, level: number): string {
  return level === 0 ? `${index + 1}` : `${index + 1}`;
}
