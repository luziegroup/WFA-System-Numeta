import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  // './' = path relatif, sehingga hasil build (dist/) bisa di-upload ke hosting mana pun:
  // Firebase Hosting, Netlify, GitHub Pages (subfolder repo), maupun cPanel.
  base: './',
  // Tambahan untuk Tauri (aplikasi desktop). Tidak mengubah build untuk hosting web.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Pecah bundle agar load awal lebih ringan & cache browser lebih efektif
        manualChunks: {
          firebase: ['firebase/app', 'firebase/database'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    watch: {
      // Isi folder ini hasil compile Rust; kalau ikut dipantau Vite, muncul error EBUSY.
      ignored: ['**/src-tauri/**'],
    },
  },
});
