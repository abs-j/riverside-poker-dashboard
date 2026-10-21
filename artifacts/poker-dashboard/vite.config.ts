import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const isDemo = true;

// Swaps the real club's name out of the page shell and install manifest in the demo build.
// The demo is built apart from the real site so the two never overwrite each other.
const outDir = 'dist/public';

const demoBranding = (): Plugin => ({
  name: 'demo-branding',
  apply: () => isDemo,
  transformIndexHtml: (html) =>
    html
      .replaceAll('Riverside Poker Dashboard', 'Riverside Poker Dashboard')
      .replaceAll('Riverside Poker Club', 'Riverside Poker Club'),
  closeBundle() {
    for (const file of ['manifest.webmanifest', 'sw.js']) {
      const target = path.resolve(import.meta.dirname, outDir, file);
      if (!fs.existsSync(target)) continue;
      fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replaceAll('Riverside Poker Club', 'Riverside Poker Club'));
    }
  },
});

const rawPort = process.env.PORT ?? '5000';

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    demoBranding(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, outDir),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Stable vendor chunks cache across deploys, so app changes don't re-download them.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|clsx|tailwind-merge|class-variance-authority)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return 'vendor-charts';
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // Local dev only: Replit routes /api itself, so this stays off there.
    ...(process.env.API_PROXY_TARGET
      ? { proxy: { '/api': process.env.API_PROXY_TARGET } }
      : {}),
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
