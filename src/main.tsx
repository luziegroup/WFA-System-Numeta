import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {loadRuntimeConfig} from './lib/runtimeConfig';
import './index.css';

// Alamat database dibaca dari config.json DULU, baru aplikasi dimuat (modul Firebase membacanya
// saat diimpor). Gagal mengambil config.json tidak menghentikan aplikasi — lihat runtimeConfig.ts.
loadRuntimeConfig().then(async () => {
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
