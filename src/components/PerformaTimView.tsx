import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  Users,
  Target,
  BarChart3,
  Sparkles,
  PieChart as PieChartIcon,
  Activity,
  CheckSquare,
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

export const PerformaTimView: React.FC = () => {
  const { entries, allUsers, selectedDate, currentUser } = useApp();

  // Seluruh staff yang SAAT INI ditugaskan ke koordinator ini (untuk isi dropdown filter nama)
  const myAllStaff = useMemo(
    () => allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === currentUser.id),
    [allUsers, currentUser.id]
  );

  // Filter Nama Karyawan: koordinator bisa fokus melihat performa satu staff tertentu
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');

  // Filter Rentang Waktu: supaya grafik tren tidak menumpuk seluruh riwayat sekaligus
  const [periodPreset, setPeriodPreset] = useState<'7days' | '30days' | 'month' | 'custom' | 'all'>('7days');
  const [customStart, setCustomStart] = useState<string>(selectedDate);
  const [customEnd, setCustomEnd] = useState<string>(selectedDate);

  // Hanya anggota tim yang SAAT INI ditugaskan ke leader ini (leaderId). Kalau HRD
  // memindahkan karyawan ke koordinator lain, poin/skornya otomatis ikut pindah
  // karena kita selalu ambil penugasan terbaru dari data user, bukan snapshot lama.
  const teamMembers = useMemo(
    () => myAllStaff.filter((u) => filterEmployeeId === 'all' || u.id === filterEmployeeId),
    [myAllStaff, filterEmployeeId]
  );
  const myTeamIds = useMemo(() => new Set(teamMembers.map((m) => m.id)), [teamMembers]);
  const scopedEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!myTeamIds.has(e.userId)) return false;

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
  }, [entries, myTeamIds, periodPreset, customStart, customEnd, selectedDate]);

  // Agregat performa untuk masing-masing karyawan
  const memberStats = useMemo(() => {
    const stats = teamMembers.map((member) => {
      const userEntries = scopedEntries.filter((e) => e.userId === member.id);
      const totalEntries = userEntries.length;

      let sumPercent = 0;
      let sumLeaderScore = 0;
      let leaderCount = 0;
      let sumKomunikasi = 0;
      let komunikasiCount = 0;
      let totalCompletedTasks = 0;
      let totalAssignedTasks = 0;

      userEntries.forEach((e) => {
        sumPercent += e.employeeScorePercent;
        totalCompletedTasks += e.completedTodos;
        totalAssignedTasks += e.totalTodos;
        if (e.leaderScore !== null) {
          sumLeaderScore += e.leaderScore;
          leaderCount += 1;
        }
        if (e.leaderCommunicationScore !== null) {
          sumKomunikasi += e.leaderCommunicationScore;
          komunikasiCount += 1;
        }
      });

      const avgCentang = totalEntries > 0 ? Math.round(sumPercent / totalEntries) : 0;
      const avgLeader = leaderCount > 0 ? Math.round(sumLeaderScore / leaderCount) : avgCentang;
      const avgKomunikasi = komunikasiCount > 0 ? Math.round(sumKomunikasi / komunikasiCount) : 0;

      return {
        member,
        totalEntries,
        avgCentang,
        avgLeader,
        avgKomunikasi,
        komunikasiCount,
        totalCompletedTasks,
        totalAssignedTasks,
        isUnderTarget: avgCentang < 70,
      };
    });

    stats.sort((a, b) => b.avgLeader - a.avgLeader);
    return stats;
  }, [teamMembers, scopedEntries]);

  const overallTeamAvg = useMemo(() => {
    return memberStats.length > 0
      ? Math.round(memberStats.reduce((acc, m) => acc + m.avgLeader, 0) / memberStats.length)
      : 0;
  }, [memberStats]);

  const totalCompletedAll = memberStats.reduce((acc, m) => acc + m.totalCompletedTasks, 0);
  const totalTasksAll = memberStats.reduce((acc, m) => acc + m.totalAssignedTasks, 0);

  // 1. Data Grafik Tren Performa Harian (Area Chart)
  const trendData = useMemo(() => {
    const datesMap: {
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
      if (!datesMap[e.date]) {
        datesMap[e.date] = { todoSum: 0, leaderSum: 0, count: 0, leaderCount: 0, komunikasiSum: 0, komunikasiCount: 0 };
      }
      datesMap[e.date].todoSum += e.employeeScorePercent;
      datesMap[e.date].count += 1;
      if (e.leaderScore !== null) {
        datesMap[e.date].leaderSum += e.leaderScore;
        datesMap[e.date].leaderCount += 1;
      }
      if (e.leaderCommunicationScore !== null) {
        datesMap[e.date].komunikasiSum += e.leaderCommunicationScore;
        datesMap[e.date].komunikasiCount += 1;
      }
    });

    const dates = Object.keys(datesMap).sort();
    return dates.map((date) => {
      const item = datesMap[date];
      const avgCentang = item.count > 0 ? Math.round(item.todoSum / item.count) : 0;
      const avgLeader = item.leaderCount > 0 ? Math.round(item.leaderSum / item.leaderCount) : avgCentang;
      const avgKomunikasi = item.komunikasiCount > 0 ? Math.round(item.komunikasiSum / item.komunikasiCount) : 0;

      const parts = date.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;

      return {
        date: formattedDate,
        fullDate: date,
        'Skor To-Do Centang (%)': avgCentang,
        'Nilai Leader': avgLeader,
        'Komunikasi': avgKomunikasi,
      };
    });
  }, [scopedEntries]);

  // 2. Data Grafik Batang Pencapaian per Karyawan (Bar Chart)
  const memberBarData = useMemo(() => {
    return memberStats.map((ms) => ({
      name: ms.member.name.split(' ')[0], // First name for neat labels
      fullName: ms.member.name,
      'Task Dicentang': ms.totalCompletedTasks,
      'Total Target Task': ms.totalAssignedTasks,
      'Rata-rata Skor %': ms.avgCentang,
    }));
  }, [memberStats]);

  // 3. Data Donut Chart (Distribusi Pencapaian KPI Target)
  const kpiDistributionData = useMemo(() => {
    let lulusKpi = 0;
    let perluBimbingan = 0;

    memberStats.forEach((ms) => {
      if (ms.avgCentang >= 70) {
        lulusKpi += 1;
      } else {
        perluBimbingan += 1;
      }
    });

    return [
      { name: 'Lulus KPI (≥70%)', value: lulusKpi, color: '#10b981' },
      { name: 'Perlu Bimbingan (<70%)', value: perluBimbingan, color: '#f59e0b' },
    ];
  }, [memberStats]);

  const underTargetMembers = memberStats.filter((m) => m.isUnderTarget);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>WFA Analytics &bull; Luzie Group</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Grafik &amp; Analisis Performa Tim</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Visualisasi tren skor to-do list centang, pencapaian target harian anggota tim, perbandingan tugas, dan indeks evaluasi leader.
          </p>
        </div>

        <div className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-center shrink-0">
          <div className="text-[10px] uppercase font-bold text-sky-200">Indeks Kinerja Tim</div>
          <div className="text-3xl font-extrabold text-white mt-0.5">{overallTeamAvg} / 100</div>
          <div className="text-[10px] text-sky-300 mt-0.5 font-medium">
            {filterEmployeeId === 'all'
              ? 'Berdasarkan Reviu Leader'
              : myAllStaff.find((m) => m.id === filterEmployeeId)?.name || 'Berdasarkan Reviu Leader'}
          </div>
        </div>
      </div>

      {/* Filter Rentang Waktu & Nama Karyawan (Staff) */}
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

        {/* Filter Nama Karyawan (Staff Koordinator Ini) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Karyawan</span>
          </div>
          <select
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
            className="w-full sm:w-72 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-semibold"
          >
            <option value="all">Semua Staff Saya ({myAllStaff.length} Orang)</option>
            {myAllStaff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} &bull; {m.division}
              </option>
            ))}
          </select>
          {filterEmployeeId !== 'all' && (
            <button
              onClick={() => setFilterEmployeeId('all')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 underline underline-offset-2"
            >
              Reset ke Semua Staff
            </button>
          )}
          <p className="text-[11px] text-slate-400 sm:ml-auto">
            Grafik, KPI, dan peringkat di bawah otomatis menyesuaikan dengan filter yang dipilih.
          </p>
        </div>
      </div>

      {/* Grid 3 Metrik Performa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Tingkat Penyelesaian To-Do
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600">
              {totalTasksAll > 0 ? Math.round((totalCompletedAll / totalTasksAll) * 100) : 0}%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({totalCompletedAll}/{totalTasksAll} Task Selesai)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{
                width: `${totalTasksAll > 0 ? Math.round((totalCompletedAll / totalTasksAll) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Kepatuhan Target KPI (≥70%)
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">
              {memberStats.length > 0
                ? Math.round(
                    ((memberStats.length - underTargetMembers.length) / memberStats.length) * 100
                  )
                : 0}
              %
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({memberStats.length - underTargetMembers.length} dari {memberStats.length} Anggota)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all"
              style={{
                width: `${
                  memberStats.length > 0
                    ? Math.round(
                        ((memberStats.length - underTargetMembers.length) / memberStats.length) * 100
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Anggota Perlu Pembinaan
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-extrabold ${
                underTargetMembers.length > 0 ? 'text-amber-600' : 'text-slate-700'
              }`}
            >
              {underTargetMembers.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">Karyawan Skor &lt; 70%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {underTargetMembers.length > 0
              ? 'Disarankan memberikan arahan tambahan pada to-do list'
              : 'Semua anggota tim memenuhi standar KPI WFA!'}
          </p>
        </div>
      </div>

      {/* GRAFIK 1 & GRAFIK 2: DUA KOLOM VISUALISASI RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRAFIK 1: Tren Performa Harian Tim (Area Chart) - 2 Kolom */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>Tren Pergerakan Performa Tim (Harian)</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Perbandingan antara Skor Centang To-Do Mandiri, Nilai Evaluasi Leader, dan Komunikasi harian
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> To-Do Centang %
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Nilai Leader
              </span>
              <span className="flex items-center gap-1.5 text-violet-600">
                <span className="w-3 h-3 rounded-full bg-violet-500 inline-block" /> Komunikasi
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTodo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorLeader" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorKomunikasiTim" x1="0" y1="0" x2="0" y2="1">
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
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Skor To-Do Centang (%)"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorTodo)"
                   />
                  <Area
                    type="monotone"
                    dataKey="Nilai Leader"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorLeader)"
                   />
                  <Area
                    type="monotone"
                    dataKey="Komunikasi"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorKomunikasiTim)"
                   />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Belum ada data historis yang cukup untuk grafik tren.
              </div>
            )}
          </div>
        </div>

        {/* GRAFIK 2: Distribusi Status KPI Tim (Donut Chart) - 1 Kolom */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-600" />
              <span>Distribusi Standar KPI Tim</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Proporsi anggota tim yang mencapai passing grade WFA (≥70%)
            </p>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={kpiDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {kpiDistributionData.map((entry, index) => (
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

            {/* Center Label in Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-slate-900">
                {memberStats.length > 0
                  ? Math.round(
                      ((memberStats.length - underTargetMembers.length) / memberStats.length) * 100
                    )
                  : 0}
                %
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Lulus KPI</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {kpiDistributionData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-bold text-slate-900">{d.value} Orang</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GRAFIK 3: Pencapaian Task To-Do per Anggota Tim (Bar Chart) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Volume Task Dikerjakan vs Target Diberikan per Anggota</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Menunjukkan jumlah to-do list yang berhasil diselesaikan dan dicentang oleh masing-masing karyawan
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 rounded-md bg-blue-500 inline-block" /> Task Dicentang (Selesai)
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-3 rounded-md bg-slate-300 inline-block" /> Total Target Task
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={memberBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="fullName"
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
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
              <Bar dataKey="Total Target Task" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Task Dicentang" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard & Rincian Kinerja Anggota Tim */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Peringkat &amp; Evaluasi Kinerja Anggota Tim</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Berdasarkan persentase to-do list centang mandiri dan skor review berkala leader
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Peringkat</th>
                <th className="py-3 px-4">Nama Anggota</th>
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4">Rata-rata Centang To-Do</th>
                <th className="py-3 px-4">Rata-rata Nilai Leader</th>
                <th className="py-3 px-4">Nilai Komunikasi</th>
                <th className="py-3 px-4">Total Task Selesai</th>
                <th className="py-3 px-4">Status KPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {memberStats.map((stat, idx) => (
                <tr key={stat.member.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                    <span
                      className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-extrabold ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-700'
                          : idx === 2
                          ? 'bg-orange-100 text-orange-800'
                          : 'text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={stat.member.avatar}
                        alt={stat.member.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{stat.member.name}</div>
                        <div className="text-[10px] text-slate-400">{stat.member.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600">{stat.member.division}</td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            stat.avgCentang >= 70 ? 'bg-blue-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${stat.avgCentang}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-800">{stat.avgCentang}%</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-extrabold text-slate-800">
                    <span
                      className={`px-2 py-0.5 rounded-lg border text-xs ${
                        stat.avgLeader >= 80
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : stat.avgLeader >= 70
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {stat.avgLeader} / 100
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    {stat.komunikasiCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg border text-xs font-extrabold bg-violet-50 text-violet-800 border-violet-200">
                        {stat.avgKomunikasi} / 100
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">&mdash;</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                    {stat.totalCompletedTasks} / {stat.totalAssignedTasks} Task
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        !stat.isUnderTarget
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {!stat.isUnderTarget ? 'Lulus Target KPI' : 'Perlu Bimbingan'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
