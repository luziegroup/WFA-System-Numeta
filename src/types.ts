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
  /** Kode pasang ekstensi pelacakan alamat (URL). Dibuat sekali lewat menu Hubstaff karyawan. */
  urlTrackerToken?: string;
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
  // Total detik time-tracking Hubstaff yang tercatat pada hari ini (direset otomatis
  // tiap entry baru dibuat untuk tanggal berikutnya, karena entry sendiri per-tanggal).
  hubstaffSeconds?: number;
  // --- Monitoring Hubstaff (dilihat koordinator & HRD) ---
  /** true = timer sedang berjalan pada heartbeat terakhir */
  hubstaffTracking?: boolean;
  /** Epoch ms heartbeat terakhir dari perangkat karyawan (dikirim tiap ~10 detik saat tracking) */
  hubstaffLastBeat?: number;
  /** true = tingkat aktivitas terukur dari sistem operasi (hanya lewat aplikasi desktop) */
  hubstaffActivityTracked?: boolean;
  /** Detik yang ada input keyboard/mouse (aktif) selama tracking */
  hubstaffActiveSeconds?: number;
  /** Detik tanpa input keyboard/mouse (idle) selama tracking */
  hubstaffIdleSeconds?: number;
  /** true = saat heartbeat terakhir karyawan sedang idle */
  hubstaffIdleNow?: boolean;
  /** Berapa kali timer dijeda otomatis karena idle terlalu lama */
  hubstaffAutoPauseCount?: number;
}

/** Potongan data Hubstaff yang ditulis ke entry harian. */
export type HubstaffStatsPatch = Pick<
  DailyWfaEntry,
  | 'hubstaffSeconds'
  | 'hubstaffTracking'
  | 'hubstaffLastBeat'
  | 'hubstaffActivityTracked'
  | 'hubstaffActiveSeconds'
  | 'hubstaffIdleSeconds'
  | 'hubstaffIdleNow'
  | 'hubstaffAutoPauseCount'
>;

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

/** Pengaturan menu Hubstaff (diatur HRD lewat menu Pengaturan Hubstaff). */
export interface HubstaffSettings {
  // --- Siapa yang bisa memonitor (HRD selalu bisa) ---
  /** semua = semua koordinator memantau timnya; terpilih = hanya koordinator di allowedLeaderIds */
  leaderMonitorMode: 'semua' | 'terpilih' | 'nonaktif';
  allowedLeaderIds: string[];
  leaderCanViewScreenshots: boolean;

  // --- Fitur pemantauan yang diterapkan (timer durasi selalu aktif) ---
  featureActivity: boolean;
  featureScreenshot: boolean;

  // --- Umum ---
  targetHoursPerDay: number;
  /** Tanpa detak lebih lama dari ini = "Tidak Terpantau" */
  heartbeatLostSeconds: number;

  // --- Aktivitas keyboard/mouse ---
  /** Tanpa input selama ini dihitung idle */
  idleThresholdSeconds: number;
  /** true = tanya "Masih bekerja?" lalu jeda otomatis; false = idle hanya dicatat */
  autoPauseOnIdle: boolean;
  /** Setelah dijeda otomatis karena idle, timer lanjut sendiri begitu ada gerakan keyboard/mouse (tanpa menekan Mulai). */
  autoResumeOnActivity: boolean;
  /** true = waktu idle sebelum jeda otomatis TETAP dihitung sebagai idle; false = dibuang dari total waktu. */
  keepIdleOnAutoPause: boolean;
  idlePromptMinutes: number;
  idleGraceSeconds: number;

  // --- Tangkap layar: `screenshotCount` kali tiap `screenshotWindowMinutes` menit (waktu acak) ---
  screenshotCount: number;
  screenshotWindowMinutes: number;
  screenshotQuality: number;
  screenshotMaxWidth: number;
  screenshotBlur: boolean;
  screenshotNotifyEmployee: boolean;
  screenshotRetentionDays: number;

  // --- Penyimpanan: Google Drive lewat Apps Script (lihat docs/PANDUAN-TANGKAP-LAYAR.md) ---
  /** URL Web App Apps Script (berakhiran /exec) */
  screenshotScriptUrl: string;
  /** Kunci unggah; harus sama dengan UPLOAD_KEY di script. Kunci LIHAT tidak disimpan di sini. */
  screenshotUploadKey: string;

  // --- Divisi yang kena tiap fitur. Array kosong = semua divisi. ---
  activityDivisions: string[];
  screenshotDivisions: string[];
  urlTrackingDivisions: string[];

  // --- Pelacakan alamat (URL) lewat ekstensi browser Chrome/Edge ---
  featureUrlTracking: boolean;
  urlTrackingRetentionDays: number;
  /** true = koordinator (yang diizinkan memonitor) juga boleh melihat daftar alamat, bukan cuma HRD */
  leaderCanViewUrlActivity: boolean;
}

/** Satu kunjungan alamat yang tercatat ekstensi browser. */
export interface UrlVisitRecord {
  ts: number;
  domain: string;
  url: string;
  title: string;
  seconds: number;
}

/** Total waktu per domain dalam satu hari (dihitung dari kumpulan UrlVisitRecord). */
export interface UrlDomainSummary {
  domain: string;
  seconds: number;
  visits: number;
}

/** Satu blok waktu (± tiap 10 menit) berisi % aktivitas pada rentang itu dan aplikasi yang
 *  paling banyak dipakai di blok tersebut. Dipakai untuk timeline rincian aktivitas. */
export interface ActivityBlockRecord {
  blockStart: number;
  activeSeconds: number;
  idleSeconds: number;
  topApp?: string;
  /** Porsi kejadian input pada blok ini: keyboardEvents + mouseEvents = total kejadian
   *  (BUKAN detik). Dipakai untuk menghitung % Mouse vs % Keyboard, seperti Hubstaff asli.
   *  Tidak ada kalau belum ada input sama sekali di blok itu. */
  keyboardEvents?: number;
  mouseEvents?: number;
  /** Detik (dalam blok ini) yang ADA input keyboard / mouse — dasar % Keyboard & % Mouse
   *  seperti Hubstaff asli (persen waktu dalam blok yang ada input). Hanya ada pada data baru. */
  keyboardSeconds?: number;
  mouseSeconds?: number;
}

/** Total waktu satu aplikasi/program dalam satu hari. */
export interface AppUsageRecord {
  appName: string;
  seconds: number;
  lastTitle?: string;
  lastSeen: number;
}

/** Catatan kecil satu tangkapan layar di Firebase: screenshots/{tanggal}/{userId}/{ts}. Gambarnya di Drive. */
export interface ScreenshotRecord {
  ts: number;
  fileId: string;
  blurred?: boolean;
  /** Persentase aktivitas (0-100) sejak tangkapan sebelumnya; tidak ada bila tidak terukur */
  activityPct?: number;
  /** Jam server saat dicatat — pembanding kalau jam perangkat karyawan tidak wajar */
  serverTs?: number;
}
