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
| `nivel3/vuelo.js` | Fase 1: minijuego en primera persona de la nave nodriza en el campo de asteroides (lógica y dibujo) |
| `nivel3/textos.js` | Textos ES/EN (`{ es, en }`, con interpolación `{nombre}`) |

Reutiliza, importándolos: `js/physics.js` (`deltaV`, `propellantFor`, `insertionOutcome`, masas, Isp), `js/mision-store.js`, `js/typewriter.js` (bitácora con máquina de escribir), `simulador/embed.js` (mensajes con el simulador) y `data/{missions,pieces,events}.json`. La página enlaza `css/a11y.css` para la clase `.sr-only`.

## 2. Entrada y salida (contrato)

- **Lee** de `eo-mision`: `missionId`, `satellite` (`formFactor`, `pieces`, `propellantKg`) y `simulation` (`rocketId`, `done`). La masa seca y el Isp se recalculan con las piezas. Si no hay `simulation.rocketId` (partida anterior a este campo), usa el del destino (`missions[].simRocket.id`).
- **Modo demo:** si no hay satélite, usa el diseño de referencia de la Luna (`docs/fuentes.md`) y muestra un aviso. Solo escribe ese demo en `eo-mision` si no había nada guardado. En modo demo el despegue usa el Saturno V y no lee ni escribe `simulation`.
- **Escribe** `simulation`: `locked: true` al abrir el simulador y `done: true` + `result` al llegar a órbita (`{ ok, perigeoKm, apogeoKm, tiempoS, propRestanteKg }`) o al saltarlo (`{ skipped: true }`). Del pilotaje, `simulation.pilot = { done, result }` con `result = { fin, orbita, estrellas, lugares, dvUsado, tiempoS }` o `{ skipped: true }`. **El pilotaje no suma ni resta puntos**: no toca `journey` ni `report`.
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

- **Simuladores a pantalla completa:** el despegue y el pilotaje se abren en un iframe que cubre toda la ventana (`body.n3-fullsim`). El panel del nivel se vuelve una barra flotante abajo a la derecha con el botón ES/EN y la acción (saltar / continuar); su título y explicación quedan solo para lectores de pantalla. En móvil la barra muestra solo iconos.
- **Despegue (simulador de cohetes reales):** lo primero al entrar. Un iframe abre `../simulador/?rocket=<simulation.rocketId>&lock=1&embed=1`: el cohete es el que fijó el Nivel 1 según el destino (Luna → Saturno V, Marte → Atlas-Agena D, Europa → Falcon Heavy) y **no se puede cambiar** (sin pestañas de otros cohetes). El jugador pulsa ▶ Lanzar; cuando el cohete llega a órbita, el simulador manda `eo:sim-done` por `postMessage` (mismo origen) y, tras 2,5 s (`SIM_EXIT_MS`), el iframe se cierra (libera su WebGL) y aparece el campo de asteroides. Si el lanzamiento falla, no avisa: se reinicia dentro del simulador. "Saltar el despegue" pasa directo a los asteroides. Con `simulation.done` ya en `true` (recarga, vuelta desde el Taller) se salta. El botón ES/EN de la página también cambia el idioma del simulador (`eo:sim-lang`).
0. **Campo de asteroides (nave nodriza, primera persona):** antes del presupuesto, el jugador pilota desde la cabina la nave que lleva el CubeSat hasta el punto de despliegue (25 s). Se maneja con flechas/WASD o moviendo el ratón o el dedo sobre el canvas; la retícula marca el tamaño de la nave y el radar marca en rojo las rocas que vienen hacia ella. El escudo aguanta 5 impactos: si se agota, se puede reintentar o saltar al despliegue. Al superarlo, el cartel se muestra 3 s (`PILOT_ENTER_MS`) y pasa solo, sin botón, al pilotaje orbital; "Saltar al despliegue" entra al pilotaje de inmediato. **No gasta propelente del satélite ni cambia `journey`**; solo deja una línea en la bitácora. "Reintentar travesía" vuelve al presupuesto, no a los asteroides.
- **Pilotaje orbital (simulador de pilotaje):** el iframe abre `../simulador/pilotaje/?destino=<missions[].simRocket.destino>&lock=1&embed=1` (Luna, Marte o Europa, con el mismo cohete del despegue). La misión no se puede cambiar: sin pestañas ni tarjetas de otras misiones ni "siguiente misión". El jugador captura la órbita y observa los lugares; al pulsar "📊 Ver Informe Final" o "🏁 Concluir" aparece el informe con "Continuar la misión" y "Repetir misión" (también tras un choque o escape) y la nota de que esta etapa es importante pero **no suma ni resta puntos**. "Continuar la misión" manda `eo:pil-done` y el Nivel 3 cierra el iframe y abre el presupuesto. "Saltar el pilotaje" (en el panel) hace lo mismo. El recorrido del pilotaje empieza lejos (a 3,5–4 radios del destino, su llegada natural): se ve la Luna, Marte o Europa completos detrás del cohete y el tiempo corre rápido (hasta ×300) para que en ~20 s se acerque al punto de frenado, donde baja a ×8 y la cámara pasa a la vista de persecución (`simulador/pilotaje/cabina.js` → `ESCALA_LLEGADA_*`, `cuerpos.js` → `LEJOS_R`/`CERCA_R`). Con `simulation.pilot.done` en `true`, tras los asteroides se va directo al presupuesto.
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
- **Luna:** vista geocéntrica, con la nave nodriza al centro.
- En Marte y Europa la nave nodriza queda dibujada en el punto de despliegue, de donde sale el CubeSat.
- **Fase 1 (asteroides):** cabina en primera persona con estelas de estrellas, rocas en perspectiva, radar y barras de escudo y avance. Con `prefers-reduced-motion` no hay sacudida, giro ni estelas.
- Al terminar se dibuja la órbita lograda (verde o amarilla), el sobrevuelo o el choque.
- **Bitácora:** cada línea se escribe en orden con `js/typewriter.js` (≤ 0,8 s por línea, cursor `▋` mientras escribe). El texto completo va en un `<span class="sr-only">` para lectores de pantalla y la copia animada lleva `aria-hidden="true"`. Con `prefers-reduced-motion` la línea sale completa. «Reintentar travesía» vacía la bitácora y la cola.
- Respeta `prefers-reduced-motion`.

## 7. Constantes para balancear

Todas al inicio de `nivel3/nivel3.js`: `TCM_FRACTION`, `TCM_LATE_FACTOR`, `SKIP_PENALTY`, `RISK_DV`, `BURN_RATE`, `CRUISE_SECONDS`, `TCM_AT` y `EVENT_AT`.

Las del campo de asteroides están al inicio de `nivel3/vuelo.js`: `FLIGHT_SECONDS`, `FLIGHT_HITS`, `SPEED0`/`SPEED1`, `SPAWN0`/`SPAWN1` y `AIMED` (fracción de rocas que van directo a la nave). Con los valores actuales, quedarse quieto siempre pierde y esquivar con el radar gana con ≈1 impacto.

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
