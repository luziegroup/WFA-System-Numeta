import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getFinalScore, getAbsenScore, weightsFromSettings } from '../utils/scoreUtils';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Filter,
  Calendar,
  Sparkles,
  BarChart3,
  Target,
  MessageSquareQuote,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

export const PerformaKaryawanView: React.FC = () => {
  const { currentUser, entries, wfaSettings } = useApp();

  // Filter state
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>('2026-09-30');

  // Ambil hanya entries milik karyawan yang sedang login
  const myEntries = useMemo(() => {
    return entries.filter((e) => e.userId === currentUser.id);
  }, [entries, currentUser.id]);

  // Daftar bulan unik
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add('2026-09');
    monthsSet.add('2026-08');
    myEntries.forEach((e) => {
      if (e.date) {
        monthsSet.add(e.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [myEntries]);

  // Filter entries sesuai kontrol tanggal/bulan
  const filteredEntries = useMemo(() => {
    return myEntries.filter((entry) => {
      if (filterMode === 'month') {
        if (selectedMonth !== 'all' && !entry.date.startsWith(selectedMonth)) {
          return false;
        }
      } else {
        if (startDate && entry.date < startDate) return false;
        if (endDate && entry.date > endDate) return false;
      }
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date)); // Sort ascending untuk grafik tren
  }, [myEntries, filterMode, selectedMonth, startDate, endDate]);

  // Metrik Performa Pribadi Karyawan
  const metrics = useMemo(() => {
    const count = filteredEntries.length;
    if (count === 0) {
      return {
        totalDays: 0,
        avgEmployeeScore: 0,
        avgLeaderScore: 0,
        avgAbsenScore: 0,
        avgCommunicationScore: 0,
        avgFinalScore: 0,
        komunikasiReviewedCount: 0,
        finalScoreCount: 0,
        totalCompletedTasks: 0,
        totalTargetTasks: 0,
        taskCompletionRate: 0,
        onTimeRate: 0,
        isKpiPassed: false,
      };
    }

    const totalEmployeeScores = filteredEntries.reduce((acc, curr) => acc + curr.employeeScorePercent, 0);
    const avgEmployeeScore = Math.round(totalEmployeeScores / count);

    const reviewed = filteredEntries.filter((e) => e.leaderScore !== null);
    const totalLeaderScores = reviewed.reduce((acc, curr) => acc + (curr.leaderScore || 0), 0);
    const avgLeaderScore = reviewed.length > 0 ? Math.round(totalLeaderScores / reviewed.length) : 0;

    // Nilai Absen: rata-rata otomatis dari akumulasi Absen Pagi + Absen Siang setiap hari
    const totalAbsenScores = filteredEntries.reduce((acc, curr) => acc + getAbsenScore(curr), 0);
    const avgAbsenScore = Math.round(totalAbsenScores / count);

    // Nilai Komunikasi: rata-rata dari hari yang sudah dinilai Leader (mutlak dari Leader)
    const komunikasiReviewed = filteredEntries.filter((e) => e.leaderCommunicationScore !== null);
    const totalKomunikasiScores = komunikasiReviewed.reduce(
      (acc, curr) => acc + (curr.leaderCommunicationScore || 0),
      0
    );
    const avgCommunicationScore =
      komunikasiReviewed.length > 0 ? Math.round(totalKomunikasiScores / komunikasiReviewed.length) : 0;

    // Skor Akhir: rata-rata gabungan (Absen 34% + To-Do 33% + Komunikasi 33%) dari hari yang sudah dinilai lengkap
    const finalScoreEntries = filteredEntries
      .map((e) => getFinalScore(e, weightsFromSettings(wfaSettings)))
      .filter((s): s is number => s !== null);
    const avgFinalScore =
      finalScoreEntries.length > 0
        ? Math.round(finalScoreEntries.reduce((acc, curr) => acc + curr, 0) / finalScoreEntries.length)
        : 0;

    const totalCompletedTasks = filteredEntries.reduce((acc, curr) => acc + curr.completedTodos, 0);
    const totalTargetTasks = filteredEntries.reduce((acc, curr) => acc + curr.totalTodos, 0);
    const taskCompletionRate = totalTargetTasks > 0 ? Math.round((totalCompletedTasks / totalTargetTasks) * 100) : 0;

    const onTimeCount = filteredEntries.filter((e) => e.absenPagi?.status === 'tepat_waktu').length;
    const onTimeRate = Math.round((onTimeCount / count) * 100);

    const isKpiPassed = avgEmployeeScore >= (wfaSettings?.minKpiPassScore || 70);

    return {
      totalDays: count,
      avgEmployeeScore,
      avgLeaderScore,
      avgAbsenScore,
      avgCommunicationScore,
      avgFinalScore,
      komunikasiReviewedCount: komunikasiReviewed.length,
      finalScoreCount: finalScoreEntries.length,
      totalCompletedTasks,
      totalTargetTasks,
      taskCompletionRate,
      onTimeRate,
      isKpiPassed,
    };
  }, [filteredEntries, wfaSettings]);

  // Data untuk Grafik Tren Harian (Area Chart)
  const trendChartData = useMemo(() => {
    return filteredEntries.map((e) => {
      const parts = e.date.split('-');
      const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : e.date;
      return {
        date: shortDate,
        fullDate: e.date,
        'Skor To-Do (%)': e.employeeScorePercent,
        'Nilai Leader': e.leaderScore !== null ? e.leaderScore : undefined,
      };
    });
  }, [filteredEntries]);

  // Data untuk Grafik Batang Task Harian (Target vs Centang)
  const taskBarChartData = useMemo(() => {
    return filteredEntries.map((e) => {
      const parts = e.date.split('-');
      const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : e.date;
      return {
        date: shortDate,
        fullDate: e.date,
        'Target Task': e.totalTodos,
        'Task Dicentang': e.completedTodos,
      };
    });
  }, [filteredEntries]);

  // Daftar Riwayat Catatan & Evaluasi Leader Khusus Karyawan
  const leaderReviews = useMemo(() => {
    return filteredEntries
      .filter((e) => e.leaderScore !== null || e.leaderGeneralComment)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredEntries]);

  // Preset filter waktu
  const applyPreset = (preset: 'this-month' | 'last-14' | 'last-30' | 'all') => {
    if (preset === 'this-month') {
      setFilterMode('month');
      setSelectedMonth('2026-09');
    } else if (preset === 'all') {
      setFilterMode('month');
      setSelectedMonth('all');
    } else if (preset === 'last-14') {
      setFilterMode('range');
      setStartDate('2026-09-03');
      setEndDate('2026-09-17');
    } else if (preset === 'last-30') {
      setFilterMode('range');
      setStartDate('2026-08-18');
      setEndDate('2026-09-17');
    }
  };

  const formatMonthName = (monthStr: string) => {
    if (monthStr === 'all') return 'Semua Periode';
    try {
      const [y, m] = monthStr.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Performa Pribadi Karyawan */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>Analisis Kinerja Mandiri &bull; {currentUser.name}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Performa Kerja Saya</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Evaluasi pencapaian target to-do list centang, ketepatan waktu presensi, dan penilaian kualitas kerja dari Leader Anda ({currentUser.leaderName || 'Ariesta Jatmiko'}).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-center">
            <div className="text-[10px] uppercase tracking-wider text-sky-200 font-bold">Status KPI WFA</div>
            <div className={`text-sm font-black mt-0.5 ${metrics.isKpiPassed ? 'text-emerald-300' : 'text-amber-300'}`}>
              {metrics.isKpiPassed ? 'MEMENUHI TARGET ✓' : 'PERLU PENINGKATAN'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel (Tanggal & Bulan) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

            {/* Quick preset buttons */}
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
                onClick={() => applyPreset('last-14')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
              >
                14 Hari
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

          <span className="text-xs text-slate-500 font-medium">
            Periode aktif: <strong>{filterMode === 'month' ? formatMonthName(selectedMonth) : `${startDate} s/d ${endDate}`}</strong>
          </span>
        </div>

        {/* Dynamic Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {filterMode === 'month' ? (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Pilih Bulan Analisis:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Semua Bulan (Keseluruhan)</option>
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
                  Mulai Tanggal:
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

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterMode('month');
                setSelectedMonth('2026-09');
              }}
              className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Kartu Metrik Performa Karyawan - Sesuai 3 Jenis Penilaian + Skor Akhir, Mengikuti Filter Periode */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rata-rata Nilai Absen */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Nilai Absen</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-amber-600 mt-2">
            {metrics.avgAbsenScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Akumulasi Absen Pagi + Siang ({metrics.totalDays} hari periode ini)
          </p>
        </div>

        {/* Rata-rata Nilai To-Do */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Nilai To-Do</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-sky-700 mt-2">
            {metrics.avgLeaderScore > 0 ? metrics.avgLeaderScore : '-'}{' '}
            <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Centang karyawan ({metrics.avgEmployeeScore}%) tervalidasi Leader
          </p>
        </div>

        {/* Rata-rata Nilai Komunikasi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Nilai Komunikasi</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <MessageSquareQuote className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-blue-700 mt-2">
            {metrics.komunikasiReviewedCount > 0 ? metrics.avgCommunicationScore : '-'}{' '}
            <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Nilai mutlak dari Leader ({metrics.komunikasiReviewedCount} hari dinilai)
          </p>
        </div>

        {/* Rata-rata Skor Akhir Gabungan */}
        <div className="bg-[#004080] rounded-2xl border border-[#004080] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-100">Skor Akhir</span>
            <span className="p-2 rounded-xl bg-white/15 text-white">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-white mt-2">
            {metrics.finalScoreCount > 0 ? metrics.avgFinalScore : '-'}{' '}
            <span className="text-xs font-normal text-sky-200">/ 100</span>
          </div>
          <p className="text-[11px] text-sky-200/80 mt-1">
            Absen 34% + To-Do 33% + Komunikasi 33%
          </p>
        </div>
      </div>

      {/* 2 Kartu Tambahan: Ketuntasan Task & Disiplin Jam Absen */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Task Selesai vs Target */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ketuntasan Task</span>
            <span className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <Target className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-700 mt-2">{metrics.taskCompletionRate}%</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.totalCompletedTasks} dari {metrics.totalTargetTasks} task dicentang
          </p>
        </div>

        {/* Ketepatan Waktu Presensi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Disiplin Jam Absen</span>
            <span className="p-2 rounded-xl bg-slate-50 text-slate-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-700 mt-2">{metrics.onTimeRate}%</div>
          <p className="text-[11px] text-slate-500 mt-1">
            Presensi sebelum batas 08:30 WIB
          </p>
        </div>
      </div>

      {/* GRAFIK 1: Tren Performa Harian Karyawan (Area Chart) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Grafik Tren Performa Harian Saya</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pergerakan persentase to-do list centang mandiri (%) dan evaluasi leader per tanggal
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 rounded-md bg-blue-500 inline-block" /> Skor To-Do (%)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" /> Nilai Leader
            </span>
          </div>
        </div>

        {trendChartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            Tidak ada data performa untuk rentang waktu yang dipilih.
          </div>
        ) : (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEmployee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLeader" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="Skor To-Do (%)" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEmployee)" />
                <Area type="monotone" dataKey="Nilai Leader" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeader)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* GRAFIK 2 & RINGKASAN DISIPLIN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Batang Target vs Dicentang per Hari */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <span>Jumlah Task Target vs Task Dicentang Harian</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Membandingkan beban target to-do dengan task yang berhasil diselesaikan
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-3 h-3 rounded-md bg-slate-300 inline-block" /> Target Task
              </span>
              <span className="flex items-center gap-1.5 text-sky-600">
                <span className="w-3 h-3 rounded-md bg-sky-500 inline-block" /> Selesai Dicentang
              </span>
            </div>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskBarChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Target Task" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Task Dicentang" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ringkasan Indikator KPI & Standar Karyawan */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Standar KPI WFA Luzie</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Target minimum kepatuhan sistem WFA
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Passing Grade KPI:</span>
                <span className="font-bold text-slate-900">{wfaSettings?.minKpiPassScore || 70}%</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-600 font-medium">Skor Anda Saat Ini:</span>
                <span className={`font-black ${metrics.isKpiPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {metrics.avgEmployeeScore}% ({metrics.isKpiPassed ? 'Lulus Target' : 'Di Bawah Target'})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Batas Presensi Pagi:</span>
                <span className="font-bold text-slate-900">{wfaSettings?.morningAbsenTime || '08:30'} WIB</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-600 font-medium">Tingkat Ketepatan:</span>
                <span className="font-black text-emerald-600">{metrics.onTimeRate}%</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Wajib Lampirkan Bukti:</span>
                <span className="font-bold text-emerald-600">Aktif (Link / Foto)</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-600 font-medium">Koordinator Pembimbing:</span>
                <span className="font-bold text-slate-900">{currentUser.leaderName || 'Ariesta Jatmiko'}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-800">
            <strong>Tips Produktivitas:</strong> Centang task segera setelah selesai sebelum batas absen siang 12:00 WIB dan sertakan tautan link dokumen untuk mempercepat evaluasi Leader.
          </div>
        </div>
      </div>

      {/* Catatan Feedback & Evaluasi Langsung dari Leader */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquareQuote className="w-5 h-5 text-emerald-600" />
              <span>Feedback &amp; Evaluasi dari Supervisor</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Komentar dan arahan langsung dari {currentUser.leaderName || 'Ariesta Jatmiko'} terkait to-do list Anda
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
            {leaderReviews.length} Ulasan Terdata
          </span>
        </div>

        {leaderReviews.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 italic">
            Belum ada catatan evaluasi dari leader pada periode waktu yang Anda pilih.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaderReviews.map((rev) => (
              <div key={rev.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{rev.date}</span>
                    <span className="text-xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      Nilai Absen: {getAbsenScore(rev)} / 100
                    </span>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      Nilai To-Do: {rev.leaderScore} / 100
                    </span>
                    {rev.leaderCommunicationScore !== null && (
                      <span className="text-xs font-black text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
                        Komunikasi: {rev.leaderCommunicationScore} / 100
                      </span>
                    )}
                    <span className="text-xs font-black text-white bg-[#004080] px-2 py-0.5 rounded-md">
                      Skor Akhir: {getFinalScore(rev, weightsFromSettings(wfaSettings))} / 100
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Dinilai oleh: <strong>{rev.leaderReviewedBy || currentUser.leaderName || 'Leader'}</strong> {rev.leaderReviewedAt ? `&bull; ${rev.leaderReviewedAt}` : ''}
                  </span>
                </div>

                {rev.leaderGeneralComment ? (
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/80 italic">
                    "{rev.leaderGeneralComment}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Leader memberikan nilai tanpa catatan tambahan.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
