import { useEffect, useState } from 'react';
import type { DailyWfaEntry } from '../types';

/** Fitur tangkap layar terpasang. Tetap tidak ada yang diambil sampai HRD menyalakannya di
 *  Pengaturan Hubstaff DAN mengisi URL + kunci Apps Script. */
export const SCREENSHOT_IMPLEMENTED = true;

/** Tangkap layar siap dipakai menurut pengaturan HRD. */
export const isScreenshotConfigured = (s: { featureScreenshot: boolean; screenshotScriptUrl: string; screenshotUploadKey: string }): boolean =>
  SCREENSHOT_IMPLEMENTED && s.featureScreenshot && !!s.screenshotScriptUrl.trim() && !!s.screenshotUploadKey.trim();

/** Array kosong = berlaku untuk semua divisi. */
export const isDivisionInScope = (scopeDivisions: string[], division: string): boolean =>
  !scopeDivisions || scopeDivisions.length === 0 || scopeDivisions.includes(division);

export type MonitorFeature = 'activity' | 'screenshot' | 'urlTracking';

/** Fitur aktif untuk divisi tertentu = saklar utama menyala DAN divisinya termasuk cakupan. */
export const isFeatureEnabledForDivision = (
  settings: {
    featureActivity: boolean;
    featureScreenshot: boolean;
    featureUrlTracking: boolean;
    activityDivisions: string[];
    screenshotDivisions: string[];
    urlTrackingDivisions: string[];
  },
  feature: MonitorFeature,
  division: string
): boolean => {
  if (feature === 'activity') return settings.featureActivity && isDivisionInScope(settings.activityDivisions, division);
  if (feature === 'screenshot') return settings.featureScreenshot && isDivisionInScope(settings.screenshotDivisions, division);
  return settings.featureUrlTracking && isDivisionInScope(settings.urlTrackingDivisions, division);
};

export type HubstaffLiveStatus = 'tracking' | 'idle' | 'lost' | 'paused' | 'none';

export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** "2j 15m" */
export const formatDuration = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
};

/** Persentase aktif dari waktu yang terukur. null = tidak terukur (bukan dari aplikasi desktop). */
export const getActivityPercent = (e?: DailyWfaEntry | null): number | null => {
  if (!e?.hubstaffActivityTracked) return null;
  const active = e.hubstaffActiveSeconds || 0;
  const idle = e.hubstaffIdleSeconds || 0;
  if (active + idle <= 0) return null;
  return Math.round((active / (active + idle)) * 100);
};

export const getLiveStatus = (e: DailyWfaEntry | undefined, now: number, lostSeconds = 45): HubstaffLiveStatus => {
  if (!e) return 'none';
  const seconds = e.hubstaffSeconds || 0;
  if (e.hubstaffTracking) {
    if (!e.hubstaffLastBeat || now - e.hubstaffLastBeat > lostSeconds * 1000) return 'lost';
    return e.hubstaffIdleNow ? 'idle' : 'tracking';
  }
  return seconds > 0 ? 'paused' : 'none';
};

export const LIVE_STATUS_META: Record<HubstaffLiveStatus, { label: string; className: string }> = {
  tracking: { label: 'Tracking Aktif', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  idle: { label: 'Idle', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  lost: { label: 'Tidak Terpantau', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  paused: { label: 'Dijeda / Selesai', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  none: { label: 'Belum Mulai', className: 'bg-slate-50 text-slate-400 border-slate-200' },
};

/** Tanggal lokal hari ini (YYYY-MM-DD). */
export const localToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Jam sekarang yang diperbarui berkala, supaya status "terakhir terlihat" ikut bergerak. */
export const useNow = (intervalMs = 15000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};
