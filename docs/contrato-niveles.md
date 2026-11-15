# Contrato de datos entre niveles

> Owner: Rol 1 (@Andreushin). Si necesitas un campo nuevo, agrégalo aquí en tu PR y avísalo en el canal del equipo.

Cada nivel vive en su carpeta (`nivel2/`, `nivel3/`, `nivel4/`; el Nivel 1 es la app principal) y **se pasan la misión por una sola clave de `localStorage`**. Usa siempre el helper compartido, que maneja errores, versiones y la mezcla por sección:

```js
import { loadMission, saveMission, clearMission, levelUrl } from '../js/mision-store.js';

const m = loadMission();               // objeto completo o null
saveMission({ journey: { outcome: 'orbit' } }); // mezcla: no borra el resto de journey ni otras secciones
location.href = levelUrl(4);           // ../nivel4/  (funciona desde la raíz o desde una carpeta)
```

## Clave y forma

- Clave: **`eo-mision`**, con `version: 1`. Si la versión no coincide, `loadMission()` devuelve `null`.
- Idioma: **no va aquí**. Se guarda aparte en `srl-lang` (`'es'` | `'en'`), igual que en la app principal.
- La forma es la misma que en `js/state.js`, así que todos hablamos el mismo idioma.

```jsonc
{
  "version": 1,
  "updatedAt": "2026-11-14T22:30:00.000Z",

  // ── Nivel 1 · Diseña tu misión (app principal) ─────────────────────
  "missionId": "moon",                       // id de data/missions.json
  "rocketId": "pico",                        // id de data/rockets.json
  "budget": { "total": 100, "launch": 25, "space": 25, "ground": 8, "user": 5 }, // $M
  "plan": {
    "projectName": "Colibrí Lunar",
    "scienceTargetIdx": 0,                   // índice en missions[].scienceTargets
    "cards": { "launch": "pico", "space": "…", "ground": "…", "user": "…" },
    "maturity": 100, "penalty": 0, "cmlCap": 4, "validated": true
  },

  // ── Nivel 2 · Taller del CubeSat (nivel2/) ─────────────────────────
  "satellite": {
    "formFactor": "struct-6u",               // id de pieza "structure" en data/pieces.json
    "pieces": ["solar-body", "battery", "prop-green", "comm-uhf", "obc", "inst-camera"],
    "propellantKg": 2.5,
    // Resumen calculado por el Nivel 2 al validar (para que N3 y N4 no recalculen):
    "dryKg": 4.4,                            // masa sin propelente
    "wetKg": 6.9,                            // masa al despegar
    "isp": 220,                              // s, del sistema de propulsión
    "dvAvailable": 971,                      // m/s (Tsiolkovsky)
    "maxPayloadKg": 15,                      // del cohete elegido
    "validated": true
  },

  // ── Nivel 3 · Travesía e inserción orbital (nivel3/) ───────────────
  "journey": {
    "dvAvailable": 971,                      // m/s al despegar
    "dvUsed": 912,                           // m/s gastados en total
    "propellantStartKg": 2.5,
    "propellantUsedKg": 2.31,
    "tcm": "early",                          // corrección de trayectoria: 'early' | 'late' | 'skip'
    "events": [{ "id": "valve-leak", "choice": 0, "hit": false, "dv": 50, "science": 0 }],
    "insertionRatio": 1.02,                  // Δv aplicado / Δv requerido en el frenado
    "outcome": "orbit",                      // 'orbit' | 'eccentric' | 'flyby' | 'crash' | 'no-fuel'
    "attempts": 1
  },

  // ── Nivel 4 · Reporte y CML (nivel4/) ──────────────────────────────
  "report": { "score": 72, "cml": 4, "scienceData": [] }
}
```

## Navegar entre niveles

```js
import { levelHref } from '../js/mision-store.js';
location.href = levelHref(4); // nivel4/ si ya está publicado; si no, ../#report en la app principal
```
Cuando publiques tu carpeta, **agrega tu número a `FOLDER_LEVELS`** en `js/mision-store.js` y `folder: N` a tu entrada en `js/levels.js`. Hoy solo está el 3.

## Quién escribe qué

| Nivel | Lee | Escribe | Al terminar va a |
|---|---|---|---|
| 1 · Misión (app principal) | — | `missionId`, `rocketId`, `budget`, `plan` (se guarda solo, en cada cambio) | `nivel2/` |
| 2 · Taller (`nivel2/`) | `missionId`, `rocketId`, `budget`, `plan` | `satellite` (con el resumen calculado) | `nivel3/` |
| 3 · Travesía (`nivel3/`) | `missionId`, `satellite` | `journey` | `nivel4/` |
| 4 · Reporte (`nivel4/`) | todo | `report` | menú / nueva misión (`clearMission()` + `levelUrl(1)`) |

## Reglas

1. **Escribe solo tu sección.** Usa `saveMission({ tuSeccion: {...} })` y nunca `localStorage.setItem('eo-mision', ...)` directo, porque borrarías lo de los demás.
2. **Funciona sin datos (modo demo).** Si `loadMission()` devuelve `null` o le falta lo que necesitas, carga un ejemplo (los diseños de referencia de `docs/fuentes.md`) y muestra un aviso "Modo demo". Así cada nivel se puede probar solo.
3. **Reutiliza la lógica compartida** importándola: `../js/physics.js` (Tsiolkovsky, masas, validación) y `../data/*.json`. No copies fórmulas.
4. **Estilos aislados.** Cada carpeta usa solo su `nivelN.css`. Los colores de la identidad (para mantener el look): fondo `#070b1a`, tarjeta `#0e1530`, borde `#263362`, texto `#eef2ff`, tenue `#9aa6cf`, naranja `#ff6b35` (con texto `#0a0f22` encima), azul `#4fc3f7`, verde `#4ade80`, amarillo `#fbbf24`, rojo `#ff7a7a`.
5. **Bilingüe ES/EN.** Lee el idioma de `srl-lang` y ofrece el botón para cambiarlo.

## Probar el traspaso a mano

En la consola del navegador:
```js
localStorage.getItem('eo-mision')          // ver lo guardado
localStorage.removeItem('eo-mision')       // empezar de cero (modo demo)
```

## Campaña y estrellas

El progreso de la campaña vive aparte, en **`eo-campana`**, para que sobreviva a "Nueva misión". No lo escribas a mano: usa `js/campaign.js`.

```js
import { recordLevel, starsLevel2 } from '../js/campaign.js';
import { showResult, sfx, soundToggle } from '../js/game-ui.js';

const stars = starsLevel2(satellite, mission);             // reglas de los 4 niveles en un solo lugar
showResult({ kicker, title, text, stars,
  record: recordLevel(missionId, 2, stars),                 // guarda la mejor marca
  reasons: ['cómo ganar más estrellas…'],
  primary: { label: 'Siguiente', onClick: () => { location.href = levelHref(3); } },
  secondary: { label: 'Seguir ajustando', onClick: () => {} } });
```

| Nivel | 3 ★ | 2 ★ | 1 ★ |
|---|---|---|---|
| 1 · Misión | sin penalización y CML máx. 4 | CML máx. ≥ 3 | plan validado |
| 2 · Taller | margen de Δv +3 % a +25 % | hasta +60 % | válido pero sobredimensionado |
| 3 · Travesía | órbita estable con frenado ±4 % | órbita estable | órbita excéntrica |
| 4 · Reporte | CML 4 | CML 3 | CML 2 |

- **Desbloqueo:** Luna → Marte → Europa. Un destino se completa cuando el Nivel 3 deja al CubeSat en órbita (`recordLevel(..., { cleared: true })`).
- **Sonido:** `sfx('star' | 'success' | 'fail' | 'decision' | 'click' | 'unlock')`, `engineStart()` y `engineStop()`. Pon `soundToggle(clasesDeBotón)` en tu header. Respeta el silencio del jugador (`eo-sonido`); en táctil empieza apagado.
