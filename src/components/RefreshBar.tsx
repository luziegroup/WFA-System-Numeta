import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  onRefresh: () => void | Promise<unknown>;
  loading?: boolean;
  updatedAt?: number | null;
  className?: string;
  /** Teks tambahan di sebelah kiri (mis. "Menampilkan 30 hari terakhir") */
  note?: React.ReactNode;
}

const fmt = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  return `${Math.floor(s / 3600)} jam lalu`;
};

/**
 * Bar kecil "Diperbarui HH:MM:SS (x menit lalu) [Refresh]". Data tidak diunduh otomatis;
 * tekan Refresh untuk mengambil data terbaru dari server.
 */
export const RefreshBar: React.FC<Props> = ({ onRefresh, loading, updatedAt, className = '', note }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const stale = !!updatedAt && Date.now() - updatedAt > 10 * 60 * 1000;
  return (
    <div className={`flex items-center justify-end gap-2 flex-wrap text-[11px] text-slate-500 ${className}`}>
      {note && <span className="mr-auto">{note}</span>}
      <span className={stale ? 'text-amber-600 font-semibold' : ''}>
        {updatedAt ? (
          <>
            Data terakhir diperbarui {fmt(updatedAt)} <span className={stale ? '' : 'text-slate-400'}>({ago(Date.now() - updatedAt)})</span>
            {stale && ' — mungkin sudah lama, tekan Refresh'}
          </>
        ) : (
          'Memuat data…'
        )}
      </span>
      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
        title="Ambil data terbaru dari server"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Memuat…' : 'Refresh'}
      </button>
    </div>
  );
};
