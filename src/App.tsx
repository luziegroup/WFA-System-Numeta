import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar, SidebarMenuId } from './components/Sidebar';
import { DashboardTimView } from './components/DashboardTimView';
import { ZoomPagiView } from './components/ZoomPagiView';
import { LeaderView } from './components/LeaderView'; // Monitor To-Do List
import { RekapAbsensiTimView } from './components/RekapAbsensiTimView';
import { PerformaTimView } from './components/PerformaTimView';
import { KirimTeguranView } from './components/KirimTeguranView';
import { LaporanTimView } from './components/LaporanTimView';
import { AkunSayaView } from './components/AkunSayaView';
import { BerandaSayaView } from './components/BerandaSayaView';
import { AbsensiGpsView } from './components/AbsensiGpsView';
import { TodoListKaryawanView } from './components/TodoListKaryawanView';
import { KaryawanView } from './components/KaryawanView';
import { HubstaffView } from './components/HubstaffView';
import { NotifikasiView } from './components/NotifikasiView';
import { PelanggaranSayaView } from './components/PelanggaranSayaView';
import { RiwayatAbsenKaryawanView } from './components/RiwayatAbsenKaryawanView';
import { PerformaKaryawanView } from './components/PerformaKaryawanView';
import { HrdView } from './components/HrdView';
import { RekapAbsenGlobalView } from './components/RekapAbsenGlobalView';
import { PengaturanWfaView } from './components/PengaturanWfaView';
import { ManajemenAkunView } from './components/ManajemenAkunView';
import { AnalisisPerformaHrdView } from './components/AnalisisPerformaHrdView';
import { ImageModal } from './components/ImageModal';
import { StartupNotificationModal } from './components/StartupNotificationModal';
import { LoginView } from './components/LoginView';
import { ForceChangePasswordView } from './components/ForceChangePasswordView';
import {
  CheckCircle,
  AlertTriangle,
  Info,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface ToastStackProps {
  toasts: { id: string; message: string; type: 'success' | 'warning' | 'info' }[];
}

const ToastStack: React.FC<ToastStackProps> = ({ toasts }) => (
  <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-bottom-2 ${
          toast.type === 'success'
            ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
            : toast.type === 'warning'
            ? 'bg-amber-900 text-amber-100 border-amber-700'
            : 'bg-slate-900 text-slate-100 border-slate-700'
        }`}
      >
        {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
        {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
        {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
        <span>{toast.message}</span>
      </div>
    ))}
  </div>
);

const MainApp: React.FC = () => {
  const { currentUser, toasts, isAuthenticated, isReady, logout, isImpersonating, impersonatorUser, returnToAdmin, mustChangePassword } =
    useApp();

  // Sidebar navigation state
  const [activeMenu, setActiveMenu] = useState<SidebarMenuId>('monitor-todo');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState<boolean>(false);

  // Sesuaikan menu default saat role user berubah
  useEffect(() => {
    if (currentUser.role === 'leader') {
      setActiveMenu('monitor-todo'); // Sesuai screenshot: "Monitor To-Do List" aktif
    } else if (currentUser.role === 'karyawan') {
      setActiveMenu('beranda-saya'); // Sesuai screenshot: "Beranda Saya" aktif
    } else if (currentUser.role === 'hrd') {
      setActiveMenu('dashboard-hrd');
    }
  }, [currentUser.role, currentUser.id]);

  // Data awal dari server belum termuat
  if (!isReady) {
    return (
      <div className="min-h-screen w-full bg-[#004080] flex flex-col items-center justify-center gap-4 font-sans text-white">
        <div className="w-10 h-10 rounded-full border-4 border-white/25 border-t-white animate-spin" />
        <div className="text-sm font-semibold">Memuat WFA System…</div>
      </div>
    );
  }

  // Belum login: tampilkan halaman login (email & password)
  if (!isAuthenticated) {
    return (
      <>
        <LoginView />
        <ToastStack toasts={toasts} />
      </>
    );
  }

  // WAJIB ganti password: akun masih memakai password default/bawaan (akun baru / hasil reset
  // HRD). Halaman ini MENGGANTIKAN seluruh aplikasi — sidebar & menu tidak bisa diakses sama
  // sekali sebelum password diganti. Tidak berlaku saat HRD sedang "login sebagai" akun lain.
  if (mustChangePassword) {
    return (
      <>
        <ForceChangePasswordView />
        <ToastStack toasts={toasts} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Bar peringatan saat HRD sedang login sebagai akun lain */}
      {isImpersonating && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 text-xs sm:text-sm font-semibold px-4 py-2 flex items-center justify-center gap-3 shadow-md">
          <span>
            Anda login sebagai <strong>{currentUser.name}</strong>
            {impersonatorUser ? ` (atas nama ${impersonatorUser.name})` : ''}
          </span>
          <button
            onClick={returnToAdmin}
            className="bg-amber-950 text-amber-50 px-3 py-1 rounded-lg hover:bg-amber-900 transition-colors"
          >
            Kembali ke Admin
          </button>
        </div>
      )}

      {/* Sidebar WFA System Luzie Group (Sesuai Screenshot!) */}
      <Sidebar
        activeMenu={activeMenu}
        onSelectMenu={(menuId) => setActiveMenu(menuId)}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isImpersonating ? 'pt-9' : ''}`}>
        {/* Top Navbar */}
        <Header
          onToggleSidebar={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
          activeRoleTab={currentUser.role}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* LEADER VIEWS (Menu Screenshot) */}
          {currentUser.role === 'leader' && (
            <>
              {activeMenu === 'dashboard-tim' && (
                <DashboardTimView onNavigate={(m) => setActiveMenu(m)} />
              )}
              {activeMenu === 'zoom-pagi' && <ZoomPagiView />}
              {activeMenu === 'monitor-todo' && <LeaderView />}
              {activeMenu === 'rekap-absensi-tim' && <RekapAbsensiTimView />}
              {activeMenu === 'performa-tim' && <PerformaTimView />}
              {activeMenu === 'kirim-teguran' && <KirimTeguranView />}
              {activeMenu === 'laporan-tim' && <LaporanTimView />}
              {activeMenu === 'akun-saya' && (
                <AkunSayaView onOpenSwitchAccount={logout} />
              )}
            </>
          )}

          {/* KARYAWAN VIEWS (Sesuai Persis 3 Screenshot Referensi) */}
          {currentUser.role === 'karyawan' && (
            <>
              {activeMenu === 'beranda-saya' && (
                <BerandaSayaView onNavigate={(m) => setActiveMenu(m)} />
              )}
              {(activeMenu === 'absensi-gps' || activeMenu === 'absen-harian') && (
                <AbsensiGpsView onNavigate={(m) => setActiveMenu(m)} />
              )}
              {activeMenu === 'todo-saya' && (
                <TodoListKaryawanView onNavigate={(m) => setActiveMenu(m)} />
              )}
              {activeMenu === 'hubstaff' && (
                <HubstaffView onNavigate={(m) => setActiveMenu(m)} />
              )}
              {activeMenu === 'notifikasi' && (
                <NotifikasiView onNavigate={(m) => setActiveMenu(m)} />
              )}
              {activeMenu === 'riwayat-absen' && <RiwayatAbsenKaryawanView />}
              {activeMenu === 'performa-saya' && <PerformaKaryawanView />}
              {activeMenu === 'pelanggaran-saya' && (
                <PelanggaranSayaView />
              )}
              {activeMenu === 'akun-saya' && (
                <AkunSayaView onOpenSwitchAccount={logout} />
              )}
            </>
          )}

          {/* HRD VIEWS */}
          {currentUser.role === 'hrd' && (
            <>
              {activeMenu === 'dashboard-hrd' && (
                <HrdView onNavigate={(m) => setActiveMenu(m as SidebarMenuId)} />
              )}
              {activeMenu === 'rekap-global' && <RekapAbsenGlobalView />}
              {activeMenu === 'analisis-performa' && <AnalisisPerformaHrdView />}
              {activeMenu === 'pengaturan-wfa' && <PengaturanWfaView />}
              {activeMenu === 'manajemen-akun' && <ManajemenAkunView />}
              {activeMenu === 'akun-saya' && (
                <AkunSayaView onOpenSwitchAccount={logout} />
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200/80 py-4 px-6 text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">WFA System &bull; Luzie Group</span>
              <span>&copy; 2026 Hak Cipta Dilindungi</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Sistem To-Do List Centang Otomatis, Bukti Link &amp; Foto, Presensi &amp; Evaluasi Leader
            </div>
          </div>
        </footer>
      </div>

      {/* Modal Popup Bukti Foto */}
      <ImageModal />

      {/* Popup Notifikasi Awal: Teguran wajib dibaca & pengingat Zoom sebelum absen */}
      <StartupNotificationModal onNavigate={(m) => setActiveMenu(m)} />

      <ToastStack toasts={toasts} />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
