# Nivel 3 · Travesía e inserción orbital

> Referencia para revisar y mantener el Nivel 3. **Responsable:** @Andreushin · vive en `nivel3/`.
> **Recurso NASA:** [General Mission Analysis Tool (GMAT)](https://software.nasa.gov/software/GSC-19468-1) y [NASA Mission Viz](https://nasa.github.io/mission-viz/).
> **Relacionados:** [`contrato-niveles.md`](../contrato-niveles.md) · [`fuentes.md`](../fuentes.md) · [`nivel-2.md`](nivel-2.md) · [`nivel-4.md`](nivel-4.md)

## Especificación

Simulación del viaje al destino y de la inserción orbital.

- **Combustible finito:** el consumo depende de la masa total del CubeSat diseñado en el Nivel 2. A más masa, más propelente para el mismo cambio de velocidad.
- **Decisiones críticas** en puntos clave: corrección de trayectoria y maniobra de frenado orbital.
- Si el combustible se agota por un satélite sobredimensionado, la misión fracasa y aparece una **pantalla de reintento educativo**.
- Estilos aislados en `nivel3.css`. Al terminar, continúa al Nivel 4.

## Índice
1. [Archivos](#1-archivos)
2. [Entrada y salida (contrato)](#2-entrada-y-salida-contrato)
3. [Modelo de combustible](#3-modelo-de-combustible)
4. [Fases y decisiones](#4-fases-y-decisiones)
5. [Pantalla sin combustible](#5-pantalla-sin-combustible)
6. [Visualización](#6-visualización)
7. [Constantes para balancear](#7-constantes-para-balancear)
8. [Cómo probarlo](#8-cómo-probarlo)

## 1. Archivos

| Archivo | Qué hace |
|---|---|
| `nivel3/index.html` | Página aislada: header, canvas, HUD, panel de decisiones y bitácora |
| `nivel3/nivel3.css` | Estilos con prefijo `n3-` y sus propios tokens de la identidad |
| `nivel3/nivel3.js` | Lógica del nivel: estado de la travesía, fases, canvas y persistencia |
| `nivel3/textos.js` | Textos ES/EN (`{ es, en }`, con interpolación `{nombre}`) |

Reutiliza, importándolos: `js/physics.js` (`deltaV`, `propellantFor`, `insertionOutcome`, masas, Isp), `js/mision-store.js` y `data/{missions,pieces,events}.json`.

## 2. Entrada y salida (contrato)

- **Lee** de `eo-mision`: `missionId` y `satellite` (`formFactor`, `pieces`, `propellantKg`). La masa seca y el Isp se recalculan con las piezas.
- **Modo demo:** si no hay satélite, usa el diseño de referencia de la Luna (`docs/fuentes.md`) y muestra un aviso. Solo escribe ese demo en `eo-mision` si no había nada guardado.
- **Escribe** `journey`: `dvAvailable`, `dvUsed`, `propellantStartKg`, `propellantUsedKg`, `tcm` (`early` | `late` | `skip`), `events[]` (`{ id, choice, hit, dv, science }`), `insertionRatio`, `outcome` (`orbit` | `eccentric` | `flyby` | `crash` | `no-fuel`), `science` y `attempts`.
- **Navega** con `levelHref(n)`: "Ver reporte" va al Nivel 4 y "Volver al Taller" al Nivel 2.

## 3. Modelo de combustible

Cada maniobra de Δv consume, con la masa del momento:

```
kg = m · (1 − e^(−Δv / (Isp · g₀)))
```

- La masa baja a medida que se gasta propelente, así que el orden de las maniobras importa.
- Si una maniobra pide más propelente del que queda, se gasta todo y se logra solo el Δv que alcanza (`burn()` devuelve `out: true`).
- Ejemplo de control: 10 kg, Isp 220 s, Δv 850 m/s → 3.26 kg.

## 4. Fases y decisiones

1. **Presupuesto de Δv** (antes de volar, estilo GMAT): masa seca, propelente, Isp, Δv disponible y una tabla con la corrección temprana y la inserción, los kg estimados y el margen.
2. **Corrección de trayectoria (TCM)** al 25 % del viaje:
   - temprana: 4 % del Δv de inserción;
   - tardía: 3× más cara;
   - no corregir: la inserción exige +15 %.
3. **Evento en ruta** al 60 %: uno de `data/events.json` (se excluye `tcm` para no repetir la decisión anterior). Aplica `dv`, `risk` (si se cumple, −120 m/s) y `science`.
4. **Frenado orbital (MOI):** mantener presionado o usar la barra espaciadora. La barra de precisión tiene zonas de sobrevuelo (< 0.75), excéntrica (< 0.95), órbita (≤ 1.10) y choque. El resultado sale de `insertionOutcome`.

## 5. Pantalla sin combustible

Aparece si el tanque se vacía antes de lograr la órbita (en la TCM, en un evento o durante el frenado). Muestra:

- masa al despegar, propelente que llevaba y propelente necesario (`propellantFor` con el Δv total del plan);
- por qué pasa, explicado con la ecuación del cohete;
- 3 sugerencias calculadas: cuánta masa seca quitar, cuánto propelente bastaría con propulsión iónica (Isp 1500 s) y cuánto cargar (o aviso si ni el tanque lleno alcanza);
- botones: Volver al Taller, Reintentar travesía y Ver reporte.

## 6. Visualización

- **Marte y Europa:** vista heliocéntrica con la órbita de la Tierra, la del destino y la transferencia de Hohmann. El destino avanza según la 3.ª ley de Kepler.
- **Luna:** vista geocéntrica.
- Al terminar se dibuja la órbita lograda (verde o amarilla), el sobrevuelo o el choque.
- Respeta `prefers-reduced-motion`.

## 7. Constantes para balancear

Todas al inicio de `nivel3/nivel3.js`: `TCM_FRACTION`, `TCM_LATE_FACTOR`, `SKIP_PENALTY`, `RISK_DV`, `BURN_RATE`, `CRUISE_SECONDS`, `TCM_AT` y `EVENT_AT`.

## 8. Cómo probarlo

```bash
python3 -m http.server 8000
# http://localhost:8000/nivel3/  (sin datos → modo demo)
```

Para forzar un caso, en la consola del navegador:

```js
localStorage.setItem('eo-mision', JSON.stringify({ version: 1, missionId: 'moon',
  satellite: { formFactor: 'struct-12u', pieces: ['solar-deploy', 'battery', 'prop-green', 'comm-x', 'adcs', 'obc', 'inst-camera', 'inst-spectro', 'inst-radar'], propellantKg: 2.5 } }));
location.reload(); // satélite pesado → pantalla sin combustible
```
