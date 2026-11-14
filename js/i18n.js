// OWNER: Rol 1 — Internacionalización.
// Uso: t('mission.title') busca la clave "title" en data/i18n/<lang>/mission.json.
// Interpolación: t('workshop.mass', { kg: 3.2 }) con "Masa: {kg} kg".
// Textos de datos (JSON de misiones/piezas) usan objetos { es, en } → usar tx(obj).

export const LANGS = ['es', 'en'];
export const NAMESPACES = ['common', 'menu', 'mission', 'workshop', 'journey', 'report'];
const STORAGE_KEY = 'srl-lang';

const dict = {}; // dict[lang][namespace] = {...}
let current = 'es';

export async function loadTranslations() {
  await Promise.all(LANGS.flatMap((lang) => NAMESPACES.map(async (ns) => {
    const res = await fetch(`data/i18n/${lang}/${ns}.json`);
    if (!res.ok) throw new Error(`i18n: no se pudo cargar ${lang}/${ns}`);
    (dict[lang] ??= {})[ns] = await res.json();
  })));
}

export function getSavedLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(v)) return v;
  } catch { /* storage bloqueado */ }
  return navigator.language?.startsWith('es') ? 'es' : 'en';
}

export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : 'es';
  document.documentElement.lang = current;
  try { localStorage.setItem(STORAGE_KEY, current); } catch { /* ignore */ }
}

export function getLang() {
  return current;
}

export function t(key, vars = {}) {
  const [ns, ...rest] = key.split('.');
  const path = rest.join('.');
  const lookup = (lang) => path.split('.').reduce((o, k) => o?.[k], dict[lang]?.[ns]);
  let str = lookup(current) ?? lookup('es') ?? key;
  if (typeof str !== 'string') return key;
  return str.replace(/\{(\w+)\}/g, (_, v) => (v in vars ? vars[v] : `{${v}}`));
}

/** Traduce un objeto bilingüe de los JSON de datos: { es: '...', en: '...' }. */
export function tx(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[current] ?? obj.es ?? '';
}

/** Aplica traducciones a elementos estáticos con data-i18n="ns.key". */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}
