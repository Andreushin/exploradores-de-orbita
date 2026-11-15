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

  // ── Despegue en el simulador de cohetes reales (simulador/) ────────
  // Nivel 1 fija el cohete al elegir destino (data/missions.json → simRocket.id) y reinicia el resto.
  // Nivel 3 lo abre antes de los asteroides (iframe con ?rocket=…&lock=1&embed=1, ver simulador/embed.js).
  "simulation": {
    "rocketId": "saturno-v",                 // id de simulador/cohetes.json (Luna → saturno-v, Marte → atlas-agena-d, Europa → falcon-heavy)
    "locked": true,                          // Nivel 3: el simulador ya se abrió; el cohete no se cambia
    "done": true,                            // Nivel 3: llegó a órbita (o se saltó): al volver al Nivel 3 va directo a los asteroides
    "result": { "ok": true, "perigeoKm": 171, "apogeoKm": 185, "tiempoS": 701, "propRestanteKg": 67518 }, // o { "skipped": true }
    // Nivel 3: pilotaje orbital (simulador/pilotaje/?destino=…&lock=1&embed=1) tras los asteroides.
    // Destino del pilotaje = missions[].simRocket.destino (mismo cohete). NO suma ni resta puntos.
    "pilot": {
      "done": true,                          // el jugador pulsó «Continuar la misión» en su informe (o lo saltó)
      "result": { "fin": "terminada", "orbita": true, "estrellas": 2, "lugares": 2, "dvUsado": 812, "tiempoS": 5400 } // o { "skipped": true }
    }
  },

  // ── Nivel 2 · Taller del CubeSat (nivel2/) ─────────────────────────
  "satellite": {
    "formFactor": "struct-6u",               // id de pieza "structure" en data/pieces.json
    "pieces": ["battery", "prop-green", "comm-uhf", "obc", "inst-camera"],
    "propellantKg": 2.5,
    // Resumen calculado por el Nivel 2 al validar (para que N3 y N4 no recalculen):
    "dryKg": 4.4,                            // masa sin propelente
    "wetKg": 6.9,                            // masa al despegar
    "isp": 220,                              // s, del sistema de propulsión
    "dvAvailable": 971,                      // m/s (Tsiolkovsky)
    "powerGenW": 8,                          // W generados en el destino (los paneles escalan con 1/d²)
    "powerUseW": 7,                          // W que consumen las piezas elegidas
    "powerNetW": 1,                          // powerGenW − powerUseW; puede ser negativo
    "batteryWh": 80,                         // capacidad de batería (guarda energía, no la genera)
    "maxPayloadKg": 15,                      // del cohete elegido
    "validated": true,                       // el diseño pasó las 11 verificaciones
    "launched": true                         // el jugador pulsó Lanzar (también con verificaciones en rojo: el Reporte lo marca CML 1)
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
| 1 · Misión (app principal) | — | `missionId`, `rocketId`, `budget`, `plan`, `simulation.rocketId` (se guarda solo, en cada cambio; cambiar de destino reinicia `simulation`) | `nivel2/` |
| 2 · Taller (`nivel2/`) | `missionId`, `rocketId`, `budget`, `plan` | `satellite` (con el resumen calculado) | `nivel3/` |
| 3 · Travesía (`nivel3/`) | `missionId`, `satellite`, `simulation` | `simulation.{locked,done,result,pilot}`, `journey` | `nivel4/` |
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
