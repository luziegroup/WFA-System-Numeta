import React, { useEffect, useMemo, useState } from 'react';
import { AppWindow, Camera, Keyboard, KeyRound, LayoutGrid, Mouse, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbRef, get } from '../lib/firebase';
import { fetchScreenshotCached, VIEW_KEY_STORAGE } from '../lib/screenshotClient';
import { ActivityBlockRecord, AppUsageRecord, ScreenshotRecord, User } from '../types';
import { formatDuration } from '../utils/hubstaffUtils';

const safeKey = (s: string) => s.replace(/[.#$[\]/]/g, '_');
const fmtHm = (ts: number) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const BLOCK_MIN = 10;
const BLOCK_MS = BLOCK_MIN * 60_000;

const pctTone = (pct: number) =>
  pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

interface TimelineCard {
  blockStart: number;
  pct: number | null;
  topApp?: string;
  screenshots: ScreenshotRecord[];
  /** Persentase kejadian input yang berupa mouse vs keyboard pada blok ini. null kalau
   *  belum ada data (fitur baru / belum ada input sama sekali). */
  mousePct: number | null;
  keyboardPct: number | null;
  /** 'time' = % waktu ada input (seperti Hubstaff); 'share' = data lama: porsi jumlah input (mouse+keyboard=100%) */
  inputMode: 'time' | 'share' | null;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Baris kecil "Mouse 62%" dengan bar mini */
const InputStat: React.FC<{ kind: 'mouse' | 'keyboard'; pct: number; share?: boolean }> = ({ kind, pct, share }) => {
  const Icon = kind === 'mouse' ? Mouse : Keyboard;
  return (
    <div
      className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1.5"
      title={
        share
          ? `${kind === 'mouse' ? 'Mouse' : 'Keyboard'}: ${pct}% dari seluruh input (data lama, belum per-waktu)`
          : `${kind === 'mouse' ? 'Mouse' : 'Keyboard'}: ada input pada ${pct}% waktu di blok ini`
      }
    >
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Icon className="w-3 h-3 text-slate-400" /> {kind === 'mouse' ? 'Mouse' : 'Keyboard'}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-slate-200 mt-1 overflow-hidden">
        <div className={`h-full ${kind === 'mouse' ? 'bg-sky-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ScreenshotThumb: React.FC<{ rec: ScreenshotRecord; scriptUrl: string; viewKey: string }> = ({ rec, scriptUrl, viewKey }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchScreenshotCached({ screenshotScriptUrl: scriptUrl }, viewKey, rec.fileId)
      .then((s) => !cancelled && setSrc(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [rec.fileId, scriptUrl, viewKey]);

  if (failed) return <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">Gagal dimuat</div>;
  if (!src) return <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">Memuat...</div>;
  return <img src={src} alt="Tangkap layar" className="w-full h-full object-cover" />;
};

export const ActivityDetailModal: React.FC<{ member: User; date: string; onClose: () => void }> = ({ member, date, onClose }) => {
  const { entries, hubstaffSettings } = useApp();
  const [tab, setTab] = useState<'timeline' | 'apps'>('timeline');
  const [blocks, setBlocks] = useState<ActivityBlockRecord[] | null>(null);
  const [shots, setShots] = useState<ScreenshotRecord[] | null>(null);
  const [apps, setApps] = useState<AppUsageRecord[] | null>(null);
  const [viewKey, setViewKey] = useState(() => { try { return localStorage.getItem(VIEW_KEY_STORAGE) || ''; } catch { return ''; } });
  const [keyInput, setKeyInput] = useState('');

  const entry = useMemo(() => entries.find((e) => e.userId === member.id && e.date === date), [entries, member.id, date]);
  const todoLabel = !entry || entry.todos.length === 0
    ? 'Tidak ada to-do'
    : entry.todos.length === 1
    ? entry.todos[0].task
    : `${entry.todos[0].task} +${entry.todos.length - 1} lainnya`;

  useEffect(() => {
    const uid = safeKey(member.id);
    get(dbRef(`activityTimeline/${date}/${uid}`))
      .then((snap) => {
        const val = (snap.val() || {}) as Record<string, ActivityBlockRecord>;
        setBlocks(Object.values(val).sort((a, b) => a.blockStart - b.blockStart));
      })
      .catch(() => setBlocks([]));
    get(dbRef(`appActivity/${date}/${uid}`))
      .then((snap) => {
        const val = (snap.val() || {}) as Record<string, AppUsageRecord>;
        setApps(Object.values(val).sort((a, b) => b.seconds - a.seconds));
      })
      .catch(() => setApps([]));
    get(dbRef(`screenshots/${date}/${uid}`))
      .then((snap) => {
        const val = (snap.val() || {}) as Record<string, ScreenshotRecord>;
        setShots(Object.values(val).sort((a, b) => a.ts - b.ts));
      })
      .catch(() => setShots([]));
  }, [date, member.id]);

  const saveKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    try { localStorage.setItem(VIEW_KEY_STORAGE, k); } catch { /* abaikan */ }
    setViewKey(k);
  };

  const cards: TimelineCard[] | null = useMemo(() => {
    if (blocks === null || shots === null) return null;
    const map = new Map<number, TimelineCard>();
    blocks.forEach((b) => {
      const total = b.activeSeconds + b.idleSeconds;
      const inputTotal = (b.keyboardEvents || 0) + (b.mouseEvents || 0);
      const timeBased = b.keyboardSeconds !== undefined || b.mouseSeconds !== undefined;
      let mousePct: number | null = null;
      let keyboardPct: number | null = null;
      let inputMode: TimelineCard['inputMode'] = null;
      if (timeBased && total > 0) {
        mousePct = clampPct(((b.mouseSeconds || 0) / total) * 100);
        keyboardPct = clampPct(((b.keyboardSeconds || 0) / total) * 100);
        inputMode = 'time';
      } else if (inputTotal > 0) {
        mousePct = clampPct(((b.mouseEvents || 0) / inputTotal) * 100);
        keyboardPct = clampPct(((b.keyboardEvents || 0) / inputTotal) * 100);
        inputMode = 'share';
      }
      map.set(b.blockStart, {
        blockStart: b.blockStart,
        pct: total > 0 ? Math.round((b.activeSeconds / total) * 100) : null,
        topApp: b.topApp,
        screenshots: [],
        mousePct,
        keyboardPct,
        inputMode,
      });
    });
    shots.forEach((s) => {
      const blockStart = Math.floor(s.ts / BLOCK_MS) * BLOCK_MS;
      let card = map.get(blockStart);
      if (!card) {
        card = { blockStart, pct: null, screenshots: [], mousePct: null, keyboardPct: null, inputMode: null };
        map.set(blockStart, card);
      }
      card.screenshots.push(s);
    });
    return Array.from(map.values()).sort((a, b) => a.blockStart - b.blockStart);
  }, [blocks, shots]);

  const totalActive = useMemo(() => (blocks || []).reduce((t, b) => t + b.activeSeconds, 0), [blocks]);
  const totalIdle = useMemo(() => (blocks || []).reduce((t, b) => t + b.idleSeconds, 0), [blocks]);
  // Ringkasan harian ala Hubstaff: Overall / Mouse / Keyboard
  const daySummary = useMemo(() => {
    const bl = blocks || [];
    const tracked = bl.reduce((t, b) => t + b.activeSeconds + b.idleSeconds, 0);
    const timeBlocks = bl.filter((b) => b.keyboardSeconds !== undefined || b.mouseSeconds !== undefined);
    const timeTracked = timeBlocks.reduce((t, b) => t + b.activeSeconds + b.idleSeconds, 0);
    const overall = tracked > 0 ? clampPct((totalActive / tracked) * 100) : null;
    if (timeTracked > 0) {
      return {
        overall,
        mouse: clampPct((timeBlocks.reduce((t, b) => t + (b.mouseSeconds || 0), 0) / timeTracked) * 100),
        keyboard: clampPct((timeBlocks.reduce((t, b) => t + (b.keyboardSeconds || 0), 0) / timeTracked) * 100),
        mode: 'time' as const,
        partial: timeBlocks.length < bl.length,
      };
    }
    const ev = bl.reduce((t, b) => t + (b.keyboardEvents || 0) + (b.mouseEvents || 0), 0);
    if (ev > 0) {
      return {
        overall,
        mouse: clampPct((bl.reduce((t, b) => t + (b.mouseEvents || 0), 0) / ev) * 100),
        keyboard: clampPct((bl.reduce((t, b) => t + (b.keyboardEvents || 0), 0) / ev) * 100),
        mode: 'share' as const,
        partial: false,
      };
    }
    return { overall, mouse: null, keyboard: null, mode: null, partial: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, totalActive]);
  const totalAppSeconds = useMemo(() => (apps || []).reduce((t, a) => t + a.seconds, 0), [apps]);
  const empty = cards !== null && cards.length === 0 && apps !== null && apps.length === 0;
  const hasAnyScreenshot = (shots || []).length > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <LayoutGrid className="w-4 h-4 text-blue-600" />
            <span>Rincian Aktivitas &mdash; {member.name} &bull; {date}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex border-b border-slate-100 px-5 gap-1">
          {([
            ['timeline', 'Per Rentang Waktu'],
            ['apps', 'Aplikasi Dipakai'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2.5 text-xs font-bold border-b-2 -mb-px ${
                tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {empty ? (
            <div className="text-center text-xs text-slate-400 py-12">
              Belum ada data rincian aktivitas untuk tanggal ini.
            </div>
          ) : tab === 'timeline' ? (
            cards === null ? (
              <div className="text-center text-xs text-slate-400 py-12">Memuat...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="text-[10px] font-bold uppercase text-emerald-700">Total Aktif</div>
                    <div className="text-sm font-black text-emerald-800 mt-0.5">{formatDuration(totalActive)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="text-[10px] font-bold uppercase text-amber-700">Total Idle</div>
                    <div className="text-sm font-black text-amber-800 mt-0.5">{formatDuration(totalIdle)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <div className="text-[10px] font-bold uppercase text-blue-700">Aktivitas</div>
                    <div className="text-sm font-black text-blue-800 mt-0.5">{daySummary.overall !== null ? `${daySummary.overall}%` : '—'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-100" title="Persentase waktu ada input mouse">
                    <div className="text-[10px] font-bold uppercase text-sky-700 inline-flex items-center gap-1"><Mouse className="w-3 h-3" /> Mouse</div>
                    <div className="text-sm font-black text-sky-800 mt-0.5">{daySummary.mouse !== null ? `${daySummary.mouse}%` : '—'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-50 border border-violet-100" title="Persentase waktu ada input keyboard">
                    <div className="text-[10px] font-bold uppercase text-violet-700 inline-flex items-center gap-1"><Keyboard className="w-3 h-3" /> Keyboard</div>
                    <div className="text-sm font-black text-violet-800 mt-0.5">{daySummary.keyboard !== null ? `${daySummary.keyboard}%` : '—'}</div>
                  </div>
                </div>
                {daySummary.mode === null && (
                  <p className="text-[11px] text-slate-400">
                    Data mouse &amp; keyboard belum tercatat untuk hari ini. Persentase muncul jika karyawan memakai aplikasi desktop versi terbaru.
                  </p>
                )}
                {daySummary.mode === 'share' && (
                  <p className="text-[11px] text-slate-400">
                    Hari ini direkam dengan versi lama: persentase Mouse &amp; Keyboard berupa porsi jumlah input (total 100%), bukan persen waktu.
                  </p>
                )}
                {daySummary.mode === 'time' && daySummary.partial && (
                  <p className="text-[11px] text-slate-400">Sebagian blok direkam dengan versi lama dan tidak ikut dihitung pada persentase Mouse &amp; Keyboard.</p>
                )}

                {hasAnyScreenshot && !viewKey && (
                  <div className="max-w-md space-y-2 p-4 rounded-xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" /> Masukkan kunci lihat untuk menampilkan thumbnail
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveKey()}
                        placeholder="Kunci lihat"
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs"
                      />
                      <button onClick={saveKey} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">Simpan</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {cards.map((c) => {
                    const pct = c.pct ?? 0;
                    return (
                      <div key={c.blockStart} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                        <div className="px-3 pt-2.5 pb-2 border-b border-slate-100">
                          <div className="text-[11px] font-bold text-slate-700 truncate" title={todoLabel}>{todoLabel}</div>
                        </div>
                        <div className="relative aspect-video bg-slate-100">
                          {c.screenshots.length > 0 ? (
                            viewKey ? (
                              <ScreenshotThumb rec={c.screenshots[0]} scriptUrl={hubstaffSettings.screenshotScriptUrl} viewKey={viewKey} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Camera className="w-6 h-6" />
                              </div>
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">Tidak ada tangkapan</div>
                          )}
                          {c.screenshots.length > 0 && (
                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-white shadow text-[10px] font-bold text-slate-700">
                              {c.screenshots.length} tangkapan
                            </span>
                          )}
                        </div>
                        <div className="px-3 py-2.5 space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-600 text-center">
                            {fmtHm(c.blockStart)} &ndash; {fmtHm(c.blockStart + BLOCK_MS)}
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" title={`Aktivitas keseluruhan: ${pct}%`}>
                            <div className={`h-full ${pctTone(pct)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[11px] text-slate-500 text-center">
                            {c.pct === null ? 'Tidak terukur' : `${c.pct}% dari ${BLOCK_MIN} menit`}
                          </div>
                          {c.mousePct !== null && c.keyboardPct !== null ? (
                            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                              <InputStat kind="mouse" pct={c.mousePct} share={c.inputMode === 'share'} />
                              <InputStat kind="keyboard" pct={c.keyboardPct} share={c.inputMode === 'share'} />
                            </div>
                          ) : (
                            c.pct !== null && <div className="text-[10px] text-slate-300 text-center">Mouse &amp; keyboard belum tercatat</div>
                          )}
                          {c.topApp && (
                            <div className="text-[10px] text-slate-400 text-center truncate" title={c.topApp}>{c.topApp}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : apps === null ? (
            <div className="text-center text-xs text-slate-400 py-12">Memuat...</div>
          ) : (
            <div className="space-y-2 max-w-xl">
              {apps.map((a) => {
                const pct = totalAppSeconds > 0 ? Math.round((a.seconds / totalAppSeconds) * 100) : 0;
                return (
                  <div key={a.appName} className="p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <AppWindow className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate">{a.appName}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-600 shrink-0">{formatDuration(a.seconds)}</span>
                    </div>
                    {a.lastTitle && <div className="text-[10px] text-slate-400 truncate mt-1 pl-5.5">{a.lastTitle}</div>}
                    <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <p className="px-5 pb-4 text-[10px] text-slate-400">
          Dicatat dari sistem (nama program, lama aktif/idle, & tangkap layar) lewat aplikasi desktop. Isi layar penuh atau isi ketikan tidak pernah direkam di luar tangkap layar yang memang diaktifkan HRD.
        </p>
      </div>
    </div>
  );
};
