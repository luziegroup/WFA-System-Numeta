import React, { useState } from 'react';
import { DatabaseZap, Loader2, Search, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbRef, rootRef, get, set, update } from '../lib/firebase';
import { isInlineImage, makeImageRef, safeSegment } from '../lib/imageRef';
import { shrinkDataUrl } from '../lib/image';
import { getRuntimeConfig } from '../lib/runtimeConfig';

const NODES = [
  'users',
  'entries',
  'warnings',
  'zoomMeetings',
  'proofImages',
  'zoomPhotos',
  'settings',
  'hubstaffSettings',
  'trackingStatus',
  'screenshots',
  'activityTimeline',
  'appActivity',
  'urlActivity',
];

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
const AVATAR_MAX_BYTES = 12 * 1024;

/** Alat HRD: ukur ukuran tiap bagian database & pindahkan gambar besar keluar dari data utama. */
export const OptimasiDatabaseCard: React.FC = () => {
  const { currentUser, showToast } = useApp();
  const [busy, setBusy] = useState<'analyze' | 'migrate' | null>(null);
  const [sizes, setSizes] = useState<Array<{ node: string; bytes: number }> | null>(null);
  const [log, setLog] = useState<string[]>([]);

  if (currentUser.role !== 'hrd') return null;
  const say = (m: string) => setLog((l) => [...l.slice(-40), m]);

  const analyze = async () => {
    setBusy('analyze');
    setSizes(null);
    try {
      const out: Array<{ node: string; bytes: number }> = [];
      for (const node of NODES) {
        const snap = await get(dbRef(node));
        const val = snap.val();
        out.push({ node, bytes: val == null ? 0 : JSON.stringify(val).length });
      }
      setSizes(out.sort((a, b) => b.bytes - a.bytes));
    } catch (e: any) {
      showToast(`Gagal mengukur: ${e?.message || e}`, 'warning');
    } finally {
      setBusy(null);
    }
  };

  const migrate = async () => {
    if (!window.confirm('Jalankan optimasi sekarang?\n\nPastikan semua pengguna sudah memakai versi aplikasi terbaru (refresh / update) sebelum menjalankan ini. Proses memindahkan gambar ke node terpisah dan tidak menghapus data apa pun.')) return;
    setBusy('migrate');
    setLog([]);
    let moved = 0;
    let bytes = 0;
    try {
      // 1) Foto bukti to-do di entries
      say('Membaca entries…');
      const eSnap = await get(dbRef('entries'));
      const entries = (eSnap.val() || {}) as Record<string, any>;
      let batch: Record<string, unknown> = {};
      const flush = async () => {
        if (Object.keys(batch).length) await update(rootRef(), batch);
        batch = {};
      };
      for (const [entryId, entry] of Object.entries(entries)) {
        const todos = entry?.todos as Record<string, any> | any[] | undefined;
        if (!todos) continue;
        const pairs: Array<[string, any]> = Array.isArray(todos) ? todos.map((t, i) => [String(i), t]) : Object.entries(todos);
        for (const [k, todo] of pairs) {
          if (!todo || !isInlineImage(todo.proofImage)) continue;
          const path = `proofImages/${safeSegment(entryId)}/${safeSegment(todo.id || k)}`;
          await set(dbRef(path), todo.proofImage); // simpan gambar DULU
          batch[`entries/${entryId}/todos/${k}/proofImage`] = makeImageRef(path);
          moved++;
          bytes += todo.proofImage.length;
          if (Object.keys(batch).length >= 20) await flush();
        }
      }
      await flush();
      say(`Foto bukti to-do dipindahkan: ${moved}`);

      // 2) Foto meeting
      say('Membaca zoomMeetings…');
      const zSnap = await get(dbRef('zoomMeetings'));
      const zooms = (zSnap.val() || {}) as Record<string, any>;
      let zMoved = 0;
      for (const [mid, m] of Object.entries(zooms)) {
        const photos = m?.photos as Record<string, any> | any[] | undefined;
        if (!photos) continue;
        const pairs: Array<[string, any]> = Array.isArray(photos) ? photos.map((p, i) => [String(i), p]) : Object.entries(photos);
        for (const [k, ph] of pairs) {
          if (!ph || !isInlineImage(ph.url)) continue;
          const path = `zoomPhotos/${safeSegment(mid)}/${safeSegment(ph.id || k)}`;
          await set(dbRef(path), ph.url);
          batch[`zoomMeetings/${mid}/photos/${k}/url`] = makeImageRef(path);
          zMoved++;
          bytes += ph.url.length;
          if (Object.keys(batch).length >= 20) await flush();
        }
      }
      await flush();
      say(`Foto meeting dipindahkan: ${zMoved}`);

      // 3) Avatar besar -> kecil
      say('Membaca users…');
      const uSnap = await get(dbRef('users'));
      const users = (uSnap.val() || {}) as Record<string, any>;
      let aShrunk = 0;
      for (const [uid, u] of Object.entries(users)) {
        const av = u?.avatar as string | undefined;
        if (!av || !av.startsWith('data:image/') || av.startsWith('data:image/svg') || av.length <= AVATAR_MAX_BYTES) continue;
        try {
          const small = await shrinkDataUrl(av, 160, 0.75);
          if (small.length < av.length) {
            await set(dbRef(`users/${uid}/avatar`), small);
            bytes += av.length - small.length;
            aShrunk++;
          }
        } catch {
          /* lewati avatar rusak */
        }
      }
      say(`Avatar diperkecil: ${aShrunk}`);
      say(`Selesai. Perkiraan data yang keluar dari unduhan rutin: ${kb(bytes)} (per sekali muat penuh).`);
      showToast('Optimasi database selesai', 'success');
    } catch (e: any) {
      say(`GAGAL: ${e?.message || e}`);
      showToast('Optimasi terhenti karena error. Aman dijalankan ulang.', 'warning');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <DatabaseZap className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Optimasi Database (hemat kuota Firebase)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Gambar bukti & foto meeting lama masih tersimpan di dalam data utama. Alat ini memindahkannya ke node terpisah
            (hanya diunduh saat dilihat) dan memperkecil avatar. Aman dijalankan berulang. Keduanya mengunduh database SEKALI.
          </p>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
        Database aktif: <b className="text-slate-700">{getRuntimeConfig().firebase.projectId}</b> (root{' '}
        <b className="text-slate-700">{getRuntimeConfig().dbRoot}</b>) · sumber: <b className="text-slate-700">{getRuntimeConfig().source}</b>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={analyze}
          disabled={!!busy}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {busy === 'analyze' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Ukur ukuran database
        </button>
        <button
          type="button"
          onClick={migrate}
          disabled={!!busy}
          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-60 inline-flex items-center gap-2"
        >
          {busy === 'migrate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Jalankan optimasi
        </button>
      </div>

      {sizes && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-1.5 pr-4 font-semibold">Bagian</th>
                <th className="py-1.5 font-semibold">Ukuran</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s.node} className="border-b border-slate-50">
                  <td className="py-1.5 pr-4 font-mono text-slate-700">{s.node}</td>
                  <td className="py-1.5 text-slate-800 font-semibold">{kb(s.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <pre className="text-[11px] bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-600 whitespace-pre-wrap">{log.join('\n')}</pre>
      )}
    </div>
  );
};
