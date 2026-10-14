import React, { useEffect, useState } from 'react';
import { Check, Chrome, Copy, KeyRound, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';


const genToken = (): string => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** Kartu untuk karyawan: buat & salin kode pasang ekstensi pelacakan alamat (URL). */
export const UrlTrackingPairingCard: React.FC = () => {
  const { currentUser, updateUser, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleGenerate = () => {
    setBusy(true);
    const token = genToken();
    updateUser(currentUser.id, { urlTrackerToken: token });
    setBusy(false);
    showToast('Kode pasang dibuat. Salin dan masukkan ke ekstensi browser Anda.', 'success');
  };

  const pairingCode = currentUser.urlTrackerToken ? `${currentUser.id}.${currentUser.urlTrackerToken}` : '';

  // Beri tahu ekstensi browser (kalau terpasang) kode pasang lewat atribut di <html>. Ekstensi
  // yang mengamati alamat aplikasi ini akan otomatis membaca & menyambungkan diri — karyawan
  // tidak perlu menyalin apa pun secara manual selama ekstensi sudah dipasang & dikonfigurasi IT.
  useEffect(() => {
    if (pairingCode) document.documentElement.setAttribute('data-wfa-pairing', pairingCode);
    return () => document.documentElement.removeAttribute('data-wfa-pairing');
  }, [pairingCode]);

  type ExtStatus = 'unknown' | 'disconnected' | 'connected' | 'tracking';
  const [extStatus, setExtStatus] = useState<ExtStatus>('unknown');
  useEffect(() => {
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent).detail as { paired?: boolean; tracking?: boolean; urlTrackingOn?: boolean } | undefined;
      if (!d) return;
      setExtStatus(!d.paired ? 'disconnected' : d.tracking && d.urlTrackingOn ? 'tracking' : 'connected');
    };
    window.addEventListener('wfa-extension-status', onStatus);
    const timeout = setTimeout(() => setExtStatus((s) => (s === 'unknown' ? 'disconnected' : s)), 4000);
    return () => {
      window.removeEventListener('wfa-extension-status', onStatus);
      clearTimeout(timeout);
    };
  }, [pairingCode]);
  const copyToken = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Gagal menyalin. Salin manual dari kotak di atas.', 'warning');
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
          <Chrome className="w-4 h-4 text-blue-600" />
          <span>Pelacakan Alamat (URL)</span>
        </div>
        <span
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
            extStatus === 'tracking'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : extStatus === 'connected'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {extStatus === 'tracking' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {extStatus === 'tracking' ? 'Ekstensi Mencatat' : extStatus === 'connected' ? 'Ekstensi Terhubung' : 'Ekstensi Belum Terdeteksi'}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Untuk mencatat alamat situs yang dibuka (termasuk Google dan YouTube), pasang ekstensi browser WFA System
        di Chrome atau Edge. Kalau sudah terpasang, ekstensi otomatis tersambung sendiri ke akun Anda — tidak
        perlu menyalin apa pun. Pencatatan hanya berjalan saat timer Hubstaff Anda aktif.
      </p>
      {extStatus === 'disconnected' && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Ekstensi belum terdeteksi di browser ini. Minta file ekstensi ke HRD/IT bila belum pasang, atau buka kode
          pasang di bawah untuk menyambungkan manual.
        </p>
      )}

      {currentUser.urlTrackerToken ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono break-all">
              {pairingCode}
            </code>
            <button
              type="button"
              onClick={copyToken}
              className="shrink-0 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              aria-label="Salin kode"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Buat kode baru (kode lama berhenti bekerja)
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
        >
          <KeyRound className="w-3.5 h-3.5" /> Buat Kode Pasang
        </button>
      )}
      <p className="text-[10px] text-slate-400">Minta file ekstensi ke HRD/IT jika belum punya.</p>
    </div>
  );
};
