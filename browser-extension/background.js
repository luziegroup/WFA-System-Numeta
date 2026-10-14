/**
 * Service worker ekstensi WFA System — Pelacak Alamat.
 *
 * Cara kerja singkat:
 * 1. Karyawan memasukkan kode pasang (userId + token) sekali di halaman Opsi.
 * 2. Tiap ~15 detik, service worker mengecek `trackingStatus/{userId}` di Firebase untuk
 *    tahu apakah timer Hubstaff karyawan sedang berjalan DAN fitur pelacakan alamat
 *    dinyalakan untuk divisinya. Kalau tidak, ekstensi TIDAK mencatat apa pun.
 * 3. Selama boleh mencatat, ekstensi mengamati tab yang sedang aktif & fokus, mengambil
 *    alamat (URL) dan judul halamannya, lalu menjumlah waktu per domain.
 * 4. Tiap pergantian alamat atau tiap ~30 detik, catatan dikirim ke Firebase lewat REST API
 *    (fetch biasa, tanpa SDK) ke path `urlActivity/{tanggal}/{userId}/...`.
 *
 * Isi tab (isi ketikan, isi halaman) TIDAK pernah dibaca. Yang dicatat hanya alamat, judul
 * tab, dan lama waktu tab tersebut aktif.
 */
importScripts('config.js');

const POLL_STATUS_MS = 15000;
const FLUSH_MS = 30000;
const TICK_MS = 5000;

let pairing = null; // { userId, token }
const CONTENT_SCRIPT_ID = 'wfa-app-page';

/** Kode pasang berformat "userId.token" (sama seperti yang dibuat halaman Hubstaff). */
function parsePairingCode(raw) {
  const s = String(raw || '').trim();
  const dot = s.indexOf('.');
  if (dot <= 0) return null;
  return { userId: s.slice(0, dot), token: s.slice(dot + 1) };
}

/**
 * Daftarkan/perbarui content script supaya berjalan di alamat aplikasi WFA System yang diisi
 * admin (bisa diganti kapan saja lewat halaman Opsi, tanpa memasang ulang ekstensi).
 */
async function registerAppContentScript() {
  let { appOrigin } = await chrome.storage.local.get(['appOrigin']);
  // Belum pernah diisi sama sekali (pemasangan baru) -> pakai alamat bawaan dari config.js,
  // supaya karyawan tidak perlu mengetik apa pun. Kalau admin sudah pernah mengubahnya
  // manual (termasuk mengosongkannya), pilihan admin itu yang dipakai, bukan nilai bawaan.
  if (appOrigin === undefined && WFA_CONFIG.DEFAULT_APP_ORIGIN) {
    appOrigin = WFA_CONFIG.DEFAULT_APP_ORIGIN;
    await chrome.storage.local.set({ appOrigin });
    return; // set() di atas akan memicu registerAppContentScript() lagi lewat onChanged
  }
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  } catch {
    // belum pernah didaftarkan — abaikan
  }
  if (!appOrigin) return;
  const base = String(appOrigin).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return;
  try {
    await chrome.scripting.registerContentScripts([
      { id: CONTENT_SCRIPT_ID, matches: [`${base}/*`], js: ['content-script.js'], runAt: 'document_idle' },
    ]);
  } catch (e) {
    console.warn('WFA: gagal mendaftarkan content script untuk', base, e);
  }
}
let statusCache = { tracking: false, urlTrackingOn: false, date: null, fetchedAt: 0 };
let current = null; // { domain, url, title, startedAt, accumSeconds, visitId }
let queue = []; // catatan siap dikirim: { date, userId, visitId, domain, url, title, ts, seconds }

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const domainOf = (url) => {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

async function loadPairing() {
  const stored = await chrome.storage.local.get(['userId', 'token']);
  pairing = stored.userId && stored.token ? { userId: stored.userId, token: stored.token } : null;
}

async function fetchStatus() {
  if (!pairing) return { tracking: false, urlTrackingOn: false, date: null };
  try {
    const db = await wfaGetDb();
    const res = await fetch(`${db.databaseUrl}/${db.dbRoot}/trackingStatus/${pairing.userId}.json`);
    const data = (await res.json()) || {};
    return {
      tracking: !!data.tracking,
      urlTrackingOn: !!data.urlTrackingOn,
      date: data.date || todayStr(),
    };
  } catch {
    return { ...statusCache, urlTrackingOn: false }; // gagal jaringan -> aman, jangan mencatat
  }
}

async function refreshStatus() {
  await loadPairing();
  statusCache = { ...(await fetchStatus()), fetchedAt: Date.now() };
  updateBadge();
}

function updateBadge() {
  const on = pairing && statusCache.tracking && statusCache.urlTrackingOn;
  chrome.action.setBadgeText({ text: on ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: on ? '#059669' : '#94a3b8' });
}

function canRecord() {
  return !!pairing && statusCache.tracking && statusCache.urlTrackingOn;
}

/** Tutup kunjungan yang sedang berjalan (kalau ada) dan masukkan ke antrean kirim. */
function closeCurrent() {
  if (!current || !pairing) return;
  if (current.accumSeconds > 0) {
    queue.push({
      date: statusCache.date || todayStr(),
      userId: pairing.userId,
      token: pairing.token,
      visitId: current.visitId,
      domain: current.domain,
      url: current.url,
      title: current.title,
      ts: current.startedAt,
      seconds: Math.round(current.accumSeconds),
    });
  }
  current = null;
}

async function setActiveUrl(url, title) {
  const domain = domainOf(url || '');
  if (!canRecord() || !domain) {
    closeCurrent();
    return;
  }
  if (current && current.url === url) {
    current.title = title || current.title;
    return;
  }
  closeCurrent();
  current = { domain, url, title: title || '', startedAt: Date.now(), accumSeconds: 0, visitId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
}

async function readActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

async function tick() {
  const state = await chrome.idle.queryState(60).catch(() => 'active');
  if (!canRecord() || state !== 'active') {
    closeCurrent();
    return;
  }
  const win = await chrome.windows.getLastFocused({}).catch(() => null);
  if (!win || !win.focused) {
    closeCurrent();
    return;
  }
  const tab = await readActiveTab();
  if (!tab || !tab.url) {
    closeCurrent();
    return;
  }
  await setActiveUrl(tab.url, tab.title || '');
  if (current) current.accumSeconds += TICK_MS / 1000;
}

async function flush() {
  closeCurrent(); // pastikan sesi yang sedang berjalan ikut terkirim sebagian (akan dilanjut sebagai kunjungan baru)
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  const db = await wfaGetDb();
  for (const item of batch) {
    try {
      const safeUid = String(item.userId).replace(/[.#$/\[\]]/g, '_');
      await fetch(
        `${db.databaseUrl}/${db.dbRoot}/urlActivity/${item.date}/${safeUid}/visits/${item.visitId}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ts: item.ts,
            domain: item.domain,
            url: item.url.slice(0, 500),
            title: (item.title || '').slice(0, 200),
            seconds: item.seconds,
            token: item.token,
          }),
        }
      );
    } catch {
      // Gagal kirim: catatan ini dilewati (tidak diulang) supaya antrean tidak menumpuk tanpa batas
      // saat offline lama. Kehilangan beberapa menit riwayat alamat bukan hal kritis.
    }
  }
}

chrome.tabs.onActivated.addListener(async () => { if (canRecord()) { const t = await readActiveTab(); if (t) await setActiveUrl(t.url, t.title || ''); } });
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.active || !info.url) return;
  if (canRecord()) await setActiveUrl(tab.url, tab.title || '');
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) { closeCurrent(); return; }
  if (canRecord()) { const t = await readActiveTab(); if (t) await setActiveUrl(t.url, t.title || ''); }
});

chrome.alarms.create('wfa-status', { periodInMinutes: POLL_STATUS_MS / 60000 });
chrome.alarms.create('wfa-tick', { periodInMinutes: TICK_MS / 60000 });
chrome.alarms.create('wfa-flush', { periodInMinutes: FLUSH_MS / 60000 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wfa-status') refreshStatus();
  else if (alarm.name === 'wfa-tick') tick();
  else if (alarm.name === 'wfa-flush') flush();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.userId || changes.token) refreshStatus();
  if (changes.appOrigin) registerAppContentScript();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'wfa-pairing-detected') {
    (async () => {
      const parsed = parsePairingCode(msg.code);
      if (parsed) {
        const cur = await chrome.storage.local.get(['userId', 'token']);
        if (cur.userId !== parsed.userId || cur.token !== parsed.token) {
          await chrome.storage.local.set(parsed); // memicu refreshStatus() lewat onChanged di atas
        }
      }
      sendResponse({ paired: !!pairing, tracking: statusCache.tracking, urlTrackingOn: statusCache.urlTrackingOn });
    })();
    return true; // jawaban dikirim async
  }
  if (msg && msg.type === 'wfa-status-query') {
    sendResponse({ paired: !!pairing, tracking: statusCache.tracking, urlTrackingOn: statusCache.urlTrackingOn });
    return false;
  }
  return false;
});

chrome.runtime.onStartup.addListener(() => { refreshStatus(); registerAppContentScript(); });
chrome.runtime.onInstalled.addListener((details) => {
  refreshStatus();
  registerAppContentScript();
  if (details.reason === 'install') {
    chrome.action.setBadgeText({ text: '' });
  }
});
refreshStatus();
registerAppContentScript();
