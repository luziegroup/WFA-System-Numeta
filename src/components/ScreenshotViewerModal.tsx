import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, ChevronLeft, ChevronRight, KeyRound, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbRef, get, remove } from '../lib/firebase';
import { deleteScreenshotFile, fetchScreenshotCached, forgetScreenshot, ADMIN_KEY_STORAGE, VIEW_KEY_STORAGE } from '../lib/screenshotClient';
import { ScreenshotRecord, User } from '../types';

const safeKey = (s: string) => s.replace(/[.#$\[\]/]/g, '_');
const BLOCK_MIN = 10;

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtHm = (ts: number) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const activityTone = (pct?: number) =>
  pct === undefined ? 'bg-slate-100 text-slate-500 border-slate-200'
  : pct >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
  : pct >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200'
  : 'bg-rose-50 text-rose-700 border-rose-200';

/** Jam laptop karyawan menyimpang lebih dari ini dari jam server dianggap perlu diperiksa. */
const CLOCK_SKEW_WARN_MS = 3 * 60_000;

interface Row extends ScreenshotRecord {
  src?: string;
  error?: string;
}

const Thumb: React.FC<{ row: Row; onOpen: () => void }> = ({ row, onOpen }) => (
  <button type="button" onClick={onOpen} disabled={!row.src} className="text-left space-y-1 group">
    <div className="relative aspect-video rounded-lg border border-slate-200 bg-slate-100 overflow-hidden">
      {row.src ? (
        <img src={row.src} alt={`Tangkap layar ${fmtTime(row.ts)}`} className="w-full h-full object-cover group-hover:opacity-90" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
          {row.error ? (row.error === 'not_found' ? 'Sudah dihapus' : 'Gagal dimuat') : 'Memuat...'}
        </div>
      )}
      {row.activityPct !== undefined && (
        <span className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${activityTone(row.activityPct)}`}>
          {row.activityPct}%
        </span>
      )}
    </div>
    <div className="text-[10px] font-semibold text-slate-600 text-center">{fmtTime(row.ts)}{row.blurred ? ' • buram' : ''}</div>
  </button>
);

export const ScreenshotViewerModal: React.FC<{ member: User; date: string; onClose: () => void }> = ({ member, date, onClose }) => {
  const { hubstaffSettings, currentUser, showToast } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [viewKey, setViewKey] = useState(() => { try { return localStorage.getItem(VIEW_KEY_STORAGE) || ''; } catch { return ''; } });
  const [keyInput, setKeyInput] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const canDelete = currentUser.role === 'hrd';
  const rowsRef = useRef<Row[] | null>(null);
  rowsRef.current = rows;

  useEffect(() => {
    get(dbRef(`screenshots/${date}/${safeKey(member.id)}`))
      .then((snap) => {
        const val = (snap.val() || {}) as Record<string, ScreenshotRecord>;
        setRows(Object.values(val).sort((a, b) => a.ts - b.ts));
      })
      .catch(() => setRows([]));
  }, [date, member.id]);

  useEffect(() => {
    if (!viewKey || !rows) return;
    let cancelled = false;
    rows.forEach((row, i) => {
      if (row.src || row.error) return;
      fetchScreenshotCached({ screenshotScriptUrl: hubstaffSettings.screenshotScriptUrl }, viewKey, row.fileId)
        .then((src) => {
          if (cancelled) return;
          setRows((prev) => prev && prev.map((r, j) => (j === i ? { ...r, src } : r)));
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setRows((prev) => prev && prev.map((r, j) => (j === i ? { ...r, error: e.message } : r)));
          if (/kunci/i.test(e.message)) resetKey();
        });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, rows === null]);

  const saveKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    try { localStorage.setItem(VIEW_KEY_STORAGE, k); } catch { /* abaikan */ }
    setViewKey(k);
  };
  const resetKey = () => {
    try { localStorage.removeItem(VIEW_KEY_STORAGE); } catch { /* abaikan */ }
    setViewKey('');
  };

  const blocks = useMemo(() => {
    if (!rows) return [];
    const map = new Map<number, Row[]>();
    rows.forEach((r) => {
      const blockStart = Math.floor(r.ts / (BLOCK_MIN * 60_000)) * (BLOCK_MIN * 60_000);
      const list = map.get(blockStart) || [];
      list.push(r);
      map.set(blockStart, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([start, list]) => {
        const pcts = list.map((r) => r.activityPct).filter((p): p is number => p !== undefined);
        const avgPct = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : undefined;
        return { start, list, avgPct };
      });
  }, [rows]);

  const handleDelete = async (row: Row) => {
    let adminKey = '';
    try { adminKey = localStorage.getItem(ADMIN_KEY_STORAGE) || ''; } catch { /* abaikan */ }
    if (!adminKey) {
      adminKey = window.prompt('Masukkan kunci admin untuk menghapus tangkap layar ini:') || '';
      if (!adminKey) return;
      try { localStorage.setItem(ADMIN_KEY_STORAGE, adminKey); } catch { /* abaikan */ }
    }
    if (!window.confirm(`Hapus permanen tangkapan pukul ${fmtTime(row.ts)}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleting(true);
    try {
      await deleteScreenshotFile({ screenshotScriptUrl: hubstaffSettings.screenshotScriptUrl }, adminKey, row.fileId);
      await remove(dbRef(`screenshots/${date}/${safeKey(member.id)}/${row.ts}`));
      forgetScreenshot(row.fileId);
      setRows((prev) => (prev ? prev.filter((r) => r.ts !== row.ts) : prev));
      setOpenIdx(null);
      showToast('Tangkap layar dihapus.', 'success');
    } catch (e) {
      if (e instanceof Error && /admin/i.test(e.message)) {
        try { localStorage.removeItem(ADMIN_KEY_STORAGE); } catch { /* abaikan */ }
      }
      showToast(`Gagal menghapus: ${e instanceof Error ? e.message : String(e)}`, 'warning');
    } finally {
      setDeleting(false);
    }
  };

  const flat = rows || [];
  const openRow = openIdx !== null ? flat[openIdx] : null;

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null);
      else if (e.key === 'ArrowLeft') setOpenIdx((i) => (i !== null && i > 0 ? i - 1 : i));
      else if (e.key === 'ArrowRight') setOpenIdx((i) => (i !== null && rowsRef.current && i < rowsRef.current.length - 1 ? i + 1 : i));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIdx]);

  const skewed = openRow?.serverTs ? Math.abs(openRow.serverTs - openRow.ts) > CLOCK_SKEW_WARN_MS : false;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Camera className="w-4 h-4 text-blue-600" />
            <span>Tangkap Layar &mdash; {member.name} &bull; {date}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {!viewKey ? (
            <div className="max-w-md mx-auto space-y-3 text-center py-6">
              <KeyRound className="w-8 h-8 text-blue-600 mx-auto" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Masukkan <span className="font-bold">kunci lihat</span> dari script Google Drive. Kunci ini hanya disimpan di
                browser/aplikasi Anda, tidak di database. Tanyakan ke HRD bila belum punya.
              </p>
              <div className="flex gap-2">
                <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs" placeholder="Kunci lihat" />
                <button onClick={saveKey} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">Simpan</button>
              </div>
            </div>
          ) : rows === null ? (
            <div className="text-center text-xs text-slate-400 py-12">Memuat daftar...</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-12">Belum ada tangkap layar pada tanggal ini.</div>
          ) : (
            <>
              {blocks.map((b) => (
                <div key={b.start} className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                    <span>{fmtHm(b.start)} &ndash; {fmtHm(b.start + BLOCK_MIN * 60_000)}</span>
                    {b.avgPct !== undefined && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${activityTone(b.avgPct)}`}>{b.avgPct}% aktif</span>
                    )}
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-slate-400 font-normal">{b.list.length} tangkapan</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {b.list.map((r) => (
                      <Thumb key={r.ts} row={r} onOpen={() => setOpenIdx(flat.findIndex((x) => x.ts === r.ts))} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>{rows.length} tangkapan &bull; dikelompokkan per {BLOCK_MIN} menit, seperti Hubstaff</span>
                <button onClick={resetKey} className="underline hover:text-slate-600">Ganti kunci lihat</button>
              </div>
            </>
          )}
        </div>
      </div>

      {openRow && (
        <div className="fixed inset-0 z-[80] bg-black/85 flex flex-col" onClick={() => setOpenIdx(null)}>
          <div className="flex items-center justify-between p-4 text-white text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="font-bold">{fmtTime(openRow.ts)}</span>
              {openRow.activityPct !== undefined && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${activityTone(openRow.activityPct)}`}>{openRow.activityPct}% aktif</span>
              )}
              {openRow.blurred && <span className="px-2 py-0.5 rounded bg-white/10 text-[10px]">Diburamkan</span>}
              {skewed && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]" title="Jam perangkat karyawan berbeda cukup jauh dari jam server">
                  <AlertTriangle className="w-3 h-3" /> Jam perangkat berbeda dari server
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canDelete && (
                <button onClick={() => handleDelete(openRow)} disabled={deleting} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 disabled:opacity-50 font-bold">
                  <Trash2 className="w-3.5 h-3.5" /> {deleting ? 'Menghapus...' : 'Hapus'}
                </button>
              )}
              <button onClick={() => setOpenIdx(null)} aria-label="Tutup"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4 relative" onClick={(e) => e.stopPropagation()}>
            {openIdx! > 0 && (
              <button onClick={() => setOpenIdx((i) => (i ?? 0) - 1)} className="absolute left-2 text-white/80 hover:text-white p-2" aria-label="Sebelumnya">
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            {openRow.src ? (
              <img src={openRow.src} alt={`Tangkap layar ${fmtTime(openRow.ts)}`} className="max-w-full max-h-full rounded-lg" />
            ) : (
              <div className="text-white/60 text-xs">{openRow.error === 'not_found' ? 'Gambar sudah dihapus' : 'Memuat...'}</div>
            )}
            {openIdx! < flat.length - 1 && (
              <button onClick={() => setOpenIdx((i) => (i ?? 0) + 1)} className="absolute right-2 text-white/80 hover:text-white p-2" aria-label="Berikutnya">
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
