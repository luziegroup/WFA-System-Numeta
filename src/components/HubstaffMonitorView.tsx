import React, { useMemo, useState } from 'react';
import { Activity, Camera, Clock, Globe, ListTree, Search, Timer, UserX, Zap } from 'lucide-react';
import { useApp, useEntriesRange } from '../context/AppContext';
import { RefreshBar } from './RefreshBar';
import { HubstaffStatusBadge } from './HubstaffCell';
import { ScreenshotViewerModal } from './ScreenshotViewerModal';
import { UrlActivityViewerModal } from './UrlActivityViewerModal';
import { ActivityDetailModal } from './ActivityDetailModal';
import { dbRef, remove, onValue, get } from '../lib/firebase';
import type { User, DailyWfaEntry } from '../types';
import {
  HubstaffLiveStatus,
  formatClock,
  formatDuration,
  getActivityPercent,
  getLiveStatus,
  isFeatureEnabledForDivision,
  isScreenshotConfigured,
  localToday,
  useNow,
} from '../utils/hubstaffUtils';

type StatusFilter = 'semua' | HubstaffLiveStatus;

const ago = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  return `${Math.floor(s / 3600)} jam lalu`;
};

/** Monitoring Hubstaff. Koordinator melihat timnya, HRD melihat semua karyawan. */
export const HubstaffMonitorView: React.FC = () => {
  const { entries, allUsers, currentUser, hubstaffSettings, canMonitorHubstaff } = useApp();
  const targetSeconds = hubstaffSettings.targetHoursPerDay * 3600;
  const now = useNow(10000);
  const [date, setDate] = useState(localToday());
  const [division, setDivision] = useState('semua');
  const [status, setStatus] = useState<StatusFilter>('semua');
  const [query, setQuery] = useState('');
  const isToday = date === localToday();
  const { refresh: entriesRefresh, loading: entriesLoading, updatedAt: entriesUpdatedAt } = useEntriesRange(date, date);

  // Status LIVE: dibaca langsung dari node kecil trackingStatus/{uid} (bukan dari entries). Pendengar
  // hanya aktif selama halaman ini terbuka & saklar Live menyala; matikan Live untuk hemat kuota
  // dan ambil status dengan tombol Refresh.
  type LiveStatusRow = {
    tracking?: boolean; lastBeat?: number; date?: string; seconds?: number; activityTracked?: boolean;
    active?: number; idle?: number; idleNow?: boolean; pauses?: number;
  };
  const [liveOn, setLiveOn] = useState(true);
  const [liveMap, setLiveMap] = useState<Record<string, LiveStatusRow | null>>({});
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);
  const [viewingUrl, setViewingUrl] = useState<User | null>(null);
  const [viewingActivity, setViewingActivity] = useState<User | null>(null);
  const canViewShots =
    isScreenshotConfigured(hubstaffSettings) && (currentUser.role === 'hrd' || hubstaffSettings.leaderCanViewScreenshots);
  const canViewUrl =
    hubstaffSettings.featureUrlTracking && (currentUser.role === 'hrd' || hubstaffSettings.leaderCanViewUrlActivity);

  // Bersihkan catatan tangkap layar yang lewat masa simpan (gambarnya dihapus oleh script Drive).
  // Dijalankan HRD maksimal sekali sehari per browser; hanya mengirim beberapa hapus kecil.
  React.useEffect(() => {
    if (currentUser.role !== 'hrd') return;
    const flag = 'wfa_screenshot_meta_cleanup';
    try {
      if (localStorage.getItem(flag) === localToday()) return;
      localStorage.setItem(flag, localToday());
    } catch { /* lanjut saja */ }
    for (let i = 1; i <= 8; i++) {
      const dS = new Date();
      dS.setDate(dS.getDate() - hubstaffSettings.screenshotRetentionDays - i);
      const keyS = `${dS.getFullYear()}-${String(dS.getMonth() + 1).padStart(2, '0')}-${String(dS.getDate()).padStart(2, '0')}`;
      remove(dbRef(`screenshots/${keyS}`)).catch(() => undefined);

      const dU = new Date();
      dU.setDate(dU.getDate() - hubstaffSettings.urlTrackingRetentionDays - i);
      const keyU = `${dU.getFullYear()}-${String(dU.getMonth() + 1).padStart(2, '0')}-${String(dU.getDate()).padStart(2, '0')}`;
      remove(dbRef(`urlActivity/${keyU}`)).catch(() => undefined);

      // Rincian aktivitas dibersihkan mengikuti masa simpan yang sama dengan tangkap layar,
      // supaya tidak perlu pengaturan retensi baru hanya untuk fitur ini.
      const dA = new Date();
      dA.setDate(dA.getDate() - hubstaffSettings.screenshotRetentionDays - i);
      const keyA = `${dA.getFullYear()}-${String(dA.getMonth() + 1).padStart(2, '0')}-${String(dA.getDate()).padStart(2, '0')}`;
      remove(dbRef(`activityTimeline/${keyA}`)).catch(() => undefined);
      remove(dbRef(`appActivity/${keyA}`)).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.role]);

  const members = useMemo(
    () =>
      allUsers.filter(
        (u) => u.role === 'karyawan' && u.isActive !== false && (currentUser.role === 'hrd' || u.leaderId === currentUser.id)
      ),
    [allUsers, currentUser]
  );
  const divisions = useMemo(() => Array.from(new Set(members.map((m) => m.division))).sort(), [members]);

  const memberIdsKey = members.map((m) => m.id).join(',');
  React.useEffect(() => {
    if (!isToday || !liveOn || !memberIdsKey) return;
    const unsubs = memberIdsKey.split(',').map((id) =>
      onValue(dbRef(`trackingStatus/${id}`), (snap) => {
        setLiveMap((prev) => ({ ...prev, [id]: (snap.val() as LiveStatusRow) || null }));
        setLiveUpdatedAt(Date.now());
      })
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, liveOn, memberIdsKey]);

  /** Ambil status live SEKALI (saat Live dimatikan / tombol Refresh). */
  const fetchLiveOnce = React.useCallback(async () => {
    if (!isToday || !memberIdsKey) return;
    const ids = memberIdsKey.split(',');
    const snaps = await Promise.all(ids.map((id) => get(dbRef(`trackingStatus/${id}`)).catch(() => null)));
    const next: Record<string, LiveStatusRow | null> = {};
    ids.forEach((id, i) => (next[id] = (snaps[i]?.val() as LiveStatusRow) || null));
    setLiveMap(next);
    setLiveUpdatedAt(Date.now());
  }, [isToday, memberIdsKey]);
  React.useEffect(() => {
    if (!liveOn) void fetchLiveOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOn, fetchLiveOnce]);

  /** Gabungkan entry harian dengan status live (hanya untuk hari ini). */
  const withLive = (m: User, entry: DailyWfaEntry | undefined): DailyWfaEntry | undefined => {
    const lv = isToday ? liveMap[m.id] : null;
    if (!lv || lv.date !== date) return entry;
    const base =
      entry ||
      ({ id: `live-${m.id}`, userId: m.id, userName: m.name, userEmail: m.email, division: m.division, date, todos: [] } as unknown as DailyWfaEntry);
    return {
      ...base,
      hubstaffSeconds: lv.seconds ?? base.hubstaffSeconds,
      hubstaffTracking: lv.tracking,
      hubstaffLastBeat: lv.lastBeat,
      ...(lv.activityTracked
        ? {
            hubstaffActivityTracked: true,
            hubstaffActiveSeconds: lv.active || 0,
            hubstaffIdleSeconds: lv.idle || 0,
            hubstaffIdleNow: !!lv.idleNow,
            hubstaffAutoPauseCount: lv.pauses || 0,
          }
        : {}),
    };
  };

  const rows = useMemo(
    () =>
      members.map((m) => {
        const entry = withLive(m, entries.find((e) => e.userId === m.id && e.date === date));
        return { member: m, entry, live: getLiveStatus(entry, now, hubstaffSettings.heartbeatLostSeconds) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, entries, date, now, hubstaffSettings.heartbeatLostSeconds, liveMap, isToday]
  );

  const filtered = rows
    .filter((r) => division === 'semua' || r.member.division === division)
    .filter((r) => status === 'semua' || r.live === status)
    .filter((r) => r.member.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.entry?.hubstaffSeconds || 0) - (a.entry?.hubstaffSeconds || 0));

  const count = (s: HubstaffLiveStatus) => rows.filter((r) => r.live === s).length;
  const withTime = rows.filter((r) => (r.entry?.hubstaffSeconds || 0) > 0);
  const avgSeconds = withTime.length
    ? Math.round(withTime.reduce((t, r) => t + (r.entry?.hubstaffSeconds || 0), 0) / withTime.length)
    : 0;

  const cards = [
    { label: 'Tracking Aktif', value: count('tracking'), icon: Activity, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Idle Sekarang', value: count('idle'), icon: Timer, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Tidak Terpantau', value: count('lost'), icon: Zap, tone: 'text-rose-600 bg-rose-50' },
    { label: 'Belum Mulai', value: count('none'), icon: UserX, tone: 'text-slate-500 bg-slate-100' },
    { label: 'Rata-rata Durasi', value: avgSeconds ? formatDuration(avgSeconds) : '—', icon: Clock, tone: 'text-blue-600 bg-blue-50' },
  ];

  if (!canMonitorHubstaff) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
        <div className="text-base font-bold text-slate-900">Monitor Hubstaff tidak tersedia untuk akun Anda</div>
        <p className="text-xs text-slate-500">Akses ini diatur oleh HRD di menu Pengaturan Hubstaff.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Monitor Hubstaff</h1>
        <p className="text-xs text-slate-500 mt-1">
          {currentUser.role === 'hrd' ? 'Time tracking seluruh karyawan' : 'Time tracking anggota tim Anda'}
          {isToday ? (liveOn ? ' — status live (terhubung langsung)' : ' — status tidak live, tekan Refresh untuk memperbarui') : ''}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {isToday ? (
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input type="checkbox" checked={liveOn} onChange={(e) => setLiveOn(e.target.checked)} className="accent-emerald-600" />
            <span className={`w-2 h-2 rounded-full ${liveOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            Live
            <span className="font-normal text-slate-400">(matikan untuk menghemat kuota data)</span>
          </label>
        ) : (
          <span />
        )}
        <RefreshBar
          onRefresh={() => Promise.all([entriesRefresh(), fetchLiveOnce()])}
          loading={entriesLoading}
          updatedAt={liveOn && isToday ? liveUpdatedAt || entriesUpdatedAt : entriesUpdatedAt}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tone}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-900 leading-none">{c.value}</div>
              <div className="text-[11px] text-slate-500 mt-1">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 text-xs">
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700"
        />
        {currentUser.role === 'hrd' && (
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700"
          >
            <option value="semua">Semua Divisi</option>
            {divisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700"
        >
          <option value="semua">Semua Status</option>
          <option value="tracking">Tracking Aktif</option>
          <option value="idle">Idle</option>
          <option value="lost">Tidak Terpantau</option>
          <option value="paused">Dijeda / Selesai</option>
          <option value="none">Belum Mulai</option>
        </select>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Durasi Tracking</th>
                {hubstaffSettings.featureActivity && <th className="py-3.5 px-4">Aktivitas</th>}
                {hubstaffSettings.featureActivity && <th className="py-3.5 px-4">Idle</th>}
                <th className="py-3.5 px-4">Terakhir Terlihat</th>
                {canViewShots && <th className="py-3.5 px-4">Tangkap Layar</th>}
                {canViewUrl && <th className="py-3.5 px-4">Alamat Situs</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={(hubstaffSettings.featureActivity ? 6 : 4) + (canViewShots ? 1 : 0) + (canViewUrl ? 1 : 0)} className="text-center py-12 text-slate-400">Tidak ada karyawan yang cocok dengan filter.</td>
                </tr>
              ) : (
                filtered.map(({ member, entry }) => {
                  const seconds = entry?.hubstaffSeconds || 0;
                  const pct = getActivityPercent(entry);
                  const progress = Math.min(100, Math.round((seconds / targetSeconds) * 100));
                  return (
                    <tr key={member.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{member.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {member.division}
                          {currentUser.role === 'hrd' && member.leaderName ? ` • ${member.leaderName}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><HubstaffStatusBadge entry={entry} now={now} /></td>
                      <td className="py-3.5 px-4 min-w-[150px]">
                        <div className="font-mono font-bold text-slate-800">{seconds > 0 ? formatClock(seconds) : '—'}</div>
                        <div className="h-1 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
                        </div>
                      </td>
                      {hubstaffSettings.featureActivity && (<td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {pct !== null ? (
                            <span className={`font-extrabold ${pct >= 70 ? 'text-emerald-700' : pct >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>
                              {pct}%
                            </span>
                          ) : seconds > 0 ? (
                            <span className="text-[11px] text-slate-400" title="Tracking dari browser: hanya durasi yang tercatat">
                              Tidak terukur
                            </span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                          {pct !== null && (
                            <button
                              type="button"
                              onClick={() => setViewingActivity(member)}
                              className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1"
                              title="Lihat rincian per rentang waktu & aplikasi"
                            >
                              <ListTree className="w-2.5 h-2.5" /> Rincian
                            </button>
                          )}
                        </div>
                      </td>)}
                      {hubstaffSettings.featureActivity && (<td className="py-3.5 px-4 text-slate-600">
                        {entry?.hubstaffActivityTracked ? (
                          <>
                            {formatDuration(entry.hubstaffIdleSeconds || 0)}
                            {(entry.hubstaffAutoPauseCount || 0) > 0 && (
                              <span className="ml-1.5 text-[10px] font-bold text-rose-600">
                                • {entry.hubstaffAutoPauseCount}x jeda otomatis
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>)}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {entry?.hubstaffLastBeat ? ago(now - entry.hubstaffLastBeat) : '—'}
                      </td>
                      {canViewShots && (
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setViewing(member)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                          >
                            <Camera className="w-3 h-3" /> Lihat
                          </button>
                        </td>
                      )}
                      {canViewUrl && (
                        <td className="py-3.5 px-4">
                          {isFeatureEnabledForDivision(hubstaffSettings, 'urlTracking', member.division) ? (
                            <button
                              type="button"
                              onClick={() => setViewingUrl(member)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                            >
                              <Globe className="w-3 h-3" /> Lihat
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">Divisi tidak dipantau</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {viewing && <ScreenshotViewerModal member={viewing} date={date} onClose={() => setViewing(null)} />}
      {viewingUrl && <UrlActivityViewerModal member={viewingUrl} date={date} onClose={() => setViewingUrl(null)} />}
      {viewingActivity && <ActivityDetailModal member={viewingActivity} date={date} onClose={() => setViewingActivity(null)} />}
      <p className="text-[11px] text-slate-400">
        Aktivitas = persentase waktu ada input keyboard/mouse (dibaca dari sistem operasi, hanya lewat aplikasi desktop).
        &ldquo;Tidak Terpantau&rdquo; berarti timer masih berstatus jalan tetapi tidak ada kabar dari perangkat karyawan
        selama lebih dari 45 detik (aplikasi ditutup, laptop tidur, atau koneksi putus).
      </p>
    </div>
  );
};
