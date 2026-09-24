import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings,
  Clock,
  CheckSquare,
  Award,
  Video,
  Bell,
  Save,
  RotateCcw,
  CheckCircle2,
  Shield,
  FileCheck,
  PieChart,
  Users,
  X,
  Plus
} from 'lucide-react';
import { INITIAL_SETTINGS } from '../data/initialData';

export const PengaturanWfaView: React.FC = () => {
  const { wfaSettings, updateWfaSettings, showToast } = useApp();

  const [formData, setFormData] = useState(wfaSettings);
  const [isSaved, setIsSaved] = useState(false);
  const [newDivisiName, setNewDivisiName] = useState('');

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const totalBobot = (formData.bobotAbsen || 0) + (formData.bobotTodo || 0) + (formData.bobotKomunikasi || 0);

  const handleAddDivisi = () => {
    const name = newDivisiName.trim();
    if (!name) return;
    if ((formData.divisiList || []).some((d) => d.toLowerCase() === name.toLowerCase())) {
      showToast('Divisi tersebut sudah ada di daftar.', 'warning');
      return;
    }
    setFormData((prev) => ({ ...prev, divisiList: [...(prev.divisiList || []), name] }));
    setNewDivisiName('');
  };

  const handleRemoveDivisi = (name: string) => {
    setFormData((prev) => ({ ...prev, divisiList: (prev.divisiList || []).filter((d) => d !== name) }));
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => {
      const exists = prev.workDays.includes(day);
      const updated = exists ? prev.workDays.filter((d) => d !== day) : [...prev.workDays, day];
      return { ...prev, workDays: updated };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateWfaSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    setFormData(INITIAL_SETTINGS);
    updateWfaSettings(INITIAL_SETTINGS);
    showToast('Pengaturan dikembalikan ke nilai bawaan (default)', 'info');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-xs font-semibold uppercase tracking-wider">
            <Settings className="w-4 h-4" />
            <span>Luzie Group &bull; Konfigurasi HR &amp; Operasional WFA</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Pengaturan Sistem WFA</h1>
          <p className="text-xs text-blue-100/90 mt-1 max-w-xl">
            Kelola parameter kebijakan kerja, jam presensi pagi &amp; siang, standar centang to-do list, passing grade KPI, dan integrasi Google Meet.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Semua parameter pengaturan kebijakan sistem WFA berhasil disimpan dan langsung diterapkan ke seluruh karyawan!
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Jam Kerja & Presensi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">1. Jadwal Jam Masuk &amp; Pulang WFA</h2>
              <p className="text-xs text-slate-500">
                Tentukan batas waktu presensi harian serta batas toleransi keterlambatan sistem.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Batas Jam Absen Pagi (Masuk)
              </label>
              <input
                type="time"
                value={formData.morningAbsenTime}
                onChange={(e) => setFormData({ ...formData, morningAbsenTime: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Presensi setelah jam ini ditandai terlambat
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Batas Jam Absen Siang (Pulang)
              </label>
              <input
                type="time"
                value={formData.afternoonAbsenTime}
                onChange={(e) => setFormData({ ...formData, afternoonAbsenTime: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Waktu pengisian to-do centang dan absensi selesai
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Toleransi Keterlambatan (Menit)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={formData.lateToleranceMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, lateToleranceMinutes: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Dispensasi waktu sebelum sistem mengirim peringatan
              </span>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-2 text-xs">
              Hari Kerja WFA Aktif
            </label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const isChecked = formData.workDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isChecked
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isChecked ? `✓ ${day}` : day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2: Kebijakan To-Do List & Bukti Pekerjaan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                2. Kebijakan To-Do List &amp; Bukti Pekerjaan
              </h2>
              <p className="text-xs text-slate-500">
                Atur kewajiban to-do list centang, lampiran link Google Drive/Figma/PR, dan foto screenshot.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Minimal Task To-Do per Hari
              </label>
              <input
                type="number"
                min="1"
                max="15"
                value={formData.minTodosPerDay}
                onChange={(e) =>
                  setFormData({ ...formData, minTodosPerDay: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Jumlah minimal item to-do list yang wajib diisi karyawan di pagi hari
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <span className="font-bold text-slate-800 block">Wajib Lampiran Bukti Kerja</span>
                <span className="text-[11px] text-slate-500">
                  Karyawan harus menyertakan link URL atau foto untuk menyelesaikan centang
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.requireProofAttachment}
                onChange={(e) =>
                  setFormData({ ...formData, requireProofAttachment: e.target.checked })
                }
                className="w-5 h-5 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Standar Evaluasi & Target KPI */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                3. Standar Evaluasi &amp; Kelulusan KPI
              </h2>
              <p className="text-xs text-slate-500">
                Tentukan target persentase skor centang to-do list dan pembinaan otomatis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Target Minimum Skor KPI (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={formData.minKpiPassScore}
                  onChange={(e) =>
                    setFormData({ ...formData, minKpiPassScore: parseInt(e.target.value) })
                  }
                  className="w-full accent-amber-600"
                />
                <span className="font-extrabold text-amber-600 font-mono text-sm w-12 text-right">
                  {formData.minKpiPassScore}%
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Skor to-do di bawah {formData.minKpiPassScore}% dikategorikan "Perlu Bimbingan"
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <span className="font-bold text-slate-800 block">Teguran Keterlambatan Otomatis</span>
                <span className="text-[11px] text-slate-500">
                  Kirim notifikasi peringatan jika karyawan telat absen masuk
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoSendLateWarning}
                onChange={(e) =>
                  setFormData({ ...formData, autoSendLateWarning: e.target.checked })
                }
                className="w-5 h-5 text-amber-600 rounded-md border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <span className="font-bold text-slate-800 block">Pengingat To-Do Belum Dicentang</span>
                <span className="text-[11px] text-slate-500">
                  Notifikasi ke karyawan jika to-do belum dicentang menjelang jam 12:00
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.autoSendIncompleteTodoWarning}
                onChange={(e) =>
                  setFormData({ ...formData, autoSendIncompleteTodoWarning: e.target.checked })
                }
                className="w-5 h-5 text-amber-600 rounded-md border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Bobot Penilaian Performa */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">4. Bobot Penilaian Performa</h2>
              <p className="text-xs text-slate-500">
                Atur persentase bobot komponen yang membentuk Skor Akhir harian karyawan.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-900 flex items-start gap-2">
            <Settings className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-600" />
            <span>
              Skor harian karyawan = rata-rata berbobot dari 3 komponen: <strong>Ketepatan Absen</strong>{' '}
              (otomatis dari absen pagi &amp; siang), <strong>Hasil To-Do List</strong> (dikonfirmasi
              koordinator), dan <strong>Komunikasi</strong> (dinilai koordinator setiap WFA). Total bobot tidak
              harus 100 — sistem otomatis menormalkan berdasarkan proporsi yang diisi.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Bobot Ketepatan Absen (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.bobotAbsen}
                onChange={(e) => setFormData({ ...formData, bobotAbsen: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Bobot Hasil To-Do (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.bobotTodo}
                onChange={(e) => setFormData({ ...formData, bobotTodo: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Bobot Komunikasi (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.bobotKomunikasi}
                onChange={(e) => setFormData({ ...formData, bobotKomunikasi: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-semibold focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div
            className={`text-[11px] font-semibold px-3 py-2 rounded-lg ${
              totalBobot === 100
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            Total bobot saat ini: {totalBobot}%{' '}
            {totalBobot === 100
              ? '(pas 100% — ideal)'
              : '(sistem tetap menghitung proporsional walau bukan 100%)'}
          </div>
        </div>

        {/* SECTION 5: Kelola Divisi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">5. Kelola Divisi</h2>
              <p className="text-xs text-slate-500">
                Daftar divisi custom ini akan muncul di dropdown saat HRD menambah karyawan, dan di filter Data
                Karyawan.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(formData.divisiList || []).map((divisi) => (
              <span
                key={divisi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold"
              >
                {divisi}
                <button
                  type="button"
                  onClick={() => handleRemoveDivisi(divisi)}
                  className="text-blue-400 hover:text-rose-600 transition-colors"
                  title={`Hapus divisi ${divisi}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            {(formData.divisiList || []).length === 0 && (
              <span className="text-xs text-slate-400 italic">Belum ada divisi. Tambahkan di bawah.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDivisiName}
              onChange={(e) => setNewDivisiName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDivisi();
                }
              }}
              placeholder="Nama divisi baru..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddDivisi}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Divisi
            </button>
          </div>
        </div>

        {/* SECTION 6: Konfigurasi Google Meet Perusahaan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                6. Integrasi Google Meet Perusahaan
              </h2>
              <p className="text-xs text-slate-500">
                Link cadangan (fallback) — hanya dipakai kalau koordinator belum mengatur link
                Google Meet pribadinya sendiri di halaman "Google Meet Pagi". Setiap koordinator
                disarankan pakai link Meet miliknya masing-masing supaya bisa meeting bersamaan
                tanpa bentrok satu sama lain.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Default Google Meet URL (Fallback)
              </label>
              <input
                type="url"
                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                value={formData.companyZoomLink}
                onChange={(e) => setFormData({ ...formData, companyZoomLink: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                PIN / Kode Tambahan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Kosongkan jika tidak perlu"
                value={formData.companyZoomPasscode}
                onChange={(e) => setFormData({ ...formData, companyZoomPasscode: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
          >
            Batal &amp; Reset
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan WFA</span>
          </button>
        </div>
      </form>
    </div>
  );
};
