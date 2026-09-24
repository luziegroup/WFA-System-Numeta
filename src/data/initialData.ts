import { WfaSettings } from '../types';

export const INITIAL_SETTINGS: WfaSettings = {
  morningAbsenTime: '08:30',
  afternoonAbsenTime: '12:00',
  lateToleranceMinutes: 15,
  minTodosPerDay: 3,
  requireProofAttachment: true,
  minKpiPassScore: 70,
  companyZoomLink: 'https://us06web.zoom.us/j/85620165861?pwd=RsnolF3CjaNjCeeVJbeomRiQ5j97IW.1',
  companyZoomPasscode: '531761',
  autoSendLateWarning: true,
  autoSendIncompleteTodoWarning: true,
  workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'],
  bobotAbsen: 34,
  bobotTodo: 33,
  bobotKomunikasi: 33,
  divisiList: [
    'Tech & Engineering',
    'Creative & UI/UX',
    'Marketing & Growth',
    'People & Culture (HRD)',
    'Finance & Accounting',
    'Tech & Product Operations',
  ],
};

// Helper mendapatkan tanggal hari ini dalam format YYYY-MM-DD
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
