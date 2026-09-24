import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutGrid,
  Video,
  Eye,
  BarChart2,
  TrendingUp,
  Bell,
  FileSpreadsheet,
  UserCheck,
  CheckSquare,
  Clock,
  CalendarCheck,
  ShieldCheck,
  Briefcase,
  Users,
  Settings,
  Home,
  Check,
  X,
  Play,
  MapPin,
  ListChecks,
  History,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type SidebarMenuId =
  | 'dashboard-tim'
  | 'zoom-pagi'
  | 'monitor-todo'
  | 'rekap-absensi-tim'
  | 'performa-tim'
  | 'kirim-teguran'
  | 'laporan-tim'
  | 'akun-saya'
  // Menu Karyawan (Sesuai Persis Screenshot User)
  | 'beranda-saya'
  | 'absensi-gps'
  | 'todo-saya'
  | 'hubstaff'
  | 'notifikasi'
  | 'performa-saya'
  | 'riwayat-absen'
  | 'pelanggaran-saya'
  | 'absen-harian'
  // Menu HRD
  | 'dashboard-hrd'
  | 'rekap-global'
  | 'analisis-performa'
  | 'pengaturan-wfa'
  | 'manajemen-akun';

interface SidebarProps {
  activeMenu: SidebarMenuId;
  onSelectMenu: (menuId: SidebarMenuId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const COLLAPSE_KEY = 'wfa_sidebar_collapsed_v1';

/** Satu tombol menu di sidebar. Saat collapsed, hanya ikon yang tampil (label jadi tooltip). */
const NavItem: React.FC<{
  id?: string;
  icon: React.ElementType;
  iconClassName?: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: number;
  badgeColorClass?: string;
  pulseDot?: boolean;
}> = ({
  id,
  icon: Icon,
  iconClassName = '',
  label,
  active,
  collapsed,
  onClick,
  badge,
  badgeColorClass = 'bg-amber-500',
  pulseDot,
}) => (
  <button
    id={id}
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`relative w-full flex items-center rounded-xl font-semibold text-xs transition-all text-left ${
      collapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-3.5 py-2.5'
    } ${
      active
        ? 'bg-[#e0f2fe] text-[#0369a1] font-bold shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`}
  >
    <Icon
      className={`w-4 h-4 shrink-0 ${iconClassName} ${active ? 'text-[#0284c7]' : 'text-slate-500'}`}
    />
    {!collapsed && <span className="flex-1">{label}</span>}
    {!collapsed && pulseDot && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
    {!collapsed && badge !== undefined && badge > 0 && (
      <span className={`px-1.5 py-0.5 text-[10px] font-bold text-white rounded-full ${badgeColorClass}`}>
        {badge}
      </span>
    )}
    {collapsed && ((badge !== undefined && badge > 0) || pulseDot) && (
      <span
        className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white ${
          pulseDot ? 'bg-emerald-500 animate-pulse' : badgeColorClass
        }`}
      />
    )}
  </button>
);

/** Judul kelompok menu (mis. "MENU UTAMA"). Saat collapsed, jadi garis pemisah tipis. */
const SectionLabel: React.FC<{ label: string; collapsed: boolean }> = ({ label, collapsed }) =>
  collapsed ? (
    <div className="mx-2 border-t border-slate-200" />
  ) : (
    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">{label}</div>
  );

export const Sidebar: React.FC<SidebarProps> = ({
  activeMenu,
  onSelectMenu,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { currentUser, entries, selectedDate, warnings, allUsers } = useApp();

  // Status minimize/collapse sidebar (khusus layar desktop), diingat lewat localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, isCollapsed ? '1' : '0');
    } catch {
      // localStorage tidak tersedia — abaikan
    }
  }, [isCollapsed]);

  // Menghitung badge untuk Monitor To-Do List & Kirim Teguran (khusus anggota tim leader ini)
  const myTeamIds = new Set(
    allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === currentUser.id).map((u) => u.id)
  );
  const dayEntries = entries.filter((e) => e.date === selectedDate && myTeamIds.has(e.userId));
  const pendingReviewCount = dayEntries.filter((e) => e.status === 'siang_selesai').length;
  const activeWarningsCount = warnings.filter((w) => myTeamIds.has(w.recipientId)).length;

  const handleItemClick = (menuId: SidebarMenuId) => {
    onSelectMenu(menuId);
    if (isOpenMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 ${
          isCollapsed ? 'lg:w-[76px]' : 'lg:w-64'
        } bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out select-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Tombol minimize/expand (desktop saja) */}
        <button
          onClick={() => setIsCollapsed((v) => !v)}
          title={isCollapsed ? 'Perluas menu' : 'Ciutkan menu'}
          className="hidden lg:flex absolute top-16 -right-3 z-10 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-500 hover:text-[#004080] hover:border-[#004080] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Sidebar Brand Header (Mirip persis dengan screenshot pengguna!) */}
        <div
          className={`bg-[#004080] py-3.5 flex items-center text-white shrink-0 shadow-xs ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
            {/* White rounded square logo with blue home check icon */}
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
              <div className="relative flex items-center justify-center">
                <Home className="w-5 h-5 text-[#0060b5]" />
                <span className="absolute -bottom-1 -right-1 bg-sky-500 text-white rounded-full p-0.5 ring-1 ring-white">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              </div>
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-extrabold text-white text-base tracking-tight leading-tight">
                  WFA System
                </h1>
                <p className="text-xs font-semibold text-sky-400 tracking-normal leading-none mt-0.5">
                  Luzie Group
                </p>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          {!isCollapsed && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-200"
              title="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Area */}
        <div
          className={`flex-1 overflow-y-auto py-3 space-y-5 text-sm ${
            isCollapsed ? 'px-2' : 'px-3'
          }`}
        >
          {/* ============================================================ */}
          {/* LEADER / KOORDINATOR MENU (PERSIS SEPERTI SCREENSHOT USER!) */}
          {/* ============================================================ */}
          {currentUser.role === 'leader' && (
            <>
              {/* SECTION: MENU UTAMA */}
              <div className="space-y-1.5">
                <SectionLabel label="MENU UTAMA" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-dashboard-tim"
                    icon={LayoutGrid}
                    label="Dashboard Tim"
                    active={activeMenu === 'dashboard-tim'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('dashboard-tim')}
                  />
                  <NavItem
                    id="menu-zoom-pagi"
                    icon={Video}
                    label="Google Meet Tim"
                    active={activeMenu === 'zoom-pagi'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('zoom-pagi')}
                    pulseDot
                  />
                  <NavItem
                    id="menu-monitor-todo"
                    icon={Eye}
                    label="Monitor To-Do List"
                    active={activeMenu === 'monitor-todo'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('monitor-todo')}
                    badge={pendingReviewCount}
                    badgeColorClass="bg-amber-500"
                  />
                  <NavItem
                    id="menu-rekap-absensi-tim"
                    icon={BarChart2}
                    label="Rekap Absensi Tim"
                    active={activeMenu === 'rekap-absensi-tim'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('rekap-absensi-tim')}
                  />
                  <NavItem
                    id="menu-performa-tim"
                    icon={TrendingUp}
                    label="Performa Tim"
                    active={activeMenu === 'performa-tim'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('performa-tim')}
                  />
                </div>
              </div>

              {/* SECTION: TINDAKAN */}
              <div className="space-y-1.5">
                <SectionLabel label="TINDAKAN" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-kirim-teguran"
                    icon={Bell}
                    label="Kirim Teguran"
                    active={activeMenu === 'kirim-teguran'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('kirim-teguran')}
                    badge={activeWarningsCount}
                    badgeColorClass="bg-rose-500"
                  />
                  <NavItem
                    id="menu-laporan-tim"
                    icon={FileSpreadsheet}
                    label="Laporan Tim"
                    active={activeMenu === 'laporan-tim'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('laporan-tim')}
                  />
                </div>
              </div>

              {/* SECTION: AKUN */}
              <div className="space-y-1.5">
                <SectionLabel label="AKUN" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-akun-saya"
                    icon={UserCheck}
                    label="Akun Saya"
                    active={activeMenu === 'akun-saya'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('akun-saya')}
                  />
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* KARYAWAN MENU (PERSIS SEPERTI SCREENSHOT USER!) */}
          {/* ============================================================ */}
          {currentUser.role === 'karyawan' && (
            <>
              {/* SECTION: MENU UTAMA */}
              <div className="space-y-1.5">
                <SectionLabel label="MENU UTAMA" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-kary-beranda"
                    icon={Home}
                    label="Beranda Saya"
                    active={activeMenu === 'beranda-saya'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('beranda-saya')}
                  />
                  <NavItem
                    id="menu-kary-absensi-gps"
                    icon={MapPin}
                    label="Absensi + GPS"
                    active={activeMenu === 'absensi-gps' || activeMenu === 'absen-harian'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('absensi-gps')}
                  />
                  <NavItem
                    id="menu-kary-todo"
                    icon={ListChecks}
                    label="To-Do List"
                    active={activeMenu === 'todo-saya'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('todo-saya')}
                  />
                  <NavItem
                    id="menu-kary-hubstaff"
                    icon={Play}
                    iconClassName="fill-current"
                    label="Hubstaff"
                    active={activeMenu === 'hubstaff'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('hubstaff')}
                  />
                </div>
              </div>

              {/* SECTION: INFORMASI */}
              <div className="space-y-1.5">
                <SectionLabel label="INFORMASI" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-kary-notifikasi"
                    icon={Bell}
                    label="Notifikasi"
                    active={activeMenu === 'notifikasi'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('notifikasi')}
                  />
                  <NavItem
                    id="menu-kary-performa"
                    icon={TrendingUp}
                    label="Performa Saya"
                    active={activeMenu === 'performa-saya'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('performa-saya')}
                  />
                  <NavItem
                    id="menu-kary-riwayat"
                    icon={History}
                    label="Riwayat Absen"
                    active={activeMenu === 'riwayat-absen'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('riwayat-absen')}
                  />
                  <NavItem
                    id="menu-kary-pelanggaran"
                    icon={AlertTriangle}
                    label="Pelanggaran Saya"
                    active={activeMenu === 'pelanggaran-saya'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('pelanggaran-saya')}
                  />
                </div>
              </div>

              {/* SECTION: AKUN */}
              <div className="space-y-1.5">
                <SectionLabel label="AKUN" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-kary-akun"
                    icon={UserCheck}
                    label="Akun Saya"
                    active={activeMenu === 'akun-saya'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('akun-saya')}
                  />
                </div>
              </div>
            </>
          )}

          {/* ============================================================ */}
          {/* HRD MENU */}
          {/* ============================================================ */}
          {currentUser.role === 'hrd' && (
            <>
              <div className="space-y-1.5">
                <SectionLabel label="MENU UTAMA" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-hrd-dash"
                    icon={LayoutGrid}
                    iconClassName="text-sky-600"
                    label="Dashboard HRD"
                    active={activeMenu === 'dashboard-hrd'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('dashboard-hrd')}
                  />
                  <NavItem
                    id="menu-hrd-rekap"
                    icon={BarChart2}
                    label="Rekap Absensi Global"
                    active={activeMenu === 'rekap-global'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('rekap-global')}
                  />
                  <NavItem
                    id="menu-hrd-analisis"
                    icon={TrendingUp}
                    label="Analisis Performa Tim"
                    active={activeMenu === 'analisis-performa'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('analisis-performa')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <SectionLabel label="PENGATURAN" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-hrd-pengaturan"
                    icon={Settings}
                    label="Pengaturan WFA"
                    active={activeMenu === 'pengaturan-wfa'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('pengaturan-wfa')}
                  />
                  <NavItem
                    id="menu-hrd-manajemen"
                    icon={Users}
                    label="Manajemen Akun"
                    active={activeMenu === 'manajemen-akun'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('manajemen-akun')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <SectionLabel label="AKUN" collapsed={isCollapsed} />
                <div className="space-y-1">
                  <NavItem
                    id="menu-hrd-akun"
                    icon={UserCheck}
                    label="Akun Saya"
                    active={activeMenu === 'akun-saya'}
                    collapsed={isCollapsed}
                    onClick={() => handleItemClick('akun-saya')}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom User Card in Sidebar */}
        <div className={`p-3 border-t border-slate-200 bg-slate-50/70 shrink-0`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              title={isCollapsed ? currentUser.name : undefined}
              className="w-9 h-9 rounded-full object-cover border border-slate-300 shrink-0"
            />
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    {currentUser.division}
                  </p>
                </div>
                <span
                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    currentUser.role === 'leader'
                      ? 'bg-amber-100 text-amber-800'
                      : currentUser.role === 'hrd'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {currentUser.role}
                </span>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
