import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { WarningItem } from '../types';
import {
  Bell,
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  UserCheck,
  Sparkles,
  Info
} from 'lucide-react';

export const KirimTeguranView: React.FC = () => {
  const { allUsers, warnings, sendWarning, deleteWarning, currentUser } = useApp();

  // Anggota tim yang SAAT INI ditugaskan ke leader ini
  const teamMembers = allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === currentUser.id);
  const myTeamIds = new Set(teamMembers.map((m) => m.id));
  // Hanya tampilkan riwayat teguran untuk anggota tim sendiri
  const teamWarnings = warnings.filter((w) => myTeamIds.has(w.recipientId));

  const [recipientId, setRecipientId] = useState<string>(teamMembers[0]?.id || '');
  const [type, setType] = useState<WarningItem['type']>('todo_siang');
  const [title, setTitle] = useState<string>('Pengingat: Centang To-Do Siang & Lampirkan Bukti');
  const [message, setMessage] = useState<string>(
    'Halo, mohon segera mencentang to-do list pekerjaan hari ini dan melampirkan bukti link atau screenshot foto sebelum jam absen siang berakhir.'
  );

  // Template cepat saat type berubah
  const handleTypeChange = (newType: WarningItem['type']) => {
    setType(newType);
    if (newType === 'todo_pagi') {
      setTitle('Pengingat: Segera Isi To-Do List Pagi');
      setMessage(
        'Halo, Anda belum melengkapi daftar to-do list hari ini. Harap segera input minimal 3 target pekerjaan sebelum mengikuti standup pagi.'
      );
    } else if (newType === 'todo_siang') {
      setTitle('Pengingat: Centang To-Do Siang & Lampirkan Bukti');
      setMessage(
        'Halo, mohon segera mencentang to-do list pekerjaan hari ini dan melampirkan bukti link atau screenshot foto sebelum jam absen siang berakhir.'
      );
    } else if (newType === 'bukti_kurang') {
      setTitle('Pemberitahuan: Bukti Pekerjaan Perlu Dilengkapi');
      setMessage(
        'Mohon periksa kembali lampiran bukti pekerjaan Anda. Tautan dokumen tidak dapat diakses atau screenshot belum memperlihatkan hasil kerja.'
      );
    } else if (newType === 'terlambat') {
      setTitle('Teguran: Keterlambatan Jam Absensi');
      setMessage(
        'Tercatat Anda melakukan presensi di luar batas waktu WFA (melewati pukul 08:30 / 13:30). Harap menjaga kedisiplinan jam kerja WFA.'
      );
    } else if (newType === 'performa') {
      setTitle('Pemberitahuan: Skor Capaian To-Do Kurang dari Target');
      setMessage(
        'Capaian to-do list Anda hari ini berada di bawah standar 70%. Mari koordinasikan kendala pekerjaan pada standup pagi berikutnya.'
      );
    } else {
      setTitle('Catatan Khusus dari Leader');
      setMessage('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !title.trim() || !message.trim()) return;

    sendWarning(recipientId, type, title, message);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <Bell className="w-4 h-4" />
            <span>Tindakan Leader &bull; Luzie Group</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Kirim Teguran &amp; Pengingat</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Kirim surat pengingat resmi atau teguran langsung ke anggota tim terkait keterlambatan absensi, pengisian to-do list, atau kelengkapan bukti.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Form Kirim Teguran */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Form Pengiriman Teguran Tim</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Pilih Anggota Tim (Penerima):
              </label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
              >
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.division} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Kategori / Alasan Teguran:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'todo_siang', label: 'Belum Centang Siang' },
                  { id: 'todo_pagi', label: 'Belum Isi To-Do Pagi' },
                  { id: 'bukti_kurang', label: 'Bukti Kurang/Tidak Valid' },
                  { id: 'terlambat', label: 'Terlambat Absen' },
                  { id: 'performa', label: 'Skor Rendah (<70%)' },
                  { id: 'custom', label: 'Pesan Khusus' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTypeChange(item.id as WarningItem['type'])}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                      type === item.id
                        ? 'bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-500/10'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Judul Teguran:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul surat teguran / pengingat..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Isi Pesan / Instruksi Leader:
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan arahan perbaikan yang harus dilakukan oleh karyawan..."
                className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-rose-600/20"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Teguran Resmi</span>
              </button>
            </div>
          </form>
        </div>

        {/* Kolom Kanan: Log Teguran Terkirim */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Riwayat Teguran Terkirim</span>
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {teamWarnings.length} Pesan
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {teamWarnings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Belum ada teguran terkirim.</p>
            ) : (
              teamWarnings.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{w.recipientName}</span>
                    <button
                      onClick={() => deleteWarning(w.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                      title="Hapus riwayat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                    {w.title}
                  </div>

                  <p className="text-slate-600 leading-relaxed text-[11px]">{w.message}</p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/50">
                    <span>{w.createdAt} &bull; {w.date}</span>
                    <span className="font-semibold text-blue-600 uppercase">{w.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
