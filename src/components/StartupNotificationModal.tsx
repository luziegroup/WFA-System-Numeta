import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, Video, MapPin, CheckCheck, X, Clock, ArrowRight, Sun, Sunset, ListChecks } from 'lucide-react';
import { SidebarMenuId } from './Sidebar';
import { ZoomMeetingInfo } from '../types';

interface StartupNotificationModalProps {
  onNavigate: (menu: SidebarMenuId) => void;
}

type Step = 'teguran' | 'zoom-pagi' | 'zoom-siang' | 'todo-pagi' | 'todo-siang' | null;

/**
 * Popup yang muncul di awal (begitu karyawan login / membuka aplikasi) untuk:
 * 1. Teguran yang belum dibaca -> wajib ditandai "Sudah Saya Baca" dulu (memastikan sudah dibaca).
 * 2. Jadwal Meet Pagi hari ini yang jatuh sebelum karyawan absen pagi -> diarahkan ke halaman Absen Pagi.
 * 3. Jadwal Meet Siang/Sore hari ini yang jatuh sebelum karyawan absen siang -> diarahkan ke halaman Absen Siang.
 *
 * Hanya berlaku untuk role karyawan, dan hanya tampil sekali per sesi login (per tanggal berjalan).
 */
export const StartupNotificationModal: React.FC<StartupNotificationModalProps> = ({ onNavigate }) => {
  const { currentUser, warnings, zoomMeetings, entries, selectedDate, markWarningRead, wfaSettings } = useApp();

  const [step, setStep] = useState<Step>(null);

  // Teguran yang dikirim ke karyawan ini dan belum ditandai dibaca
  const unreadWarnings = useMemo(
    () =>
      warnings.filter(
        (w) =>
          (w.recipientId === currentUser.id || w.recipientName === currentUser.name) && w.status === 'terkirim'
      ),
    [warnings, currentUser.id, currentUser.name]
  );

  // Entri absensi karyawan ini untuk hari ini
  const myTodayEntry = useMemo(
    () => entries.find((e) => e.userId === currentUser.id && e.date === selectedDate),
    [entries, currentUser.id, selectedDate]
  );
  const hasAbsenPagi = !!myTodayEntry?.absenPagi;
  const hasAbsenSiang = !!myTodayEntry?.absenSiang;

  // Meeting aktif hari ini dari koordinator/leader karyawan ini sendiri (bukan tim lain), per sesi
  const todayZoomMeetings = useMemo(
    () =>
      zoomMeetings.filter(
        (z) => z.date === selectedDate && z.status === 'aktif' && z.leaderId === currentUser.leaderId
      ),
    [zoomMeetings, selectedDate, currentUser.leaderId]
  );
  const pagiMeeting: ZoomMeetingInfo | undefined = todayZoomMeetings.find((z) => z.session === 'pagi');
  const siangMeeting: ZoomMeetingInfo | undefined = todayZoomMeetings.find((z) => z.session === 'siang');

  // Kunci "sudah dilihat" diikat ke ID meeting spesifik (bukan cuma tanggal+sesi), supaya kalau
  // koordinator membuat jadwal BARU di tengah sesi (mis. baru bikin Meet Siang jam 1 siang saat
  // karyawan sudah login dari pagi), popupnya tetap otomatis muncul untuk meeting yang baru itu.
  const storageKeyPagi = pagiMeeting
    ? `wfa_startup_notif_seen_${currentUser.id}_${pagiMeeting.id}`
    : '';
  const storageKeySiang = siangMeeting
    ? `wfa_startup_notif_seen_${currentUser.id}_${siangMeeting.id}`
    : '';

  // Pengingat To-Do List — supaya karyawan yang absen lalu langsung "kabur" ke tab Google Meet
  // (fokus teralihkan) tidak lupa mengisi/mencentang To-Do List-nya. Hanya dipicu di hari yang
  // memang ada jadwal Meet, sesuai laporan: risiko lupa isi to-do paling besar justru saat ada
  // meeting yang menyita perhatian.
  const totalTodosToday = myTodayEntry?.totalTodos ?? 0;
  const completedTodosToday = myTodayEntry?.completedTodos ?? 0;
  const minTodos = wfaSettings.minTodosPerDay || 3;
  const belumIsiTodoPagi = pagiMeeting && hasAbsenPagi && totalTodosToday < minTodos;
  const belumCentangTodoSiang = siangMeeting && hasAbsenSiang && totalTodosToday > 0 && completedTodosToday === 0;
  const storageKeyTodoPagi = `wfa_startup_notif_seen_todo-pagi_${currentUser.id}_${selectedDate}`;
  const storageKeyTodoSiang = `wfa_startup_notif_seen_todo-siang_${currentUser.id}_${selectedDate}`;

  const hasSeen = (key: string) => {
    if (!key) return false;
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };
  const markSeen = (key: string) => {
    if (!key) return;
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // abaikan jika sessionStorage tidak tersedia
    }
  };

  // Tentukan langkah selanjutnya yang perlu ditampilkan (dipanggil ulang tiap satu langkah selesai)
  const resolveNextStep = (): Step => {
    if (pagiMeeting && !hasAbsenPagi && !hasSeen(storageKeyPagi)) return 'zoom-pagi';
    if (siangMeeting && !hasAbsenSiang && !hasSeen(storageKeySiang)) return 'zoom-siang';
    if (belumIsiTodoPagi && !hasSeen(storageKeyTodoPagi)) return 'todo-pagi';
    if (belumCentangTodoSiang && !hasSeen(storageKeyTodoSiang)) return 'todo-siang';
    return null;
  };

  // Tentukan langkah yang perlu ditampilkan — dievaluasi ulang otomatis (bukan cuma sekali saat
  // login) setiap kali ada teguran baru, atau koordinator membuat jadwal Meet Pagi/Siang baru,
  // supaya karyawan yang sedang online tetap dapat notifikasinya secara real-time.
  useEffect(() => {
    if (currentUser.role !== 'karyawan') return;

    if (unreadWarnings.length > 0) {
      setStep('teguran');
    } else {
      setStep(resolveNextStep());
    }
    // Sengaja tidak menyertakan seluruh objek meeting/entries di dependency (hanya ID-nya),
    // supaya modal tidak muncul berulang setiap kali data lain (mis. toast) berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser.id,
    currentUser.role,
    selectedDate,
    unreadWarnings.length,
    pagiMeeting?.id,
    siangMeeting?.id,
    hasAbsenPagi,
    hasAbsenSiang,
    belumIsiTodoPagi,
    belumCentangTodoSiang,
  ]);

  const handleReadAllWarnings = () => {
    unreadWarnings.forEach((w) => markWarningRead(w.id));
    setStep(resolveNextStep());
  };

  const handleCloseZoomPagi = () => {
    markSeen(storageKeyPagi);
    setStep(resolveNextStep());
  };

  const handleGoAbsenPagi = () => {
    markSeen(storageKeyPagi);
    setStep(null);
    onNavigate('absensi-gps');
  };

  const handleCloseZoomSiang = () => {
    markSeen(storageKeySiang);
    setStep(null);
  };

  const handleGoAbsenSiang = () => {
    markSeen(storageKeySiang);
    setStep(null);
    onNavigate('absensi-gps');
  };

  const handleCloseTodoPagi = () => {
    markSeen(storageKeyTodoPagi);
    setStep(resolveNextStep());
  };

  const handleGoTodoPagi = () => {
    markSeen(storageKeyTodoPagi);
    setStep(null);
    onNavigate('todo-saya');
  };

  const handleCloseTodoSiang = () => {
    markSeen(storageKeyTodoSiang);
    setStep(null);
  };

  const handleGoTodoSiang = () => {
    markSeen(storageKeyTodoSiang);
    setStep(null);
    onNavigate('todo-saya');
  };

  if (currentUser.role !== 'karyawan' || step === null) return null;

  return (
    <div
      id="startup-notification-backdrop"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      {step === 'teguran' && (
        <div className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-rose-200">
          <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">
                {unreadWarnings.length} Teguran Baru Untuk Anda
              </h3>
              <p className="text-[11px] text-rose-100/90 mt-0.5">
                Mohon dibaca terlebih dahulu sebelum melanjutkan
              </p>
            </div>
          </div>

          <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
            {unreadWarnings.map((w) => (
              <div key={w.id} className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rose-800">{w.title}</span>
                  <span className="text-[10px] text-rose-500 shrink-0">{w.date} &bull; {w.createdAt}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{w.message}</p>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Dari: <strong className="text-slate-600">{w.senderName}</strong>
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/70">
            <button
              onClick={handleReadAllWarnings}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Saya Sudah Membaca {unreadWarnings.length > 1 ? 'Semua Teguran' : 'Teguran Ini'}</span>
            </button>
          </div>
        </div>
      )}

      {step === 'zoom-pagi' && pagiMeeting && (
        <div className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-sky-200">
          <button
            onClick={handleCloseZoomPagi}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] px-5 py-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">
                {pagiMeeting.isUrgent ? '🚨 Google Meet Pagi Urgen' : 'Ada Jadwal Google Meet Pagi'}
              </h3>
              <p className="text-[11px] text-sky-100/90 mt-0.5">{pagiMeeting.title}</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>
                Pukul <strong className="text-slate-800">{pagiMeeting.time} WIB</strong> &bull; Host:{' '}
                <strong className="text-slate-800">{pagiMeeting.hostName || 'Koordinator Tim'}</strong>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Anda <strong>belum melakukan absen pagi</strong> hari ini. Lakukan absen dahulu sebelum bergabung ke
                Google Meet.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <button
              onClick={handleCloseZoomPagi}
              className="px-4 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
            >
              Nanti Saja
            </button>
            <button
              onClick={handleGoAbsenPagi}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#004080] hover:bg-[#0060b5] text-white font-bold text-xs transition-colors shadow-sm"
            >
              <span>Absen Pagi Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'zoom-siang' && siangMeeting && (
        <div className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-orange-200">
          <button
            onClick={handleCloseZoomSiang}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Sunset className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">
                {siangMeeting.isUrgent ? '🚨 Google Meet Siang/Sore Urgen' : 'Ada Jadwal Google Meet Siang/Sore'}
              </h3>
              <p className="text-[11px] text-orange-100/90 mt-0.5">{siangMeeting.title}</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              <span>
                Pukul <strong className="text-slate-800">{siangMeeting.time} WIB</strong> &bull; Host:{' '}
                <strong className="text-slate-800">{siangMeeting.hostName || 'Koordinator Tim'}</strong>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Anda <strong>belum melakukan absen siang</strong> hari ini. Lakukan absen dahulu sebelum bergabung ke
                Google Meet.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <button
              onClick={handleCloseZoomSiang}
              className="px-4 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
            >
              Nanti Saja
            </button>
            <button
              onClick={handleGoAbsenSiang}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <span>Absen Siang Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'todo-pagi' && pagiMeeting && (
        <div className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-emerald-200">
          <button
            onClick={handleCloseTodoPagi}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Jangan Lupa Isi To-Do List Pagi</h3>
              <p className="text-[11px] text-emerald-100/90 mt-0.5">Sebelum lanjut ke Google Meet</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <ListChecks className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Anda baru absen pagi & ada jadwal Google Meet hari ini, tapi rencana To-Do List Anda baru{' '}
                <strong>{totalTodosToday} dari minimal {minTodos} tugas</strong>. Isi dulu sebelum masuk meeting
                supaya tidak lupa setelahnya.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <button
              onClick={handleCloseTodoPagi}
              className="px-4 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
            >
              Nanti Saja
            </button>
            <button
              onClick={handleGoTodoPagi}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <span>Isi To-Do List Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'todo-siang' && siangMeeting && (
        <div className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-emerald-200">
          <button
            onClick={handleCloseTodoSiang}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Jangan Lupa Centang To-Do List</h3>
              <p className="text-[11px] text-emerald-100/90 mt-0.5">Sebelum lanjut ke Google Meet</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <ListChecks className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Anda baru absen siang & ada jadwal Google Meet hari ini, tapi belum ada satu pun tugas yang
                dicentang & dilampirkan buktinya. Centang dulu tugas yang sudah selesai sebelum masuk meeting.
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <button
              onClick={handleCloseTodoSiang}
              className="px-4 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
            >
              Nanti Saja
            </button>
            <button
              onClick={handleGoTodoSiang}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <span>Centang To-Do List Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
