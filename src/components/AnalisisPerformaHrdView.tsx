import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp,
  Award,
  Users,
  Building2,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Clock3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

export const AnalisisPerformaHrdView: React.FC = () => {
  const { entries, allUsers, selectedDate } = useApp();

  const allDivisions = useMemo(() => Array.from(new Set(allUsers.map((u) => u.division))), [allUsers]);

  // Filter Divisi: supaya HRD bisa fokus melihat performa satu divisi tertentu lebih spesifik
  const [filterDivision, setFilterDivision] = useState<string>('all');

  // Filter Rentang Waktu: supaya grafik tren tidak menumpuk seluruh riwayat sekaligus
  const [periodPreset, setPeriodPreset] = useState<'7days' | '30days' | 'month' | 'custom' | 'all'>('7days');
  const [customStart, setCustomStart] = useState<string>(selectedDate);
  const [customEnd, setCustomEnd] = useState<string>(selectedDate);

  const employees = useMemo(
    () =>
      allUsers.filter(
        (u) => u.role === 'karyawan' && (filterDivision === 'all' || u.division === filterDivision)
      ),
    [allUsers, filterDivision]
  );
  const divisions = useMemo(
    () => (filterDivision === 'all' ? allDivisions : allDivisions.filter((d) => d === filterDivision)),
    [allDivisions, filterDivision]
  );
  const scopedEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesDivision = filterDivision === 'all' || e.division === filterDivision;
      if (!matchesDivision) return false;

      if (periodPreset === 'all') return true;
      if (periodPreset === 'custom') {
        return (!customStart || e.date >= customStart) && (!customEnd || e.date <= customEnd);
      }
      if (periodPreset === 'month') {
        return e.date.substring(0, 7) === selectedDate.substring(0, 7);
      }
      const today = new Date(selectedDate);
      const entryDate = new Date(e.date);
      const diffDays = (today.getTime() - entryDate.getTime()) / (1000 * 3600 * 24);
      const rangeDays = periodPreset === '30days' ? 30 : 7;
      return diffDays >= 0 && diffDays <= rangeDays;
    });
  }, [entries, filterDivision, periodPreset, customStart, customEnd, selectedDate]);

  // Statistik per Divisi
  const divisionStats = useMemo(() => {
    return divisions.map((div) => {
      const divEntries = scopedEntries.filter((e) => e.division === div);
      const totalEntries = divEntries.length;

      let sumTodo = 0;
      let sumLeader = 0;
      let leaderCount = 0;
      let sumKomunikasi = 0;
      let komunikasiCount = 0;
      let onTimeCount = 0;

      divEntries.forEach((e) => {
        sumTodo += e.employeeScorePercent;
        if (e.leaderScore !== null) {
          sumLeader += e.leaderScore;
          leaderCount++;
        }
        if (e.leaderCommunicationScore !== null) {
          sumKomunikasi += e.leaderCommunicationScore;
          komunikasiCount++;
        }
        if (e.absenPagi?.status === 'tepat_waktu') onTimeCount++;
      });

      const avgTodo = totalEntries > 0 ? Math.round(sumTodo / totalEntries) : 0;
      const avgLeader = leaderCount > 0 ? Math.round(sumLeader / leaderCount) : avgTodo;
      const avgKomunikasi = komunikasiCount > 0 ? Math.round(sumKomunikasi / komunikasiCount) : 0;
      const onTimePercent = totalEntries > 0 ? Math.round((onTimeCount / totalEntries) * 100) : 0;

      return {
        division: div,
        totalEntries,
        avgTodo,
        avgLeader,
        avgKomunikasi,
        onTimePercent,
      };
    });
  }, [divisions, scopedEntries]);

  // Statistik per Karyawan (Top Performers)
  const employeePerformances = useMemo(() => {
    const list = employees.map((emp) => {
      const empEntries = scopedEntries.filter((e) => e.userId === emp.id);
      const count = empEntries.length;
      let sumTodo = 0;
      let sumLeader = 0;
      let leaderCount = 0;

      empEntries.forEach((e) => {
        sumTodo += e.employeeScorePercent;
        if (e.leaderScore !== null) {
          sumLeader += e.leaderScore;
          leaderCount++;
        }
      });

      const avgTodo = count > 0 ? Math.round(sumTodo / count) : 0;
      const avgLeader = leaderCount > 0 ? Math.round(sumLeader / leaderCount) : avgTodo;

      return {
        employee: emp,
        avgTodo,
        avgLeader,
        count,
      };
    });

    list.sort((a, b) => b.avgLeader - a.avgLeader);
    return list;
  }, [employees, scopedEntries]);

  // 1. Data Grafik Bar Perbandingan Antar Divisi
  const divisionBarData = useMemo(() => {
    return divisionStats.map((ds) => ({
      name: ds.division.replace('& Engineering', 'Tech').replace('& UI/UX', 'Desain').replace('& Growth', 'Mktg').replace('& Culture (HRD)', 'HRD'),
      fullName: ds.division,
      'Rata-rata Centang To-Do (%)': ds.avgTodo,
      'Rata-rata Reviu Leader': ds.avgLeader,
      'Rata-rata Komunikasi': ds.avgKomunikasi,
    }));
  }, [divisionStats]);

  // 2. Data Grafik Area Tren Performa Perusahaan Harian
  const companyTrendData = useMemo(() => {
    const map: {
      [date: string]: {
        todoSum: number;
        leaderSum: number;
        count: number;
        leaderCount: number;
        komunikasiSum: number;
        komunikasiCount: number;
      };
    } = {};

    scopedEntries.forEach((e) => {
      if (!map[e.date]) {
        map[e.date] = { todoSum: 0, leaderSum: 0, count: 0, leaderCount: 0, komunikasiSum: 0, komunikasiCount: 0 };
      }
      map[e.date].todoSum += e.employeeScorePercent;
      map[e.date].count++;
      if (e.leaderScore !== null) {
        map[e.date].leaderSum += e.leaderScore;
        map[e.date].leaderCount++;
      }
      if (e.leaderCommunicationScore !== null) {
        map[e.date].komunikasiSum += e.leaderCommunicationScore;
        map[e.date].komunikasiCount++;
      }
    });

    return Object.keys(map).sort().map((date) => {
      const item = map[date];
      const avgTodo = item.count > 0 ? Math.round(item.todoSum / item.count) : 0;
      const avgLeader = item.leaderCount > 0 ? Math.round(item.leaderSum / item.leaderCount) : avgTodo;
      const avgKomunikasi = item.komunikasiCount > 0 ? Math.round(item.komunikasiSum / item.komunikasiCount) : 0;
      const parts = date.split('-');
      const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;

      return {
        date: shortDate,
        fullDate: date,
        'Rata-rata Perusahaan (%)': avgTodo,
        'Evaluasi Leader': avgLeader,
        'Komunikasi': avgKomunikasi,
      };
    });
  }, [scopedEntries]);

  // 3. Data Pie Chart Distribusi Kehadiran
  const attendancePieData = useMemo(() => {
    let tepatPagi = 0;
    let telatPagi = 0;
    let tepatSiang = 0;

    scopedEntries.forEach((e) => {
      if (e.absenPagi?.status === 'tepat_waktu') tepatPagi++;
      if (e.absenPagi?.status === 'terlambat') telatPagi++;
      if (e.absenSiang) tepatSiang++;
    });

    return [
      { name: 'Tepat Waktu Pagi', value: tepatPagi, color: '#10b981' },
      { name: 'Selesai Siang', value: tepatSiang, color: '#0ea5e9' },
      { name: 'Terlambat Masuk', value: telatPagi, color: '#f43f5e' },
    ];
  }, [scopedEntries]);

  // Global Averages
  const totalEntries = scopedEntries.length;
  const companyAvgScore = totalEntries > 0
    ? Math.round(scopedEntries.reduce((acc, e) => acc + e.employeeScorePercent, 0) / totalEntries)
    : 0;

  const topDivision = divisionStats.reduce(
    (max, d) => (d.avgLeader > max.avgLeader ? d : max),
    divisionStats[0] || { division: '-', avgLeader: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header Banner HRD */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Executive Analytics &bull; Luzie Group Corporate</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">
            Grafik &amp; Analisis Performa Perusahaan
          </h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Laporan visual komparatif kinerja antar departemen, tren produktivitas to-do list centang, dan konsistensi reviu leader seluruh divisi.
          </p>
        </div>

        <div className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-center shrink-0">
          <div className="text-[10px] uppercase font-bold text-sky-200">Indeks Produktivitas</div>
          <div className="text-3xl font-extrabold text-white mt-0.5">{companyAvgScore}%</div>
          <div className="text-[10px] text-sky-300 mt-0.5 font-medium">
            {filterDivision === 'all' ? 'Rata-rata Seluruh Divisi' : `Divisi ${filterDivision}`}
          </div>
        </div>
      </div>

      {/* Filter Rentang Waktu & Divisi */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3.5">
        {/* Rentang Waktu */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            <Clock3 className="w-3.5 h-3.5" />
            <span>Rentang Waktu</span>
          </div>
          {[
            { id: '7days', label: '7 Hari Terakhir' },
            { id: '30days', label: '30 Hari Terakhir' },
            { id: 'month', label: 'Bulan Ini' },
            { id: 'custom', label: 'Rentang Kustom' },
            { id: 'all', label: 'Semua Riwayat' },
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

          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs ml-1">
              <span className="text-slate-500 font-medium">Dari:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
              />
              <span className="text-slate-500 font-medium">Sampai:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
              />
            </div>
          )}
        </div>

        <div className="border-t border-slate-100" />

        {/* Filter Divisi */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Divisi</span>
          </div>
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="w-full sm:w-72 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-semibold"
          >
            <option value="all">Semua Divisi Perusahaan</option>
            {allDivisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {filterDivision !== 'all' && (
            <button
              onClick={() => setFilterDivision('all')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 underline underline-offset-2"
            >
              Reset ke Semua Divisi
            </button>
          )}
          <p className="text-[11px] text-slate-400 sm:ml-auto">
            Seluruh kartu, grafik, dan daftar di bawah otomatis menyesuaikan dengan filter yang dipilih.
          </p>
        </div>
      </div>

      {/* Grid 4 Kartu Metrik HRD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Divisi Terbaik</span>
            <Building2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-2 truncate">
            {topDivision.division}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            Skor: {topDivision.avgLeader} / 100
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Rata-rata Skor To-Do</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600 mt-2">{companyAvgScore}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Persentase centang tugas</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Karyawan Lulus KPI</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">
            {employeePerformances.filter((e) => e.avgLeader >= 70).length} / {employeePerformances.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Mencapai target passing grade</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Total Anggota WFA</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{employees.length} Orang</div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {filterDivision === 'all' ? `Di ${allDivisions.length} departemen` : `Divisi ${filterDivision}`}
          </p>
        </div>
      </div>

      {/* GRAFIK 1 & GRAFIK 2: DUA KOLOM RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRAFIK 1: Perbandingan Performa Antar Divisi (Bar Chart) - 2 Kolom */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <span>Perbandingan Skor Kinerja Antar Divisi</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Perbandingan to-do list centang vs reviu evaluasi leader masing-masing departemen
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-sky-600">
                <span className="w-3 h-3 rounded-md bg-sky-500 inline-block" /> To-Do Centang %
              </span>
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-3 h-3 rounded-md bg-blue-500 inline-block" /> Nilai Leader
              </span>
              <span className="flex items-center gap-1.5 text-violet-600">
                <span className="w-3 h-3 rounded-md bg-violet-500 inline-block" /> Komunikasi
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divisionBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Rata-rata Centang To-Do (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Rata-rata Reviu Leader" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Rata-rata Komunikasi" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAFIK 2: Distribusi Kehadiran Perusahaan (Donut Chart) - 1 Kolom */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-sky-600" />
              <span>Distribusi Status Kehadiran WFA</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Proporsi ketepatan absen masuk dan selesai kerja
            </p>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendancePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {attendancePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-slate-900">
                {totalEntries}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Sesi</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {attendancePieData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-bold text-slate-900">{d.value} Catatan</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GRAFIK 3: Tren Produktivitas Harian Perusahaan (Area Chart) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Tren Rata-rata Kinerja Perusahaan (Lintas Waktu)</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pergerakan kurva performa to-do centang, evaluasi leader, dan komunikasi harian
            </p>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          {companyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={companyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompany" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLeaderHrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorKomunikasiHrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Rata-rata Perusahaan (%)"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCompany)"
                 />
                <Area
                  type="monotone"
                  dataKey="Evaluasi Leader"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorLeaderHrd)"
                 />
                <Area
                  type="monotone"
                  dataKey="Komunikasi"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorKomunikasiHrd)"
                 />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Belum ada data historis yang cukup.
            </div>
          )}
        </div>
      </div>

      {/* TOP PERFORMERS WFA BULAN INI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Karyawan Berprestasi WFA Bulan Ini (Top Performers)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Berdasarkan akumulasi ketepatan to-do list centang, bukti pekerjaan lengkap, dan reviu leader
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {employeePerformances.slice(0, 3).map((ep, idx) => (
            <div
              key={ep.employee.id}
              className={`p-4 rounded-2xl border transition-all ${
                idx === 0
                  ? 'bg-amber-50/60 border-amber-200 shadow-xs'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={ep.employee.avatar}
                    alt={ep.employee.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                  <span
                    className={`absolute -top-1 -left-1 w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center text-white ${
                      idx === 0
                        ? 'bg-amber-500'
                        : idx === 1
                        ? 'bg-slate-500'
                        : 'bg-orange-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">{ep.employee.name}</h4>
                  <p className="text-[11px] text-sky-700 font-medium">{ep.employee.division}</p>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Skor: <b className="text-emerald-700">{ep.avgLeader} / 100</b>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
