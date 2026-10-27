import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {loadRuntimeConfig} from './lib/runtimeConfig';
import {cleanupStorage} from './lib/storageCleanup';
import './index.css';

// Alamat database dibaca dari config.json DULU, baru aplikasi dimuat (modul Firebase membacanya
// saat diimpor). Gagal mengambil config.json tidak menghentikan aplikasi — lihat runtimeConfig.ts.
// Lega-kan penyimpanan lokal SEBELUM Firebase dimuat: kalau localStorage penuh, Firebase gagal menulis
// penanda koneksinya (QuotaExceededError) dan login macet di "Menghubungkan ke server".
cleanupStorage();
loadRuntimeConfig().then(async (cfg) => {
  cleanupStorage(cfg.firebase.projectId); // buang cache milik project lain / format lama
  const [{default: App}, {ErrorBoundary}] = await Promise.all([
    import('./App.tsx'),
    import('./components/ErrorBoundary.tsx'),
  ]);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});
