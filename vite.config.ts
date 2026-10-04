import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  optimizeDeps: { include: ['@tanstack/react-virtual', 'dompurify', 'pdfjs-dist/legacy/build/pdf.mjs'] },
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: { target: ['es2022', 'chrome109', 'safari16.4'], chunkSizeWarningLimit: 900 },
  worker: { format: 'es' },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.{ts,tsx}'] },
});
