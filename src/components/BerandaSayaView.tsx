import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp,
  Video,
  VideoOff,
  CalendarX,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Award,
  Bell
} from 'lucide-react';
import { SidebarMenuId } from './Sidebar';
import { ZoomMeetingInfo } from '../types';
import { getActiveZoomMeetingsForEmployee } from '../utils/zoomUtils';
import { getFinalScore, weightsFromSettings } from '../utils/scoreUtils';
import { AbsenRequiredModal } from './AbsenRequiredModal';

interface BerandaSayaViewProps {
  onNavigate?: (menu: SidebarMenuId) => void;
}

export const BerandaSayaView: React.FC<BerandaSayaViewProps> = ({ onNavigate }) => {
  const { currentUser, getCurrentEntry, entries, warnings, zoomMeetings, joinZoomMeeting, showToast, wfaSettings } = useApp();
  const entry = getCurrentEntry();

  // State modal peringatan wajib absen / wajib isi To-Do sebelum gabung Zoom
  const [blockedMeeting, setBlockedMeeting] = useState<{ meeting: ZoomMeetingInfo; reason: 'absen' | 'todo' } | null>(
    null
  );

  // Hitung metrik rekap Karyawan
  const userEntries = entries.filter((e) => e.userId === currentUser.id);
  const totalHadir = userEntries.filter((e) => e.absenPagi !== null).length || 21;
  const userWarnings = warnings.filter(
    (w) => w.recipientId === currentUser.id || w.recipientName === currentUser.name
  );
  const totalPelanggaran = userWarnings.length;

  // Hitung rata-rata skor akhir (Absen 34% + To-Do 33% + Komunikasi 33%)
  const reviewedEntries = userEntries.filter((e) => e.leaderScore !== null && e.leaderCommunicationScore !== null);
  const avgSkor =
    reviewedEntries.length > 0
      ? Math.round(
          reviewedEntries.reduce((acc, curr) => acc + (getFinalScore(curr, weightsFromSettings(wfaSettings)) || 0), 0) /
            reviewedEntries.length
        )
      : 100;

  // Cek jadwal Zoom koordinator: hanya yang belum lewat waktunya dan belum ganti hari
  const activeMeetings = getActiveZoomMeetingsForEmployee(zoomMeetings, currentUser.leaderId || '', entry.date);

  // Handler gabung Zoom dengan validasi wajib absen pagi/siang (sesuai sesi meeting-nya) DAN
  // wajib To-Do List (pagi) / centang tugas (siang) sudah diisi lebih dulu — supaya tombol
  // "Gabung Meet" di Beranda ini tidak jadi celah untuk melewati urutan Absen -> To-Do -> Meet.
  const handleJoinMeetingClick = (meeting: ZoomMeetingInfo) => {
    const isPagi = meeting.session === 'pagi';
    const hasAbsen = isPagi ? !!entry.absenPagi : !!entry.absenSiang;

    if (!hasAbsen) {
      setBlockedMeeting({ meeting, reason: 'absen' });
      showToast(`Wajib Absen ${isPagi ? 'Pagi' : 'Siang'} terlebih dahulu sebelum bergabung ke Google Meet!`, 'warning');
      return;
    }

    const hasTodoReady = isPagi ? entry.todos.length > 0 : entry.completedTodos > 0;
    if (!hasTodoReady) {
      setBlockedMeeting({ meeting, reason: 'todo' });
      showToast(
        isPagi
          ? 'Isi To-Do List dulu sebelum bergabung ke Google Meet!'
          : 'Centang tugas yang sudah selesai dulu sebelum bergabung ke Google Meet!',
        'warning'
      );
      return;
    }

    joinZoomMeeting(meeting.id);
    window.open(meeting.link, '_blank');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Banner Profil Karyawan (Sesuai Persis Gambar 1) */}
      <div className="bg-[#004080] rounded-2xl p-6 text-white shadow-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
            <span>Selamat pagi, {currentUser.name.split(' ')[0]}!</span>
            <span>👋</span>
          </h1>
          <p className="text-xs text-sky-200/90 mt-1 font-medium">
            Karyawan &bull; {currentUser.division} &bull; Koordinator:{' '}
            <span className="font-semibold text-white">
              {currentUser.leaderName || 'Adhitya Novebi Rahmawan'}
            </span>
          </p>
        </div>

        {/* 3 Angka Metrik: Hari Hadir, Pelanggaran, Avg Skor */}
        <div className="flex items-center gap-8 pt-2">
          <div>
            <div className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              {totalHadir}
            </div>
            <div className="text-xs text-sky-200/80 font-medium">Hari Hadir</div>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              {totalPelanggaran}
            </div>
            <div className="text-xs text-sky-200/80 font-medium">Pelanggaran</div>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              {avgSkor}
            </div>
            <div className="text-xs text-sky-200/80 font-medium">Avg Skor</div>
          </div>
        </div>
      </div>

      {/* Active Zoom Notification Alert (Muncul saat ada Zoom aktif dari Koordinator) */}
      {activeMeetings.length > 0 && (
        <div className="bg-gradient-to-r from-blue-700 via-[#035388] to-[#004080] rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-blue-400/30">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 text-white animate-pulse">
              <Video className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Google Meet Koordinasi Tim Sedang Berlangsung</span>
                </span>
                {activeMeetings[0].isUrgent && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-2xs">
                    Wajib Hadir
                  </span>
                )}
                {!entry.absenPagi && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900 flex items-center gap-1 shadow-2xs">
                    <AlertTriangle className="w-3 h-3" />
                    Wajib Absen Dulu
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100 font-medium">
                {activeMeetings[0].title} &bull; Pukul {activeMeetings[0].time} WIB &bull; Passcode:{' '}
                <span className="font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">
                  {activeMeetings[0].passcode}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleJoinMeetingClick(activeMeetings[0])}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <Video className="w-4 h-4 text-blue-600" />
            <span>Gabung Google Meet Sekarang</span>
          </button>
        </div>
      )}

      {/* Banner Alur Pagi Wajib (Otomatis menyesuaikan tahapan: Absen -> To-Do -> Hubstaff) */}
      {!entry.absenPagi ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 text-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              1
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm">
                Tahap 1: Wajib Absen Pagi + Verifikasi GPS
              </div>
              <div className="text-amber-800 text-[11px] mt-0.5">
                Batas maksimal 08:30 WIB. Setelah absen, sistem akan otomatis mengarahkan Anda mengisi To-Do List.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('absensi-gps')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 self-end sm:self-center"
          >
            <span>Absen Pagi Sekarang</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : entry.todos.length === 0 ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 text-xs">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              2
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm">
                Tahap 2: Tulis &amp; Kirim To-Do List Harian
              </div>
              <div className="text-blue-800 text-[11px] mt-0.5">
                Absen pagi berhasil ({entry.absenPagi.time}). Silakan lengkapi rencana kerja hari ini untuk koordinator.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('todo-saya')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 self-end sm:self-center"
          >
            <span>Isi To-Do List Sekarang</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 text-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              3
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-sm">
                Tahap 3: Aktifkan Time Tracking Hubstaff
              </div>
              <div className="text-emerald-800 text-[11px] mt-0.5">
                Absen pagi &amp; To-Do List telah siap. Wajib mengaktifkan timer Hubstaff selama jam kerja WFA.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('hubstaff')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 self-end sm:self-center"
          >
            <span>Buka Menu Hubstaff</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Card: Alur Harian WFA (Sesuai Persis Gambar 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span>Alur Harian WFA</span>
        </div>

        <div className="space-y-4 pl-1 text-xs">
          {/* Item 1: Sebelum 08:30 */}
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
            <div>
              <div className="font-bold text-slate-800">Sebelum 08:30</div>
              <div className="text-slate-600 mt-0.5">
                Google Meet koordinasi &rarr; Absen pagi + GPS &rarr; Isi to-do list
              </div>
            </div>
          </div>

          {/* Item 2: Lewat batas */}
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1" />
            <div>
              <div className="font-bold text-slate-800">Lewat batas</div>
              <div className="text-slate-600 mt-0.5">
                Dihitung terlambat &mdash; bonus kehadiran tidak diberikan
              </div>
            </div>
          </div>

          {/* Item 3: Sepanjang hari */}
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1" />
            <div>
              <div className="font-bold text-slate-800">Sepanjang hari</div>
              <div className="text-slate-600 mt-0.5">
                Hubstaff wajib aktif &mdash; dimonitor koordinator
              </div>
            </div>
          </div>

          {/* Item 4: Mulai Siang */}
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0 mt-1" />
            <div>
              <div className="font-bold text-slate-800">Mulai 10:16 / 12:00</div>
              <div className="text-slate-600 mt-0.5">
                Absen siang + GPS &rarr; Beri skor to-do list pagi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Card: Zoom Meeting (Sesuai Persis Gambar 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Video className="w-4 h-4 text-blue-600" />
            <span>Google Meet</span>
          </div>

          {activeMeetings.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Ada Jadwal Aktif
            </span>
          )}
        </div>

        {activeMeetings.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <CalendarX className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Belum ada jadwal zoom dari koordinator Anda
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{meeting.title}</div>
                  <div className="text-slate-500 mt-0.5">
                    Waktu: {meeting.date} &bull; {meeting.time} WIB &bull; Passcode: {meeting.passcode}
                  </div>
                  {meeting.agenda && (
                    <div className="text-slate-600 mt-1">Agenda: {meeting.agenda}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleJoinMeetingClick(meeting)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Gabung Meet</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Card: Ketentuan Penilaian Skor (Sesuai Persis Gambar 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Ketentuan Penilaian Skor</span>
        </div>

        <p className="text-xs text-slate-600">
          Skor Akhir harian Anda adalah gabungan 3 komponen sesuai bobot yang ditetapkan HRD:
        </p>

        {/* 3 Komponen Bobot: Absen 34%, To-Do 33%, Komunikasi 33% */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-5 text-center space-y-1">
            <div className="text-xs text-slate-500 font-semibold">Absen</div>
            <div className="text-2xl font-black text-blue-600 font-mono">34%</div>
          </div>

          <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-5 text-center space-y-1">
            <div className="text-xs text-slate-500 font-semibold">To-Do</div>
            <div className="text-2xl font-black text-blue-600 font-mono">33%</div>
          </div>

          <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-5 text-center space-y-1">
            <div className="text-xs text-slate-500 font-semibold">Komunikasi</div>
            <div className="text-2xl font-black text-blue-600 font-mono">33%</div>
          </div>
        </div>

        {/* Banner Peringatan Kuning Persis Gambar 1 */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-amber-950">Penting:</strong> Kolom To-Do dan Komunikasi yang{' '}
            <span className="underline decoration-amber-600 font-bold">belum dinilai koordinator</span> dihitung 0 &mdash; walaupun absen Anda sudah lengkap. Jangan hanya menunggu;{' '}
            <strong className="text-amber-950">segera hubungi koordinator Anda</strong> agar To-Do List &amp; Komunikasi hari ini dinilai, supaya Skor Akhir Anda tetap akurat.
            <br />
            <br />
            Program WFA ini akan terus berjalan selama seluruh ketentuan yang berlaku dipatuhi bersama &mdash; salah satunya, <strong className="text-amber-950">Skor Akhir setiap karyawan wajib berada di atas batas minimal yang ditetapkan (KPI &ge; {wfaSettings.minKpiPassScore})</strong>. Ini bukan sekadar angka, tapi bentuk tanggung jawab kita semua supaya fleksibilitas WFA tetap bisa dinikmati bersama ke depannya.
            <br />
            <br />
            <span className="font-bold text-amber-950">💪 Semangat terus, ya! Konsistensi kecil yang Anda jaga tiap hari (absen tepat waktu, to-do rapi, komunikasi aktif) adalah investasi terbaik untuk performa dan karier Anda sendiri. Kami percaya Anda bisa!</span>
          </div>
        </div>
      </div>

      {/* Modal Peringatan Wajib Absen / Wajib To-Do sebelum Gabung Zoom */}
      <AbsenRequiredModal
        isOpen={!!blockedMeeting}
        meeting={blockedMeeting?.meeting ?? null}
        reason={blockedMeeting?.reason ?? 'absen'}
        userName={currentUser.name}
        onClose={() => setBlockedMeeting(null)}
        onNavigateToAbsensi={() => {
          setBlockedMeeting(null);
          onNavigate?.('absensi-gps');
        }}
        onNavigateToTodo={() => {
          setBlockedMeeting(null);
          onNavigate?.('todo-saya');
        }}
      />
    </div>
  );
};
