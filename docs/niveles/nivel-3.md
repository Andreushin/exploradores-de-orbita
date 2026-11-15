# Nivel 3 · Travesía e inserción orbital

> Referencia para revisar y mantener el Nivel 3. **Responsable:** @Andreushin · vive en `nivel3/`.
> **Recurso NASA:** [General Mission Analysis Tool (GMAT)](https://software.nasa.gov/software/GSC-19468-1) y [NASA Mission Viz](https://nasa.github.io/mission-viz/).
> **Relacionados:** [`contrato-niveles.md`](../contrato-niveles.md) · [`fuentes.md`](../fuentes.md) · [`nivel-2.md`](nivel-2.md) · [`nivel-4.md`](nivel-4.md)

## Especificación

El jugador **pilota** el CubeSat: gira la nave, enciende el motor y ve cómo cambia su órbita. Lo que aprende sale de lo que hace.

- **Física orbital real en 2D** (`js/orbit-sim.js`): gravedad del cuerpo central, órbita predicha en pantalla y motor con masa variable.
- **Combustible finito:** el motor tiene empuje fijo, así que un CubeSat más pesado acelera menos (a = F / m) y gasta más propelente para el mismo Δv.
- Si el tanque se vacía sin lograr la órbita, aparece una **pantalla de reintento educativo**.
- Estilos aislados en `nivel3.css`. Al terminar, continúa al Nivel 4.

## Índice
1. [Archivos](#1-archivos)
2. [Entrada y salida (contrato)](#2-entrada-y-salida-contrato)
3. [Controles](#3-controles)
4. [Etapas](#4-etapas)
5. [Modelo físico](#5-modelo-físico)
6. [Resultado y estrellas](#6-resultado-y-estrellas)
7. [Pantalla sin combustible](#7-pantalla-sin-combustible)
8. [Constantes para balancear](#8-constantes-para-balancear)
9. [Cómo probarlo](#9-cómo-probarlo)
10. [Pendientes](#10-pendientes)

## 1. Archivos

| Archivo | Qué hace |
|---|---|
| `nivel3/index.html` | Página aislada: header, canvas con objetivo, tarjetas y controles táctiles, HUD, panel y bitácora |
| `nivel3/nivel3.css` | Estilos con prefijo `n3-` y sus propios tokens de la identidad |
| `nivel3/nivel3.js` | Lógica del nivel: etapas, pilotaje, canvas, HUD y persistencia |
| `nivel3/textos.js` | Textos ES/EN (`{ es, en }`, con interpolación `{nombre}`) |
| `js/orbit-sim.js` | Simulador orbital sin DOM (Rol 2): integrador, elementos de la órbita, salida, llegada y resultado de la captura |
| `js/input.js` | Teclado y botones táctiles en un solo estado (compartido) |
| `js/tips.js` | Tarjetas de aprendizaje que salen una vez por partida (compartido) |
| `tests/orbit-sim.test.html` | 26 pruebas del simulador |

Reutiliza, importándolos: `js/physics.js` (`deltaV`, `propellantFor`, masas, Isp), `js/mision-store.js`, `js/campaign.js`, `js/game-ui.js` y `data/{missions,pieces,events}.json`.

## 2. Entrada y salida (contrato)

- **Lee** de `eo-mision`: `missionId` y `satellite` (`formFactor`, `pieces`, `propellantKg`). La masa seca y el Isp se recalculan con las piezas.
- **Modo demo:** si no hay satélite, usa el diseño de referencia de la Luna (`docs/fuentes.md`) y muestra un aviso. Solo escribe ese demo en `eo-mision` si no había nada guardado.
- **Escribe** `journey`, con los mismos campos de siempre:
  - `tcm`: `early` si el rumbo quedó corregido a más de la mitad de la distancia inicial, `late` si fue después, `skip` si no se corrigió.
  - `insertionRatio`: frenado equivalente (energía que perdió la nave frente al frenado nominal en el periapsis objetivo). 1 = nominal.
  - `outcome`: `orbit` | `eccentric` | `flyby` | `crash` | `no-fuel`, leído de la órbita real.
- **Navega** con `levelHref(n)`: "Ver reporte" va al Nivel 4 y "Volver al Taller" al Nivel 2.

## 3. Controles

| Acción | Teclado | Táctil |
|---|---|---|
| Girar | ← → o A D | ⟲ ⟳ |
| Motor | ↑, W o Espacio (mantener) | 🔥 |
| Tiempo ×1 / ×4 / ×16 / ×64 (solo en la llegada) | Z y X | ⏩ |
| Ayuda de orientación: la nave gira sola hacia el rombo | T | 🧭 |
| Confirmar la órbita | Enter | botón sobre el canvas |

Alrededor de la nave hay un anillo con tres marcas: **PRO** (verde, hacia donde se mueve), **RETRO** (naranja, al revés) y un **rombo blanco** que indica hacia dónde conviene empujar. La línea punteada es la órbita que seguirá la nave si no toca nada más; se pone roja si choca y verde cuando la órbita ya está cerrada.

## 4. Etapas

| Etapa | Qué hace el jugador | Qué aprende |
|---|---|---|
| **Presupuesto de Δv** | Lee su masa, propelente, Isp y la tabla de maniobras (estilo GMAT) | La ecuación del cohete antes de volar |
| **Salida** (órbita terrestre a 300 km, motor del cohete) | Apunta a PRO y enciende hasta juntar la energía para llegar al destino | Empujar a favor del movimiento agranda la órbita del lado opuesto. Empujar de lado se desperdicia |
| **Corrección de rumbo** (motor del CubeSat, al 20 %) | Empuja hacia el rombo hasta que el periapsis caiga en el anillo verde | Corregir lejos es barato: cuesta ≈ 4 % del Δv de inserción; cerca cuesta varias veces más |
| **Evento en ruta** (al 70 % de la distancia) | Elige una opción de `data/events.json` | Riesgos reales de una misión |
| **Captura** | Frena en RETRO cerca del periapsis hasta que la órbita se cierre y la confirma | Inserción orbital y efecto Oberth |

- El cohete lleva 20 % más Δv del ideal. Si no alcanza, o si la nave reentra, se repite la salida sin penalización.
- Una salida poco eficiente agranda el error de rumbo inicial (hasta ×1.8).
- El error de rumbo sale al azar hacia uno de dos lados: directo a chocar o demasiado lejos.
- Las tarjetas «Lo que acaba de pasar» aparecen cuando el jugador vive el concepto: primer empuje, corrección lograda, llegada al periapsis, órbita cerrada, satélite pesado y tanque al 25 %.

## 5. Modelo físico

- **Unidades:** km, km/s y s. Valores reales de μ y radio (Tierra, Luna, Marte, Europa) en `BODIES`.
- **Integrador:** Verlet de velocidad. En órbita circular la energía se conserva (prueba incluida).
- **Motor:** cada paso consume `F / (Isp · g₀) · dt` kg y aplica `Δv = Isp · g₀ · ln(m₀ / m₁)`, la misma ecuación de `js/physics.js`.
- **Salida:** la energía objetivo es la de una órbita con apoapsis en la Luna (384 400 km) o un exceso hiperbólico de 2.94 km/s (Marte) y 8.8 km/s (Júpiter). El Δv ideal resulta ≈ 3.1, 3.6 y 6.3 km/s.
- **Llegada:** la nave entra a 22 radios del destino sobre una hipérbola. El periapsis objetivo es 1.15 radios. El frenado nominal en ese punto vale `dvRequired` de `data/missions.json`: en la Luna y Europa deja una órbita circular; en Marte, una elíptica (llegada a 2.6 km/s).
- **Simplificaciones:** un solo cuerpo a la vez (el crucero interplanetario se salta con un corte), empuje del motor fijado por destino y no por tipo de propulsor, y Europa tratada como cuerpo aislado (sin Júpiter).

## 6. Resultado y estrellas

`captureOutcome` lee la órbita:

| Órbita | Resultado |
|---|---|
| El periapsis está bajo la superficie, o la nave la toca | `crash` |
| Trayectoria abierta, o apoapsis a más de 30 radios | `flyby` |
| Cerrada con frenado equivalente < 95 % | `eccentric` |
| Cerrada con frenado equivalente ≥ 95 % | `orbit` |

Las estrellas siguen en `js/campaign.js` (`starsLevel3`): 3 ★ con `orbit` y frenado equivalente entre 96 % y 104 %.

## 7. Pantalla sin combustible

Aparece si el tanque se vacía con la trayectoria todavía abierta. Muestra:

- masa al despegar, propelente que llevaba y propelente necesario (`propellantFor` con el Δv ya gastado más el que faltaba frenar);
- por qué pasa, explicado con la ecuación del cohete;
- sugerencias calculadas: cuánta masa seca quitar, cuánto propelente bastaría con propulsión iónica (Isp 1500 s), cuánto cargar (o aviso si ni el tanque lleno alcanza) y pilotar con menos gasto;
- botones: Volver al Taller, Reintentar travesía y Ver reporte.

## 8. Constantes para balancear

Al inicio de `nivel3/nivel3.js`:

| Constante | Valor | Efecto |
|---|---|---|
| `RATE`, `DEPART_RATE` | 60, 100 | Segundos simulados por segundo real |
| `WARPS` | 1, 4, 16, 64 | Aceleración del tiempo |
| `TURN` | 2.6 rad/s | Velocidad de giro |
| `BURN_SECONDS` + `REF_MASS` | 6 s | El frenado nominal tarda 6 s con el satélite de referencia del destino; de ahí sale el empuje |
| `FINE_THROTTLE` | 0.2 | Empuje lejos del destino, para corregir con pulso fino |
| `STAGE_SECONDS`, `STAGE_MARGIN` | 7 s, 1.2 | Duración del quemado de salida y margen del cohete |
| `TCM_FRACTION`, `TCM_BAND` | 0.04, 0.9–1.2 | Tamaño del error de rumbo y banda donde el periapsis cuenta como corregido |
| `EVENT_AT`, `RISK_DV` | 0.7, 120 m/s | Dónde sale el evento y cuánto cuesta un riesgo cumplido |

En `js/orbit-sim.js`: `TARGET_PERIAPSIS_R`, `ARRIVAL_START_R`, `ESCAPE_LIMIT_R` y `BODIES[...].vInf`.

## 9. Cómo probarlo

```bash
python3 -m http.server 8000
# http://localhost:8000/nivel3/                    (sin datos → modo demo)
# http://localhost:8000/tests/orbit-sim.test.html  (26 PASS)
```

Recorrido sugerido: con la ayuda de orientación (T), mantener el motor en la salida; corregir hacia el rombo; acelerar el tiempo con X; frenar cerca del periapsis y confirmar con Enter.

Para forzar la pantalla sin combustible, en la consola del navegador:

```js
localStorage.setItem('eo-mision', JSON.stringify({ version: 1, missionId: 'moon',
  satellite: { formFactor: 'struct-12u', pieces: ['solar-deploy', 'battery', 'prop-green', 'comm-x', 'adcs', 'obc', 'inst-camera', 'inst-spectro', 'inst-radar'], propellantKg: 2.5 } }));
location.reload();
```

## 10. Pendientes

- [ ] Balancear con jugadores reales: Marte y Europa solo se probaron con un piloto automático de prueba.
- [ ] El propulsor iónico empuja igual que el químico. Si se quiere distinguirlos, agregar `thrustN` a las piezas de propulsión (`data/pieces.json`, Rol 2).
- [ ] Mostrar al fallar dónde se desperdició el Δv (repetición de la trayectoria).
