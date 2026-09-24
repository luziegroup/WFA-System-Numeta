import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { compressImage } from '../lib/image';
import { ZoomMeetingInfo } from '../types';
import { getDailyMeetCompliance } from '../utils/zoomUtils';
import {
  Video,
  Zap,
  Info,
  Calendar,
  Clock,
  Send,
  ExternalLink,
  Copy,
  Trash2,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Plus,
  X,
  Radio,
  Sparkles,
  Camera,
  Sun,
  Sunset,
  CheckCircle2
} from 'lucide-react';

export const ZoomPagiView: React.FC = () => {
  const {
    zoomMeetings,
    createZoomMeeting,
    deleteZoomMeeting,
    addZoomPhoto,
    deleteZoomPhoto,
    joinZoomMeeting,
    currentUser,
    selectedDate,
    showToast,
    openImageModal,
    updateUser,
    wfaSettings
  } = useApp();

  // Meeting aktif milik koordinator ini untuk HARI INI, per sesi — dipakai untuk auto-pilih
  // tab yang belum dibuat & memperingatkan sebelum bikin jadwal ganda di sesi yang sama
  // (mis. lupa pindah tab ke "Siang" padahal sudah ada jadwal "Pagi" hari itu).
  const todaysActivePagi = zoomMeetings.find(
    (m) => m.leaderId === currentUser.id && m.date === selectedDate && m.status === 'aktif' && m.session === 'pagi'
  );
  const todaysActiveSiang = zoomMeetings.find(
    (m) => m.leaderId === currentUser.id && m.date === selectedDate && m.status === 'aktif' && m.session === 'siang'
  );

  // Form State
  const [title, setTitle] = useState('');
  // Kalau Meet Pagi hari ini sudah dijadwalkan tapi Siang belum, langsung arahkan tab ke
  // "Siang" supaya tidak lagi kejadian jadwal siang malah tersimpan sebagai "Pagi" (tab
  // lupa dipindah karena defaultnya selalu "Pagi").
  const [session, setSession] = useState<'pagi' | 'siang'>(() =>
    todaysActivePagi && !todaysActiveSiang ? 'siang' : 'pagi'
  );
  const [duration, setDuration] = useState<number>(60);
  const [date, setDate] = useState<string>(selectedDate || '2026-09-17');
  const [time, setTime] = useState<string>('08:00');
  const [agenda, setAgenda] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Link Google Meet milik koordinator ini sendiri (disimpan permanen di profilnya,
  // supaya tidak perlu tempel ulang tiap hari, dan tiap koordinator punya ruangan sendiri-sendiri).
  const [meetLink, setMeetLink] = useState<string>(
    currentUser.personalMeetLink || wfaSettings.companyZoomLink || ''
  );
  const [isSavingLink, setIsSavingLink] = useState(false);

  const handleSaveMeetLink = () => {
    if (!meetLink.trim()) {
      showToast('Tempel link Google Meet Anda terlebih dahulu', 'warning');
      return;
    }
    updateUser(currentUser.id, { personalMeetLink: meetLink.trim() });
    setIsSavingLink(true);
    showToast('Link Google Meet pribadi Anda tersimpan & akan dipakai setiap Meeting Pagi', 'success');
    setTimeout(() => setIsSavingLink(false), 1600);
  };

  // Upload Foto Modal/Input per meeting
  const [uploadMeetingId, setUploadMeetingId] = useState<string | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');

  // Sample photo options for fast testing
  const samplePhotos = [
    'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=500&auto=format&fit=crop&q=80',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Harap masukkan judul meeting', 'warning');
      return;
    }
    if (!meetLink.trim()) {
      showToast('Tempel link Google Meet Anda dulu di kolom atas', 'warning');
      return;
    }

    // Jaga-jaga terakhir: kalau sesi yang dipilih ternyata sudah ada jadwal aktif hari ini,
    // minta konfirmasi dulu supaya tidak tidak sengaja bikin jadwal ganda di sesi yang sama
    // (kasus paling sering: maksudnya bikin jadwal Siang, tapi tab masih di "Pagi").
    const duplicateInSameSession = session === 'pagi' ? todaysActivePagi : todaysActiveSiang;
    if (duplicateInSameSession) {
      const confirmed = window.confirm(
        `Anda sudah punya jadwal Meet ${session === 'pagi' ? 'Pagi' : 'Siang/Sore'} hari ini pukul ${duplicateInSameSession.time} WIB.\n\n` +
          `Tetap buat SATU LAGI di sesi ${session === 'pagi' ? 'Pagi' : 'Siang/Sore'} yang sama?\n\n` +
          `Klik Batal kalau maksud Anda sebenarnya untuk sesi ${session === 'pagi' ? 'Siang/Sore' : 'Pagi'} — lalu pilih tab yang benar dulu.`
      );
      if (!confirmed) return;
    }

    createZoomMeeting({
      title: title.trim(),
      date,
      time,
      duration,
      agenda: agenda.trim(),
      isUrgent,
      link: meetLink.trim(),
      session,
    });

    // Simpan juga sebagai link default supaya tidak perlu tempel ulang besok
    if (meetLink.trim() !== (currentUser.personalMeetLink || '')) {
      updateUser(currentUser.id, { personalMeetLink: meetLink.trim() });
    }

    // Reset form ke default (link Meet TIDAK direset — tetap dipakai untuk jadwal berikutnya)
    setTitle('');
    setAgenda('');
    setIsUrgent(false);
  };

  const handleCopy = (meeting: ZoomMeetingInfo) => {
    const text = `🔔 *Undangan Google Meet — Luzie Group*\n📌 *Judul:* ${meeting.title}\n📅 *Jadwal:* ${meeting.date} pukul ${meeting.time} WIB\n⏱ *Durasi:* ${meeting.duration} menit ${meeting.isUrgent ? '*(URGEN / PENTING)*' : ''}\n${meeting.agenda ? `📋 *Agenda:* ${meeting.agenda}\n` : ''}🔗 *Link Google Meet:* ${meeting.link}${meeting.passcode ? `\n🔑 *PIN:* ${meeting.passcode}` : ''}`;

    navigator.clipboard.writeText(text);
    setCopiedId(meeting.id);
    showToast('Tautan & rincian Google Meet berhasil disalin ke clipboard', 'info');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleFileUpload = (meetingId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    compressImage(file)
      .then((result) => addZoomPhoto(meetingId, result, file.name))
      .catch(() => showToast('Gagal memproses gambar, coba file lain', 'warning'));
    e.target.value = '';
  };

  const handleAddSamplePhoto = (meetingId: string, url: string) => {
    addZoomPhoto(meetingId, url, 'Foto dokumentasi briefing Zoom');
    setUploadMeetingId(null);
  };

  // Pisahkan meeting hari ini vs akan datang — hanya milik koordinator ini sendiri
  // (supaya tidak bisa lihat/kelola/batalkan jadwal Zoom milik koordinator lain)
  const myZoomMeetings = zoomMeetings.filter((m) => m.leaderId === currentUser.id);
  const todayMeetings = myZoomMeetings.filter((m) => m.date === selectedDate);
  const upcomingMeetings = myZoomMeetings
    .filter((m) => m.date > selectedDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Riwayat: meeting hari-hari sebelumnya, terbaru duluan — supaya bukti foto tiap hari tetap terlihat
  const historyMeetings = myZoomMeetings
    .filter((m) => m.date < selectedDate)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Status kepatuhan laporan Meet hari ini: sesi Pagi & Siang/Sore wajib dijadwalkan + ada bukti foto
  const compliance = getDailyMeetCompliance(zoomMeetings, currentUser.id, selectedDate);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Google Meet Tim</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Wajib ada jadwal &amp; laporan bukti foto untuk sesi Pagi dan Siang/Sore setiap hari kerja
        </p>
      </div>

      {/* CARD STATUS: Kepatuhan Laporan Meet Hari Ini (Pagi & Siang/Sore) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm mb-4">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>Status Laporan Meet Hari Ini</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {(['pagi', 'siang'] as const).map((sesi) => {
            const status = compliance[sesi];
            const label = sesi === 'pagi' ? 'Meet Pagi' : 'Meet Siang / Sore';
            const Icon = sesi === 'pagi' ? Sun : Sunset;

            let tone: 'done' | 'partial' | 'missing';
            let text: string;
            if (status.scheduled && status.hasPhotoProof) {
              tone = 'done';
              text = 'Terjadwal & bukti foto sudah diunggah';
            } else if (status.scheduled) {
              tone = 'partial';
              text = 'Terjadwal, tapi bukti foto belum diunggah';
            } else {
              tone = 'missing';
              text = 'Belum dibuat jadwalnya hari ini';
            }

            const toneClasses =
              tone === 'done'
                ? 'bg-emerald-50 border-emerald-200'
                : tone === 'partial'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-rose-50 border-rose-200';
            const iconToneClasses =
              tone === 'done' ? 'bg-emerald-500 text-white' : tone === 'partial' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white';
            const textToneClasses = tone === 'done' ? 'text-emerald-800' : tone === 'partial' ? 'text-amber-800' : 'text-rose-800';

            return (
              <div key={sesi} className={`p-4 rounded-xl border flex items-start gap-3 ${toneClasses}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconToneClasses}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-800">{label}</div>
                  <div className={`text-[11px] font-semibold mt-0.5 ${textToneClasses}`}>{text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CARD 0: LINK GOOGLE MEET PRIBADI KOORDINATOR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3.5">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Video className="w-4 h-4 text-blue-600" />
          <span>Link Google Meet Saya</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Tempel link ruangan Google Meet Anda sendiri di sini (bisa link permanen/nickname
          space, mis. <span className="font-mono text-[11px]">meet.google.com/lookup/xxxx</span>,
          atau link sekali pakai). Link ini otomatis dipakai setiap kali Anda membuat jadwal
          meeting baru — jadi tidak perlu tempel ulang tiap hari, dan tim Anda tidak akan bentrok
          dengan meeting koordinator lain karena masing-masing punya ruangan sendiri.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={meetLink}
            onChange={(e) => setMeetLink(e.target.value)}
            placeholder="https://meet.google.com/xxx-yyyy-zzz"
            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 font-mono"
          />
          <button
            type="button"
            onClick={handleSaveMeetLink}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors shrink-0"
          >
            {isSavingLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Tersimpan</span>
              </>
            ) : (
              <span>Simpan Link Saya</span>
            )}
          </button>
        </div>
      </div>

      {/* CARD 1: FORM BUAT JADWAL MEETING BARU */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
        {/* Header Form */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Video className="w-4 h-4 text-blue-600" />
            <span>Buat Jadwal Meeting Baru</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              meetLink.trim()
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{meetLink.trim() ? 'Link Meet Saya Siap Dipakai' : 'Belum Ada Link Meet'}</span>
          </div>
        </div>

        {/* Info Banner Google Meet */}
        <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl flex items-center gap-2.5 text-xs text-sky-900">
          <Info className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            <b>Meeting memakai link Google Meet pribadi Anda</b> (dari kolom di atas) — jadwal &amp;
            undangan langsung dikirim ke anggota tim Anda saja, tidak ke tim koordinator lain.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sesi Meeting: Pagi atau Siang/Sore */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              SESI MEETING
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSession('pagi');
                  if (!title.trim()) setTime('08:00');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  session === 'pagi'
                    ? 'bg-[#004080] text-white border-[#004080] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Meet Pagi</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSession('siang');
                  if (!title.trim()) setTime('16:00');
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  session === 'siang'
                    ? 'bg-[#004080] text-white border-[#004080] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Sunset className="w-3.5 h-3.5" />
                <span>Meet Siang / Sore</span>
              </button>
            </div>

            {/* Peringatan: sesi yang sedang dipilih ternyata SUDAH ada jadwal aktif hari ini —
                supaya koordinator sadar sebelum tidak sengaja bikin jadwal ganda di sesi yang
                sama (dan lupa memang maksudnya untuk sesi yang satunya lagi). */}
            {((session === 'pagi' && todaysActivePagi) || (session === 'siang' && todaysActiveSiang)) && (
              <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Anda sudah punya jadwal <strong>{session === 'pagi' ? 'Meet Pagi' : 'Meet Siang / Sore'}</strong> hari
                  ini pukul <strong>{(session === 'pagi' ? todaysActivePagi : todaysActiveSiang)?.time} WIB</strong>.
                  Kalau maksud Anda membuat jadwal untuk sesi{' '}
                  <strong>{session === 'pagi' ? 'Siang / Sore' : 'Pagi'}</strong>, klik tab{' '}
                  <strong>"{session === 'pagi' ? 'Meet Siang / Sore' : 'Meet Pagi'}"</strong> di atas terlebih dahulu.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Judul Meeting */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                JUDUL MEETING
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Koordinasi Pagi Harian"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
                required
              />
            </div>

            {/* Durasi */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                DURASI
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
              >
                <option value={15}>15 menit</option>
                <option value={30}>30 menit</option>
                <option value={45}>45 menit</option>
                <option value={60}>60 menit</option>
                <option value={90}>90 menit</option>
                <option value={120}>120 menit</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tanggal */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                TANGGAL
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
                  required
                />
              </div>
            </div>

            {/* Jam Mulai */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                JAM MULAI
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono font-medium text-slate-800"
                  required
                />
              </div>
            </div>
          </div>

          {/* Agenda / Catatan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              AGENDA / CATATAN (OPSIONAL)
            </label>
            <textarea
              rows={2}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Tulis agenda meeting atau hal-hal yang akan dibahas..."
              className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 leading-relaxed"
            />
          </div>

          {/* Pilihan: Zoom Urgen atau Meeting Biasa */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>
                  Tandai sebagai <b>Meeting Penting / Urgen</b>{' '}
                  <span className="text-slate-400 font-normal">(muncul di dashboard karyawan)</span>
                </span>
              </label>
            </div>

            {/* Visual Pill Indicator */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsUrgent(false)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  !isUrgent
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Meeting Biasa
              </button>
              <button
                type="button"
                onClick={() => setIsUrgent(true)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  isUrgent
                    ? 'bg-rose-600 text-white shadow-xs animate-pulse'
                    : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                }`}
              >
                <span>🚨 Urgen / Penting</span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#035388] hover:bg-[#003e68] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-900/10 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Buat &amp; Sebarkan ke Tim</span>
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: MEETING HARI INI */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Meeting Hari Ini ({todayMeetings.length})</span>
        </div>

        {todayMeetings.length === 0 ? (
          <div className="text-center py-10 text-slate-400 space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-xs">Belum ada meeting hari ini</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todayMeetings.map((m) => renderMeetingCard(m))}
          </div>
        )}
      </div>

      {/* CARD 3: RIWAYAT MEETING & BUKTI FOTO (hari-hari sebelumnya) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
          <Camera className="w-4 h-4 text-violet-600" />
          <span>Riwayat Meeting &amp; Bukti Foto ({historyMeetings.length})</span>
        </div>
        <p className="text-[11px] text-slate-400 -mt-2">
          Rekap Meet Pagi &amp; Siang/Sore hari-hari sebelumnya, lengkap dengan bukti fotonya.
        </p>

        {historyMeetings.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Belum ada riwayat meeting hari sebelumnya.
          </div>
        ) : (
          <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
            {historyMeetings.map((m) => renderMeetingCard(m))}
          </div>
        )}
      </div>

      {/* CARD 4: AKAN DATANG */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
          <Calendar className="w-4 h-4 text-amber-600" />
          <span>Akan Datang ({upcomingMeetings.length})</span>
        </div>

        {upcomingMeetings.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Tidak ada jadwal meeting mendatang.
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingMeetings.map((m) => renderMeetingCard(m))}
          </div>
        )}
      </div>
    </div>
  );

  // Sub-komponen render Meeting Card (identik dengan gambar)
  function renderMeetingCard(meeting: ZoomMeetingInfo) {
    const isUrgentMeeting = meeting.isUrgent;

    return (
      <div
        key={meeting.id}
        className={`p-5 rounded-2xl border transition-all ${
          isUrgentMeeting
            ? 'bg-[#fff5f5] border-rose-200 text-slate-800 shadow-xs'
            : 'bg-white border-slate-200 text-slate-800 hover:shadow-xs'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          {/* Sisi Kiri: Detail Meeting */}
          <div className="space-y-2.5 flex-1 min-w-0">
            {/* Badges Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                  meeting.session === 'pagi'
                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                    : 'bg-orange-100 text-orange-800 border-orange-300'
                }`}
              >
                {meeting.session === 'pagi' ? <Sun className="w-3 h-3" /> : <Sunset className="w-3 h-3" />}
                <span>{meeting.session === 'pagi' ? 'Meet Pagi' : 'Meet Siang/Sore'}</span>
              </span>

              <span className="text-[11px] font-mono font-bold text-slate-700 bg-white/90 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                {meeting.date} &bull; {meeting.time}
              </span>

              {meeting.isUrgent ? (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-600" />
                  <span>Penting</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Meeting Biasa
                </span>
              )}

              <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-300">
                Aktif
              </span>
            </div>

            {/* Title & Agenda */}
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {meeting.title}
              </h3>
              {meeting.agenda && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {meeting.agenda}
                </p>
              )}
            </div>

            {/* Link & PIN Box */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-blue-700 font-mono text-[11px] break-all">
                <span className="shrink-0">🔗</span>
                <a
                  href={meeting.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {meeting.link}
                </a>
              </div>
              {(meeting.passcode || (meeting.meetingId && meeting.meetingId !== '-')) && (
                <div className="flex items-center gap-2 text-[11px] text-slate-700 font-mono flex-wrap">
                  {meeting.passcode && (
                    <>
                      <span>🔑</span>
                      <span>
                        PIN: <b>{meeting.passcode}</b>
                      </span>
                    </>
                  )}
                  {meeting.meetingId && meeting.meetingId !== '-' && (
                    <>
                      {meeting.passcode && <span className="text-slate-400">&bull;</span>}
                      <span className="text-slate-500">Kode Rapat: {meeting.meetingId}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bukti Foto Terunggah (Pagi / Siang) */}
            <div className="pt-2 border-t border-slate-200/60 space-y-2">
              <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>{meeting.photos.length} bukti foto terunggah (Pagi/Siang)</span>
              </div>

              {/* Grid Thumbnail Foto */}
              <div className="flex items-center gap-3 flex-wrap">
                {meeting.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group bg-white p-1 rounded-xl border border-slate-200 shadow-2xs"
                  >
                    <img
                      src={photo.url}
                      alt="Bukti foto"
                      onClick={() => openImageModal(photo.url, `Bukti Foto: ${meeting.title}`)}
                      className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    />
                    <button
                      onClick={() => deleteZoomPhoto(meeting.id, photo.id)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] hover:bg-rose-700 transition-colors shadow-xs"
                      title="Hapus foto"
                    >
                      <X className="w-3 h-3 stroke-[3]" />
                    </button>
                    <div className="text-[9px] text-slate-400 text-center mt-1 font-mono">
                      {photo.timestamp}
                    </div>
                  </div>
                ))}

                {/* Tombol Tambah Foto */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tambah Foto Lagi (Pagi/Siang)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(meeting.id, e)}
                      className="hidden"
                    />
                  </label>

                  {/* Quick sample button */}
                  {meeting.photos.length === 0 && (
                    <button
                      type="button"
                      onClick={() => handleAddSamplePhoto(meeting.id, samplePhotos[0])}
                      className="text-[11px] text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      + Contoh Foto Standup
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Action Buttons */}
          <div className="flex sm:flex-row lg:flex-col items-center gap-2 shrink-0">
            {/* Tombol Buka Google Meet */}
            <a
              href={meeting.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => joinZoomMeeting(meeting.id)}
              className="flex-1 lg:w-28 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#035388] hover:bg-[#003f6b] text-white font-bold text-xs transition-colors shadow-xs"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Buka</span>
            </a>

            {/* Tombol Salin */}
            <button
              onClick={() => handleCopy(meeting)}
              className="flex-1 lg:w-28 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs transition-colors shadow-2xs"
            >
              {copiedId === meeting.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salin</span>
                </>
              )}
            </button>

            {/* Tombol Hapus */}
            <button
              onClick={() => {
                if (window.confirm(`Hapus meeting "${meeting.title}"?`)) {
                  deleteZoomMeeting(meeting.id);
                }
              }}
              className="flex-1 lg:w-28 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-300 text-rose-600 font-bold text-xs transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
};
