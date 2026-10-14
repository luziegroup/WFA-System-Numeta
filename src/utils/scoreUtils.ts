import { DailyWfaEntry } from '../types';

/**
 * Bobot penilaian Skor Akhir default sesuai ketentuan HRD (lihat "Ketentuan Penilaian Skor" di Beranda):
 * Absen 34%, To-Do 33%, Komunikasi 33%. Bisa dikustomisasi lewat Pengaturan Sistem (HRD),
 * lalu dioper sebagai parameter `weights` ke getFinalScore.
 */
export const DEFAULT_SCORE_WEIGHTS = {
  absen: 0.34,
  todo: 0.33,
  komunikasi: 0.33,
};

export interface ScoreWeights {
  absen: number; // 0-1
  todo: number; // 0-1
  komunikasi: number; // 0-1
}

/**
 * Skor Absen harian (0-100), dihitung otomatis dari status absen pagi & siang.
 * - Absen pagi & siang lengkap, keduanya tepat waktu: 100
 * - Absen pagi & siang lengkap, salah satu terlambat: 70
 * - Baru absen pagi saja: 50
 * - Belum absen sama sekali: 0
 */
export function getAbsenScore(entry: DailyWfaEntry): number {
  if (!entry.absenPagi && !entry.absenSiang) return 0;
  if (entry.absenPagi && !entry.absenSiang) return 50;
  if (entry.absenPagi && entry.absenSiang) {
    const adaTerlambat =
      entry.absenPagi.status === 'terlambat' || entry.absenSiang.status === 'terlambat';
    return adaTerlambat ? 70 : 100;
  }
  return 0;
}

/**
 * Skor Akhir gabungan (Absen + To-Do + Komunikasi) sesuai bobot (dari Pengaturan Sistem HRD,
 * atau default 34/33/33 kalau tidak dioper). Total bobot dinormalkan otomatis jika tidak pas 100%
 * (mis. HRD isi 34/33/33 = 100 pas, tapi kalau HRD ubah jadi angka lain yang totalnya bukan 100,
 * sistem tetap menghitung proporsional).
 * Mengembalikan null jika To-Do maupun Komunikasi belum sama sekali dinilai oleh Leader —
 * kolom yang belum dinilai dihitung 0 begitu salah satunya sudah mulai dinilai.
 */
export function getFinalScore(
  entry: DailyWfaEntry,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): number | null {
  if (entry.leaderScore === null && entry.leaderCommunicationScore === null) {
    return null;
  }

  const absenScore = getAbsenScore(entry);
  const todoScore = entry.leaderScore ?? 0; // Belum dinilai leader = dihitung 0
  const komunikasiScore = entry.leaderCommunicationScore ?? 0; // Belum dinilai leader = dihitung 0

  const totalWeight = weights.absen + weights.todo + weights.komunikasi;
  if (totalWeight <= 0) return null;

  const final =
    (absenScore * weights.absen + todoScore * weights.todo + komunikasiScore * weights.komunikasi) /
    totalWeight;

  return Math.round(final);
}

/**
 * Helper: ubah nilai bobot (%) dari WfaSettings (mis. 34, 33, 33) menjadi ScoreWeights (0-1) untuk getFinalScore.
 */
export function weightsFromSettings(settings: { bobotAbsen?: number; bobotTodo?: number; bobotKomunikasi?: number }): ScoreWeights {
  return {
    absen: (settings.bobotAbsen ?? DEFAULT_SCORE_WEIGHTS.absen * 100) / 100,
    todo: (settings.bobotTodo ?? DEFAULT_SCORE_WEIGHTS.todo * 100) / 100,
    komunikasi: (settings.bobotKomunikasi ?? DEFAULT_SCORE_WEIGHTS.komunikasi * 100) / 100,
  };
}

