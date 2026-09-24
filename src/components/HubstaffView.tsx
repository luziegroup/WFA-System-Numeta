import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Laptop,
  Smartphone,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Play,
  Pause,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw
} from 'lucide-react';
import { SidebarMenuId } from './Sidebar';

interface HubstaffViewProps {
  onNavigate?: (menu: SidebarMenuId) => void;
}

export const HubstaffView: React.FC<HubstaffViewProps> = ({ onNavigate }) => {
  const { currentUser, getCurrentEntry, doAbsenPagi, showToast } = useApp();
  const entry = getCurrentEntry();

  // Status kelengkapan persiapan kerja
  const isAbsenPagiDone = !!entry.absenPagi;
  const isTodoListDone = entry.todos.length > 0;
  const isReadyForHubstaff = isAbsenPagiDone && isTodoListDone;

  // State simulasi tracking Hubstaff lokal jika diaktifkan
  const [isTracking, setIsTracking] = useState(false);
  const [trackedSeconds, setTrackedSeconds] = useState(7420); // Demo default ~2 jam 3 menit
  const [showLaunchModal, setShowLaunchModal] = useState<string | null>(null);

  // Timer interval saat tracking aktif
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTracking) {
      interval = setInterval(() => {
        setTrackedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);

  const formatTrackingTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleToggleTimer = () => {
    if (!isReadyForHubstaff) {
      showToast('Selesaikan absen pagi dan to-do list terlebih dahulu!', 'warning');
      return;
    }
    if (!isTracking) {
      setIsTracking(true);
      showToast('Timer Hubstaff dimulai! Time tracking aktif.', 'success');
    } else {
      setIsTracking(false);
      showToast('Timer Hubstaff dijeda sementara.', 'info');
    }
  };

  const handleOpenDesktop = () => {
    if (!isReadyForHubstaff) {
      showToast('Hubstaff terkunci. Silakan penuhi status persiapan kerja.', 'warning');
      return;
    }
    // Coba buka protokol hubstaff URI scheme jika terinstall di desktop
    window.location.href = 'hubstaff://';
    setShowLaunchModal('desktop');
  };

  const handleOpenMobile = () => {
    if (!isReadyForHubstaff) {
      showToast('Hubstaff terkunci. Silakan penuhi status persiapan kerja.', 'warning');
      return;
    }
    setShowLaunchModal('mobile');
  };

  const handleQuickAbsenPagi = () => {
    doAbsenPagi('Rumah (WFA)', 'Absen cepat via halaman persiapan Hubstaff');
    showToast('Absen pagi berhasil dicatat! Mengalihkan ke To-Do List...', 'success');
    setTimeout(() => {
      onNavigate?.('todo-saya');
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Title & Subtitle Persis Screenshot */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Hubstaff</h1>
        <p className="text-xs text-slate-500 mt-1">Aktifkan time tracking sebelum mulai bekerja</p>
      </div>

      {/* CARD 1: STATUS PERSIAPAN KERJA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Status Persiapan Kerja</span>
        </div>

        <div className="space-y-3">
          {/* Item 1: Status Absen Pagi */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
            <div className="flex items-center gap-3.5">
              {isAbsenPagiDone ? (
                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-500 flex items-center justify-center text-emerald-600 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {isAbsenPagiDone ? 'Sudah Absen Pagi' : 'Belum Absen Pagi'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isAbsenPagiDone
                    ? `Tercatat pukul ${entry.absenPagi?.time} • ${entry.absenPagi?.location}`
                    : 'Absen dulu sebelum mulai'}
                </div>
              </div>
            </div>

            {isAbsenPagiDone ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sudah Absen</span>
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickAbsenPagi}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Absen Sekarang
                </button>
              </div>
            )}
          </div>

          {/* Item 2: Status To-Do List */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
            <div className="flex items-center gap-3.5">
              {isTodoListDone ? (
                <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-500 flex items-center justify-center text-emerald-600 shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-slate-300 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {isTodoListDone ? 'Sudah Isi To-Do List' : 'Belum Isi To-Do List'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isTodoListDone
                    ? `${entry.todos.length} tugas hari ini telah dibuat dan siap dikerjakan`
                    : 'Isi to-do list terlebih dahulu'}
                </div>
              </div>
            </div>

            {isTodoListDone ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sudah Diisi ({entry.todos.length})</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate?.('todo-saya')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                Isi To-Do
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CARD 2: BUKA HUBSTAFF */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Laptop className="w-4 h-4 text-blue-600" />
            <span>Buka Hubstaff</span>
          </div>

          {isReadyForHubstaff && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">Hubstaff Siap Digunakan</span>
            </div>
          )}
        </div>

        {/* Banner Status Persyaratan */}
        {!isReadyForHubstaff ? (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Selesaikan absen pagi dan to-do list terlebih dahulu untuk mengaktifkan Hubstaff.</span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Status Persiapan Lengkap! Absen pagi dan to-do list telah siap. Anda dapat meluncurkan time tracking Hubstaff sekarang.
              </span>
            </div>
            <button
              onClick={handleToggleTimer}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                isTracking
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
              }`}
            >
              {isTracking ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isTracking ? 'Jeda Timer' : 'Mulai Timer'}</span>
            </button>
          </div>
        )}

        {/* Interactive Hubstaff Live Tracking Panel (Ketika aktif) */}
        {isReadyForHubstaff && (
          <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 to-sky-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-white shadow-sm ${
                isTracking ? 'bg-blue-600' : 'bg-slate-400'
              }`}>
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Luzie Group &bull; {currentUser.division}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isTracking ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isTracking ? '● Tracking Aktif' : 'Dijeda'}
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                  {formatTrackingTime(trackedSeconds)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Target harian: 08:00:00 jam &bull; Aktivitas otomatis tercatat untuk rekap WFA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleTimer}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                  isTracking
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isTracking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isTracking ? 'Stop / Istirahat' : 'Mulai Tracking Hubstaff'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 2 Kotak Aplikasi Desktop & Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kotak Aplikasi Desktop */}
          <div className="border border-slate-200/80 rounded-2xl p-6 text-center space-y-4 bg-slate-50/40 hover:bg-slate-50/70 transition-colors">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Aplikasi Desktop</h3>
              <p className="text-xs text-slate-400 mt-0.5">Windows / Mac / Linux</p>
            </div>

            {!isReadyForHubstaff ? (
              <button
                type="button"
                disabled
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Terkunci</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenDesktop}
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka di Desktop</span>
              </button>
            )}
          </div>

          {/* Kotak Aplikasi Mobile */}
          <div className="border border-slate-200/80 rounded-2xl p-6 text-center space-y-4 bg-slate-50/40 hover:bg-slate-50/70 transition-colors">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Aplikasi Mobile</h3>
              <p className="text-xs text-slate-400 mt-0.5">Android / iOS</p>
            </div>

            {!isReadyForHubstaff ? (
              <button
                type="button"
                disabled
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Terkunci</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenMobile}
                className="w-full max-w-xs mx-auto py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka di Mobile</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Card 2: Buka Hubstaff di Browser */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="text-slate-400">ⓘ</span>
            <span>Jika aplikasi tidak terbuka otomatis, gunakan Hubstaff web:</span>
          </p>
          <a
            href="https://app.hubstaff.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Buka Hubstaff di Browser</span>
          </a>
        </div>
      </div>

      {/* CARD 3: CARA MENGGUNAKAN HUBSTAFF */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>Cara Menggunakan Hubstaff</span>
        </div>

        <ol className="space-y-3.5 text-xs text-slate-700">
          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <span className="leading-relaxed">Buka aplikasi Hubstaff di laptop atau HP Anda</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <span className="leading-relaxed">Pilih project / organisasi Luzie Group</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <span className="leading-relaxed">Mulai timer (tracking) sebelum mengerjakan to-do list</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              4
            </span>
            <span className="leading-relaxed">Pastikan timer tetap berjalan selama jam kerja WFA berlangsung</span>
          </li>

          <li className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              5
            </span>
            <span className="leading-relaxed">
              Hentikan timer saat istirahat siang (12:00 WIB) dan saat selesai kerja (17:00 WIB)
            </span>
          </li>
        </ol>
      </div>

      {/* Modal Dialog Peluncuran Hubstaff Desktop/Mobile */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {showLaunchModal === 'desktop' ? (
                  <Laptop className="w-5 h-5 text-blue-600" />
                ) : (
                  <Smartphone className="w-5 h-5 text-blue-600" />
                )}
                <span>
                  {showLaunchModal === 'desktop' ? 'Membuka Hubstaff Desktop' : 'Hubstaff Mobile'}
                </span>
              </h3>
              <button
                onClick={() => setShowLaunchModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Permintaan peluncuran aplikasi Hubstaff telah dikirim ke sistem operasi Anda.
              </p>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-900">
                <div className="font-bold">Organisasi Terhubung:</div>
                <div>Luzie Group &bull; Divisi {currentUser.division}</div>
                <div className="mt-1 text-[11px] text-blue-700">Akun: {currentUser.email}</div>
              </div>
              <p className="text-[11px] text-slate-500">
                Jika aplikasi belum terinstall, Anda dapat mengunduhnya langsung dari situs resmi Hubstaff atau mengakses via web browser.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <a
                href="https://app.hubstaff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Hubstaff Web</span>
              </a>
              <button
                onClick={() => setShowLaunchModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
