export type UserRole = 'karyawan' | 'leader' | 'hrd';

export interface User {
  id: string;
  name: string;
  email: string;
  /** Username untuk login. Akun lama (belum diisi) otomatis pakai bagian sebelum "@" di email. */
  username?: string;
  role: UserRole;
  division: string;
  avatar: string;
  phone?: string;
  joinDate?: string;
  isActive?: boolean;
  leaderName?: string;
  leaderId?: string;
  password?: string;
  wfaAddress?: string;
  /** Link Google Meet pribadi milik koordinator/leader (dipakai berulang tiap Meeting Pagi
   *  supaya masing-masing koordinator punya ruangan sendiri & bisa meeting bersamaan). */
  personalMeetLink?: string;
}

export interface WfaSettings {
  morningAbsenTime: string; // "08:30"
  afternoonAbsenTime: string; // "12:00"
  lateToleranceMinutes: number; // 15
  minTodosPerDay: number; // 3
  requireProofAttachment: boolean; // true
  minKpiPassScore: number; // 70
  companyZoomLink: string;
  companyZoomPasscode: string;
  autoSendLateWarning: boolean;
  autoSendIncompleteTodoWarning: boolean;
  workDays: string[];
  // Bobot Penilaian Performa (%) - dipakai untuk hitung Skor Akhir gabungan
  bobotAbsen: number; // default 34
  bobotTodo: number; // default 33
  bobotKomunikasi: number; // default 33
  // Kelola Divisi custom (dipakai di dropdown Divisi Manajemen Akun & filter)
  divisiList: string[];
}

export interface TodoItem {
  id: string;
  task: string;
  target?: string;
  completed: boolean; // CENTANG oleh karyawan saat siang
  proofLink?: string; // Lampiran Link pekerjaan (Google Doc, Figma, PR, Sheet, dll)
  proofImage?: string; // Lampiran Foto pekerjaan (data URL base64 atau URL gambar)
  proofFileName?: string; // Nama file foto jika ada
  verifiedByLeader?: boolean; // Validasi oleh leader
  createdAt: string;
  completedAt?: string;
}

export interface AbsenRecord {
  time: string;
  status: 'tepat_waktu' | 'terlambat';
  location: string;
  notes?: string;
  timestamp: number;
}

export interface DailyWfaEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  division: string;
  date: string; // YYYY-MM-DD
  absenPagi: AbsenRecord | null;
  absenSiang: AbsenRecord | null;
  todos: TodoItem[];
  // Persentase skor dari centang to-do: (jumlah dicentang / total todo) * 100
  employeeScorePercent: number;
  totalTodos: number;
  completedTodos: number;
  // Penilaian & Review dari Leader
  leaderScore: number | null; // Skor To-Do yang disetujui / dinilai oleh leader (0 - 100)
  leaderCommunicationScore: number | null; // Skor Komunikasi wajib diisi Leader (0 - 100)
  leaderGeneralComment: string; // Komen general dari leader jika memang kurang sesuai atau ada arahan
  leaderReviewedAt: string | null;
  leaderReviewedBy: string | null;
  status: 'belum_mulai' | 'pagi_selesai' | 'siang_selesai' | 'selesai_direview';
}

export interface WarningItem {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  type: 'todo_pagi' | 'todo_siang' | 'bukti_kurang' | 'terlambat' | 'performa' | 'custom' | 'zoom_pagi';
  title: string;
  message: string;
  date: string;
  createdAt: string;
  status: 'terkirim' | 'dibaca' | 'ditanggapi';
}

export interface ZoomMeetingPhoto {
  id: string;
  url: string;
  timestamp: string;
  caption?: string;
}

export interface ZoomMeetingInfo {
  id: string;
  title: string;
  time: string;
  date: string;
  duration: number; // Durasi dalam menit
  isUrgent: boolean; // Menandai Zoom Urgen atau Meeting Biasa
  session: 'pagi' | 'siang'; // Sesi meeting: Pagi atau Siang/Sore — wajib ada laporan (jadwal+bukti foto) untuk keduanya tiap hari kerja
  hostName: string;
  leaderId: string; // ID koordinator/leader pembuat meeting — supaya notifikasi tidak bocor lintas tim
  meetingId: string;
  link: string;
  passcode: string;
  agenda: string;
  status: 'aktif' | 'selesai' | 'dibatalkan';
  photos: ZoomMeetingPhoto[];
  attendees: {
    userId: string;
    userName: string;
    joinedAt: string;
  }[];
}
