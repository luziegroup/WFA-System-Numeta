/**
 * WFA System — penerima tangkap layar → Google Drive.
 * Pasang di script.google.com (akun Google yang Drive-nya dipakai menyimpan gambar).
 * Langkah lengkap: docs/PANDUAN-TANGKAP-LAYAR.md
 */

// ====== WAJIB DIGANTI (acak, panjang, dan BERBEDA satu sama lain) ======
const UPLOAD_KEY = 'GANTI-DENGAN-KUNCI-UNGGAH';   // dipakai aplikasi karyawan untuk mengunggah
const VIEW_KEY = 'GANTI-DENGAN-KUNCI-LIHAT';      // dibagikan hanya ke HRD/koordinator yang boleh melihat
const ADMIN_KEY = 'GANTI-DENGAN-KUNCI-ADMIN';     // untuk MENGHAPUS gambar; pegang sendiri / hanya HRD
// ======================================================================

const ROOT_FOLDER_NAME = 'WFA Screenshots';
const MAX_IMAGE_CHARS = 4 * 1024 * 1024; // batas ukuran base64 per gambar (~3 MB)
const P = PropertiesService.getScriptProperties();

/** Jalankan SEKALI dari editor: membuat folder utama & jadwal hapus otomatis harian. */
function setup() {
  let rootId = P.getProperty('ROOT_FOLDER_ID');
  if (!rootId) {
    const root = DriveApp.createFolder(ROOT_FOLDER_NAME);
    rootId = root.getId();
    P.setProperty('ROOT_FOLDER_ID', rootId);
  }
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'cleanup'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cleanup').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Folder utama: ' + DriveApp.getFolderById(rootId).getUrl());
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.action === 'ping') return json_(ping_(req));
    if (req.action === 'upload') return json_(upload_(req));
    if (req.action === 'get') return json_(get_(req));
    if (req.action === 'delete') return json_(delete_(req));
    return json_({ ok: false, error: 'Aksi tidak dikenal' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function root_() {
  const id = P.getProperty('ROOT_FOLDER_ID');
  if (!id) throw new Error('Script belum di-setup (jalankan fungsi setup)');
  return DriveApp.getFolderById(id);
}

function ping_(req) {
  if (req.key !== UPLOAD_KEY) return { ok: false, error: 'Kunci unggah salah' };
  return { ok: true, folder: root_().getName() };
}

/** Folder per tanggal; dikunci supaya unggahan serentak tidak membuat folder ganda. */
function dayFolder_(date) {
  const cacheKey = 'folder_' + date;
  let id = P.getProperty(cacheKey);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder hilang -> buat ulang */ }
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    id = P.getProperty(cacheKey);
    if (id) {
      try { return DriveApp.getFolderById(id); } catch (e) { /* lanjut */ }
    }
    const root = root_();
    const it = root.getFoldersByName(date);
    const folder = it.hasNext() ? it.next() : root.createFolder(date);
    P.setProperty(cacheKey, folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

function upload_(req) {
  if (req.key !== UPLOAD_KEY) return { ok: false, error: 'Kunci unggah salah' };
  const date = String(req.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Format tanggal salah' };
  const image = String(req.image || '');
  if (!image || image.length > MAX_IMAGE_CHARS) return { ok: false, error: 'Ukuran gambar tidak valid' };

  const days = Math.min(365, Math.max(1, Number(req.retentionDays) || 30));
  P.setProperty('RETENTION_DAYS', String(days));

  const userId = String(req.userId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60);
  const name = userId + '_' + Number(req.ts) + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(image), 'image/jpeg', name);
  const file = dayFolder_(date).createFile(blob);
  file.setDescription(String(req.userName || '').slice(0, 120));
  return { ok: true, fileId: file.getId() };
}

/** Hanya file di dalam folder utama yang boleh dibaca lewat kunci lihat. */
function inRoot_(file) {
  const rootId = P.getProperty('ROOT_FOLDER_ID');
  const parents = file.getParents();
  if (!parents.hasNext()) return false;
  const grand = parents.next().getParents();
  return grand.hasNext() && grand.next().getId() === rootId;
}

function get_(req) {
  if (req.key !== VIEW_KEY) return { ok: false, error: 'Kunci lihat salah' };
  try {
    const file = DriveApp.getFileById(String(req.fileId));
    if (file.isTrashed() || !inRoot_(file)) return { ok: false, error: 'not_found' };
    return { ok: true, image: Utilities.base64Encode(file.getBlob().getBytes()) };
  } catch (e) {
    return { ok: false, error: 'not_found' };
  }
}

function delete_(req) {
  if (req.key !== ADMIN_KEY) return { ok: false, error: 'Kunci admin salah' };
  try {
    const file = DriveApp.getFileById(String(req.fileId));
    if (!inRoot_(file)) return { ok: false, error: 'not_found' };
    try {
      if (typeof Drive !== 'undefined') Drive.Files.remove(file.getId());
      else file.setTrashed(true);
    } catch (e) {
      file.setTrashed(true);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'not_found' };
  }
}

/** Dijalankan otomatis tiap hari: hapus PERMANEN folder tanggal yang melewati masa simpan. */
function cleanup() {
  const days = Number(P.getProperty('RETENTION_DAYS') || 30);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cut = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const it = root_().getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const n = f.getName();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n) || n >= cut) continue;
    try {
      // Tempat sampah Drive tetap memakan kuota; hapus permanen lewat Drive API (layanan lanjutan).
      if (typeof Drive !== 'undefined') Drive.Files.remove(f.getId());
      else f.setTrashed(true);
    } catch (e) {
      f.setTrashed(true);
    }
    P.deleteProperty('folder_' + n);
  }
}
