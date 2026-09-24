import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  MessageSquare,
  AlertCircle,
  FileCheck2,
  Info
} from 'lucide-react';

export const PelanggaranSayaView: React.FC = () => {
  const { currentUser, warnings, showToast } = useApp();

  // Ambil peringatan / pelanggaran yang ditujukan kepada user yang sedang login
  const myWarnings = warnings.filter(
    (w) => w.recipientId === currentUser.id || w.recipientName === currentUser.name
  );

  // Status tanggapan lokal
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [activeRespondId, setActiveRespondId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const handleAcknowledge = (warningId: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, warningId]));
    showToast('Peringatan telah Anda konfirmasi & pahami.', 'info');
  };

  const handleSendResponse = (warningId: string) => {
    if (!responseText.trim()) {
      showToast('Harap tuliskan tanggapan Anda terlebih dahulu', 'warning');
      return;
    }
    setAcknowledgedIds((prev) => new Set([...prev, warningId]));
    setActiveRespondId(null);
    setResponseText('');
    showToast('Tanggapan Anda telah dikirimkan ke Leader / HRD!', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Kepatuhan &amp; Disiplin WFA &bull; Luzie Group</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Pelanggaran &amp; Surat Peringatan</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Daftar teguran resmi dari Leader atau HRD terkait ketepatan waktu presensi, kelengkapan target to-do list, dan bukti lampiran WFA.
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-bold flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{myWarnings.length} Catatan Pelanggaran</span>
        </div>
      </div>

      {/* Info Card Peraturan */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold">Ketentuan Standar Kerja WFA Luzie Group:</span>
          <p className="leading-relaxed text-amber-800">
            Karyawan wajib melakukan absen pagi sebelum pukul 08:30 WIB, menyusun minimal 3 to-do list, menjalankan time tracking Hubstaff, serta melakukan centang to-do dan lampiran bukti fisik sebelum pukul 12:00 WIB. Pelanggaran berulang dapat mempengaruhi evaluasi KPI bulanan.
          </p>
        </div>
      </div>

      {/* List Pelanggaran */}
      <div className="space-y-4">
        {myWarnings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Rekam Jejak Bersih!</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Anda tidak memiliki catatan teguran atau surat peringatan. Pertahankan kedisiplinan presensi dan kualitas pekerjaan WFA Anda!
            </p>
          </div>
        ) : (
          myWarnings.map((warn) => {
            const isAck = acknowledgedIds.has(warn.id) || warn.status === 'ditanggapi';

            return (
              <div
                key={warn.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 hover:border-slate-300 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{warn.title}</h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">
                      Tipe: {warn.type.replace('_', ' ')}
                    </span>
                    {isAck ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Telah Ditanggapi</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Perlu Perhatian
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                  {warn.message}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Dari: <strong className="text-slate-700">{warn.senderName}</strong></span>
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{warn.date} {warn.createdAt && `• ${warn.createdAt}`}</span>
                    </span>
                  </div>

                  {!isAck && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(warn.id)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                      >
                        Saya Mengerti
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRespondId(activeRespondId === warn.id ? null : warn.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Klarifikasi / Tanggapi</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Form Klarifikasi jika diklik */}
                {activeRespondId === warn.id && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                    <label className="block text-xs font-bold text-slate-700">
                      Tuliskan Klarifikasi / Alasan Keterlambatan / Bukti Tambahan:
                    </label>
                    <textarea
                      rows={3}
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Jelaskan alasan atau kronologi kendala yang dihadapi kepada Leader/HRD..."
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveRespondId(null)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendResponse(warn.id)}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                      >
                        Kirim Klarifikasi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
