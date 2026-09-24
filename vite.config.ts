import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  // './' = path relatif, sehingga hasil build (dist/) bisa di-upload ke hosting mana pun:
  // Firebase Hosting, Netlify, GitHub Pages (subfolder repo), maupun cPanel.
  base: './',
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
  },
});
