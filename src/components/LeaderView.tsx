import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DailyWfaEntry, TodoItem } from '../types';
import { getAbsenScore } from '../utils/scoreUtils';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  ExternalLink,
  Image as ImageIcon,
  MessageSquareQuote,
  Eye,
  Award,
  Sun,
  Sunset,
  Search,
  Filter,
  CheckSquare,
  Sparkles
} from 'lucide-react';

export const LeaderView: React.FC = () => {
  const { entries, selectedDate, leaderReviewEntry, openImageModal, showToast, currentUser, allUsers } = useApp();

  // Filter & Search anggota tim
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'need_review' | 'reviewed' | 'pending_siang'>('all');

  // State review modal / expanded form untuk karyawan yang sedang dinilai
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [verifiedTodos, setVerifiedTodos] = useState<string[]>([]);
  // Nilai Komunikasi WAJIB diisi Leader (null = belum dipilih, form tidak bisa dikirim)
  const [communicationScore, setCommunicationScore] = useState<number | null>(null);

  // ID anggota tim yang SAAT INI ditugaskan ke leader ini. Kalau HRD memindahkan
  // karyawan ke leader lain, karyawan itu (beserta seluruh poin/skornya) otomatis
  // pindah tampil di leader yang baru, karena penugasan diambil live dari data user.
  const myTeamIds = useMemo(
    () =>
      new Set(
        allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === currentUser.id).map((u) => u.id)
      ),
    [allUsers, currentUser.id]
  );

  // Ambil semua entri pada tanggal ini yang merupakan anggota tim leader ini
  const dayEntries = entries.filter((e) => e.date === selectedDate && myTeamIds.has(e.userId));

  // Buka form penilaian untuk entri tertentu
  const openReviewForm = (entry: DailyWfaEntry) => {
    setSelectedEntryId(entry.id);
    setReviewComment(entry.leaderGeneralComment || '');
    // Default centang verified adalah semua to-do yang sudah dicentang karyawan
    const alreadyVerified = entry.todos.filter((t) => t.completed).map((t) => t.id);
    setVerifiedTodos(alreadyVerified);
    // Reset nilai komunikasi tiap buka form baru, kecuali sudah pernah dinilai sebelumnya
    setCommunicationScore(entry.leaderCommunicationScore);
  };

  const handleToggleVerifyItem = (todoId: string) => {
    setVerifiedTodos((prev) => {
      if (prev.includes(todoId)) {
        return prev.filter((id) => id !== todoId);
      } else {
        return [...prev, todoId];
      }
    });
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntryId) return;
    if (communicationScore === null) {
      showToast('Nilai Komunikasi wajib diisi sebelum mengirim penilaian.', 'warning');
      return;
    }

    const entryBeingReviewed = dayEntries.find((en) => en.id === selectedEntryId);
    const totalItems = entryBeingReviewed?.todos.length || 0;
    const computedScore =
      totalItems > 0 ? Math.round((verifiedTodos.length / totalItems) * 100) : 0;

    leaderReviewEntry(selectedEntryId, computedScore, communicationScore, reviewComment, verifiedTodos);
    setSelectedEntryId(null);
  };

  // Filter entries
  const filteredEntries = dayEntries.filter((entry) => {
    const matchesSearch =
      entry.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.division.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'need_review') {
      return entry.status === 'siang_selesai';
    }
    if (statusFilter === 'reviewed') {
      return entry.status === 'selesai_direview';
    }
    if (statusFilter === 'pending_siang') {
      return entry.status === 'pagi_selesai' || entry.status === 'belum_mulai';
    }
    return true;
  });

  const activeEntryForReview = dayEntries.find((e) => e.id === selectedEntryId);

  // Skor akhir dihitung otomatis dari jumlah butir to-do yang divalidasi (dicentang) Leader
  const totalTodoItems = activeEntryForReview?.todos.length || 0;
  const computedReviewScore =
    totalTodoItems > 0 ? Math.round((verifiedTodos.length / totalTodoItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Dashboard Leader */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#e0f2fe] text-[#0369a1] flex items-center justify-center shadow-xs">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Monitor To-Do List</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                Luzie Group
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau to-do list centang tim secara realtime, verifikasi lampiran link &amp; foto bukti, serta berikan penilaian dan komentar general leader.
            </p>
          </div>
        </div>

        {/* Metrik Tim Hari Ini */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Tim</div>
            <div className="text-base font-bold">{dayEntries.length} Anggota</div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
            <div className="text-[10px] text-blue-600 font-semibold uppercase">Perlu Review</div>
            <div className="text-base font-bold">
              {dayEntries.filter((e) => e.status === 'siang_selesai').length} Menunggu
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
            <div className="text-[10px] text-emerald-600 font-semibold uppercase">Selesai Dinilai</div>
            <div className="text-base font-bold">
              {dayEntries.filter((e) => e.status === 'selesai_direview').length} Selesai
            </div>
          </div>
        </div>
      </div>

      {/* Bar Pencarian & Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama karyawan atau divisi..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
          <span className="text-slate-400 text-[11px] font-medium hidden md:inline">Filter:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
              statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({dayEntries.length})
          </button>
          <button
            onClick={() => setStatusFilter('need_review')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
              statusFilter === 'need_review' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Perlu Review Siang ({dayEntries.filter((e) => e.status === 'siang_selesai').length})
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
              statusFilter === 'reviewed' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Sudah Dinilai ({dayEntries.filter((e) => e.status === 'selesai_direview').length})
          </button>
        </div>
      </div>

      {/* Daftar Kartu Review Karyawan */}
      <div className="grid grid-cols-1 gap-5">
        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-2">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm">Tidak Ada Data Anggota Tim</h3>
            <p className="text-xs text-slate-400">Tidak ditemukan data pada filter yang dipilih.</p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isNeedReview = entry.status === 'siang_selesai';
            const isReviewed = entry.status === 'selesai_direview';

            return (
              <div
                key={entry.id}
                id={`leader-card-${entry.id}`}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isNeedReview
                    ? 'border-blue-400 ring-2 ring-blue-500/10 shadow-md'
                    : isReviewed
                    ? 'border-emerald-200 shadow-xs'
                    : 'border-slate-200 shadow-xs'
                }`}
              >
                {/* Header Bar Kartu */}
                <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0 border border-blue-200">
                      {entry.userName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{entry.userName}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                          {entry.division}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span>Pagi: {entry.absenPagi ? entry.absenPagi.time : 'Belum Absen'}</span>
                        <span>&bull;</span>
                        <span>Siang: {entry.absenSiang ? entry.absenSiang.time : 'Belum Absen'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Skor Centang & Action Button */}
                  <div className="flex items-center gap-3">
                    {/* Badge Skor Centang Otomatis */}
                    <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Skor Centang</div>
                      <div className="text-base font-extrabold text-blue-700">
                        {entry.employeeScorePercent}%
                        <span className="text-xs font-normal text-slate-500 ml-1">
                          ({entry.completedTodos}/{entry.totalTodos})
                        </span>
                      </div>
                    </div>

                    {/* Nilai Leader (jika sudah dinilai) */}
                    {entry.leaderScore !== null && (
                      <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
                        <div className="text-[10px] text-emerald-700 font-bold uppercase">Nilai Leader</div>
                        <div className="text-base font-extrabold text-emerald-800">
                          {entry.leaderScore} / 100
                        </div>
                      </div>
                    )}

                    {/* Nilai Komunikasi (jika sudah dinilai) */}
                    {entry.leaderCommunicationScore !== null && (
                      <div className="px-3.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-right">
                        <div className="text-[10px] text-sky-700 font-bold uppercase">Komunikasi</div>
                        <div className="text-base font-extrabold text-sky-800">
                          {entry.leaderCommunicationScore} / 100
                        </div>
                      </div>
                    )}

                    {/* Tombol Beri Nilai / Edit Review */}
                    <button
                      id={`btn-review-${entry.id}`}
                      onClick={() => openReviewForm(entry)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 ${
                        isNeedReview
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 animate-pulse'
                          : isReviewed
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      {isReviewed ? 'Perbarui Nilai & Komen' : 'Beri Nilai & Review'}
                    </button>
                  </div>
                </div>

                {/* Body Kartu: Daftar To-Do List yang Dicentang & Bukti Pekerjaan */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Daftar To-Do List &amp; Lampiran Bukti Pekerjaan</span>
                      <span className="text-slate-500 font-normal lowercase">
                        {entry.completedTodos} dicentang dari {entry.totalTodos} total to-do
                      </span>
                    </h4>

                    {entry.todos.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">Karyawan belum mengisi to-do list hari ini.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {entry.todos.map((todo: TodoItem, idx: number) => {
                          const isDone = todo.completed;
                          return (
                            <div
                              key={todo.id}
                              className={`p-3.5 rounded-xl border text-xs transition-colors ${
                                isDone
                                  ? 'bg-emerald-50/30 border-emerald-200/80'
                                  : 'bg-slate-50/50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5 flex-1">
                                  <div className="mt-0.5 shrink-0">
                                    {isDone ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-slate-400">#{idx + 1}</span>
                                      <span className={`font-semibold ${isDone ? 'text-slate-800' : 'text-slate-500'}`}>
                                        {todo.task}
                                      </span>
                                      {isDone ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                          Dicentang Selesai ✓
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                          Belum Dicentang
                                        </span>
                                      )}
                                    </div>
                                    {todo.target && (
                                      <div className="text-[11px] text-slate-500 mt-0.5">
                                        Target: {todo.target}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Status verifikasi leader */}
                                {todo.verifiedByLeader && (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md shrink-0">
                                    Tervalidasi Leader
                                  </span>
                                )}
                              </div>

                              {/* Lampiran Bukti (Link & Foto) */}
                              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-4 text-xs">
                                {/* Link Bukti */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-500 text-[11px]">Link Bukti:</span>
                                  {todo.proofLink ? (
                                    <a
                                      href={todo.proofLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                    >
                                      Buka Dokumen / Link <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">Tidak ada link</span>
                                  )}
                                </div>

                                {/* Foto Bukti */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-500 text-[11px]">Foto Bukti:</span>
                                  {todo.proofImage ? (
                                    <button
                                      onClick={() => openImageModal(todo.proofImage!, `Bukti: ${todo.task}`)}
                                      className="font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      Lihat Foto Screenshot <Eye className="w-3 h-3 ml-0.5" />
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px]">Tidak ada foto</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Catatan Absen Siang dari Karyawan */}
                  {entry.absenSiang && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="font-semibold text-slate-700 block mb-0.5">Catatan Siang Karyawan:</span>
                      <p className="text-slate-600 italic">"{entry.absenSiang.notes || 'Selesai sesuai to-do list'}"</p>
                    </div>
                  )}

                  {/* Komentar General Leader yang Sudah Diberikan */}
                  {entry.leaderGeneralComment && (
                    <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-sky-900 mb-1">
                        <MessageSquareQuote className="w-4 h-4 text-sky-600" />
                        <span>Komentar General Leader:</span>
                      </div>
                      <p className="text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-sky-100">
                        "{entry.leaderGeneralComment}"
                      </p>
                      <div className="text-[11px] text-sky-700 mt-1.5 text-right font-medium">
                        Direview oleh {entry.leaderReviewedBy} ({entry.leaderReviewedAt}) &bull; Skor Akhir: {entry.leaderScore}/100
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL FORM EVALUASI & KOMEN GENERAL LEADER */}
      {activeEntryForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-slate-100 shadow-2xl my-8 space-y-4">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Penilaian &amp; Evaluasi Leader: {activeEntryForReview.userName}
                  </h3>
                  <p className="text-xs text-slate-500">{activeEntryForReview.division} &bull; Tanggal: {selectedDate}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntryId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Rekap Centang To-Do Karyawan */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-blue-950 block">Skor Centang To-Do Karyawan:</span>
                <span className="text-blue-800">
                  {activeEntryForReview.completedTodos} dari {activeEntryForReview.totalTodos} tugas dicentang selesai oleh karyawan.
                </span>
              </div>
              <div className="text-2xl font-black text-blue-700">{activeEntryForReview.employeeScorePercent}%</div>
            </div>

            {/* Nilai Absen - Otomatis dari Absen Pagi + Siang, bukan diinput leader */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-amber-950 block">Nilai Absen (Otomatis):</span>
                <span className="text-amber-800">
                  Akumulasi dari status Absen Pagi ({activeEntryForReview.absenPagi ? (activeEntryForReview.absenPagi.status === 'tepat_waktu' ? 'Tepat Waktu' : 'Terlambat') : 'Belum Absen'}) &amp; Absen Siang ({activeEntryForReview.absenSiang ? 'Sudah Absen' : 'Belum Absen'}).
                </span>
              </div>
              <div className="text-2xl font-black text-amber-700">{getAbsenScore(activeEntryForReview)}</div>
            </div>

            {/* Checklist Validasi Tugas & Bukti */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Verifikasi Butir To-Do &amp; Lampiran Bukti:
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {activeEntryForReview.todos.map((todo) => {
                  const isChecked = verifiedTodos.includes(todo.id);
                  return (
                    <div
                      key={todo.id}
                      onClick={() => handleToggleVerifyItem(todo.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start justify-between gap-3 transition-colors ${
                        isChecked ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-800">{todo.task}</div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                            <span>Status Karyawan: {todo.completed ? 'Dicentang ✓' : 'Belum'}</span>
                            {todo.proofLink && (
                              <a
                                href={todo.proofLink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold"
                              >
                                Buka Link <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                            {todo.proofImage && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImageModal(todo.proofImage!, `Bukti: ${todo.task}`);
                                }}
                                className="text-blue-600 hover:underline flex items-center gap-0.5 font-semibold"
                              >
                                Lihat Foto <Eye className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border text-slate-600">
                        {isChecked ? 'Valid ✓' : 'Tidak Valid'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Input Nilai & Komen General */}
            <form onSubmit={handleSubmitReview} className="space-y-3.5 text-xs pt-2">
              {/* Nilai Akhir Leader - Otomatis dari Checklist Verifikasi */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">
                    Nilai Skor Akhir dari Leader (Otomatis dari Checklist):
                  </label>
                  <span className="font-extrabold text-sm text-blue-700">{computedReviewScore} / 100</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${computedReviewScore}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Skor dihitung otomatis: {verifiedTodos.length} dari {totalTodoItems} butir to-do dicentang valid oleh Leader ({activeEntryForReview.employeeScorePercent}% dicentang oleh karyawan). Centang/hilangkan centang butir di atas untuk menyesuaikan nilai.
                </p>
              </div>

              {/* Input Nilai Komunikasi - WAJIB diisi Leader */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">
                    Nilai Komunikasi <span className="text-rose-600 font-semibold">*wajib diisi</span>:
                  </label>
                  <span
                    className={`font-extrabold text-sm ${
                      communicationScore === null ? 'text-rose-500' : 'text-blue-700'
                    }`}
                  >
                    {communicationScore === null ? 'Belum dinilai' : `${communicationScore} / 100`}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[50, 60, 70, 80, 90, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCommunicationScore(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        communicationScore === val
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Lainnya"
                    value={
                      communicationScore !== null && ![50, 60, 70, 80, 90, 100].includes(communicationScore)
                        ? communicationScore
                        : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setCommunicationScore(v === '' ? null : Math.min(100, Math.max(0, Number(v))));
                    }}
                    className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p
                  className={`text-[11px] mt-1.5 ${
                    communicationScore === null ? 'text-rose-500 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {communicationScore === null
                    ? 'Pilih atau isi nilai komunikasi karyawan sebelum mengirim penilaian — kolom ini wajib diisi.'
                    : 'Menilai kualitas komunikasi & responsivitas karyawan hari ini (koordinasi, update progres, kejelasan info, dsb).'}
                </p>
              </div>

              {/* Input Komen General Leader */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Komentar General Leader (Feedback / Evaluasi Umum):
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Tuliskan catatan general jika memang kurang sesuai, ada koreksi pada tugas/link bukti, atau berikan apresiasi kerja..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  *Komentar general ini akan tampil langsung di portal karyawan dan laporan HRD.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedEntryId(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={communicationScore === null}
                  className={`px-5 py-2.5 font-bold rounded-xl transition-colors shadow-md flex items-center gap-1.5 ${
                    communicationScore === null
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Kirim Penilaian &amp; Komentar General
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
