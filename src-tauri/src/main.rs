// WFA System dibungkus jadi aplikasi desktop lewat Tauri. Seluruh fitur (absensi,
// to-do, zoom pagi, performa, teguran, dan time tracking Hubstaff) tetap berjalan
// sebagai satu aplikasi React yang sama — tidak ada logic terpisah di sini.
// Native code (Rust) dipakai untuk membaca idle time sistem (activity level). Screenshot
// belum ada.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Berapa detik sistem operasi tidak menerima input keyboard/mouse dari aplikasi MANA PUN.
/// Dipakai menu Hubstaff untuk mengukur tingkat aktivitas & mendeteksi idle. Yang dibaca
/// hanya "sudah berapa lama tidak ada input" — bukan isi ketikan atau posisi kursor.
#[tauri::command]
fn system_idle_seconds() -> Result<u64, String> {
    user_idle::UserIdle::get_time()
        .map(|idle| idle.as_seconds())
        .map_err(|e| e.to_string())
}

/// Ambil gambar layar (monitor pertama), perkecil, (opsional) buramkan, lalu kembalikan JPEG
/// berformat base64. Dipanggil hanya oleh menu Hubstaff saat timer berjalan dan HRD
/// menyalakan fitur tangkap layar. Pengunggahan dilakukan di sisi JavaScript.
#[tauri::command]
async fn capture_screenshot(max_width: u32, quality: u8, blur: bool) -> Result<String, String> {
    use base64::Engine;
    use image::{codecs::jpeg::JpegEncoder, imageops, imageops::FilterType, DynamicImage};

    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
        let monitor = monitors
            .into_iter()
            .next()
            .ok_or_else(|| "Tidak ada layar terdeteksi".to_string())?;
        let mut img = monitor.capture_image().map_err(|e| e.to_string())?;

        if max_width > 0 && img.width() > max_width {
            let h = ((img.height() as u64 * max_width as u64) / img.width() as u64).max(1) as u32;
            img = imageops::resize(&img, max_width, h, FilterType::Triangle);
        }
        if blur {
            img = imageops::blur(&img, 6.0);
        }

        // JPEG tidak mendukung kanal alpha -> ubah ke RGB dulu.
        let rgb = DynamicImage::ImageRgba8(img).into_rgb8();
        let mut buf: Vec<u8> = Vec::new();
        let encoder = JpegEncoder::new_with_quality(&mut buf, quality.clamp(30, 90));
        DynamicImage::ImageRgb8(rgb)
            .write_with_encoder(encoder)
            .map_err(|e| e.to_string())?;
        Ok(base64::engine::general_purpose::STANDARD.encode(&buf))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Nama aplikasi (dan judul jendelanya) yang sedang aktif/fokus di layar. Dipakai menu
/// Hubstaff untuk mencatat berapa lama tiap aplikasi dipakai (mis. Excel, Chrome, Word) saat
/// timer berjalan. Hanya membaca NAMA program & judul jendela — tidak membaca isi layar atau
/// isi jendela. Gagal dengan aman (string kosong) kalau tidak ada jendela aktif terdeteksi
/// (misalnya desktop kosong, atau layar terkunci).
#[tauri::command]
fn active_window_info() -> Result<serde_json::Value, String> {
    use active_win_pos_rs::get_active_window;
    match get_active_window() {
        Ok(w) => Ok(serde_json::json!({ "appName": w.app_name, "title": w.title })),
        Err(_) => Ok(serde_json::json!({ "appName": "", "title": "" })),
    }
}

/// Penghitung kejadian input (TIDAK PERNAH menyimpan tombol apa yang ditekan atau isi
/// ketikan — hanya angka hitungan). Dipakai untuk memecah "% aktivitas" menjadi porsi
/// Mouse vs Keyboard, seperti Hubstaff asli. Berjalan di background sejak aplikasi dibuka;
/// JS sisi menu Hubstaff yang memutuskan kapan angkanya relevan dipakai (saat timer jalan).
static KEYBOARD_EVENTS: once_cell::sync::Lazy<std::sync::atomic::AtomicU64> =
    once_cell::sync::Lazy::new(|| std::sync::atomic::AtomicU64::new(0));
static MOUSE_EVENTS: once_cell::sync::Lazy<std::sync::atomic::AtomicU64> =
    once_cell::sync::Lazy::new(|| std::sync::atomic::AtomicU64::new(0));
static LAST_MOUSE_COUNTED_MS: once_cell::sync::Lazy<std::sync::atomic::AtomicU64> =
    once_cell::sync::Lazy::new(|| std::sync::atomic::AtomicU64::new(0));

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Mulai mendengarkan kejadian keyboard & mouse di seluruh sistem. Gagal diam-diam kalau
/// sistem tidak mengizinkan (mis. izin Accessibility belum diberikan di macOS) — fitur
/// lain (timer, tangkap layar, idle) tetap jalan normal tanpa ini.
fn start_input_counter() {
    std::thread::spawn(|| {
        use rdev::EventType;
        use std::sync::atomic::Ordering;
        eprintln!("[WFA] Memulai pendengar input (keyboard/mouse)...");
        let result = rdev::listen(move |event| match event.event_type {
            EventType::KeyPress(_) => {
                KEYBOARD_EVENTS.fetch_add(1, Ordering::Relaxed);
            }
            EventType::ButtonPress(_) => {
                MOUSE_EVENTS.fetch_add(1, Ordering::Relaxed);
            }
            EventType::MouseMove { .. } => {
                // Gerakan mouse mengirim ratusan event/detik -> hitung sebagai "satu kejadian"
                // tiap 250ms saja, supaya adil dibandingkan dengan tombol keyboard yang
                // ditekan satu-satu.
                let now = now_ms();
                let last = LAST_MOUSE_COUNTED_MS.load(Ordering::Relaxed);
                if now.saturating_sub(last) >= 250 {
                    LAST_MOUSE_COUNTED_MS.store(now, Ordering::Relaxed);
                    MOUSE_EVENTS.fetch_add(1, Ordering::Relaxed);
                }
            }
            _ => {}
        });
        // Kalau listener gagal (mis. izin sistem ditolak), cetak alasannya ke konsol supaya
        // kelihatan saat aplikasi dijalankan lewat terminal — fitur lain (tangkap layar, idle,
        // nama aplikasi) tetap jalan normal walau ini gagal.
        if let Err(e) = result {
            eprintln!("[WFA] Pendengar input GAGAL dimulai: {:?}", e);
        }
    });
}

/// Ambil & nolkan hitungan kejadian input sejak terakhir dipanggil. Dipakai menu Hubstaff
/// tiap beberapa menit untuk menghitung porsi Mouse vs Keyboard pada rentang itu.
#[tauri::command]
fn take_input_counts() -> serde_json::Value {
    use std::sync::atomic::Ordering;
    let kb = KEYBOARD_EVENTS.swap(0, Ordering::Relaxed);
    let ms = MOUSE_EVENTS.swap(0, Ordering::Relaxed);
    serde_json::json!({ "keyboard": kb, "mouse": ms })
}

fn main() {
    start_input_counter();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            system_idle_seconds,
            capture_screenshot,
            active_window_info,
            take_input_counts
        ])
        .run(tauri::generate_context!())
        .expect("error while running WFA System");
}
