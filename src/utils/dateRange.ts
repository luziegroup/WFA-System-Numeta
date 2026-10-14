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
