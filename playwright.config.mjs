// OWNER: Rol 1 — Pruebas E2E de checkpoint (issue #3).
// Local:   npm run e2e          (levanta python3 -m http.server en :8765)
// Publicado: npm run e2e:live    (prueba GitHub Pages)
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8765/';
const local = !process.env.BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'es-MX',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Permite usar un Chromium ya instalado: PW_CHROMIUM_PATH=/ruta/a/chrome npm run e2e
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] }, grep: /@movil/ },
  ],
  webServer: local
    ? { command: 'python3 -m http.server 8765', url: 'http://localhost:8765/', reuseExistingServer: true }
    : undefined,
});
