import React, { useMemo, useState } from 'react';
import { Activity, Camera, Chrome, Clock, Eye, HardDrive, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { DivisionScopePicker } from './DivisionScopePicker';
import { pingScript } from '../lib/screenshotClient';
import { useApp } from '../context/AppContext';
import { INITIAL_HUBSTAFF_SETTINGS } from '../data/initialData';
import { HubstaffSettings } from '../types';
import { SCREENSHOT_IMPLEMENTED } from '../utils/hubstaffUtils';

const Card: React.FC<{ icon: React.ElementType; title: string; desc?: string; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  desc,
  children,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
    <div>
      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
        <Icon className="w-4 h-4 text-blue-600" />
        <span>{title}</span>
      </div>
      {desc && <p className="text-xs text-slate-500 mt-1">{desc}</p>}
    </div>
    {children}
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; badge?: string }> = ({
  checked,
  onChange,
  label,
  hint,
  badge,
}) => (
  <label className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer">
    <div>
      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
        {label}
        {badge && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">{badge}</span>}
      </div>
      {hint && <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{hint}</div>}
    </div>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
  </label>
);

const Num: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, unit, hint, onChange }) => (
  <div>
    <label className="text-xs font-semibold text-slate-700">{label}</label>
    <div className="flex items-center gap-2 mt-1">
      <input
        type="number"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {unit && <span className="text-[11px] text-slate-500">{unit}</span>}
    </div>
    <div className="text-[10px] text-slate-400 mt-1">{hint ?? `${min} – ${max}`}</div>
  </div>
);

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

export const PengaturanHubstaffView: React.FC = () => {
  const { hubstaffSettings, updateHubstaffSettings, allUsers, showToast } = useApp();
  const [f, setF] = useState<HubstaffSettings>({
    ...hubstaffSettings,
    allowedLeaderIds: Object.values(hubstaffSettings.allowedLeaderIds || {}),
  });
  const [testing, setTesting] = useState(false);
  const testConnection = async () => {
    setTesting(true);
    try {
      const r = await pingScript(f);
      showToast(`Terhubung ke Google Drive (folder: ${r.folder}).`, 'success');
    } catch (e) {
      showToast(`Koneksi gagal: ${e instanceof Error ? e.message : String(e)}`, 'warning');
    } finally {
      setTesting(false);
    }
  };
  const set = <K extends keyof HubstaffSettings>(k: K, v: HubstaffSettings[K]) => setF((p) => ({ ...p, [k]: v }));

  const leaders = useMemo(
    () => allUsers.filter((u) => u.role === 'leader' && u.isActive !== false),
    [allUsers]
  );
  const allDivisions = useMemo(
    () => Array.from(new Set(allUsers.filter((u) => u.role === 'karyawan').map((u) => u.division))).sort(),
    [allUsers]
  );
  const teamSize = (id: string) => allUsers.filter((u) => u.role === 'karyawan' && u.leaderId === id).length;
  const toggleLeader = (id: string) =>
    set('allowedLeaderIds', f.allowedLeaderIds.includes(id) ? f.allowedLeaderIds.filter((x) => x !== id) : [...f.allowedLeaderIds, id]);

  // Perkiraan kasar beban penyimpanan tangkap layar per karyawan
  const perDay = Math.max(0, Math.round(((f.targetHoursPerDay * 60) / Math.max(1, f.screenshotWindowMinutes)) * f.screenshotCount));
  const kbEach = Math.round(150 * Math.pow(f.screenshotMaxWidth / 1280, 2) * (f.screenshotQuality / 60) * (f.screenshotBlur ? 0.6 : 1));
  const mbPerDay = (perDay * kbEach) / 1024;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const next: HubstaffSettings = {
      ...f,
      targetHoursPerDay: clamp(f.targetHoursPerDay, 1, 12),
      heartbeatLostSeconds: clamp(f.heartbeatLostSeconds, 20, 300),
      idleThresholdSeconds: clamp(f.idleThresholdSeconds, 30, 600),
      idlePromptMinutes: clamp(f.idlePromptMinutes, 1, 60),
      idleGraceSeconds: clamp(f.idleGraceSeconds, 15, 300),
      screenshotCount: clamp(f.screenshotCount, 1, 12),
      screenshotWindowMinutes: clamp(f.screenshotWindowMinutes, 1, 60),
      screenshotQuality: clamp(f.screenshotQuality, 30, 90),
      screenshotRetentionDays: clamp(f.screenshotRetentionDays, 1, 365),
      urlTrackingRetentionDays: clamp(f.urlTrackingRetentionDays, 1, 365),
      screenshotScriptUrl: f.screenshotScriptUrl.trim(),
      screenshotUploadKey: f.screenshotUploadKey.trim(),
    };
    if (next.idlePromptMinutes * 60 <= next.idleThresholdSeconds) {
      showToast('Waktu pertanyaan "Masih bekerja?" harus lebih lama dari batas idle.', 'warning');
      return;
    }
    if (next.featureScreenshot && (!next.screenshotScriptUrl.trim() || !next.screenshotUploadKey.trim())) {
      showToast('Tangkap layar aktif, tetapi URL script dan kunci unggah Google Drive belum diisi.', 'warning');
      return;
    }
    if (next.leaderMonitorMode === 'terpilih' && next.allowedLeaderIds.length === 0) {
      showToast('Pilih minimal satu koordinator, atau ubah mode akses.', 'warning');
      return;
    }
    setF(next);
    updateHubstaffSettings(next);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pengaturan Hubstaff</h1>
          <p className="text-xs text-slate-500 mt-1">Atur siapa yang memantau, apa yang dipantau, dan ketentuannya. Berlaku ke semua akun.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setF({ ...INITIAL_HUBSTAFF_SETTINGS })}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Kembalikan Default
          </button>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Simpan Pengaturan
          </button>
        </div>
      </div>

      <Card icon={Eye} title="Siapa yang bisa memantau" desc="HRD selalu bisa memantau semua karyawan. Koordinator hanya melihat anggota timnya sendiri.">
        <div className="grid sm:grid-cols-3 gap-2">
          {([
            ['semua', 'Semua koordinator'],
            ['terpilih', 'Koordinator tertentu'],
            ['nonaktif', 'Hanya HRD'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => set('leaderMonitorMode', val)}
              className={`py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                f.leaderMonitorMode === val ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {f.leaderMonitorMode === 'terpilih' && (
          <div className="rounded-xl border border-slate-100 divide-y divide-slate-100">
            {leaders.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">Belum ada akun koordinator.</div>
            ) : (
              leaders.map((l) => (
                <label key={l.id} className="flex items-center justify-between p-3 text-xs cursor-pointer hover:bg-slate-50">
                  <div>
                    <div className="font-bold text-slate-800">{l.name}</div>
                    <div className="text-[10px] text-slate-400">{l.division} &bull; {teamSize(l.id)} anggota tim</div>
                  </div>
                  <input type="checkbox" checked={f.allowedLeaderIds.includes(l.id)} onChange={() => toggleLeader(l.id)} className="w-4 h-4 accent-blue-600" />
                </label>
              ))
            )}
          </div>
        )}
        <Toggle
          checked={f.leaderCanViewScreenshots}
          onChange={(v) => set('leaderCanViewScreenshots', v)}
          label="Koordinator boleh melihat hasil tangkap layar"
          hint="Jika mati, hasil tangkap layar hanya bisa dilihat HRD."
          badge={SCREENSHOT_IMPLEMENTED ? undefined : 'Untuk tahap berikutnya'}
        />
      </Card>

      <Card icon={ShieldCheck} title="Yang diterapkan" desc="Pilih apa yang dipantau saat timer berjalan. Timer durasi selalu aktif. Karyawan melihat daftar ini di menu Hubstaff mereka.">
        <Toggle
          checked={f.featureActivity}
          onChange={(v) => set('featureActivity', v)}
          label="Pergerakan aktivitas (keyboard/mouse)"
          hint="Menghitung waktu aktif vs idle. Hanya terukur lewat aplikasi desktop; isi ketikan dan posisi kursor tidak direkam."
        />
        <Toggle
          checked={f.featureScreenshot}
          onChange={(v) => set('featureScreenshot', v)}
          label="Tangkap layar"
          hint="Mengambil gambar layar pada waktu acak selama timer berjalan."
          badge={SCREENSHOT_IMPLEMENTED ? undefined : 'Belum aktif — pengaturan tersimpan'}
        />
      </Card>

      <Card icon={Clock} title="Umum">
        <div className="grid sm:grid-cols-2 gap-5">
          <Num label="Target jam tracking per hari" value={f.targetHoursPerDay} min={1} max={12} unit="jam" onChange={(v) => set('targetHoursPerDay', v)} />
          <Num
            label='Batas "Tidak Terpantau"'
            value={f.heartbeatLostSeconds}
            min={20}
            max={300}
            unit="detik"
            hint="Timer berjalan tapi tidak ada kabar dari perangkat karyawan selama ini."
            onChange={(v) => set('heartbeatLostSeconds', v)}
          />
        </div>
      </Card>

      <Card icon={Activity} title="Ketentuan aktivitas" desc={f.featureActivity ? undefined : 'Fitur aktivitas sedang dimatikan; ketentuan di bawah tidak berlaku.'}>
        <div className={`space-y-4 ${f.featureActivity ? '' : 'opacity-50 pointer-events-none'}`}>
          <DivisionScopePicker divisions={allDivisions} selected={f.activityDivisions} onChange={(v) => set('activityDivisions', v)} />
          <div className="grid sm:grid-cols-2 gap-5">
            <Num label="Dianggap idle setelah" value={f.idleThresholdSeconds} min={30} max={600} unit="detik tanpa input" onChange={(v) => set('idleThresholdSeconds', v)} />
          </div>
          <Toggle
            checked={f.autoPauseOnIdle}
            onChange={(v) => set('autoPauseOnIdle', v)}
            label="Tanya “Masih bekerja?” lalu jeda otomatis"
            hint="Jika mati, idle hanya dicatat (memengaruhi persentase aktivitas) tanpa menjeda timer."
          />
          {f.autoPauseOnIdle && (
            <>
              <div className="grid sm:grid-cols-2 gap-5">
                <Num label="Munculkan pertanyaan setelah idle" value={f.idlePromptMinutes} min={1} max={60} unit="menit" onChange={(v) => set('idlePromptMinutes', v)} />
                <Num label="Waktu menjawab sebelum dijeda" value={f.idleGraceSeconds} min={15} max={300} unit="detik" onChange={(v) => set('idleGraceSeconds', v)} />
              </div>
              <Toggle
                checked={f.autoResumeOnActivity}
                onChange={(v) => set('autoResumeOnActivity', v)}
                label="Lanjutkan timer otomatis saat karyawan bergerak lagi"
                hint="Setelah dijeda karena idle, timer jalan lagi begitu keyboard/mouse digerakkan — tanpa menekan Mulai manual."
              />
              <Toggle
                checked={f.keepIdleOnAutoPause}
                onChange={(v) => set('keepIdleOnAutoPause', v)}
                label="Waktu idle sebelum jeda tetap dihitung sebagai idle"
                hint="Aktif: menit idle tercatat sebagai idle (tampil di persentase aktivitas). Mati: menit idle itu dibuang dari total waktu."
              />
            </>
          )}
        </div>
      </Card>

      <Card
        icon={Camera}
        title="Ketentuan tangkap layar"
        desc={
          SCREENSHOT_IMPLEMENTED
            ? f.featureScreenshot ? undefined : 'Tangkap layar sedang dimatikan; ketentuan di bawah tidak berlaku.'
            : 'Fitur pengambilan belum dipasang. Nilai di sini disimpan dan akan dipakai saat fitur aktif.'
        }
      >
        <DivisionScopePicker divisions={allDivisions} selected={f.screenshotDivisions} onChange={(v) => set('screenshotDivisions', v)} disabled={!f.featureScreenshot} />
        <div className="grid sm:grid-cols-2 gap-5">
          <Num label="Jumlah tangkapan" value={f.screenshotCount} min={1} max={12} unit="kali" onChange={(v) => set('screenshotCount', v)} />
          <Num label="Dalam setiap rentang" value={f.screenshotWindowMinutes} min={1} max={60} unit="menit" hint="Waktu tiap tangkapan diacak di dalam rentang ini." onChange={(v) => set('screenshotWindowMinutes', v)} />
          <Num label="Kualitas gambar" value={f.screenshotQuality} min={30} max={90} unit="%" hint="Lebih rendah = file lebih kecil." onChange={(v) => set('screenshotQuality', v)} />
          <div>
            <label className="text-xs font-semibold text-slate-700">Lebar maksimum gambar</label>
            <select
              value={f.screenshotMaxWidth}
              onChange={(e) => set('screenshotMaxWidth', Number(e.target.value))}
              className="block mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
            >
              {[800, 1024, 1280, 1600, 1920].map((w) => (
                <option key={w} value={w}>{w} px</option>
              ))}
            </select>
            <div className="text-[10px] text-slate-400 mt-1">Layar lebih besar akan diperkecil.</div>
          </div>
          <Num label="Simpan hasil tangkap layar selama" value={f.screenshotRetentionDays} min={1} max={365} unit="hari" hint="Setelah itu dihapus otomatis." onChange={(v) => set('screenshotRetentionDays', v)} />
        </div>
        <Toggle checked={f.screenshotBlur} onChange={(v) => set('screenshotBlur', v)} label="Buramkan gambar" hint="Isi layar tidak terbaca jelas; lebih menjaga privasi dan file lebih kecil." />
        <Toggle checked={f.screenshotNotifyEmployee} onChange={(v) => set('screenshotNotifyEmployee', v)} label="Beri tahu karyawan setiap tangkapan diambil" />

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
          <span className="font-bold text-slate-800">Perkiraan kasar per karyawan:</span> {perDay} tangkapan per hari kerja
          (&plusmn;{kbEach} KB per gambar) &asymp; {mbPerDay.toFixed(1)} MB per hari, atau &asymp;{' '}
          {((mbPerDay * f.screenshotRetentionDays) / 1024).toFixed(2)} GB untuk {f.screenshotRetentionDays} hari penyimpanan. Kalikan dengan
          jumlah karyawan untuk total kebutuhan ruang.
        </div>
      </Card>
      <Card
        icon={Chrome}
        title="Pelacakan Alamat (URL)"
        desc="Mencatat alamat situs yang dibuka di browser (Chrome/Edge), termasuk Google dan YouTube. Butuh ekstensi browser terpisah yang dipasang tiap karyawan — lihat browser-extension/README.md."
      >
        <Toggle checked={f.featureUrlTracking} onChange={(v) => set('featureUrlTracking', v)} label="Aktifkan pelacakan alamat" hint="Karyawan tetap harus memasang ekstensi dan memasukkan kode pasang sendiri di menu Hubstaff mereka." />
        <DivisionScopePicker divisions={allDivisions} selected={f.urlTrackingDivisions} onChange={(v) => set('urlTrackingDivisions', v)} disabled={!f.featureUrlTracking} />
        <div className={`grid sm:grid-cols-2 gap-5 ${f.featureUrlTracking ? '' : 'opacity-50 pointer-events-none'}`}>
          <Num label="Simpan riwayat alamat selama" value={f.urlTrackingRetentionDays} min={1} max={365} unit="hari" hint="Setelah itu dihapus otomatis." onChange={(v) => set('urlTrackingRetentionDays', v)} />
        </div>
        <Toggle
          checked={f.leaderCanViewUrlActivity}
          onChange={(v) => set('leaderCanViewUrlActivity', v)}
          label="Koordinator boleh melihat riwayat alamat"
          hint="Jika mati, hanya HRD yang bisa melihat."
        />
      </Card>

      <Card
        icon={HardDrive}
        title="Penyimpanan Google Drive"
        desc="Gambar disimpan di Google Drive perusahaan lewat Apps Script; Firebase hanya menyimpan catatan kecil. Langkah pemasangan ada di docs/PANDUAN-TANGKAP-LAYAR.md."
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">URL Web App Apps Script</label>
            <input
              value={f.screenshotScriptUrl}
              onChange={(e) => set('screenshotScriptUrl', e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Kunci unggah</label>
            <input
              type="password"
              value={f.screenshotUploadKey}
              onChange={(e) => set('screenshotUploadKey', e.target.value)}
              placeholder="Sama dengan UPLOAD_KEY di script"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
            />
            <div className="text-[10px] text-slate-400 mt-1">
              Kunci lihat sengaja tidak disimpan di sini. Penonton memasukkannya sendiri di browser mereka.
            </div>
          </div>
          <button
            type="button"
            onClick={testConnection}
            disabled={testing || !f.screenshotScriptUrl.trim() || !f.screenshotUploadKey.trim()}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {testing ? 'Menguji...' : 'Tes Koneksi'}
          </button>
        </div>
      </Card>
    </form>
  );
};
