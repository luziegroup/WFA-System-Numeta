import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DailyWfaEntry } from '../types';
import { getFinalScore, getAbsenScore, weightsFromSettings } from '../utils/scoreUtils';
import {
  BarChart2,
  Calendar,
  Search,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  Filter,
  Eye,
  ExternalLink,
  Image as ImageIcon,
  CheckSquare,
  Award,
  UserCheck,
  ChevronRight,
  TrendingUp,
  X,
  Users,
  UserX
} from 'lucide-react';

export const RekapAbsensiTimView: React.FC = () => {
  const { entries, selectedDate, setSelectedDate, allUsers, showToast, openImageModal, wfaSettings, currentUser } = useApp();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | 'month' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>(selectedDate);
  const [endDate, setEndDate] = useState<string>(selectedDate);

  // Modal Detail State
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<DailyWfaEntry | null>(null);

  // Divisi dan Karyawan list (hanya anggota tim yang SAAT INI ditugaskan ke leader ini)
  const employees = useMemo(
    () => allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === currentUser.id),
    [allUsers, currentUser.id]
  );
  const divisions = useMemo(() => Array.from(new Set(employees.map((u) => u.division))), [employees]);
  const myTeamIds = useMemo(() => new Set(employees.map((u) => u.id)), [employees]);

  // Pemantauan Kehadiran Tim pada tanggal terpilih — dibangun dari SELURUH anggota tim
  // (bukan dari daftar `entries`), supaya karyawan yang belum melakukan absen sama sekali
  // hari itu tetap terlihat jelas sebagai "Belum Absen", bukan malah hilang dari daftar.
  const attendanceToday = useMemo(
    () =>
      employees.map((member) => ({
        member,
        entry: entries.find((e) => e.userId === member.id && e.date === selectedDate) || null,
      })),
    [employees, entries, selectedDate]
  );
  const hadirPagiTodayCount = attendanceToday.filter((a) => !!a.entry?.absenPagi).length;
  const hadirSiangTodayCount = attendanceToday.filter((a) => !!a.entry?.absenSiang).length;
  const belumAbsenTodayCount = attendanceToday.filter((a) => !a.entry?.absenPagi).length;

  // Filter Data
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // 0. Hanya anggota tim leader ini
      if (!myTeamIds.has(e.userId)) return false;

      // 1. Search (Nama, Divisi, Email)
      const matchesSearch =
        e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.division.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.userEmail.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Divisi
      const matchesDiv = filterDivision === 'all' || e.division === filterDivision;

      // 3. User
      const matchesUser = filterUser === 'all' || e.userId === filterUser;

      // 4. Status Absensi
      let matchesStatus = true;
      if (filterStatus === 'lengkap') {
        matchesStatus = !!e.absenPagi && !!e.absenSiang;
      } else if (filterStatus === 'pagi_only') {
        matchesStatus = !!e.absenPagi && !e.absenSiang;
      } else if (filterStatus === 'terlambat') {
        matchesStatus = e.absenPagi?.status === 'terlambat' || e.absenSiang?.status === 'terlambat';
      } else if (filterStatus === 'lulus_kpi') {
        matchesStatus = e.employeeScorePercent >= 70;
      } else if (filterStatus === 'perlu_bimbingan') {
        matchesStatus = e.employeeScorePercent < 70;
      }

      // 5. Periode Tanggal
      let matchesPeriod = true;
      if (periodPreset === 'today') {
        matchesPeriod = e.date === selectedDate;
      } else if (periodPreset === 'custom') {
        matchesPeriod = (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate);
      } else if (periodPreset === '7days') {
        const today = new Date(selectedDate);
        const entryDate = new Date(e.date);
        const diffTime = today.getTime() - entryDate.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        matchesPeriod = diffDays >= 0 && diffDays <= 7;
      } else if (periodPreset === 'month') {
        matchesPeriod = e.date.substring(0, 7) === selectedDate.substring(0, 7);
      }

      return matchesSearch && matchesDiv && matchesUser && matchesStatus && matchesPeriod;
    });
  }, [entries, myTeamIds, searchTerm, filterDivision, filterUser, filterStatus, periodPreset, selectedDate, startDate, endDate]);

  // Metrik Statistik Berdasarkan Filter Aktif
  const stats = useMemo(() => {
    const totalRecords = filteredEntries.length;
    if (totalRecords === 0) {
      return { total: 0, onTimePercent: 0, avgTodoScore: 0, avgLeaderScore: 0, lateCount: 0 };
    }

    let onTimeCount = 0;
    let lateCount = 0;
    let sumTodo = 0;
    let sumLeader = 0;
    let leaderScoreCount = 0;

    filteredEntries.forEach((e) => {
      if (e.absenPagi?.status === 'tepat_waktu') onTimeCount++;
      if (e.absenPagi?.status === 'terlambat' || e.absenSiang?.status === 'terlambat') lateCount++;
      sumTodo += e.employeeScorePercent;
      if (e.leaderScore !== null) {
        sumLeader += e.leaderScore;
        leaderScoreCount++;
      }
    });

    return {
      total: totalRecords,
      onTimePercent: Math.round((onTimeCount / totalRecords) * 100),
      avgTodoScore: Math.round(sumTodo / totalRecords),
      avgLeaderScore: leaderScoreCount > 0 ? Math.round(sumLeader / leaderScoreCount) : 0,
      lateCount,
    };
  }, [filteredEntries]);

  // Ekspor CSV
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'warning');
      return;
    }

    const headers = [
      'Tanggal',
      'Nama Karyawan',
      'Divisi',
      'Email',
      'Jam Masuk (Pagi)',
      'Status Pagi',
      'Lokasi Pagi',
      'Jam Pulang (Siang)',
      'Status Siang',
      'Lokasi Siang',
      'Total To-Do',
      'To-Do Selesai',
      'Persentase Centang (%)',
      'Nilai Absen',
      'Nilai Leader',
      'Nilai Komunikasi',
      'Skor Akhir',
      'Komentar Leader'
    ];

    const rows = filteredEntries.map((e) => [
      e.date,
      `"${e.userName}"`,
      `"${e.division}"`,
      e.userEmail,
      e.absenPagi?.time || '-',
      e.absenPagi?.status === 'tepat_waktu' ? 'Tepat Waktu' : e.absenPagi ? 'Terlambat' : '-',
      `"${e.absenPagi?.location || '-'}"`,
      e.absenSiang?.time || '-',
      e.absenSiang?.status === 'tepat_waktu' ? 'Tepat Waktu' : e.absenSiang ? 'Terlambat' : '-',
      `"${e.absenSiang?.location || '-'}"`,
      e.totalTodos,
      e.completedTodos,
      `${e.employeeScorePercent}%`,
      getAbsenScore(e),
      e.leaderScore !== null ? e.leaderScore : '-',
      e.leaderCommunicationScore !== null ? e.leaderCommunicationScore : '-',
      getFinalScore(e, weightsFromSettings(wfaSettings)) !== null ? getFinalScore(e, weightsFromSettings(wfaSettings)) : '-',
      `"${(e.leaderGeneralComment || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_absensi_tim_wfa_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('File CSV rekap absensi tim berhasil diunduh', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Koordinator */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <BarChart2 className="w-4 h-4" />
            <span>Luzie Group &bull; Monitoring Presensi Tim WFA</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Rekap Absensi Tim</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Tabel rekaman kehadiran kerja WFA harian, jam absen pagi dan siang, to-do list centang, bukti link/foto, serta nilai evaluasi leader.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-[#004080] font-bold text-xs transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Grid 4 Kartu Metrik Rekap */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Total Kehadiran</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{stats.total} Catatan</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Sesuai rentang filter aktif</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Ketepatan Waktu</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{stats.onTimePercent}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.lateCount} kali terlambat</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Rata-rata Skor To-Do</span>
            <CheckSquare className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-700 mt-2">{stats.avgTodoScore}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Dari to-do yang dicentang</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Rata-rata Nilai Leader</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">{stats.avgLeaderScore} / 100</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Evaluasi &amp; review leader</p>
        </div>
      </div>

      {/* Pemantauan Kehadiran Tim — siapa yang SUDAH & BELUM absen pada tanggal terpilih */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Pemantauan Kehadiran Tim
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Status absen seluruh anggota tim pada tanggal <span className="font-semibold text-slate-700">{selectedDate}</span> — termasuk yang belum absen sama sekali hari ini.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] shrink-0">
            <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {hadirPagiTodayCount} Sudah Absen Pagi
            </span>
            <span className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {hadirSiangTodayCount} Sudah Absen Siang
            </span>
            <span className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold border border-rose-200 flex items-center gap-1">
              <UserX className="w-3.5 h-3.5" /> {belumAbsenTodayCount} Belum Absen
            </span>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada anggota tim yang ditugaskan ke Anda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
            {attendanceToday.map(({ member, entry }) => {
              const hasPagi = !!entry?.absenPagi;
              const hasSiang = !!entry?.absenSiang;
              return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                    hasPagi ? 'border-slate-200 bg-slate-50/60' : 'border-rose-200 bg-rose-50/50'
                  }`}
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-9 h-9 rounded-full object-cover border border-white shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-xs truncate">{member.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{member.division}</div>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      {hasPagi ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Pagi {entry!.absenPagi!.time}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          Belum Absen
                        </span>
                      )}
                      {hasSiang && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          Siang {entry!.absenSiang!.time}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Bar Lengkap Sesuai Permintaan Logika */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Periode Preset Tab */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">
              Periode:
            </span>
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari Terakhir' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'custom', label: 'Rentang Kustom' },
              { id: 'all', label: 'Semua Riwayat' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  periodPreset === p.id
                    ? 'bg-[#004080] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Quick Date Picker */}
          {periodPreset === 'today' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
              />
              <span className="text-slate-500 font-medium">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
              />
            </div>
          )}
        </div>

        {/* Input Pencarian & Dropdown Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Karyawan */}
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
          >
            <option value="all">Semua Anggota Tim</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.division})
              </option>
            ))}
          </select>

          {/* Filter Divisi */}
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
          >
            <option value="all">Semua Divisi</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Filter Status Absensi */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
          >
            <option value="all">Semua Status Kehadiran</option>
            <option value="lengkap">Hadir Lengkap (Pagi &amp; Siang)</option>
            <option value="pagi_only">Baru Absen Pagi</option>
            <option value="terlambat">Ada Keterlambatan</option>
            <option value="lulus_kpi">Lulus KPI (&ge; 70%)</option>
            <option value="perlu_bimbingan">Perlu Bimbingan (&lt; 70%)</option>
          </select>
        </div>
      </div>

      {/* Tabel Data Rekap Absensi */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Absen Pagi</th>
                <th className="py-3.5 px-4">Absen Siang</th>
                <th className="py-3.5 px-4">To-Do Centang (Skor)</th>
                <th className="py-3.5 px-4">Nilai Absen</th>
                <th className="py-3.5 px-4">Nilai Leader</th>
                <th className="py-3.5 px-4">Komunikasi</th>
                <th className="py-3.5 px-4">Skor Akhir</th>
                <th className="py-3.5 px-4">Status &amp; Komentar</th>
                <th className="py-3.5 px-4 text-right">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BarChart2 className="w-8 h-8 text-slate-300" />
                      <p className="font-medium">Tidak ada data absensi yang sesuai filter kriteria.</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setFilterDivision('all');
                          setFilterUser('all');
                          setFilterStatus('all');
                          setPeriodPreset('all');
                        }}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        Reset Filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Tanggal */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                      {e.date}
                    </td>

                    {/* Karyawan */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{e.userName}</div>
                      <div className="text-[11px] text-slate-400">{e.division}</div>
                    </td>

                    {/* Absen Pagi */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {e.absenPagi ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-slate-800">
                              {e.absenPagi.time}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                e.absenPagi.status === 'tepat_waktu'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {e.absenPagi.status === 'tepat_waktu' ? 'Tepat' : 'Telat'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px] flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{e.absenPagi.location}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum absen</span>
                      )}
                    </td>

                    {/* Absen Siang */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {e.absenSiang ? (
                        <div>
                          <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            {e.absenSiang.time}
                          </span>
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px] flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{e.absenSiang.location}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum absen</span>
                      )}
                    </td>

                    {/* To-Do Centang */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              e.employeeScorePercent >= 70 ? 'bg-blue-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${e.employeeScorePercent}%` }}
                          />
                        </div>
                        <span
                          className={`font-bold ${
                            e.employeeScorePercent >= 70 ? 'text-blue-700' : 'text-amber-600'
                          }`}
                        >
                          {e.employeeScorePercent}%
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {e.completedTodos} dari {e.totalTodos} task dicentang
                      </div>
                    </td>

                    {/* Nilai Absen (Otomatis dari Pagi + Siang) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-extrabold px-2.5 py-0.5 rounded-lg border text-xs bg-amber-50 text-amber-800 border-amber-200">
                        {getAbsenScore(e)} / 100
                      </span>
                    </td>

                    {/* Nilai Leader */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {e.leaderScore !== null ? (
                        <span
                          className={`font-extrabold px-2.5 py-0.5 rounded-lg border text-xs ${
                            e.leaderScore >= 80
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : e.leaderScore >= 70
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {e.leaderScore} / 100
                        </span>
                      ) : (
                        <span className="text-amber-600 text-[11px] font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Menunggu Review
                        </span>
                      )}
                    </td>

                    {/* Nilai Komunikasi */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {e.leaderCommunicationScore !== null ? (
                        <span className="font-extrabold px-2.5 py-0.5 rounded-lg border text-xs bg-sky-50 text-sky-800 border-sky-200">
                          {e.leaderCommunicationScore} / 100
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">&mdash;</span>
                      )}
                    </td>

                    {/* Skor Akhir Gabungan */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getFinalScore(e, weightsFromSettings(wfaSettings)) !== null ? (
                        <span className="font-extrabold text-sm text-[#004080]">{getFinalScore(e, weightsFromSettings(wfaSettings))} / 100</span>
                      ) : (
                        <span className="text-xs text-slate-400">&mdash;</span>
                      )}
                    </td>

                    {/* Status & Komentar */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {e.leaderGeneralComment ? (
                        <p className="truncate text-slate-700 italic" title={e.leaderGeneralComment}>
                          "{e.leaderGeneralComment}"
                        </p>
                      ) : (
                        <span className="text-slate-400 text-[11px]">
                          {e.status === 'selesai_direview'
                            ? 'Selesai direview'
                            : e.status === 'siang_selesai'
                            ? 'Siap dinilai leader'
                            : 'Proses WFA harian'}
                        </span>
                      )}
                    </td>

                    {/* Aksi Rincian */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedDetailEntry(e)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        <span>Detail &amp; Bukti</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETAIL ABSENSI & BUKTI PEKERJAAN */}
      {selectedDetailEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-slate-100 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Rincian Absensi: {selectedDetailEntry.userName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDetailEntry.division} &bull; Tanggal: {selectedDetailEntry.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Absen Pagi & Siang */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">Absensi Pagi (Masuk)</span>
                {selectedDetailEntry.absenPagi ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {selectedDetailEntry.absenPagi.time}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          selectedDetailEntry.absenPagi.status === 'tepat_waktu'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {selectedDetailEntry.absenPagi.status === 'tepat_waktu'
                          ? 'Tepat Waktu'
                          : 'Terlambat'}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{selectedDetailEntry.absenPagi.location}</span>
                    </div>
                    {selectedDetailEntry.absenPagi.notes && (
                      <p className="text-slate-600 italic text-[11px] pt-1">
                        "{selectedDetailEntry.absenPagi.notes}"
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Belum melakukan absensi pagi</span>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">Absensi Siang (Pulang)</span>
                {selectedDetailEntry.absenSiang ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {selectedDetailEntry.absenSiang.time}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        Selesai Siang
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{selectedDetailEntry.absenSiang.location}</span>
                    </div>
                    {selectedDetailEntry.absenSiang.notes && (
                      <p className="text-slate-600 italic text-[11px] pt-1">
                        "{selectedDetailEntry.absenSiang.notes}"
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Belum melakukan absensi siang</span>
                )}
              </div>
            </div>

            {/* Skor Skor To-Do & Nilai Leader */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-900 font-bold block">Nilai Absen (Pagi+Siang):</span>
                <span className="text-base font-extrabold text-amber-700">
                  {getAbsenScore(selectedDetailEntry)} / 100
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-blue-900 font-bold block">Skor Centang To-Do:</span>
                <span className="text-base font-extrabold text-blue-700">
                  {selectedDetailEntry.employeeScorePercent}% ({selectedDetailEntry.completedTodos}/
                  {selectedDetailEntry.totalTodos} selesai)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-900 font-bold block">Nilai To-Do dari Leader:</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {selectedDetailEntry.leaderScore !== null
                    ? `${selectedDetailEntry.leaderScore} / 100`
                    : 'Belum dinilai'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                <span className="text-sky-900 font-bold block">Nilai Komunikasi:</span>
                <span className="text-base font-extrabold text-sky-700">
                  {selectedDetailEntry.leaderCommunicationScore !== null
                    ? `${selectedDetailEntry.leaderCommunicationScore} / 100`
                    : 'Belum dinilai'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#004080] text-white">
                <span className="font-bold block">Skor Akhir:</span>
                <span className="text-base font-extrabold">
                  {getFinalScore(selectedDetailEntry, weightsFromSettings(wfaSettings)) !== null
                    ? `${getFinalScore(selectedDetailEntry, weightsFromSettings(wfaSettings))} / 100`
                    : 'Belum dinilai'}
                </span>
              </div>
            </div>

            {selectedDetailEntry.leaderGeneralComment && (
              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs">
                <div className="font-bold text-sky-900 mb-1">Catatan Evaluasi Leader:</div>
                <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-sky-100">
                  "{selectedDetailEntry.leaderGeneralComment}"
                </p>
                <div className="text-[11px] text-sky-600 mt-1 text-right">
                  Oleh: {selectedDetailEntry.leaderReviewedBy} ({selectedDetailEntry.leaderReviewedAt})
                </div>
              </div>
            )}

            {/* Daftar To-Do List & Bukti */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <span className="text-xs font-bold text-slate-700 block">
                Daftar To-Do List &amp; Bukti Kerja:
              </span>
              {selectedDetailEntry.todos.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl text-xs">
                  Belum ada to-do list yang ditambahkan pada hari ini.
                </div>
              ) : (
                selectedDetailEntry.todos.map((todo, idx) => (
                  <div
                    key={todo.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400">#{idx + 1}</span>
                        <span className="font-semibold text-slate-800">{todo.task}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          todo.completed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
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
                          onClick={() =>
                            openImageModal(todo.proofImage!, `Bukti Pekerjaan: ${todo.task}`)
                          }
                          className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Lihat Screenshot
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">Tidak ada foto</span>
                      )}
                    </div>
                  </div>
                ))
              )}
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
