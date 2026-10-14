#!/usr/bin/env node
/**
 * Menyiapkan paket auto-update setelah `npm run tauri build`.
 *
 * Yang dilakukan skrip ini:
 * 1. Mencari file .nsis.zip + .sig hasil build terbaru di src-tauri/target/release/bundle/nsis
 * 2. Menyalinnya ke public/updates/ (supaya ikut ter-deploy ke Vercel bersama web app)
 * 3. Membuat/memperbarui public/updates/latest.json — file yang dibaca aplikasi karyawan
 *    untuk tahu ada versi baru atau tidak.
 *
 * Jalankan: node scripts/release-update.mjs ["catatan rilis singkat"]
 * Lalu: npm run build && vercel --prod (atau cara deploy Anda yang biasa)
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const NSIS_DIR = join(ROOT, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const PUBLIC_UPDATES_DIR = join(ROOT, 'public', 'updates');
const TAURI_CONF_PATH = join(ROOT, 'src-tauri', 'tauri.conf.json');

const notes = process.argv[2] || 'Pembaruan WFA System.';

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!existsSync(NSIS_DIR)) {
  fail(
    `Folder build tidak ditemukan: ${NSIS_DIR}\n` +
      'Jalankan "npm run tauri build" dulu sebelum skrip ini.'
  );
}

const tauriConf = JSON.parse(readFileSync(TAURI_CONF_PATH, 'utf8'));
const version = tauriConf.version;

const files = readdirSync(NSIS_DIR);
// Tauri (versi yang dipakai proyek ini) menandatangani installer .exe NSIS langsung —
// bukan membungkusnya jadi .nsis.zip seperti sebagian versi lain. Dukung dua-duanya supaya
// skrip ini tetap jalan kalau suatu saat Tauri diupdate dan format outputnya berubah lagi.
// PENTING: pilih berkas yang cocok dengan VERSI di tauri.conf.json dan punya .sig — installer
// versi lama yang tertinggal di folder tidak ikut terpilih.
const candidates = files.filter(
  (f) => (f.endsWith('.nsis.zip') || f.endsWith('-setup.exe')) && f.includes(`_${version}_`) && files.includes(`${f}.sig`)
);
const zipFile = candidates.find((f) => f.endsWith('.nsis.zip')) || candidates[0];
const sigFile = zipFile && `${zipFile}.sig`;

if (!zipFile || !sigFile) {
  fail(
    `Installer versi ${version} beserta .sig tidak ditemukan di folder bundle/nsis.\n` +
      `Pastikan "version" di tauri.conf.json sudah dinaikkan dan "npm run tauri build" sudah dijalankan\n` +
      'dengan kunci penandatangan (TAURI_SIGNING_PRIVATE_KEY) terisi — lihat docs/PANDUAN-AUTO-UPDATE.md langkah 1-2.\n' +
      `Isi folder saat ini: ${files.join(', ') || '(kosong)'}`
  );
}

mkdirSync(PUBLIC_UPDATES_DIR, { recursive: true });

const ext = zipFile.endsWith('.nsis.zip') ? '.nsis.zip' : '.exe';
const destZipName = `wfa-system_${version}_x64-setup${ext}`;
copyFileSync(join(NSIS_DIR, zipFile), join(PUBLIC_UPDATES_DIR, destZipName));
const signature = readFileSync(join(NSIS_DIR, sigFile), 'utf8').trim();

const endpointBase =
  tauriConf.plugins?.updater?.endpoints?.[0]?.replace(/\/updates\/latest\.json$/, '') ||
  'https://ISI-ALAMAT-WEB-ANDA.vercel.app';

const latestJson = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: `${endpointBase}/updates/${destZipName}`,
    },
  },
};

writeFileSync(join(PUBLIC_UPDATES_DIR, 'latest.json'), JSON.stringify(latestJson, null, 2));

console.log('\n✅ Paket auto-update siap:');
console.log(`   - public/updates/${destZipName}`);
console.log('   - public/updates/latest.json');
console.log(`\nVersi: ${version}`);
console.log(`Catatan rilis: ${notes}`);
console.log('\nLangkah selanjutnya:');
console.log('   1. npm run build');
console.log('   2. Deploy seperti biasa (vercel --prod, atau cara Anda)');
console.log('   3. Karyawan yang sudah pasang aplikasi akan mendapat pembaruan otomatis');
console.log('      saat berikutnya mereka membuka aplikasi.\n');
