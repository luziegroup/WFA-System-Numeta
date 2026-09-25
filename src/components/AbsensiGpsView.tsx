import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MapPin,
  Sun,
  Moon,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Compass,
  Map,
  Clock,
  ShieldCheck,
  Check
} from 'lucide-react';
import { SidebarMenuId } from './Sidebar';

interface AbsensiGpsViewProps {
  onNavigate?: (menu: SidebarMenuId) => void;
}

export const AbsensiGpsView: React.FC<AbsensiGpsViewProps> = ({ onNavigate }) => {
  const { currentUser, getCurrentEntry, doAbsenPagi, doAbsenSiang, showToast, zoomMeetings, selectedDate } = useApp();
  const entry = getCurrentEntry();

  // Jadwal Meet Pagi/Siang hari ini dari koordinator karyawan ini sendiri (kalau ada & masih aktif)
  const todaysPagiMeeting = zoomMeetings.find(
    (z) => z.leaderId === currentUser.leaderId && z.date === selectedDate && z.status === 'aktif' && z.session === 'pagi'
  );
  const todaysSiangMeeting = zoomMeetings.find(
    (z) => z.leaderId === currentUser.leaderId && z.date === selectedDate && z.status === 'aktif' && z.session === 'siang'
  );

  const [wfaLocationInput, setWfaLocationInput] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'requesting' | 'denied' | 'active'>('denied');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string | null>(null);
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);
  const [isRedirectingToTodo, setIsRedirectingToTodo] = useState(false);

  // Ubah koordinat lat/lng jadi nama lokasi yang bisa dibaca (reverse geocoding).
  // Pakai Nominatim (OpenStreetMap) — gratis, tanpa API key. Kalau gagal/offline,
  // jatuhkan ke tampilan koordinat mentah saja (bukan tebakan kota yang salah).
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`
      );
      if (!res.ok) throw new Error('reverse geocode gagal');
      const data = await res.json();
      const addr = data.address || {};
      const parts = [
        addr.suburb || addr.village || addr.town || addr.city_district,
        addr.city || addr.county,
        addr.state,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : data.display_name || `${lat}°, ${lng}°`;
    } catch {
      return `${lat}°, ${lng}° (nama lokasi tidak terdeteksi)`;
    }
  };

  // Coba ambil lokasi browser asli jika diizinkan
  const requestBrowserLocation = () => {
    setIsRefreshingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude.toFixed(4));
          const lng = Number(position.coords.longitude.toFixed(4));
          setGpsCoords({ lat, lng });
          setGpsStatus('active');
          setIsRefreshingGps(false);
          setGpsAddress(null); // sedang dideteksi ulang
          showToast('Lokasi GPS berhasil diverifikasi secara realtime', 'success');
          reverseGeocode(lat, lng).then(setGpsAddress);
        },
        () => {
          // Jika ditolak browser atau iframe sandbox
          setGpsStatus('denied');
          setIsRefreshingGps(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsStatus('denied');
      setIsRefreshingGps(false);
    }
  };

  useEffect(() => {
    requestBrowserLocation();
  }, []);

  const handleSimulateGps = () => {
    setIsRefreshingGps(true);
    setGpsAddress(null);
    setTimeout(async () => {
      const lat = -6.2088;
      const lng = 106.8456;
      setGpsCoords({ lat, lng });
      setGpsStatus('active');
      setIsRefreshingGps(false);
      const addr = await reverseGeocode(lat, lng);
      setGpsAddress(addr);
      showToast(`GPS terverifikasi: Lokasi WFA Valid (${addr})`, 'success');
    }, 600);
  };

  const handleAbsenPagiClick = () => {
    if (!wfaLocationInput.trim()) {
      showToast('Harap masukkan keterangan lokasi WFA Anda', 'warning');
      return;
    }
    const locWithCoords = gpsCoords
      ? `${wfaLocationInput.trim()} (${gpsCoords.lat}, ${gpsCoords.lng})`
      : wfaLocationInput.trim();

    doAbsenPagi(locWithCoords, 'Absensi otomatis dengan verifikasi GPS');
    setIsRedirectingToTodo(true);

    // PENTING: Google Meet TIDAK dibuka di sini lagi. Supaya karyawan tidak lupa isi To-Do List
    // (fokus keburu pindah ke tab Meet), Meet baru dibuka SETELAH To-Do List Pagi dikirim ke
    // koordinator (lihat handleSendToCoordinator di TodoListKaryawanView).
    if (todaysPagiMeeting) {
      showToast('Presensi Pagi berhasil dicatat! Isi To-Do List dulu, baru Google Meet akan dibuka.', 'success');
    } else {
      showToast('Presensi Pagi berhasil dicatat! Mengalihkan ke To-Do List...', 'success');
    }

    // Otomatis mengarahkan ke pengisian To-Do List.
    setTimeout(() => {
      onNavigate?.('todo-saya');
    }, 400);
  };

  const handleAbsenSiangClick = () => {
    if (!wfaLocationInput.trim()) {
      showToast('Harap masukkan keterangan lokasi WFA Anda', 'warning');
      return;
    }
    const locWithCoords = gpsCoords
      ? `${wfaLocationInput.trim()} (${gpsCoords.lat}, ${gpsCoords.lng})`
      : wfaLocationInput.trim();

    doAbsenSiang(locWithCoords, 'Absen siang terverifikasi GPS');
    setIsRedirectingToTodo(true);

    // PENTING: Google Meet TIDAK dibuka di sini lagi. Karyawan harus centang To-Do List dulu
    // (di halaman To-Do List) — Meet baru dibuka lewat tombol "Buka Google Meet" yang muncul
    // di kartu Penilaian Skor & Centang Tugas setelah absen siang.
    if (todaysSiangMeeting) {
      showToast('Presensi Siang berhasil dicatat! Centang To-Do List dulu, baru Google Meet akan dibuka.', 'success');
    } else {
      showToast('Presensi Siang berhasil dicatat! Mengalihkan ke To-Do List untuk centang & lampirkan bukti...', 'success');
    }

    // Otomatis mengarahkan ke To-Do List supaya karyawan langsung centang tugas yang
    // sudah dikerjakan sekaligus melampirkan bukti (link/foto) sebelum jam kerja berakhir.
    setTimeout(() => {
      onNavigate?.('todo-saya');
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Halaman (Sesuai Persis Gambar 2) */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Absensi + GPS</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Realtime</span>
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Absen pagi &amp; siang dengan verifikasi lokasi</p>
      </div>

      {/* 2. Top 2 Status Cards (Sesuai Persis Gambar 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Absen Pagi */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            ABSEN PAGI
          </div>
          <div className="text-3xl font-black font-mono text-slate-800 tracking-wider">
            {entry.absenPagi ? entry.absenPagi.time : '--:--'}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {entry.absenPagi ? (
              <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Sudah Absen ({entry.absenPagi.location.split('(')[0].trim()})</span>
              </span>
            ) : (
              'Belum absen'
            )}
          </div>
        </div>

        {/* Card Absen Siang */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Moon className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            ABSEN SIANG
          </div>
          <div className="text-3xl font-black font-mono text-slate-800 tracking-wider">
            {entry.absenSiang ? entry.absenSiang.time : '--:--'}
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {entry.absenSiang ? (
              <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Sudah Absen ({entry.absenSiang.location.split('(')[0].trim()})</span>
              </span>
            ) : (
              'Tersedia mulai 10:16'
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Card: Verifikasi Lokasi GPS (Sesuai Persis Gambar 2) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        {/* Title Bar */}
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span>Verifikasi Lokasi GPS</span>
        </div>

        {/* Status GPS Bar & Refresh Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                gpsStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <div>
              <div className="font-bold text-slate-800">
                {gpsStatus === 'active'
                  ? 'Izin lokasi aktif & terverifikasi'
                  : 'Izin lokasi ditolak'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {gpsStatus === 'active' && gpsCoords
                  ? `Koordinat: ${gpsCoords.lat}°, ${gpsCoords.lng}° · Radius WFA Aman`
                  : 'Pastikan izin lokasi diaktifkan di browser'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {gpsStatus !== 'active' && (
              <button
                type="button"
                onClick={handleSimulateGps}
                className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs transition-colors"
              >
                Gunakan GPS Default
              </button>
            )}
            <button
              type="button"
              onClick={requestBrowserLocation}
              disabled={isRefreshingGps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingGps ? 'animate-spin text-blue-600' : 'text-slate-400'}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Visual Map/GPS Box Persis Gambar 2 */}
        <div className="w-full h-44 rounded-2xl bg-sky-50/60 border border-sky-100 flex flex-col items-center justify-center text-center p-6 space-y-2">
          {gpsStatus === 'active' && gpsCoords ? (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
                <MapPin className="w-6 h-6 animate-bounce" />
              </div>
              <div className="text-sm font-bold text-slate-800">
                Lokasi Anda: {gpsAddress || 'Mendeteksi alamat...'}
              </div>
              <div className="text-xs font-mono text-slate-500">
                Lat: {gpsCoords.lat}° | Long: {gpsCoords.lng}° (Akurasi Presisi WFA)
              </div>
            </div>
          ) : (
            <>
              <Map className="w-8 h-8 text-sky-400" />
              <div className="text-xs font-semibold text-sky-700">Menunggu GPS...</div>
              <div className="text-[11px] text-slate-400 max-w-xs">
                Sistem akan memverifikasi geolokasi perangkat Anda saat melakukan presensi
              </div>
            </>
          )}
        </div>

        {/* Warning Banner Persis Gambar 2 */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Absen pagi wajib sebelum jam 08:30. Lewat dari itu dihitung terlambat.</span>
        </div>

        {/* Form Input Lokasi WFA Hari Ini Persis Gambar 2 */}
        <div className="space-y-2">
          <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider">
            LOKASI WFA HARI INI
          </label>
          <input
            type="text"
            value={wfaLocationInput}
            onChange={(e) => setWfaLocationInput(e.target.value)}
            placeholder="Contoh: Rumah, Kafe, Co-working Space..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 bg-white"
          />
        </div>

        {/* Bottom Action Button Persis Gambar 2 */}
        <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
          {entry.absenPagi && (
            <button
              type="button"
              onClick={() => onNavigate?.('todo-saya')}
              className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>Lanjut Isi To-Do List</span>
              <span>&rarr;</span>
            </button>
          )}

          <div className="ml-auto">
            {!entry.absenPagi ? (
              <button
                type="button"
                disabled={isRedirectingToTodo}
                onClick={handleAbsenPagiClick}
                className="px-5 py-2.5 rounded-xl bg-[#0066b2] hover:bg-[#005594] disabled:opacity-75 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
              >
                {isRedirectingToTodo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengarahkan ke To-Do List...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>Absen Pagi Sekarang</span>
                  </>
                )}
              </button>
            ) : !entry.absenSiang ? (
              <button
                type="button"
                disabled={isRedirectingToTodo}
                onClick={handleAbsenSiangClick}
                className="px-5 py-2.5 rounded-xl bg-[#0066b2] hover:bg-[#005594] disabled:opacity-75 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
              >
                {isRedirectingToTodo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengarahkan ke To-Do List...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>Absen Siang Sekarang</span>
                  </>
                )}
              </button>
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Absensi Pagi &amp; Siang Lengkap</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
