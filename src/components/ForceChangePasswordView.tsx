import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Lock, Eye, EyeOff, KeyRound, AlertCircle, LogOut } from 'lucide-react';

/**
 * Ditampilkan MENGGANTIKAN seluruh aplikasi (bukan cuma banner) selama akun yang sedang
 * login masih memakai password default/bawaan sistem — baik karena akun baru dibuat HRD,
 * maupun karena HRD menekan tombol Reset password. Karyawan/koordinator/HRD tidak bisa
 * membuka menu apa pun sampai password berhasil diganti.
 *
 * Begitu password berhasil diperbarui, `mustChangePassword` di AppContext otomatis
 * kembali `false` (dihitung ulang dari data akun yang tersinkron real-time), sehingga
 * halaman ini otomatis hilang dan aplikasi normal langsung terbuka — tanpa perlu reload.
 */
export const ForceChangePasswordView: React.FC = () => {
  const { currentUser, updateUser, showToast, verifyCurrentPassword, isDefaultPasswordValue, logout } = useApp();

  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPasswordInput) {
      setError('Masukkan password default/bawaan Anda saat ini terlebih dahulu.');
      return;
    }
    if (!verifyCurrentPassword(currentPasswordInput)) {
      setError('Password saat ini tidak sesuai.');
      return;
    }
    if (newPasswordInput.length < 6) {
      setError('Password baru minimal harus 6 karakter.');
      return;
    }
    if (isDefaultPasswordValue(newPasswordInput)) {
      setError('Password baru tidak boleh sama dengan password default/bawaan sistem. Gunakan password lain yang lebih aman.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }
    if (newPasswordInput === currentPasswordInput) {
      setError('Password baru tidak boleh sama dengan password lama.');
      return;
    }

    setSubmitting(true);
    updateUser(currentUser.id, { password: newPasswordInput });
    showToast('Password berhasil diganti. Selamat datang di WFA System!', 'success');
    // Tidak perlu setSubmitting(false) / navigasi manual — begitu data akun tersinkron,
    // mustChangePassword otomatis false dan halaman ini akan hilang dengan sendirinya.
  };

  return (
    <div className="min-h-screen w-full bg-[#004080] flex flex-col font-sans">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-md shrink-0">
            <ShieldAlert className="w-5 h-5 text-[#004080]" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">WFA System</div>
            <div className="text-sky-300 text-sm leading-tight">Luzie Group</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 sm:p-10">
          <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Langkah Wajib Sebelum Melanjutkan</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5">Ganti Password Anda</h1>
          <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
            Halo <strong className="text-slate-700">{currentUser.name}</strong>, akun Anda masih memakai password
            default/bawaan sistem. Demi keamanan data absensi &amp; performa Anda, password wajib diganti
            terlebih dahulu sebelum bisa mengakses menu lainnya.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password Saat Ini (default)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  placeholder="Masukkan password default Anda"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Minimal 6 karakter, jangan sama dengan default"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#004080] hover:bg-[#003366] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-md"
            >
              <KeyRound className="w-4 h-4" />
              <span>Simpan &amp; Lanjutkan ke Aplikasi</span>
            </button>
          </form>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 mt-4 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar dan masuk dengan akun lain</span>
          </button>
        </div>
      </div>
    </div>
  );
};
