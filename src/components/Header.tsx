import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  Calendar,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Menu,
  Home,
  Check,
  ShieldCheck,
  User as UserIcon,
  Briefcase,
  LogOut
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
  activeRoleTab?: 'karyawan' | 'leader' | 'hrd';
  onSelectRoleTab?: (role: 'karyawan' | 'leader' | 'hrd') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  activeRoleTab,
  onSelectRoleTab,
}) => {
  const { currentUser, logout, isOnline } = useApp();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#004080] text-white border-b border-[#003366] shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Mobile Toggle & Brand Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors"
                title="Buka Menu"
                id="btn-mobile-sidebar-toggle"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white flex items-center justify-center shadow-xs shrink-0">
                  <div className="relative flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#0060b5]" />
                    <span className="absolute -bottom-1 -right-1 bg-sky-500 text-white rounded-full p-0.5 ring-1 ring-white">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-base sm:text-lg tracking-tight leading-none">
                      WFA System
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      Luzie Group
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-200/80 font-medium hidden sm:block leading-tight mt-0.5">
                    Work From Anywhere Management Portal
                  </p>
                </div>
              </div>
            </div>

            {/* Middle & Right: Clock, Online Badge, User & Keluar */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Clock */}
              <div className="text-xs font-mono font-bold text-sky-100 hidden sm:block">
                {timeStr}
              </div>

              {/* Status koneksi Firebase */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
                title={isOnline ? 'Tersambung ke server' : 'Tidak ada koneksi — perubahan akan dikirim saat online kembali'}
              >
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full ${currentUser.role === 'karyawan' ? 'bg-emerald-700' : 'bg-amber-600'} text-white font-bold text-xs flex items-center justify-center border border-white/20 shadow-xs shrink-0`}>
                  {currentUser.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-white leading-none">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-sky-300 font-semibold mt-0.5">
                    {currentUser.role === 'leader'
                      ? 'Koordinator'
                      : currentUser.role === 'karyawan'
                      ? 'Karyawan'
                      : 'HRD Management'}
                  </div>
                </div>
              </div>

              {/* Tombol Keluar: benar-benar logout ke halaman Selamat Datang */}
              <button
                id="btn-logout"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/20 transition-all"
                title="Keluar dari akun"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

    </>
  );
};
