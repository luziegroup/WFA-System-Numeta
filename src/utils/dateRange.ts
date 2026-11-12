import { ALL_FROM, ALL_TO } from '../lib/useEntriesStore';

export const shiftDate = (d: string, days: number): string => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

/** Rentang tanggal sebuah bulan "YYYY-MM" (hari ke-31 aman karena perbandingan teks). */
export const monthRange = (ym: string) => ({ from: `${ym}-01`, to: `${ym}-31` });

/** n bulan terakhir (terbaru dulu) dalam format "YYYY-MM". */
export const lastMonths = (n: number): string[] => {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
};

export type PeriodPreset = 'today' | '7days' | '30days' | 'month' | 'custom' | 'all';

export const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const INDO_DAYS = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

/**
 * Format tanggal ke standar Indonesia: "12 November 2026"
 * Bila withDayName true: "Kamis, 12 November 2026"
 */
export function formatDateIndo(
  dateInput?: string | Date | null,
  options?: { withDayName?: boolean }
): string {
  if (!dateInput) return '-';
  try {
    let year: number;
    let month: number; // 1-12
    let day: number;
    let dayOfWeek: number | null = null;

    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
      if (match) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else {
        const d = new Date(trimmed);
        if (isNaN(d.getTime())) return dateInput;
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
        dayOfWeek = d.getDay();
      }
    } else {
      year = dateInput.getFullYear();
      month = dateInput.getMonth() + 1;
      day = dateInput.getDate();
      dayOfWeek = dateInput.getDay();
    }

    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12) {
      return String(dateInput);
    }

    const monthName = INDO_MONTHS[month - 1];
    const baseFormatted = `${day} ${monthName} ${year}`;

    if (options?.withDayName) {
      if (dayOfWeek === null) {
        dayOfWeek = new Date(year, month - 1, day).getDay();
      }
      return `${INDO_DAYS[dayOfWeek]}, ${baseFormatted}`;
    }

    return baseFormatted;
  } catch {
    return String(dateInput);
  }
}

/** Format bulan "YYYY-MM" ke "November 2026" */
export function formatMonthIndo(monthStr?: string | null): string {
  if (!monthStr || monthStr === 'all') return 'Semua Bulan';
  try {
    const parts = monthStr.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (!isNaN(year) && month >= 1 && month <= 12) {
        return `${INDO_MONTHS[month - 1]} ${year}`;
      }
    }
    return monthStr;
  } catch {
    return monthStr;
  }
}

/** Rentang tanggal yang perlu dimuat untuk pilihan periode pada halaman rekap/performa. */
export function presetRange(
  preset: PeriodPreset,
  selectedDate: string,
  customStart?: string,
  customEnd?: string
): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: selectedDate, to: selectedDate };
    case '7days':
      return { from: shiftDate(selectedDate, -7), to: selectedDate };
    case '30days':
      return { from: shiftDate(selectedDate, -30), to: selectedDate };
    case 'month':
      return monthRange(selectedDate.substring(0, 7));
    case 'custom':
      return { from: customStart || ALL_FROM, to: customEnd || ALL_TO };
    default:
      return { from: ALL_FROM, to: ALL_TO };
  }
}

