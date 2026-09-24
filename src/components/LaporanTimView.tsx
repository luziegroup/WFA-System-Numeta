import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Users,
  Award,
  Sparkles
} from 'lucide-react';

export const LaporanTimView: React.FC = () => {
  const { entries, selectedDate, allUsers, showToast, currentUser } = useApp();
  const [period, setPeriod] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');
  const [executiveNote, setExecutiveNote] = useState<string>(
    'Secara keseluruhan efektivitas WFA tim minggu ini berjalan optimal dengan adopsi sistem checklist to-do centang dan lampiran bukti kerja. Keterlambatan absensi berkurang signifikan.'
  );

  // Anggota tim yang SAAT INI ditugaskan ke leader ini
  const teamMembers = allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === currentUser.id);
  const myTeamIds = new Set(teamMembers.map((m) => m.id));
  const dayEntries = entries.filter((e) => e.date === selectedDate && myTeamIds.has(e.userId));

  // Akun HRD aktif yang menjadi penanggung jawab "Mengetahui" — diambil otomatis dari data akun,
  // bukan nama tetap, supaya selalu sesuai dengan siapa pun yang sedang menjabat sebagai HRD.
  const hrdUser = allUsers.find((u) => u.role === 'hrd' && u.isActive !== false) || allUsers.find((u) => u.role === 'hrd');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadReport = () => {
    showToast('Laporan WFA Tim Luzie Group berhasil diekspor', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Dokumentasi WFA &bull; Luzie Group</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Laporan Tim WFA</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Kompilasi laporan periodik kinerja tim, ringkasan pencapaian to-do list centang, dan laporan pertanggungjawaban untuk manajemen Luzie Group.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-[#004080] font-bold text-xs transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Unduh PDF / Dokumen</span>
          </button>
        </div>
      </div>

      {/* Periode Selector */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-2">
            Pilih Periode Laporan:
          </span>
          {(['harian', 'mingguan', 'bulanan'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                period === p
                  ? 'bg-[#004080] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Laporan {p}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>Tanggal acuan: {selectedDate}</span>
        </div>
      </div>

      {/* Laporan Preview Document Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
        <div className="border-b-2 border-slate-900 pb-5 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
              LAPORAN KINERJA WORK FROM ANYWHERE (WFA)
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">LUZIE GROUP INDONESIA</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Divisi {currentUser.division} &bull; Koordinator: {currentUser.name}
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold text-slate-800">Tanggal Terbit: {selectedDate}</div>
            <div className="text-slate-400 text-[11px]">Sistem WFA Luzie V2.5</div>
          </div>
        </div>

        {/* Ringkasan Eksekutif */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            1. Ringkasan Eksekutif Leader:
          </h3>
          <textarea
            rows={3}
            value={executiveNote}
            onChange={(e) => setExecutiveNote(e.target.value)}
            className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 leading-relaxed"
          />
        </div>

        {/* Tabel Ringkasan Capaian */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            2. Rekapitulasi Capaian To-Do List Centang &amp; Absensi:
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Nama Anggota</th>
                  <th className="py-2.5 px-3">Status Absen</th>
                  <th className="py-2.5 px-3">Capaian Centang To-Do</th>
                  <th className="py-2.5 px-3">Skor Leader</th>
                  <th className="py-2.5 px-3">Status Kinerja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamMembers.map((member) => {
                  const entry = dayEntries.find((e) => e.userId === member.id);
                  const centangPercent = entry?.employeeScorePercent || 0;
                  const leaderScore = entry?.leaderScore ?? centangPercent;

                  return (
                    <tr key={member.id}>
                      <td className="py-3 px-3 font-semibold text-slate-900">{member.name}</td>
                      <td className="py-3 px-3">
                        {entry?.absenPagi && entry?.absenSiang
                          ? 'Pagi & Siang Lengkap'
                          : entry?.absenPagi
                          ? 'Absen Pagi Sah'
                          : 'Belum Presensi'}
                      </td>
                      <td className="py-3 px-3 font-bold text-blue-700">
                        {centangPercent}% ({entry?.completedTodos || 0}/{entry?.totalTodos || 0} task)
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700">{leaderScore} / 100</td>
                      <td className="py-3 px-3">
                        {leaderScore >= 80 ? (
                          <span className="text-emerald-700 font-semibold">Sangat Baik</span>
                        ) : leaderScore >= 70 ? (
                          <span className="text-blue-700 font-semibold">Memenuhi Target</span>
                        ) : (
                          <span className="text-rose-600 font-semibold">Perlu Evaluasi</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tanda Tangan Digital — otomatis mengikuti akun yang sedang login (leader) & akun HRD aktif */}
        <div className="pt-8 border-t border-slate-100 grid grid-cols-2 gap-8 text-xs text-center">
          <div>
            <p className="text-slate-400">Dibuat oleh,</p>
            <div className="font-bold text-slate-800 mt-12">{currentUser.name}</div>
            <p className="text-slate-500 text-[11px]">Koordinator Tim WFA &bull; {currentUser.division}</p>
          </div>
          <div>
            <p className="text-slate-400">Mengetahui HRD,</p>
            {hrdUser ? (
              <>
                <div className="font-bold text-slate-800 mt-12">{hrdUser.name}</div>
                <p className="text-slate-500 text-[11px]">{hrdUser.division || 'People & Culture Luzie Group'}</p>
              </>
            ) : (
              <>
                <div className="font-bold text-slate-300 mt-12">Belum ada akun HRD</div>
                <p className="text-slate-400 text-[11px]">Menunggu penunjukan HRD</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
