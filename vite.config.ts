import { defineConfig } from 'vite';
function resolveAppVersion() {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION;
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `v${month}.${day}-${hour}${minute}`;
}

const appVersion = resolveAppVersion();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: { host: true, port: 5173 },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
