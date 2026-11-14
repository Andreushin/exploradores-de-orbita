// OWNER: Rol 1 — Prueba de checkpoint: juega las 3 misiones de punta a punta.
// Los selectores salen de los JSON (textos e ids), no del markup: si un rol cambia
// el diseño de su pantalla, la prueba sigue funcionando mientras use botones y textos.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url)));
const missions = read('data/missions.json');
const rockets = read('data/rockets.json');
const pieces = read('data/pieces.json');
const events = read('data/events.json');
const es = Object.fromEntries(['common', 'mission', 'workshop', 'journey', 'report']
  .map((ns) => [ns, read(`data/i18n/es/${ns}.json`)]));

// Diseños ganadores de referencia (docs/fuentes.md). Si Rol 2 cambia el balance, actualizar aquí.
const REFERENCE = {
  moon: { rocket: 'pico', parts: ['struct-6u', 'solar-body', 'battery', 'prop-green', 'comm-uhf', 'obc', 'inst-camera'], propellant: 2.5 },
  mars: { rocket: 'medio', parts: ['struct-12u', 'solar-deploy', 'solar-body', 'battery', 'prop-green', 'comm-x', 'adcs', 'obc', 'inst-camera', 'inst-mag'], propellant: 6 },
  europa: { rocket: 'pesado', parts: ['struct-12u', 'rtg-mini', 'solar-deploy', 'prop-ion', 'comm-x', 'obc', 'inst-mag', 'inst-camera'], propellant: 1.5 },
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// El nombre accesible del botón empieza con el título de la tarjeta/pieza.
const byName = (page, text) => page.getByRole('button', { name: new RegExp(`^\\s*${esc(text)}`) });
const screen = (page, id) => page.locator(`#screen-${id}`);

/** Errores de JS y de red (excepto favicon) durante la prueba. */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('favicon') && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

/** Math.random con semilla: los eventos y riesgos salen igual en cada corrida. */
async function seedRandom(page) {
  await page.addInitScript(() => {
    let s = 20261114;
    Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  });
}

async function playMission(page, missionId) {
  const m = missions.find((x) => x.id === missionId);
  const ref = REFERENCE[missionId];
  const rocket = rockets.find((r) => r.id === ref.rocket);

  // 1 · Misión
  await page.goto('./');
  await byName(screen(page, 'mission'), m.name.es).click();
  await byName(screen(page, 'mission'), rocket.name.es).click();
  const next = screen(page, 'mission').getByRole('button', { name: es.common.next });
  await expect(next, 'el reparto inicial del presupuesto debe permitir avanzar').toBeEnabled({ timeout: 5000 });
  await next.click();

  // 2 · Taller
  const ws = screen(page, 'workshop');
  await expect(ws).toBeVisible();
  for (const id of ref.parts) {
    await byName(ws, pieces.find((p) => p.id === id).name.es).click();
  }
  const slider = ws.getByRole('slider');
  await slider.fill(String(ref.propellant));
  await slider.dispatchEvent('change');
  const launch = ws.getByRole('button', { name: es.workshop.launch });
  await expect(launch, 'el diseño de referencia debe poder lanzarse').toBeEnabled();
  await launch.click();

  // 3 · Travesía: elige la primera opción de cada evento hasta llegar a la inserción
  const jr = screen(page, 'journey');
  const burn = jr.getByRole('button', { name: es.journey.holdToBurn });
  const choices = events.map((e) => e.choices[0].label.es);
  await expect(async () => {
    for (const label of choices) {
      const btn = jr.getByRole('button', { name: label, exact: true });
      if (await btn.isVisible()) await btn.click();
    }
    await expect(burn).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 40_000 });

  // Mantener el quemado ~1/BURN_RATE s para apuntar a ratio 1.0
  await burn.hover();
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();

  const outcomes = Object.values(es.journey.outcomes);
  await expect(jr.getByRole('heading', { level: 3 })).toHaveText(new RegExp(outcomes.map(esc).join('|')));
  const outcome = await jr.getByRole('heading', { level: 3 }).innerText();
  await jr.getByRole('button', { name: es.journey.toReport }).click();

  // 4 · Reporte
  const rp = screen(page, 'report');
  await expect(rp.getByRole('heading', { level: 1 })).toHaveText(es.report.title);
  await expect(rp.locator('.cml-step.is-reached').first()).toBeVisible();
  const cml = await rp.locator('.cml-step.is-reached').count();
  test.info().annotations.push({ type: 'resultado', description: `${outcome} · CML ${cml}` });
}

// Bugs conocidos: la prueba se marca como "falla esperada" hasta que se arregle.
// Cuando el bug se corrija, Playwright avisará ("expected to fail") → borrar la entrada.
const KNOWN_BUGS = {
};

for (const id of Object.keys(REFERENCE)) {
  test(`misión ${id}: de punta a punta`, async ({ page }) => {
    test.fail(!!KNOWN_BUGS[id], KNOWN_BUGS[id]);
    const errors = trackErrors(page);
    await seedRandom(page);
    await playMission(page, id);
    expect(errors, 'sin errores en consola ni recursos 404').toEqual([]);
  });
}

test('cambio de idioma ES → EN en todas las pantallas visitadas', async ({ page }) => {
  const errors = trackErrors(page);
  const en = read('data/i18n/en/mission.json');
  await page.goto('./');
  await page.locator('#lang-toggle').click();
  await expect(screen(page, 'mission').getByRole('heading', { level: 1 })).toHaveText(en.title);
  await page.locator('#lang-toggle').click();
  await expect(screen(page, 'mission').getByRole('heading', { level: 1 })).toHaveText(es.mission.title);
  expect(errors).toEqual([]);
});

test('móvil: sin scroll horizontal en Misión y Taller @movil', async ({ page }) => {
  await page.goto('./');
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noOverflow()).toBe(true);
  const m = missions[0];
  await byName(screen(page, 'mission'), m.name.es).click();
  await byName(screen(page, 'mission'), rockets.find((r) => r.destinations.includes(m.id)).name.es).click();
  await screen(page, 'mission').getByRole('button', { name: es.common.next }).click();
  await expect(screen(page, 'workshop')).toBeVisible();
  expect(await noOverflow()).toBe(true);
});
