import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DailyWfaEntry, TodoItem } from '../types';
import { getFinalScore, getAbsenScore, weightsFromSettings } from '../utils/scoreUtils';
import {
  CalendarCheck,
  Calendar,
  Filter,
  Search,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  ExternalLink,
  Eye,
  FileText,
  Award,
  Sparkles,
  ChevronRight,
  X,
  TrendingUp,
  MessageSquareQuote
} from 'lucide-react';

export const RiwayatAbsenKaryawanView: React.FC = () => {
  const { currentUser, entries, openImageModal, wfaSettings } = useApp();

  // Filter state
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09'); // YYYY-MM
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal rincian to-do & bukti harian
  const [selectedEntryDetail, setSelectedEntryDetail] = useState<DailyWfaEntry | null>(null);

  // Ambil hanya entries milik karyawan yang sedang login
  const myEntries = useMemo(() => {
    return entries.filter((e) => e.userId === currentUser.id);
  }, [entries, currentUser.id]);

  // Daftar bulan unik dari data karyawan
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    // Selalu sertakan bulan ini dan bulan lalu
    monthsSet.add('2026-09');
    monthsSet.add('2026-08');
    myEntries.forEach((e) => {
      if (e.date) {
        monthsSet.add(e.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [myEntries]);

  // Filter entries sesuai kontrol
  const filteredEntries = useMemo(() => {
    return myEntries.filter((entry) => {
      // 1. Filter Waktu
      if (filterMode === 'month') {
        if (selectedMonth !== 'all' && !entry.date.startsWith(selectedMonth)) {
          return false;
        }
      } else {
        if (startDate && entry.date < startDate) return false;
        if (endDate && entry.date > endDate) return false;
      }

      // 2. Filter Status Kehadiran
      if (statusFilter === 'tepat_waktu') {
        if (entry.absenPagi?.status !== 'tepat_waktu') return false;
      } else if (statusFilter === 'terlambat') {
        if (entry.absenPagi?.status !== 'terlambat') return false;
      } else if (statusFilter === 'lengkap') {
        if (!entry.absenPagi || !entry.absenSiang) return false;
      } else if (statusFilter === 'menunggu_review') {
        if (entry.status !== 'siang_selesai') return false;
      } else if (statusFilter === 'sudah_direview') {
        if (entry.status !== 'selesai_direview') return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dateMatch = entry.date.toLowerCase().includes(q);
        const morningNotes = entry.absenPagi?.notes?.toLowerCase().includes(q) || false;
        const afternoonNotes = entry.absenSiang?.notes?.toLowerCase().includes(q) || false;
        const leaderNotes = entry.leaderGeneralComment?.toLowerCase().includes(q) || false;
        const todoMatch = entry.todos.some((t) => t.task.toLowerCase().includes(q));
        if (!dateMatch && !morningNotes && !afternoonNotes && !leaderNotes && !todoMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [myEntries, filterMode, selectedMonth, startDate, endDate, statusFilter, searchQuery]);

  // Statistik Ringkasan Periode Terpilih
  const stats = useMemo(() => {
    const totalDays = filteredEntries.length;
    const tepatWaktuCount = filteredEntries.filter((e) => e.absenPagi?.status === 'tepat_waktu').length;
    const tepatWaktuPercent = totalDays > 0 ? Math.round((tepatWaktuCount / totalDays) * 100) : 0;

    const totalEmployeeScores = filteredEntries.reduce((acc, curr) => acc + curr.employeeScorePercent, 0);
    const avgEmployeeScore = totalDays > 0 ? Math.round(totalEmployeeScores / totalDays) : 0;

    const reviewedEntries = filteredEntries.filter((e) => e.leaderScore !== null);
    const totalLeaderScores = reviewedEntries.reduce((acc, curr) => acc + (curr.leaderScore || 0), 0);
    const avgLeaderScore = reviewedEntries.length > 0 ? Math.round(totalLeaderScores / reviewedEntries.length) : 0;

    return {
      totalDays,
      tepatWaktuCount,
      tepatWaktuPercent,
      avgEmployeeScore,
      avgLeaderScore,
      reviewedCount: reviewedEntries.length,
    };
  }, [filteredEntries]);

  // Helper format tanggal Indonesia
  const formatDateIndo = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Helper format nama bulan
  const formatMonthName = (monthStr: string) => {
    if (monthStr === 'all') return 'Semua Bulan';
    try {
      const [y, m] = monthStr.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  // Helper format durasi Hubstaff jadi "Xj Ym" (contoh: 2j 15m)
  const formatHubstaffDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}j ${m}m`;
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      alert('Tidak ada data riwayat absensi untuk diekspor.');
      return;
    }

    const headers = [
      'Tanggal',
      'Nama Karyawan',
      'Divisi',
      'Jam Absen Pagi',
      'Status Pagi',
      'Lokasi Pagi',
      'Catatan Pagi',
      'Jam Absen Siang',
      'Lokasi Siang',
      'Catatan Siang',
      'Jam Tracking Hubstaff',
      'To-Do Selesai',
      'Total To-Do',
      'Skor To-Do (%)',
      'Nilai Evaluasi Leader',
      'Feedback Leader',
      'Status Reviu'
    ];

    const rows = filteredEntries.map((e) => [
      `"${e.date}"`,
      `"${e.userName}"`,
      `"${e.division}"`,
      `"${e.absenPagi?.time || '-'}"`,
      `"${e.absenPagi?.status === 'tepat_waktu' ? 'Tepat Waktu' : e.absenPagi?.status === 'terlambat' ? 'Terlambat' : '-'}"`,
      `"${e.absenPagi?.location || '-'}"`,
      `"${(e.absenPagi?.notes || '').replace(/"/g, '""')}"`,
      `"${e.absenSiang?.time || '-'}"`,
      `"${e.absenSiang?.location || '-'}"`,
      `"${(e.absenSiang?.notes || '').replace(/"/g, '""')}"`,
      `"${e.hubstaffSeconds ? formatHubstaffDuration(e.hubstaffSeconds) : '-'}"`,
      e.completedTodos,
      e.totalTodos,
      `${e.employeeScorePercent}%`,
      e.leaderScore !== null ? e.leaderScore : '-',
      `"${(e.leaderGeneralComment || '').replace(/"/g, '""')}"`,
      `"${e.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Riwayat_Absensi_${currentUser.name.replace(/\s+/g, '_')}_${filterMode === 'month' ? selectedMonth : 'Custom'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Set quick filter presets
  const applyPreset = (preset: 'this-month' | 'last-7' | 'last-30' | 'all') => {
    if (preset === 'this-month') {
      setFilterMode('month');
      setSelectedMonth('2026-09');
    } else if (preset === 'all') {
      setFilterMode('month');
      setSelectedMonth('all');
    } else if (preset === 'last-7') {
      setFilterMode('range');
      setStartDate('2026-09-10');
      setEndDate('2026-09-17');
    } else if (preset === 'last-30') {
      setFilterMode('range');
      setStartDate('2026-08-18');
      setEndDate('2026-09-17');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Riwayat Absensi */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <CalendarCheck className="w-4 h-4" />
            <span>Riwayat Kehadiran Mandiri &bull; {currentUser.name}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Riwayat Absensi Saya</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Pantau seluruh catatan presensi pagi, absen siang, bukti to-do list centang, dan nilai evaluasi leader dalam periode waktu yang Anda tentukan.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all shadow-xs"
            title="Download CSV Riwayat Absensi"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Data CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Panel Interaktif */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Mode Switcher: Filter Berdasarkan Bulan vs Rentang Tanggal */}
          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'month'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Berdasarkan Bulan
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'range'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rentang Tanggal
              </button>
            </div>

            {/* Quick Preset Pills */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('this-month')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last-7')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last-30')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
              >
                30 Hari
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
              >
                Semua
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari catatan, tanggal, to-do..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Controls based on Filter Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {filterMode === 'month' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Pilih Bulan:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Bulan</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Dari Tanggal:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Sampai Tanggal:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Status Presensi:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status</option>
              <option value="lengkap">Hadir Lengkap (Pagi &amp; Siang)</option>
              <option value="tepat_waktu">Pagi Tepat Waktu</option>
              <option value="terlambat">Pagi Terlambat</option>
              <option value="sudah_direview">Sudah Direview Leader</option>
              <option value="menunggu_review">Menunggu Evaluasi Leader</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterMode('month');
                setSelectedMonth('2026-09');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Kartu Metrik Ringkasan Periode Terpilih */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Hari Kerja</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.totalDays} Hari</div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {filterMode === 'month' ? formatMonthName(selectedMonth) : 'Rentang Kustom'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tepat Waktu</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{stats.tepatWaktuPercent}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {stats.tepatWaktuCount} dari {stats.totalDays} presensi tepat waktu
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rata-rata Centang To-Do</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-2">{stats.avgEmployeeScore}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Skor capaian to-do mandiri
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rata-rata Nilai Leader</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">
            {stats.avgLeaderScore > 0 ? stats.avgLeaderScore : '-'}{' '}
            <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {stats.reviewedCount} entri telah dinilai leader
          </p>
        </div>
      </div>

      {/* Tabel Daftar Riwayat Presensi */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
              <span>Daftar Presensi Harian WFA</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {filteredEntries.length} catatan kehadiran Anda
            </p>
          </div>

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 w-fit">
            Koordinator: {currentUser.leaderName || 'Ariesta Jatmiko'}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Tidak ada data absensi ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada catatan presensi pada filter bulan atau rentang tanggal yang Anda pilih. Silakan ganti filter atau pilih opsi "Semua Bulan".
            </p>
            <button
              onClick={() => {
                setFilterMode('month');
                setSelectedMonth('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 transition-colors"
            >
              Lihat Semua Riwayat
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Tanggal</th>
                  <th className="py-3.5 px-4">Absen Pagi</th>
                  <th className="py-3.5 px-4">Absen Siang</th>
                  <th className="py-3.5 px-4">Jam Hubstaff</th>
                  <th className="py-3.5 px-4">Nilai Absen</th>
                  <th className="py-3.5 px-4">Capaian To-Do Centang</th>
                  <th className="py-3.5 px-4">Evaluasi Leader</th>
                  <th className="py-3.5 px-4">Komunikasi</th>
                  <th className="py-3.5 px-4">Skor Akhir</th>
                  <th className="py-3.5 px-4 text-center">Rincian &amp; Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Tanggal */}
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{formatDateIndo(item.date)}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.date}</div>
                    </td>

                    {/* Absen Pagi */}
                    <td className="py-3.5 px-4">
                      {item.absenPagi ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{item.absenPagi.time}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.absenPagi.status === 'tepat_waktu'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.absenPagi.status === 'tepat_waktu' ? 'Tepat Waktu' : 'Terlambat'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[150px]">{item.absenPagi.location}</span>
                          </div>
                          {item.absenPagi.notes && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 italic max-w-xs">
                              "{item.absenPagi.notes}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Belum Absen
                        </span>
                      )}
                    </td>

                    {/* Absen Siang */}
                    <td className="py-3.5 px-4">
                      {item.absenSiang ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{item.absenSiang.time}</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                              Terkirim
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[150px]">{item.absenSiang.location}</span>
                          </div>
                          {item.absenSiang.notes && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 italic max-w-xs">
                              "{item.absenSiang.notes}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum absen siang</span>
                      )}
                    </td>

                    {/* Jam Hubstaff */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.hubstaffSeconds ? (
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {formatHubstaffDuration(item.hubstaffSeconds)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum tracking</span>
                      )}
                    </td>

                    {/* Nilai Absen (Otomatis dari Pagi + Siang) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                        {getAbsenScore(item)} / 100
                      </span>
                    </td>

                    {/* Capaian To-Do Centang */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-blue-700 text-sm">
                            {item.employeeScorePercent}%
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            ({item.completedTodos}/{item.totalTodos} Task Dicentang)
                          </span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.employeeScorePercent >= 70 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${item.employeeScorePercent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Evaluasi Leader */}
                    <td className="py-3.5 px-4">
                      {item.leaderScore !== null ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                              Nilai: {item.leaderScore} / 100
                            </span>
                          </div>
                          {item.leaderGeneralComment && (
                            <p className="text-[11px] text-slate-600 italic line-clamp-1 max-w-xs">
                              "{item.leaderGeneralComment}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Menunggu Review
                        </span>
                      )}
                    </td>

                    {/* Nilai Komunikasi */}
                    <td className="py-3.5 px-4">
                      {item.leaderCommunicationScore !== null ? (
                        <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md">
                          {item.leaderCommunicationScore} / 100
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">&mdash;</span>
                      )}
                    </td>

                    {/* Skor Akhir Gabungan */}
                    <td className="py-3.5 px-4">
                      {getFinalScore(item, weightsFromSettings(wfaSettings)) !== null ? (
                        <span className="text-sm font-extrabold text-[#004080]">
                          {getFinalScore(item, weightsFromSettings(wfaSettings))} / 100
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">&mdash;</span>
                      )}
                    </td>

                    {/* Aksi: Lihat Rincian & Bukti */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedEntryDetail(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Rincian &amp; Bukti</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL RINCIAN TO-DO LIST & BUKTI HARIAN */}
      {selectedEntryDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#004080] to-[#0060b5] text-white p-5 flex items-center justify-between border-b border-slate-700">
              <div>
                <div className="text-xs text-sky-300 font-semibold uppercase tracking-wider">
                  Rincian Presensi &amp; Pekerjaan Harian
                </div>
                <h3 className="text-base font-bold mt-0.5">
                  {formatDateIndo(selectedEntryDetail.date)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEntryDetail(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Ringkasan Jam & Lokasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Presensi Pagi:</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedEntryDetail.absenPagi?.status === 'tepat_waktu'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedEntryDetail.absenPagi?.status === 'tepat_waktu' ? 'Tepat Waktu' : 'Terlambat'}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    {selectedEntryDetail.absenPagi?.time || '-'}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedEntryDetail.absenPagi?.location || 'WFA'}</span>
                  </div>
                  {selectedEntryDetail.absenPagi?.notes && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 italic">
                      "{selectedEntryDetail.absenPagi.notes}"
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Presensi Siang:</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Terkirim
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    {selectedEntryDetail.absenSiang?.time || '-'}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedEntryDetail.absenSiang?.location || 'WFA'}</span>
                  </div>
                  {selectedEntryDetail.absenSiang?.notes && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 italic">
                      "{selectedEntryDetail.absenSiang.notes}"
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">Time Tracking Hubstaff:</span>
                  </div>
                  <div className="text-sm font-black text-indigo-900">
                    {selectedEntryDetail.hubstaffSeconds
                      ? formatHubstaffDuration(selectedEntryDetail.hubstaffSeconds)
                      : 'Belum ada tracking'}
                  </div>
                  <div className="text-[11px] text-indigo-700">
                    Otomatis berhenti saat Absen Siang tercatat, dan direset tiap hari baru.
                  </div>
                </div>
              </div>

              {/* Evaluasi Leader jika sudah dinilai */}
              {selectedEntryDetail.leaderScore !== null && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-600" />
                      Evaluasi &amp; Catatan Supervisor:
                    </span>
                    <span className="text-sm font-black text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                      Skor Leader: {selectedEntryDetail.leaderScore} / 100
                    </span>
                  </div>
                  {selectedEntryDetail.leaderGeneralComment && (
                    <p className="text-xs text-emerald-900 italic bg-white/70 p-3 rounded-xl border border-emerald-200">
                      "{selectedEntryDetail.leaderGeneralComment}"
                    </p>
                  )}
                  <div className="text-[11px] text-emerald-700">
                    Dinilai oleh: <strong>{selectedEntryDetail.leaderReviewedBy || 'Leader'}</strong> &bull; {selectedEntryDetail.leaderReviewedAt || ''}
                  </div>
                </div>
              )}

              {/* Daftar To-Do List & Bukti */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Daftar To-Do List &amp; Lampiran Bukti:</span>
                  </h4>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                    Skor: {selectedEntryDetail.employeeScorePercent}% ({selectedEntryDetail.completedTodos}/{selectedEntryDetail.totalTodos} Task Dicentang)
                  </span>
                </div>

                {selectedEntryDetail.todos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Tidak ada to-do list terdata pada hari ini.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedEntryDetail.todos.map((todo, idx) => (
                      <div
                        key={todo.id}
                        className={`p-4 rounded-xl border transition-all ${
                          todo.completed
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                todo.completed
                                  ? 'bg-emerald-600 text-white'
                                  : 'border-2 border-slate-300 text-slate-400'
                              }`}
                            >
                              {todo.completed ? '✓' : idx + 1}
                            </span>
                            <div>
                              <div
                                className={`text-xs font-bold ${
                                  todo.completed ? 'text-slate-900' : 'text-slate-600'
                                }`}
                              >
                                {todo.task}
                              </div>
                              {todo.target && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Target: <span className="font-semibold">{todo.target}</span>
                                </div>
                              )}
                              {todo.completedAt && (
                                <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                  Dicentang selesai jam {todo.completedAt}
                                </div>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              todo.completed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {todo.completed ? 'Selesai Dicentang ✓' : 'Belum Selesai'}
                          </span>
                        </div>

                        {/* Bukti Lampiran */}
                        {(todo.proofLink || todo.proofImage) && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                            {todo.proofLink && (
                              <a
                                href={todo.proofLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Buka Dokumen / Link Pekerjaan</span>
                              </a>
                            )}
                            {todo.proofImage && (
                              <button
                                onClick={() => openImageModal(todo.proofImage!, `Bukti: ${todo.task}`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                <span>Lihat Foto / Screenshot Bukti</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
              <button
                onClick={() => setSelectedEntryDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
