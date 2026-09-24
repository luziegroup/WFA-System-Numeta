import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { compressImage } from '../lib/image';
import { TodoItem } from '../types';
import { SidebarMenuId } from './Sidebar';
import { getFinalScore, getAbsenScore, weightsFromSettings } from '../utils/scoreUtils';
import { getActiveZoomMeetingsForEmployee } from '../utils/zoomUtils';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  ExternalLink,
  AlertCircle,
  Sun,
  Sunset,
  MapPin,
  FileText,
  Sparkles,
  Award,
  MessageSquareQuote,
  ShieldCheck,
  Eye,
  Video,
  Clock,
  Zap,
  Play,
  Bell,
  TrendingUp,
  Navigation,
  Compass
} from 'lucide-react';

interface KaryawanViewProps {
  initialMode?: SidebarMenuId;
  onNavigate?: (menu: SidebarMenuId) => void;
}

export const KaryawanView: React.FC<KaryawanViewProps> = ({ initialMode = 'todo-saya', onNavigate }) => {
  const {
    currentUser,
    getCurrentEntry,
    doAbsenPagi,
    addTodo,
    deleteTodo,
    toggleTodoCentang,
    updateTodoProof,
    doAbsenSiang,
    openImageModal,
    zoomMeetings,
    joinZoomMeeting,
    selectedDate,
    wfaSettings
  } = useApp();

  const entry = getCurrentEntry();

  // Hanya jadwal Zoom dari koordinator/leader karyawan ini sendiri (bukan tim lain)
  const myZoomMeetings = getActiveZoomMeetingsForEmployee(zoomMeetings, currentUser.leaderId || '', selectedDate);

  // Mode tab view jika ingin fokus
  const [activeTabFocus, setActiveTabFocus] = useState<'all' | 'absen' | 'todo'>(
    initialMode === 'absensi-gps' ? 'absen' : initialMode === 'todo-saya' ? 'todo' : 'all'
  );

  // Form Absen Pagi
  const [pagiLoc, setPagiLoc] = useState('Rumah (WFA) - Jakarta Selatan');
  const [pagiNotes, setPagiNotes] = useState('');
  const [gpsCoordinates, setGpsCoordinates] = useState('-6.2088° S, 106.8456° E');

  // Form Tambah To-Do Pagi
  const [newTask, setNewTask] = useState('');
  const [newTarget, setNewTarget] = useState('');

  // Form Absen Siang
  const [siangLoc, setSiangLoc] = useState('Rumah (WFA) - Jakarta Selatan');
  const [siangNotes, setSiangNotes] = useState('');
  const [showSiangModal, setShowSiangModal] = useState(false);

  // State untuk editing bukti per item
  const [editingProofId, setEditingProofId] = useState<string | null>(null);
  const [inputLink, setInputLink] = useState('');

  // Handle file upload bukti foto (Convert to base64)
  const handlePhotoUpload = (todoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 5MB');
      return;
    }

    compressImage(file)
      .then((base64String) => updateTodoProof(todoId, undefined, base64String, file.name))
      .catch(() => alert('Gagal memproses gambar, coba file lain'));
  };

  // Submit Absen Pagi
  const handlePagiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doAbsenPagi(pagiLoc, pagiNotes);
  };

  // Submit Tambah Todo
  const handleAddTodoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    addTodo(newTask, newTarget);
    setNewTask('');
    setNewTarget('');
  };

  // Submit Absen Siang
  const handleSiangSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doAbsenSiang(siangLoc, siangNotes);
    setShowSiangModal(false);
  };

  // Warna progress skor persentase
  const getScoreColor = (percent: number) => {
    if (percent >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (percent >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getProgressBarColor = (percent: number) => {
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* Profil Banner Karyawan */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/30 shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{currentUser.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {currentUser.division}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Atasan / Leader: <span className="font-semibold text-slate-700">{currentUser.leaderName || 'Hendra Wijaya'}</span>
            </p>
          </div>
        </div>

        {/* Status Absensi & To-Do Harian */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${
            entry.absenPagi ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            <Sun className="w-4 h-4 text-amber-500" />
            <div>
              <div className="font-semibold">Absen Pagi</div>
              <div className="text-[11px] opacity-80">{entry.absenPagi ? `${entry.absenPagi.time}` : 'Belum Absen'}</div>
            </div>
          </div>

          <div className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${
            entry.absenSiang ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            <Sunset className="w-4 h-4 text-blue-500" />
            <div>
              <div className="font-semibold">Absen Siang</div>
              <div className="text-[11px] opacity-80">{entry.absenSiang ? `${entry.absenSiang.time}` : 'Belum Absen'}</div>
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl border bg-blue-50/70 border-blue-200 text-blue-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-600" />
            <div>
              <div className="font-semibold">Skor Centang</div>
              <div className="text-[11px] font-bold text-blue-700">{entry.employeeScorePercent}% ({entry.completedTodos}/{entry.totalTodos})</div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Zoom Meeting (Muncul jika ada jadwal aktif/urgen dari Leader sendiri) */}
      {myZoomMeetings.length > 0 && (
        <div className="space-y-3">
          {myZoomMeetings.slice(0, 2).map((meeting) => (
            <div
              key={meeting.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                meeting.isUrgent
                  ? 'bg-rose-50/90 border-rose-200 text-rose-950 shadow-xs'
                  : 'bg-sky-50/80 border-sky-200 text-sky-950 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    meeting.isUrgent ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                  }`}
                >
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{meeting.title}</span>
                    {meeting.isUrgent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800 border border-rose-300">
                        🚨 Meeting Penting / Urgen
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        Meeting Tim
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-600">
                      {meeting.date} &bull; {meeting.time} WIB ({meeting.duration} mnt)
                    </span>
                  </div>
                  {meeting.agenda && (
                    <p className="text-xs text-slate-600 mt-0.5">Agenda: {meeting.agenda}</p>
                  )}
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Passcode: <b className="text-slate-800">{meeting.passcode}</b> &bull; ID: {meeting.meetingId}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <a
                  href={meeting.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => joinZoomMeeting(meeting.id)}
                  className={`px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs ${
                    meeting.isUrgent ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#035388] hover:bg-[#003f6b]'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Buka &amp; Gabung Google Meet</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid 2 Kolom: Kolom Kiri Absen Pagi/Siang & Ringkasan, Kolom Kanan To-Do List Centang */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KOLOM KIRI (4 Kolom): Panel Absensi & Feedback Leader */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Card 1: Absen Pagi */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Absen Pagi (08:00 - 08:30 WIB)</h3>
                <p className="text-[11px] text-slate-500">Isi kehadiran &amp; susun rencana to-do list</p>
              </div>
            </div>

            {entry.absenPagi ? (
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Waktu Absen:</span>
                  <span className="font-semibold text-slate-800">{entry.absenPagi.time}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Status Kehadiran:</span>
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                    entry.absenPagi.status === 'tepat_waktu' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {entry.absenPagi.status === 'tepat_waktu' ? 'Tepat Waktu' : 'Terlambat'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[11px] mb-1">Lokasi WFA:</div>
                  <div className="font-medium text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    {entry.absenPagi.location}
                  </div>
                </div>
                {entry.absenPagi.notes && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 text-xs">
                    <div className="text-slate-500 text-[11px] mb-1">Rencana Pagi:</div>
                    <p className="italic">"{entry.absenPagi.notes}"</p>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handlePagiSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi WFA</label>
                  <input
                    type="text"
                    value={pagiLoc}
                    onChange={(e) => setPagiLoc(e.target.value)}
                    placeholder="Contoh: Rumah (Jakarta Selatan)"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Singkat Rencana Kerja</label>
                  <textarea
                    value={pagiNotes}
                    onChange={(e) => setPagiNotes(e.target.value)}
                    placeholder="Tuliskan fokus pekerjaan hari ini..."
                    rows={2}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Sun className="w-4 h-4" />
                  Kirim Absen Pagi
                </button>
              </form>
            )}
          </div>

          {/* Card 2: Absen Siang (Sebelum Absen, Beri Skor Centang) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Sunset className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Absen Siang (12:30 - 13:30 WIB)</h3>
                <p className="text-[11px] text-slate-500">Centang to-do &amp; lampirkan bukti sebelum absen</p>
              </div>
            </div>

            {entry.absenSiang ? (
              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Waktu Absen Siang:</span>
                  <span className="font-semibold text-slate-800">{entry.absenSiang.time}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[11px] mb-1">Catatan Progress Siang:</div>
                  <p className="text-slate-800 italic">"{entry.absenSiang.notes || 'Progress sesuai to-do list'}"</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Absen siang berhasil terkirim ke Leader.</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Instruksi Siang:</span>
                    Pastikan Anda telah <b>mencentang to-do list</b> yang selesai dan melampirkan <b>bukti link/foto</b> di kolom kanan sebelum menekan tombol Absen Siang.
                  </div>
                </div>

                <button
                  onClick={() => setShowSiangModal(true)}
                  disabled={!entry.absenPagi}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs ${
                    entry.absenPagi
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sunset className="w-4 h-4" />
                  {!entry.absenPagi ? 'Harus Absen Pagi Terlebih Dahulu' : 'Lakukan Absen Siang'}
                </button>
              </div>
            )}
          </div>

          {/* Card 3: Hasil Review Leader & Komentar General */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Review &amp; Feedback Leader</h3>
                <p className="text-[11px] text-slate-500">Evaluasi to-do list dari Supervisor</p>
              </div>
            </div>

            <div className="mt-4">
              {entry.leaderReviewedAt ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-amber-900 font-medium">Nilai Absen (Pagi + Siang):</span>
                    <span className="text-base font-extrabold text-amber-700">{getAbsenScore(entry)} / 100</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50 border border-sky-200">
                    <span className="text-sky-900 font-medium">Nilai To-Do (Validasi Leader):</span>
                    <span className="text-base font-extrabold text-sky-700">{entry.leaderScore} / 100</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-blue-900 font-medium">Nilai Komunikasi:</span>
                    <span className="text-base font-extrabold text-blue-700">
                      {entry.leaderCommunicationScore} / 100
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#004080] text-white">
                    <span className="font-semibold">Skor Akhir (Absen 34% + To-Do 33% + Komunikasi 33%):</span>
                    <span className="text-base font-extrabold">{getFinalScore(entry, weightsFromSettings(wfaSettings))} / 100</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs mb-1.5">
                      <MessageSquareQuote className="w-4 h-4 text-sky-600" />
                      <span>Komentar General Leader:</span>
                    </div>
                    {entry.leaderGeneralComment ? (
                      <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 text-xs">
                        "{entry.leaderGeneralComment}"
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">Leader tidak memberikan komentar khusus (semua sesuai).</p>
                    )}
                    <div className="mt-2 text-[11px] text-slate-400 text-right">
                      Direview oleh {entry.leaderReviewedBy} ({entry.leaderReviewedAt})
                    </div>
                  </div>
                </div>
              ) : entry.absenSiang ? (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs text-center space-y-1">
                  <Sparkles className="w-5 h-5 mx-auto text-blue-600 animate-pulse" />
                  <p className="font-semibold">Menunggu Review Leader</p>
                  <p className="text-[11px] opacity-80">
                    To-do list ({entry.employeeScorePercent}%) dan bukti sudah diajukan ke Hendra Wijaya.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-3">
                  Selesaikan to-do list siang &amp; absen siang untuk menerima evaluasi leader.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* KOLOM KANAN (8 Kolom): INTI FITUR TO-DO LIST DENGAN CENTANG, PERSENTASE SKOR & BUKTI */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Header To-Do & Indikator Persentase Skor Otomatis */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  To-Do List Harian &amp; Penilaian Centang
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi to-do di pagi hari, lalu <b>beri tanda centang</b> di siang hari untuk memunculkan persentase skor.
                </p>
              </div>

              {/* Skor Persentase Badge */}
              <div className={`px-4 py-2.5 rounded-2xl border flex items-center gap-3 ${getScoreColor(entry.employeeScorePercent)}`}>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Persentase Skor</div>
                  <div className="text-2xl font-black leading-none">{entry.employeeScorePercent}%</div>
                </div>
                <div className="h-8 w-px bg-current opacity-20" />
                <div className="text-xs font-semibold">
                  <span>{entry.completedTodos}</span> / <span>{entry.totalTodos}</span>
                  <span className="block text-[10px] font-normal opacity-75">Tugas Selesai</span>
                </div>
              </div>
            </div>

            {/* Progress Bar Visual */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-medium text-slate-600">
                <span>Pencapaian To-Do Hari Ini</span>
                <span>{entry.completedTodos} dari {entry.totalTodos} tugas dicentang ({entry.employeeScorePercent}%)</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(entry.employeeScorePercent)}`}
                  style={{ width: `${entry.employeeScorePercent}%` }}
                />
              </div>
            </div>

            {/* Form Tambah To-Do Pagi */}
            <form onSubmit={handleAddTodoSubmit} className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-100">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Tuliskan tugas to-do baru... (Contoh: Selesaikan modul integrasi API)"
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="Target / Waktu (opsional)"
                className="sm:w-48 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Tambah Tugas
              </button>
            </form>
          </div>

          {/* Daftar Item To-Do List */}
          <div className="space-y-3">
            {entry.todos.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center space-y-2">
                <FileText className="w-10 h-10 mx-auto text-slate-300" />
                <h3 className="font-bold text-slate-700 text-sm">Belum Ada To-Do List Hari Ini</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Gunakan form di atas untuk mengisi daftar tugas to-do pagi Anda. Di siang hari sebelum absen siang, centang tugas yang sudah selesai.
                </p>
              </div>
            ) : (
              entry.todos.map((todo: TodoItem, index: number) => {
                const isCompleted = todo.completed;
                return (
                  <div
                    key={todo.id}
                    id={`todo-card-${todo.id}`}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* CENTANG CHECKBOX (PENGGANTI SKOR SKOR) */}
                      <button
                        type="button"
                        onClick={() => toggleTodoCentang(todo.id)}
                        className="mt-0.5 text-left flex items-start gap-3 cursor-pointer group flex-1"
                        title={isCompleted ? 'Batalkan centang' : 'Centang tugas ini (Selesai)'}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 transition-transform group-hover:scale-110" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-300 transition-transform group-hover:text-blue-500 group-hover:scale-110" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                            <span
                              className={`text-sm font-semibold leading-snug ${
                                isCompleted ? 'line-through text-slate-500' : 'text-slate-800'
                              }`}
                            >
                              {todo.task}
                            </span>
                            {isCompleted ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Selesai Dicentang ✓
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                Belum Selesai
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            {todo.target && <span>Target: <b>{todo.target}</b></span>}
                            <span>Dibuat: {todo.createdAt}</span>
                            {todo.completedAt && (
                              <span className="text-emerald-700 font-medium">Dicentang jam {todo.completedAt}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Tombol Hapus */}
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Hapus tugas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* SECTION LAMPIRAN BUKTI PEKERJAAN (LINK MAUPUN FOTO) */}
                    <div className="mt-4 pt-3 border-t border-slate-100/90 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                          Lampiran Bukti Pekerjaan:
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {todo.proofLink || todo.proofImage ? 'Sudah ada bukti' : 'Wajib lampirkan link / foto'}
                        </span>
                      </div>

                      {/* Preview Bukti yang Ada */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        
                        {/* 1. Bukti Link */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                              <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                              Link Dokumen / PR / Sheet
                            </span>
                            {todo.proofLink && (
                              <a
                                href={todo.proofLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
                              >
                                Buka Link <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {editingProofId === todo.id ? (
                            <div className="flex gap-1.5">
                              <input
                                type="url"
                                value={inputLink}
                                onChange={(e) => setInputLink(e.target.value)}
                                placeholder="https://docs.google.com/... atau figma.com/..."
                                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                              />
                              <button
                                onClick={() => {
                                  updateTodoProof(todo.id, inputLink);
                                  setEditingProofId(null);
                                }}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                              >
                                Simpan
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-700 truncate max-w-[200px]" title={todo.proofLink || 'Belum ada link'}>
                                {todo.proofLink || <span className="text-slate-400 italic">Belum melampirkan link</span>}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingProofId(todo.id);
                                  setInputLink(todo.proofLink || '');
                                }}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium ml-2"
                              >
                                {todo.proofLink ? 'Ubah Link' : '+ Tambah Link'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 2. Bukti Foto / Screenshot */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                              Foto / Screenshot Pekerjaan
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {todo.proofImage ? (
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  onClick={() => openImageModal(todo.proofImage!, `Bukti: ${todo.task}`)}
                                  className="w-12 h-12 rounded-lg border border-slate-300 overflow-hidden cursor-pointer hover:opacity-90 relative group shrink-0"
                                  title="Klik untuk memperbesar foto"
                                >
                                  <img
                                    src={todo.proofImage}
                                    alt="Bukti foto"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                                <div className="text-xs text-slate-700 overflow-hidden">
                                  <span className="truncate block font-medium">
                                    {todo.proofFileName || 'Screenshot Terlampir'}
                                  </span>
                                  <button
                                    onClick={() => openImageModal(todo.proofImage!, `Bukti: ${todo.task}`)}
                                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                                  >
                                    Lihat Foto Besar &rarr;
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Belum melampirkan foto</span>
                            )}

                            {/* Tombol Upload File Foto */}
                            <label className="cursor-pointer px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-colors shrink-0 shadow-2xs">
                              <Upload className="w-3 h-3 text-slate-500" />
                              <span>{todo.proofImage ? 'Ganti Foto' : 'Upload Foto'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handlePhotoUpload(todo.id, e)}
                              />
                            </label>
                          </div>
                        </div>

                      </div>

                      {/* Status Verifikasi Leader pada Item Ini */}
                      {entry.leaderReviewedAt && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                          {todo.verifiedByLeader ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Diverifikasi oleh Leader ({entry.leaderReviewedBy})
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Belum/tidak diverifikasi oleh leader
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Action di Bawah To-Do */}
          {entry.todos.length > 0 && !entry.absenSiang && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-sky-50 to-blue-100 border border-blue-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-700">
                <div className="font-bold text-slate-900 text-sm">
                  Sudah selesai memberi centang to-do siang ini?
                </div>
                <div>
                  Skor Anda saat ini: <b>{entry.employeeScorePercent}%</b> ({entry.completedTodos} dari {entry.totalTodos} to-do dicentang).
                </div>
              </div>
              <button
                onClick={() => setShowSiangModal(true)}
                disabled={!entry.absenPagi}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-500/20 shrink-0 flex items-center gap-2"
              >
                <Sunset className="w-4 h-4" />
                Submit Absen Siang Sekarang
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Modal Absen Siang */}
      {showSiangModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Sunset className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Konfirmasi Absen Siang</h3>
                  <p className="text-xs text-slate-500">Penilaian to-do list &amp; lampiran bukti</p>
                </div>
              </div>
              <button
                onClick={() => setShowSiangModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Ringkasan Skor Centang */}
            <div className={`p-4 rounded-xl border ${getScoreColor(entry.employeeScorePercent)} flex items-center justify-between`}>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">Skor Centang To-Do Anda</div>
                <div className="text-xs mt-0.5">
                  {entry.completedTodos} dari {entry.totalTodos} tugas telah dicentang selesai
                </div>
              </div>
              <div className="text-2xl font-black">{entry.employeeScorePercent}%</div>
            </div>

            <form onSubmit={handleSiangSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi WFA Saat Ini</label>
                <input
                  type="text"
                  value={siangLoc}
                  onChange={(e) => setSiangLoc(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Progress Siang</label>
                <textarea
                  value={siangNotes}
                  onChange={(e) => setSiangNotes(e.target.value)}
                  placeholder="Ceritakan ringkasan kemajuan pekerjaan dan catatan untuk leader..."
                  rows={3}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSiangModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Kembali Cek To-Do
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
                >
                  Kirim Absen Siang &amp; Ajukan ke Leader
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
