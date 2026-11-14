# Cómo trabajamos (4 roles, sin pisarnos)

**Regla de oro:** cada archivo tiene un único dueño (ver comentario `OWNER:` al inicio). Si necesitas un cambio en un archivo ajeno, pídeselo a su dueño.

| Rol | Rama | Archivos |
|---|---|---|
| 1 · Core e integración | `feat/core` | `index.html`, `js/main.js`, `js/state.js`, `js/i18n.js`, `css/base.css`, `data/i18n/*/common.json`, `README.md`, `CONTRIBUTING.md` |
| 2 · Datos y física | `feat/data-physics` | `data/{missions,rockets,pieces,events}.json`, `js/physics.js`, `tests/`, `docs/fuentes.md` |
| 3 · Pantallas 1–2 | `feat/screens-1-2` | `js/screens/{mission,workshop}.js`, `css/screens/{mission,workshop}.css`, `data/i18n/*/{mission,workshop}.json` |
| 4 · Pantallas 3–4 | `feat/screens-3-4` | `js/screens/{journey,report}.js`, `js/canvas/*`, `css/screens/{journey,report}.css`, `data/i18n/*/{journey,report}.json` |

## Contratos (no se cambian sin avisar)
- **Pantalla:** `export default { id, mount(container, ctx), unmount() }`. Cada pantalla crea su propio DOM dentro de `container`.
- **ctx:** `{ state, update, subscribe, reset, data, physics, t, tx, goTo }`.
  - `update({ budget: { space: 60 } })` mezcla por rama (no borra el resto de `budget`).
  - `t('mission.title', vars)` → textos de `data/i18n/<lang>/<ns>.json`. `tx({es, en})` → textos dentro de los JSON de datos.
- **Estado:** ver esquema en `js/state.js`.
- **Física:** firmas exportadas en `js/physics.js` (`deltaV`, `validateDesign`, `insertionOutcome`, `scienceScore`, `computeCML`, …).
- **Textos nuevos:** agrégalos SIEMPRE en `es` y `en` del namespace de tu pantalla.

## Flujo git
```bash
git checkout -b feat/<tu-rama>
# trabajar, commits pequeños
git pull --rebase origin main
git push -u origin feat/<tu-rama>   # abrir PR → lo revisa Rol 1
```

## Checkpoints (≤36 h)
- **H12:** flujo de 4 pantallas navegable en `main` + primer deploy a GitHub Pages.
- **H24:** feature freeze. Después solo balanceo, bugs, móvil y textos.
- **H32–H36:** video demo, README y entrega.
- Recortables en orden: eventos aleatorios → gráfica del reporte → animación elaborada → 3er destino.
