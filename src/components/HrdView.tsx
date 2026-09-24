import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DailyWfaEntry, TodoItem } from '../types';
import {
  Briefcase,
  Users,
  CheckCircle2,
  TrendingUp,
  Download,
  Search,
  ExternalLink,
  Image as ImageIcon,
  MessageSquareQuote,
  Eye,
  Calendar,
  Filter,
  CheckSquare,
  BarChart3,
  ArrowRight,
  Settings,
  Globe
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface HrdViewProps {
  onNavigate?: (menu: string) => void;
}

export const HrdView: React.FC<HrdViewProps> = ({ onNavigate }) => {
  const { entries, selectedDate, setSelectedDate, openImageModal } = useApp();

  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<DailyWfaEntry | null>(null);

  // Filter entries untuk tanggal aktif
  const dayEntries = entries.filter((e) => e.date === selectedDate);

  // Divisi unik
  const divisions = Array.from(new Set(entries.map((e) => e.division)));

  // Filtered entries
  const filteredEntries = dayEntries.filter((entry) => {
    const matchDiv = divisionFilter === 'all' || entry.division === divisionFilter;
    const matchSearch =
      entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.division.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDiv && matchSearch;
  });

  // Metrik HRD
  const totalEmployees = dayEntries.length;
  const avgScore =
    totalEmployees > 0
      ? Math.round(
          dayEntries.reduce((acc, curr) => acc + curr.employeeScorePercent, 0) / totalEmployees
        )
      : 0;
  const onTimeMorning = dayEntries.filter((e) => e.absenPagi?.status === 'tepat_waktu').length;
  const reviewedByLeader = dayEntries.filter((e) => e.status === 'selesai_direview').length;

  // Ekspor CSV
  const handleExportCsv = () => {
    const headers = [
      'Nama Karyawan',
      'Divisi',
      'Tanggal',
      'Absen Pagi',
      'Status Pagi',
      'Absen Siang',
      'To-Do Selesai',
      'Total To-Do',
      'Skor Centang (%)',
      'Nilai Leader',
      'Komentar General Leader',
    ];

    const rows = filteredEntries.map((e) => [
      `"${e.userName}"`,
      `"${e.division}"`,
      `"${e.date}"`,
      `"${e.absenPagi?.time || '-'}"`,
      `"${e.absenPagi?.status || '-'}"`,
      `"${e.absenSiang?.time || '-'}"`,
      e.completedTodos,
      e.totalTodos,
      `${e.employeeScorePercent}%`,
      e.leaderScore !== null ? e.leaderScore : '-',
      `"${(e.leaderGeneralComment || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_WFA_LuzieGroup_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner HRD */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center shadow-xs">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Dashboard &amp; Rekap HRD</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                People &amp; Culture
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemantauan menyeluruh sistem WFA: Kehadiran pagi/siang, penilaian to-do centang, lampiran bukti, dan feedback leader.
            </p>
          </div>
        </div>

        {/* Date Selector & Export */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 text-xs border-none focus:outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Grid Kartu Metrik HRD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Karyawan WFA</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">{totalEmployees} Orang</div>
          <p className="text-[11px] text-slate-400 mt-1">Anggota aktif terdaftar</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Rata-rata Skor Centang</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{avgScore}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Dihitung dari to-do yang dicentang</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tepat Waktu Pagi</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {onTimeMorning} / {totalEmployees}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sebelum jam 08:30 WIB</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Selesai Review Leader</span>
            <CheckSquare className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 mt-2">
            {reviewedByLeader} / {totalEmployees}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dinilai &amp; dikomentari leader</p>
        </div>
      </div>

      {/* Quick Navigation Cards to Specialized Modules */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate?.('rekap-global')}
          className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-600">
            <Globe className="w-4 h-4" />
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="font-bold text-slate-800 text-xs mt-2">Rekap Absen Global</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Filter riwayat lengkap &amp; ekspor</div>
        </button>

        <button
          onClick={() => onNavigate?.('analisis-performa')}
          className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-600">
            <TrendingUp className="w-4 h-4" />
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="font-bold text-slate-800 text-xs mt-2">Grafik Performa Tim</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Visualisasi tren &amp; top performer</div>
        </button>

        <button
          onClick={() => onNavigate?.('manajemen-akun')}
          className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-600">
            <Users className="w-4 h-4" />
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="font-bold text-slate-800 text-xs mt-2">Manajemen Akun</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Hak akses, divisi &amp; koordinator</div>
        </button>

        <button
          onClick={() => onNavigate?.('pengaturan-wfa')}
          className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-xs transition-all text-left group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-sky-600">
            <Settings className="w-4 h-4" />
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="font-bold text-slate-800 text-xs mt-2">Pengaturan WFA</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Jam batas, KPI target &amp; Google Meet</div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-700"
          >
            <option value="all">Semua Divisi</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel Data Rekap WFA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Absen Pagi</th>
                <th className="py-3.5 px-4">Absen Siang</th>
                <th className="py-3.5 px-4">To-Do Centang (Skor)</th>
                <th className="py-3.5 px-4">Nilai Leader</th>
                <th className="py-3.5 px-4">Komentar General Leader</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada data yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Nama & Divisi */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{item.userName}</div>
                      <div className="text-[11px] text-slate-400">{item.division}</div>
                    </td>

                    {/* Absen Pagi */}
                    <td className="py-3.5 px-4">
                      {item.absenPagi ? (
                        <div>
                          <span className="font-semibold text-slate-700">{item.absenPagi.time}</span>
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              item.absenPagi.status === 'tepat_waktu'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.absenPagi.status === 'tepat_waktu' ? 'Tepat' : 'Telat'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum</span>
                      )}
                    </td>

                    {/* Absen Siang */}
                    <td className="py-3.5 px-4">
                      {item.absenSiang ? (
                        <span className="font-semibold text-slate-700">{item.absenSiang.time}</span>
                      ) : (
                        <span className="text-slate-400 italic">Belum</span>
                      )}
                    </td>

                    {/* To-Do Centang & Skor */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${item.employeeScorePercent}%` }}
                          />
                        </div>
                        <span className="font-bold text-blue-700">{item.employeeScorePercent}%</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {item.completedTodos} dari {item.totalTodos} dicentang
                      </span>
                    </td>

                    {/* Nilai Leader */}
                    <td className="py-3.5 px-4">
                      {item.leaderScore !== null ? (
                        <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {item.leaderScore} / 100
                        </span>
                      ) : (
                        <span className="text-amber-600 text-[11px] font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Menunggu
                        </span>
                      )}
                    </td>

                    {/* Komentar General Leader */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {item.leaderGeneralComment ? (
                        <p className="truncate text-slate-700 italic" title={item.leaderGeneralComment}>
                          "{item.leaderGeneralComment}"
                        </p>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Aksi Lihat Detail Bukti */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedDetailEntry(item)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Detail To-Do &amp; Bukti
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL RINCIAN TO-DO & BUKTI PEKERJAAN DARI HRD */}
      {selectedDetailEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-slate-100 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Rincian To-Do List: {selectedDetailEntry.userName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDetailEntry.division} &bull; Tanggal: {selectedDetailEntry.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Rekap Nilai & Komentar General */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-blue-900 font-bold block">Skor Centang Karyawan:</span>
                <span className="text-xl font-extrabold text-blue-700">
                  {selectedDetailEntry.employeeScorePercent}% ({selectedDetailEntry.completedTodos}/{selectedDetailEntry.totalTodos} selesai)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-900 font-bold block">Nilai dari Leader:</span>
                <span className="text-xl font-extrabold text-emerald-700">
                  {selectedDetailEntry.leaderScore !== null ? `${selectedDetailEntry.leaderScore} / 100` : 'Belum dinilai'}
                </span>
              </div>
            </div>

            {selectedDetailEntry.leaderGeneralComment && (
              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-sky-900 mb-1">
                  <MessageSquareQuote className="w-4 h-4 text-sky-600" />
                  <span>Komentar General Leader:</span>
                </div>
                <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-sky-100">
                  "{selectedDetailEntry.leaderGeneralComment}"
                </p>
                <div className="text-[11px] text-sky-600 mt-1 text-right">
                  Oleh: {selectedDetailEntry.leaderReviewedBy} ({selectedDetailEntry.leaderReviewedAt})
                </div>
              </div>
            )}

            {/* List Tugas & Bukti */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <span className="text-xs font-bold text-slate-700 block">Daftar Tugas &amp; Bukti:</span>
              {selectedDetailEntry.todos.map((todo, idx) => (
                <div key={todo.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400">#{idx + 1}</span>
                      <span className="font-semibold text-slate-800">{todo.task}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        todo.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {todo.completed ? 'Dicentang ✓' : 'Belum'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] pt-1 border-t border-slate-200/60">
                    {todo.proofLink ? (
                      <a
                        href={todo.proofLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        Buka Link Bukti <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Tidak ada link</span>
                    )}

                    {todo.proofImage ? (
                      <button
                        onClick={() => openImageModal(todo.proofImage!, `Bukti: ${todo.task}`)}
                        className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Lihat Foto Screenshot
                      </button>
                    ) : (
                      <span className="text-slate-400 italic">Tidak ada foto</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedDetailEntry(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
