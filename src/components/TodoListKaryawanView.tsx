import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { compressImage } from '../lib/image';
import { TodoItem } from '../types';
import {
  ListChecks,
  Sun,
  Sunset,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  Save,
  Send,
  Lock,
  Unlock,
  CheckCircle2,
  Circle,
  Link as LinkIcon,
  Image as ImageIcon,
  ExternalLink,
  Award,
  Upload,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Video
} from 'lucide-react';
import { SidebarMenuId } from './Sidebar';

interface TodoListKaryawanViewProps {
  onNavigate?: (menu: SidebarMenuId) => void;
}

export const TodoListKaryawanView: React.FC<TodoListKaryawanViewProps> = ({ onNavigate }) => {
  const {
    currentUser,
    getCurrentEntry,
    addTodo,
    deleteTodo,
    toggleTodoCentang,
    updateTodoProof,
    showToast,
    openImageModal,
    zoomMeetings,
    selectedDate,
    joinZoomMeeting
  } = useApp();

  const entry = getCurrentEntry();

  // Jadwal Meet Pagi/Siang hari ini dari koordinator karyawan ini (kalau ada & masih aktif) —
  // dipakai supaya Google Meet baru dibuka SETELAH To-Do List diisi/dicentang, bukan sebelumnya.
  const todaysPagiMeeting = zoomMeetings.find(
    (z) => z.leaderId === currentUser.leaderId && z.date === selectedDate && z.status === 'aktif' && z.session === 'pagi'
  );
  const todaysSiangMeeting = zoomMeetings.find(
    (z) => z.leaderId === currentUser.leaderId && z.date === selectedDate && z.status === 'aktif' && z.session === 'siang'
  );

  // State draft input tugas pagi (default 3 baris persis Gambar 3)
  const [taskInputs, setTaskInputs] = useState<string[]>(['', '', '']);
  const [isSentToCoordinator, setIsSentToCoordinator] = useState(entry.todos.length > 0);
  const [isRedirectingToHubstaff, setIsRedirectingToHubstaff] = useState(false);

  // State untuk editing bukti per item
  const [editingProofId, setEditingProofId] = useState<string | null>(null);
  const [inputLink, setInputLink] = useState('');

  const isAbsenPagiDone = !!entry.absenPagi;
  const isAbsenSiangDone = !!entry.absenSiang;

  // Ubah teks baris tugas
  const handleInputChange = (index: number, val: string) => {
    setTaskInputs((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  // Tambah baris input tugas
  const handleAddTaskInput = () => {
    setTaskInputs((prev) => [...prev, '']);
  };

  // Hapus baris input tugas
  const handleRemoveTaskInput = (index: number) => {
    if (taskInputs.length <= 1) {
      setTaskInputs(['']);
      return;
    }
    setTaskInputs((prev) => prev.filter((_, i) => i !== index));
  };

  // Simpan Draft
  const handleSaveDraft = () => {
    const validTasks = taskInputs.filter((t) => t.trim().length > 0);
    if (validTasks.length === 0) {
      showToast('Tulis minimal 1 tugas untuk disimpan sebagai draft', 'warning');
      return;
    }
    validTasks.forEach((task) => {
      addTodo(task.trim(), 'Target harian WFA');
    });
    showToast('Draft to-do list berhasil disimpan', 'info');
  };

  // Kirim ke Koordinator
  const handleSendToCoordinator = () => {
    const validTasks = taskInputs.filter((t) => t.trim().length > 0);
    if (validTasks.length === 0 && entry.todos.length === 0) {
      showToast('Tulis rencana tugas terlebih dahulu sebelum mengirim', 'warning');
      return;
    }

    if (validTasks.length > 0) {
      validTasks.forEach((task) => {
        addTodo(task.trim(), 'Target kerja WFA');
      });
      setTaskInputs(['']);
    }

    setIsSentToCoordinator(true);
    setIsRedirectingToHubstaff(true);

    // Kirim ke koordinator selesai -> KALAU ada jadwal Meet Pagi hari ini, baru sekarang Meet
    // dibuka (bukan langsung saat absen), supaya To-Do List pasti terisi dulu sebelum karyawan
    // "kabur" ke Google Meet. Lalu tetap diarahkan ke Hubstaff untuk mengaktifkan time-tracking.
    if (todaysPagiMeeting) {
      joinZoomMeeting(todaysPagiMeeting.id);
      window.open(todaysPagiMeeting.link, '_blank', 'noopener,noreferrer');
      showToast('To-Do List terkirim! Membuka Google Meet Pagi & mengalihkan ke Hubstaff...', 'success');
    } else {
      showToast('To-Do List berhasil dikirim ke koordinator! Mengalihkan ke aktivasi Hubstaff...', 'success');
    }

    // Otomatis mengarahkan ke aktivasi Hubstaff
    setTimeout(() => {
      onNavigate?.('hubstaff');
    }, 1200);
  };

  // Upload Bukti Foto
  const handlePhotoUpload = (todoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran gambar maksimal 5MB', 'warning');
      return;
    }

    compressImage(file)
      .then((base64String) => {
        updateTodoProof(todoId, undefined, base64String, file.name);
        showToast('Foto bukti pekerjaan berhasil dilampirkan', 'success');
      })
      .catch(() => showToast('Gagal memproses gambar, coba file lain', 'warning'));
  };

  // Simpan Link Bukti
  const handleSaveLinkProof = (todoId: string) => {
    if (!inputLink.trim()) return;
    updateTodoProof(todoId, inputLink.trim());
    setEditingProofId(null);
    setInputLink('');
    showToast('Tautan dokumen berhasil disimpan', 'success');
  };

  // Buka Google Meet Siang — ini pengganti tombol "kirim" untuk sesi siang (bagian Centang
  // Tugas memang tidak punya tombol submit seperti To-Do List Pagi, jadi tombol inilah yang
  // jadi penanda "sudah dicentang, siap lanjut ke meeting").
  const handleOpenSiangMeet = () => {
    if (!todaysSiangMeeting) return;
    joinZoomMeeting(todaysSiangMeeting.id);
    window.open(todaysSiangMeeting.link, '_blank', 'noopener,noreferrer');
    showToast('Membuka Google Meet Siang/Sore...', 'success');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Halaman (Sesuai Persis Gambar 3) */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">To-Do List Harian</h1>
        <p className="text-xs text-slate-500 mt-1">
          Fase Pagi &mdash; Tulis rencana kerja dan kirim ke koordinator
        </p>
      </div>

      {/* 2. Workflow Banner Biru Persis Gambar 3 */}
      <div className="bg-[#004080] text-white rounded-2xl p-5 shadow-sm space-y-1">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Sun className="w-4 h-4 text-amber-300" />
          <span>Fase Pagi</span>
        </div>
        <p className="text-xs text-sky-100 font-medium">
          Absen pagi &rarr; Isi to-do &rarr; Beri skor pencapaian diri &rarr; baru bisa absen siang
        </p>
      </div>

      {/* 3. Notice Banner Kuning Persis Gambar 3 */}
      {!isAbsenPagiDone ? (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Belum absen pagi.</span>
            <button
              type="button"
              onClick={() => onNavigate?.('absensi-gps')}
              className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1"
            >
              <span>Absen dulu &rarr;</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Absen pagi telah tercatat pukul {entry.absenPagi?.time}. Silakan susun rencana kerja hari ini di bawah.
          </span>
        </div>
      )}

      {/* 4. Card: To-Do List Pagi (Sesuai Persis Gambar 3) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <ListChecks className="w-4 h-4 text-blue-600" />
          <span>To-Do List Pagi</span>
        </div>

        {/* Info Box Biru Persis Gambar 3 */}
        <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100 text-sky-900 text-xs flex items-center gap-2.5">
          <Info className="w-4 h-4 text-sky-600 shrink-0" />
          <span>Tulis rencana kerja sebelum jam 08:30. Koordinator dapat melihat tugas Anda.</span>
        </div>

        {/* Dynamic Task Input Rows Persis Gambar 3 */}
        <div className="space-y-3">
          {taskInputs.map((taskVal, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 w-5 text-right shrink-0">
                {idx + 1}.
              </span>
              <div className="flex-1">
                <input
                  type="text"
                  value={taskVal}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  placeholder="Tulis tugas yang akan dikerjakan..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveTaskInput(idx)}
                title="Hapus baris tugas"
                className="p-2 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Tambah Tugas Button Persis Gambar 3 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleAddTaskInput}
            className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Tugas</span>
          </button>
        </div>

        {/* Actions Bottom Right Persis Gambar 3 */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
          {entry.todos.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate?.('hubstaff')}
              className="px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>Lanjut ke Hubstaff</span>
              <span>&rarr;</span>
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-2xs transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Simpan Draft</span>
            </button>
            <button
              type="button"
              disabled={isRedirectingToHubstaff}
              onClick={handleSendToCoordinator}
              className="px-5 py-2.5 rounded-xl bg-[#0066b2] hover:bg-[#005594] disabled:opacity-75 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              {isRedirectingToHubstaff ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengarahkan ke Hubstaff...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim ke Koordinator</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Card: Penilaian Skor & Centang Tugas (Sesuai Gambar 3 Bagian Bawah) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            {entry.todos.length > 0 ? (
              <Unlock className="w-4 h-4 text-emerald-600" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>Penilaian Skor &amp; Centang Tugas</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Skor Centang Anda:</span>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              {entry.employeeScorePercent}% ({entry.completedTodos}/{entry.totalTodos})
            </span>
          </div>
        </div>

        {entry.todos.length === 0 ? (
          <div className="py-8 text-center space-y-2 text-slate-400">
            <Lock className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">
              Tulis dan kirim to-do list pagi terlebih dahulu untuk membuka penilaian skor &amp; centang pekerjaan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Centang tugas yang sudah Anda selesaikan, lalu lampirkan link dokumen atau foto hasil pekerjaan sebagai bukti verifikasi koordinator:
            </p>

            <div className="space-y-3">
              {entry.todos.map((todo) => (
                <div
                  key={todo.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    todo.completed
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTodoCentang(todo.id)}
                      className="flex items-start gap-3 text-left flex-1"
                    >
                      <div className="mt-0.5">
                        {todo.completed ? (
                          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md border-2 border-slate-300" />
                        )}
                      </div>
                      <div>
                        <div
                          className={`text-xs font-bold ${
                            todo.completed ? 'text-slate-500 line-through' : 'text-slate-800'
                          }`}
                        >
                          {todo.task}
                        </div>
                        {todo.completed && todo.completedAt && (
                          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                            Selesai pada {todo.completedAt}
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      className="text-slate-300 hover:text-rose-600 text-xs p-1"
                      title="Hapus tugas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Lampiran Bukti: Link & Foto */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100/80 flex-wrap text-xs">
                    {/* Link Bukti */}
                    {todo.proofLink ? (
                      <a
                        href={todo.proofLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium text-[11px] hover:underline border border-blue-200/60"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">{todo.proofLink}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingProofId(editingProofId === todo.id ? null : todo.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[11px] hover:bg-slate-50"
                      >
                        <LinkIcon className="w-3 h-3 text-slate-400" />
                        <span>+ Link Dokumen</span>
                      </button>
                    )}

                    {/* Foto Bukti */}
                    {todo.proofImage ? (
                      <button
                        type="button"
                        onClick={() =>
                          openImageModal(
                            todo.proofImage!,
                            `Bukti Tugas: ${todo.task} — diupload oleh ${currentUser.name}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200/60"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>Lihat Foto Bukti</span>
                      </button>
                    ) : (
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 font-semibold text-[11px] hover:bg-slate-50 cursor-pointer">
                        <Upload className="w-3 h-3 text-slate-400" />
                        <span>+ Upload Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(todo.id, e)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Form Input Link Bukti Jika Diklik */}
                  {editingProofId === todo.id && (
                    <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                      <input
                        type="url"
                        placeholder="Tempel link Google Drive / Docs / Figma / GitHub..."
                        value={inputLink}
                        onChange={(e) => setInputLink(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveLinkProof(todo.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProofId(null)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* CTA "Buka Google Meet" untuk sesi Siang — pengganti tombol kirim, muncul
                setelah absen siang & kalau memang ada jadwal Meet Siang/Sore hari ini. */}
            {isAbsenSiangDone && todaysSiangMeeting && (
              <div className="pt-4 mt-1 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Sudah centang &amp; lampirkan bukti tugas yang selesai? Lanjut gabung Google Meet Siang/Sore.
                </p>
                <button
                  type="button"
                  onClick={handleOpenSiangMeet}
                  className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Buka Google Meet Siang/Sore</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
