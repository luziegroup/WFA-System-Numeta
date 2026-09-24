import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Home, User as UserIcon, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

export const LoginView: React.FC = () => {
  const { login, isOnline, allUsers } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockLeft, setLockLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Daftar username unik (akun aktif saja), diambil dari field username atau bagian sebelum "@" di email
  const allUsernames = useMemo(
    () =>
      Array.from(
        new Set(
          allUsers
            .filter((u) => u.isActive !== false)
            .map((u) => (u.username?.trim() || u.email.split('@')[0] || '').trim().toLowerCase())
            .filter(Boolean)
        )
      ).sort(),
    [allUsers]
  );

  // Filter sesuai yang diketik: cocokkan dari awal kata (prefix match), tidak peka huruf besar/kecil
  const filteredUsernames = useMemo(() => {
    const query = username.trim().toLowerCase();
    if (!query) return allUsernames;
    return allUsernames.filter((u) => u.startsWith(query));
  }, [allUsernames, username]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [username]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const pickSuggestion = (value: string) => {
    setUsername(value);
    setShowSuggestions(false);
  };

  // Hitung mundur kunci sementara setelah terlalu banyak salah password
  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setTimeout(() => setLockLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [lockLeft]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockLeft > 0 || submitting) return;
    setError('');
    setSubmitting(true);

    // jeda singkat supaya terasa responsif & mempersulit tebak-tebakan cepat
    setTimeout(() => {
      const result = login(username, password);
      if (!result.ok) {
        const next = attempts + 1;
        setAttempts(next);
        setError(result.error || 'Gagal masuk');
        if (next >= MAX_ATTEMPTS) {
          setLockLeft(LOCK_SECONDS);
          setAttempts(0);
        }
        setPassword('');
      }
      setSubmitting(false);
    }, 250);
  };

  return (
    <div className="min-h-screen w-full bg-[#004080] flex flex-col font-sans">
      {/* Logo pojok kiri atas */}
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-md shrink-0">
            <Home className="w-5 h-5 text-[#004080]" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">WFA System</div>
            <div className="text-sky-300 text-sm leading-tight">Luzie Group</div>
          </div>
        </div>
      </div>

      {/* Kartu Login di Tengah */}
      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 sm:p-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Selamat Datang</h1>
          <p className="text-slate-400 text-sm mt-1.5">Masuk ke portal Work From Anywhere Anda</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            <div>
              <label htmlFor="login-username" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  role="combobox"
                  aria-expanded={showSuggestions && filteredUsernames.length > 0}
                  aria-controls="username-suggestions-list"
                  aria-autocomplete="list"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // jeda singkat supaya klik pada saran sempat terdaftar sebelum dropdown ditutup
                    blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  onKeyDown={(e) => {
                    if (!showSuggestions || filteredUsernames.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedIndex((i) => Math.min(i + 1, filteredUsernames.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && showSuggestions) {
                      const pick = filteredUsernames[highlightedIndex];
                      if (pick) {
                        e.preventDefault();
                        pickSuggestion(pick);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSuggestions(false);
                    }
                  }}
                  placeholder="username"
                  className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100"
                />

                {showSuggestions && filteredUsernames.length > 0 && (
                  <ul
                    id="username-suggestions-list"
                    role="listbox"
                    className="absolute z-20 left-0 right-0 mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1"
                  >
                    {filteredUsernames.map((uname, i) => (
                      <li
                        key={uname}
                        role="option"
                        aria-selected={i === highlightedIndex}
                        onMouseDown={(e) => e.preventDefault()} // cegah blur sebelum onClick terpanggil
                        onClick={() => pickSuggestion(uname)}
                        onMouseEnter={() => setHighlightedIndex(i)}
                        className={`px-3.5 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                          i === highlightedIndex ? 'bg-blue-50 text-[#004080]' : 'text-slate-700'
                        }`}
                      >
                        <UserIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <span>{uname}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#004080] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {(error || lockLeft > 0) && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {lockLeft > 0
                    ? `Terlalu banyak percobaan. Coba lagi dalam ${lockLeft} detik.`
                    : error}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || lockLeft > 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#004080] hover:bg-[#003366] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-md"
            >
              <LogIn className="w-4 h-4" />
              <span>{submitting ? 'Memproses…' : 'Masuk'}</span>
            </button>

            <p className="text-center text-[11px] text-slate-400 pt-1">
              Lupa password? Hubungi HRD untuk mereset akun Anda.
            </p>
          </form>

          {!isOnline && (
            <p className="mt-4 text-center text-[11px] text-amber-600">
              Menghubungkan ke server… pastikan koneksi internet Anda aktif.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
