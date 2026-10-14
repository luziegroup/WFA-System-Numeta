import React from 'react';
import type { DailyWfaEntry } from '../types';
import { useApp } from '../context/AppContext';
import {
  LIVE_STATUS_META,
  formatDuration,
  getActivityPercent,
  getLiveStatus,
} from '../utils/hubstaffUtils';

/** Ringkasan Hubstaff satu entry untuk sel tabel: durasi, progres target, dan % aktivitas. */
export const HubstaffCell: React.FC<{ entry?: DailyWfaEntry | null }> = ({ entry }) => {
  const { hubstaffSettings } = useApp();
  const seconds = entry?.hubstaffSeconds || 0;
  if (!entry || seconds <= 0) return <span className="text-xs text-slate-400">&mdash;</span>;
  const pct = getActivityPercent(entry);
  const progress = Math.min(100, Math.round((seconds / (hubstaffSettings.targetHoursPerDay * 3600)) * 100));
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-800 text-xs">{formatDuration(seconds)}</span>
        {pct !== null && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              pct >= 70
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : pct >= 40
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title="Persentase waktu ada aktivitas keyboard/mouse"
          >
            {pct}% aktif
          </span>
        )}
      </div>
      <div className="h-1 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
        <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export const HubstaffStatusBadge: React.FC<{ entry?: DailyWfaEntry; now: number }> = ({ entry, now }) => {
  const { hubstaffSettings } = useApp();
  const meta = LIVE_STATUS_META[getLiveStatus(entry, now, hubstaffSettings.heartbeatLostSeconds)];
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
};
