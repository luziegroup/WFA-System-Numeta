import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { compressImage } from '../lib/image';
import {
  UserCheck,
  Building2,
  Mail,
  Phone,
  Shield,
  KeyRound,
  CheckCircle2,
  Save,
  Laptop,
  Users,
  Camera,
  Upload,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';

interface AkunSayaViewProps {
  onOpenSwitchAccount: () => void;
}

// Koleksi preset avatar profesional cepat
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
];

export const AkunSayaView: React.FC<AkunSayaViewProps> = ({ onOpenSwitchAccount }) => {
  const { currentUser, updateUser, showToast, verifyCurrentPassword, mustChangePassword, isDefaultPasswordValue } = useApp();

  // State Profil Umum
  const [phoneNumber, setPhoneNumber] = useState('+62 812-3456-7890');
  const [wfaAddress, setWfaAddress] = useState(currentUser.wfaAddress || 'Jakarta Selatan, DKI Jakarta');
  
  // State Ganti Foto Profil
  const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State Ganti Password
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Preferensi Notifikasi
  const [notifyStandup, setNotifyStandup] = useState(true);
  const [notifyAfternoon, setNotifyAfternoon] = useState(true);
  const [notifyLeaderReview, setNotifyLeaderReview] = useState(true);

  // Handle File Upload Foto Profil
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih file gambar (JPG, PNG, WebP)', 'warning');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 3MB', 'warning');
      return;
    }

    compressImage(file, 400, 0.8)
      .then((result) => setAvatarPreview(result))
      .catch(() => showToast('Gagal memproses foto, coba file lain', 'warning'));
  };

  // Simpan Foto Profil
  const handleSaveAvatar = () => {
    const finalAvatar = avatarUrlInput.trim() || avatarPreview;
    if (!finalAvatar) {
      showToast('Pilih atau masukkan foto profil terlebih dahulu', 'warning');
      return;
    }

    updateUser(currentUser.id, { avatar: finalAvatar });
    setShowPhotoModal(false);
    showToast('Foto profil berhasil diperbarui!', 'success');
  };

  // Reset Foto Profil ke Default
  const handleResetAvatar = () => {
    const defaultAvatar = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80`;
    setAvatarPreview(defaultAvatar);
    setAvatarUrlInput('');
    updateUser(currentUser.id, { avatar: defaultAvatar });
    showToast('Foto profil dikembalikan ke default', 'info');
  };

  // Handle Simpan Profil & Lokasi WFA
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser(currentUser.id, {
      wfaAddress: wfaAddress.trim() || 'Jakarta Selatan, DKI Jakarta'
    });
    showToast('Informasi profil dan lokasi WFA berhasil disimpan!', 'success');
  };

  // Evaluasi kekuatan password
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: '', percent: 0, color: 'bg-slate-200' };
    if (pass.length < 6) return { label: 'Sangat Lemah (Min. 6 Karakter)', percent: 25, color: 'bg-rose-500' };
    const hasLetter = /[a-zA-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);

    if (hasLetter && hasNumber && hasSpecial && pass.length >= 8) {
      return { label: 'Sangat Kuat', percent: 100, color: 'bg-emerald-500' };
    }
    if (hasLetter && hasNumber && pass.length >= 6) {
      return { label: 'Kuat', percent: 75, color: 'bg-blue-500' };
    }
    return { label: 'Cukup', percent: 50, color: 'bg-amber-500' };
  };

  const passwordStrength = getPasswordStrength(newPasswordInput);

  // Handle Ganti Password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validasi input
    if (!currentPasswordInput) {
      setPasswordError('Harap masukkan password saat ini');
      return;
    }

    if (!verifyCurrentPassword(currentPasswordInput)) {
      setPasswordError('Password saat ini tidak sesuai!');
      return;
    }

    if (newPasswordInput.length < 6) {
      setPasswordError('Password baru minimal harus 6 karakter');
      return;
    }

    if (isDefaultPasswordValue(newPasswordInput)) {
      setPasswordError('Password baru tidak boleh sama dengan password default/bawaan sistem (mis. "123456"). Gunakan password lain yang lebih aman.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('Konfirmasi password baru tidak cocok');
      return;
    }

    if (newPasswordInput === currentPasswordInput) {
      setPasswordError('Password baru tidak boleh sama dengan password lama');
      return;
    }

    // Eksekusi perubahan password
    updateUser(currentUser.id, { password: newPasswordInput });
    setPasswordSuccess('Password akun Anda berhasil diperbarui dengan aman!');
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    showToast('Password akun berhasil diganti!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004080] to-[#0060b5] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-300 text-xs font-semibold uppercase tracking-wider">
            <UserCheck className="w-4 h-4" />
            <span>Pengaturan Akun &bull; Luzie Group</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 tracking-tight">Akun Saya &amp; Keamanan</h1>
          <p className="text-xs text-sky-100/90 mt-1 max-w-xl">
            Kelola foto profil, perbarui password akun secara mandiri, atur alamat kerja WFA, dan sesuaikan preferensi notifikasi presensi.
          </p>
        </div>

        <button
          onClick={onOpenSwitchAccount}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-[#004080] font-bold text-xs transition-all shadow-md shrink-0"
        >
          <Users className="w-4 h-4" />
          <span>Keluar &amp; Ganti Akun</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Profil Card & Ganti Foto Profil */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 text-center">
            {/* Foto Profil dengan Tombol Ganti */}
            <div className="relative inline-block mx-auto group">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg mx-auto ring-2 ring-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPhotoModal(true)}
                className="absolute bottom-1 right-1 p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all hover:scale-110"
                title="Ganti Foto Profil"
              >
                <Camera className="w-4 h-4" />
              </button>
              <span
                className={`absolute top-0 right-0 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white uppercase shadow-xs ${
                  currentUser.role === 'leader'
                    ? 'bg-amber-600'
                    : currentUser.role === 'hrd'
                    ? 'bg-sky-600'
                    : 'bg-blue-600'
                }`}
              >
                {currentUser.role}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">{currentUser.name}</h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{currentUser.email}</p>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Username login: <span className="font-semibold text-slate-500">{currentUser.username || currentUser.email.split('@')[0]}</span>
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>{currentUser.division}</span>
              </div>
            </div>

            {/* Tombol Cepat Ganti Foto */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPhotoModal(true)}
                className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Ubah Foto Profil</span>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 text-left space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">ID Karyawan / NIP:</span>
                <span className="font-mono font-bold text-slate-800">
                  {currentUser.id === 'usr-kary-2' ? 'LZ-2026-0914' : currentUser.id}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Status Kepegawaian:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  WFA Terverifikasi
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-400">Jam Kerja Standar:</span>
                <span className="font-semibold text-slate-800">08:00 - 17:00 WIB</span>
              </div>
              {currentUser.leaderName && (
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Koordinator Tim:</span>
                  <span className="font-semibold text-slate-800">{currentUser.leaderName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Pengaturan Informasi & Form Ganti Password */}
        <div className="lg:col-span-2 space-y-6">
          {/* MODUL 1: GANTI PASSWORD (SESUAI REQUEST USER) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <KeyRound className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ganti Password Akun</h3>
                <p className="text-xs text-slate-500">Perbarui kata sandi login sistem presensi WFA Anda secara berkala</p>
              </div>
            </div>

            {mustChangePassword && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Password akun Anda masih memakai password bawaan/default.</strong> Demi keamanan data
                  Anda, segera ganti dengan password baru yang hanya Anda ketahui — jangan gunakan password bawaan
                  ini lagi.
                </span>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Password Saat Ini */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Password Saat Ini:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Masukkan password saat ini"
                    className="w-full text-xs pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Baru & Konfirmasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Password Baru:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full text-xs pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPasswordInput && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Kekuatan:</span>
                        <span className="font-bold text-slate-700">{passwordStrength.label}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Konfirmasi Password Baru:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full text-xs pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-600/20"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Perbarui Password Akun</span>
                </button>
              </div>
            </form>
          </div>

          {/* MODUL 2: INFORMASI KONTAK & LOKASI WFA */}
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Kontak &amp; Alamat Kerja WFA</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Nomor Telepon / WhatsApp:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Alamat / Lokasi WFA Utama:
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={wfaAddress}
                    onChange={(e) => setWfaAddress(e.target.value)}
                    placeholder="Contoh: Jl. Kemang Raya No. 12, Jakarta Selatan"
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pt-2 pb-2">
              Preferensi Notifikasi &amp; Pengingat Sistem
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Pengingat Presensi Pagi &amp; Briefing (08:20 WIB)</div>
                  <div className="text-[11px] text-slate-500">Notifikasi pengingat sebelum batas akhir absen pagi 08:30 WIB</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyStandup}
                  onChange={(e) => setNotifyStandup(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Pengingat Absen Siang &amp; Centang To-Do (12:00 WIB)</div>
                  <div className="text-[11px] text-slate-500">Peringatan otomatis pukul 12:00 WIB untuk mencentang to-do list</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyAfternoon}
                  onChange={(e) => setNotifyAfternoon(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Notifikasi Evaluasi &amp; Komentar Leader</div>
                  <div className="text-[11px] text-slate-500">Terima pemberitahuan saat review to-do telah dinilai oleh leader</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyLeaderReview}
                  onChange={(e) => setNotifyLeaderReview(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Kontak &amp; Lokasi WFA</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL GANTI FOTO PROFIL */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <span>Ganti Foto Profil</span>
              </h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Preview Foto */}
            <div className="text-center space-y-3">
              <img
                src={avatarUrlInput || avatarPreview}
                alt="Preview"
                className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-md mx-auto"
              />
              <p className="text-xs text-slate-500">Pratinjau Foto Profil Baru</p>
            </div>

            {/* Opsi 1: Upload dari Perangkat */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                1. Upload dari Komputer / HP:
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Pilih Foto dari Perangkat...</span>
              </button>
            </div>

            {/* Opsi 2: Input URL Gambar */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                2. Atau Masukkan URL Gambar Langsung:
              </label>
              <div className="relative">
                <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Opsi 3: Pilihan Preset Avatar */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                3. Atau Pilih Preset Avatar Profesional:
              </label>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatarPreview(preset);
                      setAvatarUrlInput(preset);
                    }}
                    className={`rounded-full overflow-hidden border-2 transition-transform hover:scale-105 ${
                      avatarPreview === preset ? 'border-blue-600 ring-2 ring-blue-300' : 'border-transparent'
                    }`}
                  >
                    <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-10 object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Tombol Simpan & Batal */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetAvatar}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAvatar}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Simpan Foto Profil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
