import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Собирает sw.js со списком всех файлов сборки, чтобы приложение открывалось без интернета. */
function serviceWorker(): Plugin {
  return {
    name: 'svoya-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => f !== 'index.html');
      const files = ['./', './index.html', './favicon.svg', './manifest.webmanifest', ...built.map((f) => `./${f}`)];
      const version = createHash('sha1').update(files.join('\n')).digest('hex').slice(0, 10);
      const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// base: './' — собранную папку dist можно разместить в любом подкаталоге сайта.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
