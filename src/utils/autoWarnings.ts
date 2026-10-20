/**
 * Teguran OTOMATIS — logika murni (tanpa Firebase) supaya mudah diuji.
 *
 * Aplikasi ini tidak punya server, jadi teguran otomatis dibuat oleh aplikasi KARYAWAN itu sendiri
 * pada saat yang tepat, dengan id yang TETAP (deterministik) sehingga tidak pernah terkirim ganda
 * walau aplikasi dibuka di beberapa perangkat. Id memakai awalan waktu (warn-<ms>-...) supaya urutannya
 * tetap kronologis bersama teguran manual (yang ber-id warn-<Date.now()>).
 */
import type { AbsenRecord, DailyWfaEntry, WarningItem, WfaSettings } from '../types';
import { getFinalScore, weightsFromSettings } from './scoreUtils';

export interface AutoWarnDraft {
  id: string;
  type: WarningItem['type'];
  title: string;
  message: string;
  date: string; // YYYY-MM-DD
}

export const AUTO_SENDER_ID = 'system-auto';
export const AUTO_SENDER_NAME = 'Sistem (Otomatis)';

/** Pengingat to-do dikirim mulai sekian menit sebelum jam absen siang. */
export const TODO_REMINDER_LEAD_MINUTES = 30;
/** Minimal jumlah hari yang sudah dinilai leader sebelum teguran performa dianggap adil. */
export const MIN_REVIEWED_DAYS_FOR_PERFORMANCE = 3;

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const dayNameOf = (date: string): string => HARI[new Date(`${date}T00:00:00`).getDay()];

/** true bila tanggal itu hari kerja menurut pengaturan (daftar kosong = semua hari dianggap kerja). */
export const isWorkDay = (date: string, workDays?: string[]): boolean =>
  !workDays || workDays.length === 0 || workDays.includes(dayNameOf(date));

const dayStartMs = (date: string) => new Date(`${date}T00:00:00`).getTime();

const toMinutes = (hhmm: string, fallback: number): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

/** Absen pagi terlambat -> teguran keterlambatan (sekali per hari). */
export function lateWarningDraft(
  userId: string,
  date: string,
  record: AbsenRecord,
  settings: Pick<WfaSettings, 'autoSendLateWarning' | 'morningAbsenTime' | 'workDays'>
): AutoWarnDraft | null {
  if (settings.autoSendLateWarning === false) return null;
  if (record.status !== 'terlambat') return null;
  if (!isWorkDay(date, settings.workDays)) return null;
  return {
    id: `warn-${dayStartMs(date)}-auto-late-${userId}`,
    type: 'terlambat',
    title: 'Keterlambatan Absen Pagi',
    message: `Anda absen pagi pukul ${record.time}, melewati batas ${settings.morningAbsenTime}. Mohon lebih tepat waktu.`,
    date,
  };
}

/** Menjelang absen siang masih ada to-do yang belum dicentang -> pengingat (sekali per hari). */
export function todoReminderDraft(
  userId: string,
  entry: DailyWfaEntry,
  now: Date,
  settings: Pick<WfaSettings, 'autoSendIncompleteTodoWarning' | 'afternoonAbsenTime' | 'workDays'>
): AutoWarnDraft | null {
  if (settings.autoSendIncompleteTodoWarning === false) return null;
  if (!entry.absenPagi || entry.absenSiang) return null; // belum mulai kerja / sudah absen siang
  if (!isWorkDay(entry.date, settings.workDays)) return null;

  const noon = toMinutes(settings.afternoonAbsenTime, 12 * 60);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < noon - TODO_REMINDER_LEAD_MINUTES || nowMin >= noon) return null;

  const total = entry.todos.length;
  const belum = entry.todos.filter((t) => !t.completed).length;
  if (total === 0 || belum === 0) return null;

  return {
    id: `warn-${dayStartMs(entry.date)}-auto-todo-${userId}`,
    type: 'todo_siang',
    title: 'Pengingat To-Do Belum Dicentang',
    message: `Ada ${belum} dari ${total} to-do yang belum dicentang. Centang dan lampirkan bukti sebelum absen siang pukul ${settings.afternoonAbsenTime}.`,
    date: entry.date,
  };
}

/** Rata-rata skor bulan berjalan DI BAWAH target KPI -> teguran performa (sekali per bulan). */
export function performanceWarningDraft(
  userId: string,
  entries: DailyWfaEntry[],
  today: string,
  settings: Pick<WfaSettings, 'autoSendPerformanceWarning' | 'minKpiPassScore' | 'bobotAbsen' | 'bobotTodo' | 'bobotKomunikasi'>
): AutoWarnDraft | null {
  if (settings.autoSendPerformanceWarning === false) return null;
  const target = settings.minKpiPassScore;
  if (!Number.isFinite(target) || target <= 0) return null;

  const month = today.substring(0, 7);
  const weights = weightsFromSettings(settings);
  const scores: number[] = [];
  for (const e of entries) {
    if (e.userId !== userId || !e.date.startsWith(month)) continue;
    const s = getFinalScore(e, weights);
    if (s !== null) scores.push(s);
  }
  if (scores.length < MIN_REVIEWED_DAYS_FOR_PERFORMANCE) return null;

  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  if (!(avg < target)) return null; // HANYA bila benar-benar di bawah target

  return {
    id: `warn-${dayStartMs(`${month}-01`)}-auto-perf-${userId}`,
    type: 'performa',
    title: 'Peringatan Performa',
    message: `Skor performa rata-rata bulan ini (${avg}) di bawah target ${target}. Segera tingkatkan ketepatan absen, kualitas to-do, dan komunikasi.`,
    date: today,
  };
}
