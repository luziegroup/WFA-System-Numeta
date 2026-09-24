import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Video,
  Award,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCheck,
  Calendar,
  Sparkles,
  Info,
  ChevronRight
} from 'lucide-react';
import { SidebarMenuId } from './Sidebar';

interface NotifikasiViewProps {
  onNavigate?: (menu: SidebarMenuId) => void;
}

export type NotificationType = 'teguran' | 'review' | 'zoom' | 'jadwal' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  date: string;
  sender: string;
  isRead: boolean;
  priority?: 'high' | 'normal' | 'urgent';
  targetMenu?: SidebarMenuId;
  actionLabel?: string;
}

export const NotifikasiView: React.FC<NotifikasiViewProps> = ({ onNavigate }) => {
  const { currentUser, warnings, zoomMeetings, entries, selectedDate, showToast, markWarningRead } = useApp();

  // Filter kategori notifikasi
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'teguran' | 'review' | 'zoom'>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Kumpulkan semua notifikasi secara dinamis dari data sistem
  const notifications: AppNotification[] = useMemo(() => {
    const list: AppNotification[] = [];

    // 1. Notifikasi Teguran / Peringatan dari Leader/HRD untuk Karyawan ini
    const userWarnings = warnings.filter(
      (w) => w.recipientId === currentUser.id || w.recipientName === currentUser.name
    );
    userWarnings.forEach((w) => {
      list.push({
        id: `warn-${w.id}`,
        type: 'teguran',
        title: `Peringatan: ${w.title}`,
        message: w.message,
        timestamp: w.createdAt || '10:00 WIB',
        date: w.date,
        sender: w.senderName || 'Leader / Supervisor',
        isRead: readIds.has(`warn-${w.id}`) || w.status === 'dibaca' || w.status === 'ditanggapi',
        priority: 'urgent',
        targetMenu: 'pelanggaran-saya',
        actionLabel: 'Lihat Peringatan'
      });
    });

    // 2. Notifikasi Hasil Review / Evaluasi Leader
    const userEntries = entries.filter((e) => e.userId === currentUser.id && e.leaderScore !== null);
    userEntries.forEach((e) => {
      list.push({
        id: `review-${e.id}`,
        type: 'review',
        title: `Evaluasi To-Do Selesai: Nilai ${e.leaderScore}/100`,
        message: e.leaderGeneralComment
          ? `Catatan Leader: "${e.leaderGeneralComment}"`
          : `Hasil review centang to-do Anda tanggal ${e.date} telah dinilai oleh ${e.leaderReviewedBy || 'Leader'}.`,
        timestamp: e.leaderReviewedAt || '13:30 WIB',
        date: e.date,
        sender: e.leaderReviewedBy || currentUser.leaderName || 'Leader Tim',
        isRead: readIds.has(`review-${e.id}`),
        priority: 'normal',
        targetMenu: 'performa-saya',
        actionLabel: 'Lihat Performa'
      });
    });

    // 3. Notifikasi Zoom Meeting (hanya dari koordinator/leader karyawan ini sendiri)
    zoomMeetings
      .filter((z) => z.leaderId === currentUser.leaderId)
      .forEach((z) => {
        list.push({
          id: `zoom-${z.id}`,
          type: 'zoom',
          title: z.isUrgent ? `🚨 Google Meet Urgen: ${z.title}` : `Undangan Google Meet: ${z.title}`,
          message: `Meeting dijadwalkan pukul ${z.time} WIB. Agenda: ${z.agenda || 'Briefing koordinasi harian'}.`,
          timestamp: z.time,
          date: z.date,
          sender: z.hostName || 'Koordinator Tim',
          isRead: readIds.has(`zoom-${z.id}`),
          priority: z.isUrgent ? 'urgent' : 'high',
          targetMenu: 'todo-saya',
          actionLabel: 'Buka Jadwal'
        });
      });

    // 4. Notifikasi Jadwal Harian WFA & Pengingat Rutin
    list.push({
      id: 'reminder-hubstaff',
      type: 'jadwal',
      title: 'Aktifkan Time Tracking Hubstaff',
      message: 'Setelah menyelesaikan absen pagi dan menyusun to-do list, pastikan timer Hubstaff Anda telah berjalan.',
      timestamp: '08:35 WIB',
      date: selectedDate,
      sender: 'Sistem Otomatis WFA',
      isRead: readIds.has('reminder-hubstaff'),
      priority: 'normal',
      targetMenu: 'hubstaff',
      actionLabel: 'Buka Hubstaff'
    });

    list.push({
      id: 'reminder-siang',
      type: 'jadwal',
      title: 'Pukul 12:00 WIB: Waktunya Absen Siang & Centang To-Do',
      message: 'Segera centang tugas-tugas yang telah selesai dan lampirkan bukti link dokumen serta foto hasil pekerjaan sebelum istirahat.',
      timestamp: '12:00 WIB',
      date: selectedDate,
      sender: 'Sistem Presensi WFA',
      isRead: readIds.has('reminder-siang'),
      priority: 'high',
      targetMenu: 'todo-saya',
      actionLabel: 'Centang To-Do'
    });

    list.push({
      id: 'reminder-pagi',
      type: 'jadwal',
      title: 'Pengingat Presensi WFA Pagi (Batas 08:30 WIB)',
      message: 'Pastikan Anda telah mengisi presensi pagi dan menyusun minimal 3 target to-do list hari ini.',
      timestamp: '08:15 WIB',
      date: selectedDate,
      sender: 'Sistem Presensi WFA',
      isRead: readIds.has('reminder-pagi'),
      priority: 'normal',
      targetMenu: 'absensi-gps',
      actionLabel: 'Absen Sekarang'
    });

    // Sort by timestamp or urgent first
    return list.sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      return 0;
    });
  }, [warnings, zoomMeetings, entries, currentUser, selectedDate, readIds]);

  // Hitung jumlah unread
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Filter tampilan
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'teguran') return n.type === 'teguran';
    if (activeTab === 'review') return n.type === 'review';
    if (activeTab === 'zoom') return n.type === 'zoom';
    return true;
  });

  const handleMarkAsRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
    // Kalau ini notifikasi teguran, tandai juga statusnya "dibaca" secara permanen di sistem
    if (id.startsWith('warn-')) {
      markWarningRead(id.replace('warn-', ''));
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    warnings
      .filter((w) => (w.recipientId === currentUser.id || w.recipientName === currentUser.name) && w.status === 'terkirim')
      .forEach((w) => markWarningRead(w.id));
    showToast('Semua notifikasi ditandai sebagai sudah dibaca', 'success');
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'teguran':
        return <AlertTriangle className="w-5 h-5 text-rose-600" />;
      case 'review':
        return <Award className="w-5 h-5 text-blue-600" />;
      case 'zoom':
        return <Video className="w-5 h-5 text-sky-600" />;
      case 'jadwal':
        return <Clock className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getNotificationBadgeClass = (type: NotificationType) => {
    switch (type) {
      case 'teguran':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'review':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'zoom':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'jadwal':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <Bell className="w-4 h-4" />
            <span>Pusat Notifikasi &bull; WFA System</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Notifikasi &amp; Peringatan</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Pantau seluruh pengingat presensi harian, evaluasi review leader, panggilan Google Meet, dan surat teguran secara terintegrasi.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors backdrop-blur-xs border border-white/20"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Tandai Semua Dibaca</span>
            </button>
          )}
          <div className="px-3.5 py-2 rounded-xl bg-sky-400 text-[#004080] font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
            <span>{unreadCount} Belum Dibaca</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Semua ({notifications.length})
        </button>

        <button
          onClick={() => setActiveTab('unread')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            activeTab === 'unread'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Belum Dibaca</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('teguran')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
            activeTab === 'teguran'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Peringatan &amp; Teguran
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
            activeTab === 'review'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Review Leader
        </button>

        <button
          onClick={() => setActiveTab('zoom')}
          className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
            activeTab === 'zoom'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Google Meet &amp; Rapat
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Tidak Ada Notifikasi</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Semua notifikasi pada kategori ini sudah Anda baca atau belum ada pembaruan baru dari sistem.
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleMarkAsRead(notif.id)}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer ${
                !notif.isRead
                  ? 'bg-white border-blue-200 shadow-xs ring-1 ring-blue-50 hover:border-blue-300'
                  : 'bg-white/70 border-slate-200/80 hover:bg-white text-slate-600 opacity-90'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    notif.type === 'teguran'
                      ? 'bg-rose-50 border border-rose-200'
                      : notif.type === 'review'
                      ? 'bg-blue-50 border border-blue-200'
                      : notif.type === 'zoom'
                      ? 'bg-sky-50 border border-sky-200'
                      : 'bg-emerald-50 border border-emerald-200'
                  }`}
                >
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-900">{notif.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getNotificationBadgeClass(
                        notif.type
                      )}`}
                    >
                      {notif.type}
                    </span>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Belum Dibaca" />
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{notif.message}</p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                    <span>Pengirim: <strong className="text-slate-600">{notif.sender}</strong></span>
                    <span>&bull;</span>
                    <span>{notif.date} • {notif.timestamp}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {notif.targetMenu && (
                <div className="shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(notif.id);
                      if (notif.targetMenu) onNavigate?.(notif.targetMenu);
                    }}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition-all"
                  >
                    <span>{notif.actionLabel || 'Lihat'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
