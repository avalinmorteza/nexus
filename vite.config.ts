import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Multi-entry build: dashboard page, popup page and the MV3 service worker.
//   npm run build            -> dist/          personal build (Peyda font)
//   npm run build:release    -> release/build/ public build (Vazirmatn, OFL) for the Chrome Web Store / Edge
export default defineConfig(({ mode }) => {
  const release = mode === 'release';
  // Peyda is a commercial font kept only on the owner's machine; without it every build uses Vazirmatn.
  const hasPeyda = fs.existsSync(resolve(__dirname, 'src/assets/fonts/Peyda-Regular.ttf'));
  return {
    plugins: [react()],
    base: './',
    resolve: {
      alias: {
        '@nexus-font': resolve(__dirname, release || !hasPeyda ? 'src/fonts/vazirmatn.css' : 'src/fonts/peyda.css'),
      },
    },
    build: {
      outDir: release ? 'release/build' : 'dist',
      emptyOutDir: true,
      target: 'es2020',
      sourcemap: false,
      rollupOptions: {
        input: {
          dashboard: resolve(__dirname, 'dashboard.html'),
          popup: resolve(__dirname, 'popup.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
        },
        output: {
          entryFileNames: (chunk: { name: string }) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  } as any;
});
