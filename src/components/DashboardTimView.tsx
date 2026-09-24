import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutGrid,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Eye,
  Video,
  Bell,
  ArrowUpRight,
  Sparkles,
  Calendar,
  BarChart3
} from 'lucide-react';
import { SidebarMenuId } from './Sidebar';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface DashboardTimViewProps {
  onNavigate: (menuId: SidebarMenuId) => void;
}

export const DashboardTimView: React.FC<DashboardTimViewProps> = ({ onNavigate }) => {
  const { entries, selectedDate, allUsers, setSelectedDate, currentUser } = useApp();

  // Anggota tim yang SAAT INI ditugaskan ke leader ini (mengikuti penugasan terbaru dari HRD)
  const teamMembers = useMemo(
    () => allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === currentUser.id),
    [allUsers, currentUser.id]
  );
  const myTeamIds = useMemo(() => new Set(teamMembers.map((m) => m.id)), [teamMembers]);

  const dayEntries = entries.filter((e) => e.date === selectedDate && myTeamIds.has(e.userId));

  const hadirPagiCount = dayEntries.filter((e) => e.absenPagi !== null).length;
  const selesaiSiangCount = dayEntries.filter((e) => e.absenSiang !== null).length;
  const needReviewCount = dayEntries.filter((e) => e.status === 'siang_selesai').length;
  const reviewedCount = dayEntries.filter((e) => e.status === 'selesai_direview').length;

  const totalScores = dayEntries.reduce((acc, curr) => acc + curr.employeeScorePercent, 0);
  const avgScore = dayEntries.length > 0 ? Math.round(totalScores / dayEntries.length) : 0;

  // Mini Chart Data
  const chartData = useMemo(() => {
    return teamMembers.map((member) => {
      const entry = dayEntries.find((e) => e.userId === member.id);
      return {
        name: member.name.split(' ')[0],
        'Skor To-Do (%)': entry ? entry.employeeScorePercent : 0,
        'Nilai Leader': entry && entry.leaderScore !== null ? entry.leaderScore : 0,
      };
    });
  }, [teamMembers, dayEntries]);

  return (
    <div className="space-y-6">
      {/* Header Banner Dashboard Tim */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <LayoutGrid className="w-4 h-4" />
            <span>WFA System &bull; Koordinator Panel</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Dashboard Tim WFA</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Ringkasan status absensi pagi/siang, persentase penyelesaian to-do list centang, dan progres penilaian evaluasi harian.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-quick-monitor"
            onClick={() => onNavigate('monitor-todo')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-[#004080] font-bold text-xs transition-all shadow-md"
          >
            <Eye className="w-4 h-4" />
            <span>Monitor To-Do List</span>
            {needReviewCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px]">
                {needReviewCount}
              </span>
            )}
          </button>

          <button
            id="btn-quick-zoom"
            onClick={() => onNavigate('zoom-pagi')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all"
          >
            <Video className="w-4 h-4 text-emerald-400" />
            <span>Google Meet Tim</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Metrik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Anggota Tim
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{teamMembers.length}</span>
            <span className="text-xs text-slate-500 font-medium">Orang Karyawan</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">{hadirPagiCount} hadir pagi</span> &bull;{' '}
            <span>{teamMembers.length - hadirPagiCount} belum</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sudah Absen Siang
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{selesaiSiangCount}</span>
            <span className="text-xs text-slate-500 font-medium">dari {teamMembers.length}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {selesaiSiangCount === teamMembers.length
              ? 'Seluruh tim telah absen siang'
              : `${teamMembers.length - selesaiSiangCount} menunggu absen siang`}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Perlu Review Leader
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{needReviewCount}</span>
            <span className="text-xs text-slate-500 font-medium">To-Do Siang</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {reviewedCount} telah selesai diberi nilai & komentar
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rata-rata Skor To-Do
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600">{avgScore}%</span>
            <span className="text-xs text-slate-500 font-medium">Capaian Centang</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Berdasarkan checklist to-do riil hari ini
          </div>
        </div>
      </div>

      {/* Grafik Performa Singkat Tim Hari Ini */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>Grafik Performa Tim Hari Ini</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan capaian to-do list centang mandiri (%) dan evaluasi leader per anggota tim
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-3 h-3 rounded-md bg-blue-500 inline-block" /> To-Do Centang %
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" /> Nilai Leader
              </span>
            </div>

            <button
              onClick={() => onNavigate('performa-tim')}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>Lihat Analisis Lengkap</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
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
              <Bar dataKey="Skor To-Do (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Nilai Leader" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabel Status Kehadiran Tim Hari Ini */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Kehadiran & Status To-Do Tim</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar anggota tim beserta status jam absen pagi, siang, dan skor to-do centang
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('monitor-todo')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>Buka Semua To-Do</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Anggota Tim</th>
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4">Absen Pagi</th>
                <th className="py-3 px-4">Absen Siang</th>
                <th className="py-3 px-4">Progress To-Do</th>
                <th className="py-3 px-4">Nilai Leader</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamMembers.map((member) => {
                const entry = dayEntries.find((e) => e.userId === member.id);
                const hasPagi = !!entry?.absenPagi;
                const hasSiang = !!entry?.absenSiang;
                const isNeedReview = entry?.status === 'siang_selesai';
                const isReviewed = entry?.status === 'selesai_direview';

                return (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{member.name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{member.division}</td>
                    <td className="py-3.5 px-4">
                      {hasPagi ? (
                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                          {entry?.absenPagi?.time}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Belum absen</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {hasSiang ? (
                        <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">
                          {entry?.absenSiang?.time}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Belum absen</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {entry && entry.totalTodos > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">
                              {entry.completedTodos}/{entry.totalTodos} Task
                            </span>
                            <span className="font-bold text-blue-600">
                              {entry.employeeScorePercent}%
                            </span>
                          </div>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all"
                              style={{ width: `${entry.employeeScorePercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum ada to-do</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {entry?.leaderScore !== null && entry?.leaderScore !== undefined ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                          {entry.leaderScore} / 100
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isNeedReview ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          Perlu Review
                        </span>
                      ) : isReviewed ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Selesai Review
                        </span>
                      ) : hasPagi ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Sedang WFA
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          Belum Mulai
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onNavigate('monitor-todo')}
                        className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
