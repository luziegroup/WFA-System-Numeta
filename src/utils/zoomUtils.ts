import { ZoomMeetingInfo } from '../types';
import { getTodayDateString } from '../data/initialData';

/**
 * Memeriksa apakah sebuah Zoom Meeting sudah lewat waktunya atau sudah berganti hari.
 * Aturan:
 * 1. Jika tanggal meeting < tanggal hari ini (ganti hari / masa lalu) -> EXPIRED (true)
 * 2. Jika status meeting adalah 'selesai' atau 'dibatalkan' -> EXPIRED (true)
 *
 * CATATAN: Sengaja TIDAK ada lagi auto-expire berdasarkan jam_mulai + durasi. Durasi yang
 * diisi koordinator saat membuat jadwal cuma perkiraan — meeting sering berjalan lebih lama
 * (atau karyawan sempat lama di Google Meet lalu balik ke aplikasi ini). Selama koordinator
 * belum menekan tombol selesai/batalkan (status masih 'aktif'), kartu "Google Meet" & banner
 * di Beranda Karyawan HARUS tetap menampilkan meeting ini supaya karyawan yang tidak sengaja
 * menutup tab Meet tetap bisa masuk lagi ke meeting yang sedang berlangsung — berlaku sama
 * untuk sesi Pagi maupun Siang/Sore.
 */
export function isZoomMeetingExpired(
  meeting: ZoomMeetingInfo,
  todayStr: string = getTodayDateString()
): boolean {
  // 1. Ganti hari (tanggal sudah lewat)
  if (meeting.date < todayStr) {
    return true;
  }

  // 2. Status selesai atau dibatalkan oleh leader — satu-satunya penanda meeting benar-benar berakhir
  if (meeting.status === 'selesai' || meeting.status === 'dibatalkan') {
    return true;
  }

  return false;
}

/**
 * Filter Zoom Meeting untuk tampilan Karyawan:
 * Menghapus/menyaring meeting yang sudah lewat waktunya atau sudah ganti hari,
 * DAN hanya meeting yang dibuat oleh koordinator/leader karyawan itu sendiri
 * (supaya notifikasi Zoom tim lain tidak bocor ke karyawan yang bukan anggotanya).
 */
export function getActiveZoomMeetingsForEmployee(
  meetings: ZoomMeetingInfo[],
  employeeLeaderId: string,
  todayStr: string = getTodayDateString()
): ZoomMeetingInfo[] {
  return meetings.filter((meeting) => {
    // Hanya meeting milik koordinator/leader karyawan ini
    if (!employeeLeaderId || meeting.leaderId !== employeeLeaderId) {
      return false;
    }
    // Jika sudah lewat waktunya atau ganti hari, hapus dari karyawan
    if (isZoomMeetingExpired(meeting, todayStr)) {
      return false;
    }
    // Hanya tampilkan meeting hari ini atau hari mendatang yang masih aktif
    return meeting.date >= todayStr && meeting.status === 'aktif';
  });
}

export interface SessionComplianceStatus {
  scheduled: boolean;
  hasPhotoProof: boolean;
  meeting: ZoomMeetingInfo | null;
}

export interface DailyMeetComplianceStatus {
  pagi: SessionComplianceStatus;
  siang: SessionComplianceStatus;
}

/**
 * Status kepatuhan laporan Meet harian seorang koordinator: apakah sesi Pagi & Siang/Sore
 * hari ini sudah dijadwalkan, dan apakah sudah ada bukti foto sebagai laporannya.
 * Dipakai untuk mengingatkan leader supaya konsisten bikin jadwal + upload bukti tiap hari.
 */
export function getDailyMeetCompliance(
  meetings: ZoomMeetingInfo[],
  leaderId: string,
  todayStr: string = getTodayDateString()
): DailyMeetComplianceStatus {
  const todaysMeetings = meetings.filter((m) => m.leaderId === leaderId && m.date === todayStr);

  const buildStatus = (session: 'pagi' | 'siang'): SessionComplianceStatus => {
    // Kalau ada lebih dari satu, ambil yang paling baru dibuat (id berisi timestamp)
    const found = todaysMeetings
      .filter((m) => m.session === session)
      .sort((a, b) => b.id.localeCompare(a.id))[0];
    return {
      scheduled: !!found,
      hasPhotoProof: !!found && found.photos.length > 0,
      meeting: found || null,
    };
  };

  return { pagi: buildStatus('pagi'), siang: buildStatus('siang') };
}
