# Fuentes y supuestos (OWNER: Rol 2)

Valores ludificados: conservan el orden de magnitud real pero se ajustan para que cada destino tenga al menos un diseño ganador.

## Puntaje científico y CML
`scienceScore` (js/physics.js) da de 0 a 100:

**puntaje = (40 + instrumentos) × resultado × Tierra × Usuario** (con tope de 100)

- **Instrumentos:** los `scienceValue` se ordenan de mayor a menor y se multiplican por 1 · 0.6 · 0.4 · 0.25 (`INSTRUMENT_WEIGHTS`). Cada instrumento extra suma, pero menos que el anterior (rendimientos decrecientes, como cuando varios instrumentos comparten masa, energía y enlace de datos).
- **Resultado de la inserción:** órbita estable 1 · excéntrica 0.5 · sobrevuelo 0.15 · choque 0.
- **Tierra y Usuario** (segmentos de *Design and Develop Science Missions*): cada uno va de 0.6 sin inversión a 1, de forma lineal, hasta $40M en Tierra (antenas y tiempo de DSN) y $30M en Usuario (procesamiento, calibración y archivo PDS). Sin estos segmentos, los datos se pierden o no se aprovechan.
- Después, el Reporte suma las penalizaciones de los eventos (por ejemplo, modo seguro −10).

`computeCML` (NASA Concept Maturity Levels):

| CML | Condición |
|---|---|
| 1 · Concepto | El diseño no cumple las restricciones |
| 2 · Factibilidad | Diseño válido, pero sobrevuelo o choque |
| 3 · Trade space | En órbita, pero excéntrica o con ciencia < 50 (`CML4_MIN_SCORE`) |
| 4 · Diseño puntual | Órbita estable y ciencia ≥ 50 |

Con el reparto inicial del presupuesto, los diseños de referencia en órbita estable dan: Luna 39 (CML 3), Marte 56 (CML 4) y Europa 71 (CML 4). En la Luna se llega a CML 4 pasando a Tierra y Usuario el dinero que sobra de Lanzamiento y Espacio (por ejemplo 25 / 25 / 30 / 20 → 55 puntos). Pruebas: `tests/science.test.html`.

| Dato | Valor en el juego | Referencia |
|---|---|---|
| Masa por unidad U | 1.33 kg/U | CubeSat 101 / CubeSat Design Specification |
| Ecuación del cohete | Δv = Isp · g0 · ln(m0/mf) | GMAT (modelo de maniobras impulsivas) |
| Generación solar | ∝ 1/d² (UA) | Ley del inverso del cuadrado |
| Isp gas frío / monoprop verde / iónico | 70 / 220 / 1500 s | Órdenes de magnitud típicos para CubeSats |
| Inserción Luna / Marte / Europa | 850 / 1200 / 1800 m/s | Ludificado (valores reales de captura mayores en Júpiter) |
| Niveles CML 1–4 | Napkin · Feasibility · Trade space · Point design | NASA Concept Maturity Levels |

## Piezas (CubeSat 101 / SmallSat SOA)
Fuentes generales:
- NASA, *CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers* (2017): unidades U, 1.33 kg/U y subsistemas típicos.
- NASA Ames, *State-of-the-Art of Small Spacecraft Technology* (SOA): rangos de masa, potencia y TRL por subsistema.

Masa, potencia y TRL tienen orden de magnitud real. El **costo** está ludificado en $M (desarrollo + integración), pero conserva el orden relativo de precios reales: UHF, OBC y batería son lo más barato; espectrómetro, radar, iónico y RTG lo más caro.

| Pieza | Masa | Potencia | TRL | Referencia |
|---|---|---|---|---|
| `struct-3u` / `6u` / `12u` | 0.4 / 1.1 / 2.0 kg | — | 9 | SOA, cap. Estructuras: estructuras comerciales 3U de 0.3–0.5 kg, 6U ~1 kg y 12U ~2 kg |
| `solar-body` | 0.3 kg | +8 W a 1 UA | 9 | CubeSat 101 / SOA, cap. Energía: paneles fijos de 3U–6U entregan ~7–10 W |
| `solar-deploy` | 0.9 kg | +36 W a 1 UA | 9 | Alas desplegables de MarCO (~35 W, volaron en 2018) |
| `battery` | 0.5 kg | — | 9 | Ion-litio a ~150 Wh/kg → 80 Wh ≈ 0.5 kg |
| `rtg-mini` | 3.0 kg | +35 W | 4 | **Ludificado.** No hay RTG para CubeSat. El MMRTG da ~2 W/kg, así que 35 W reales pesarían más de 10 kg |
| `prop-cold` | 1.0 kg | 2 W (en quemados) | 9 | SOA, cap. Propulsión: gas frío de 40–70 s de Isp (sistema de MarCO) |
| `prop-green` | 1.5 kg + 7 kg máx. | 10 W (precalentado) | 7 | AF-M315E / ASCENT (GPIM, Lunar Flashlight), Isp ~220 s. **Ludificado:** 7 kg de propelente no caben en 3U reales |
| `prop-ion` | 2.0 kg | 20 W | 6 | Electrospray/iónico para CubeSat (Accion TILE, Enpulsion IFM): Isp 1000–2000 s, 10–30 W |
| `comm-uhf` | 0.2 kg | 2 W | 9 | Transceptores UHF comerciales (~0.1–0.2 kg, ~4 W al transmitir) |
| `comm-x` | 1.2 kg | 8 W (promedio) | 9 | JPL Iris v2 (MarCO): 1.2 kg, 0.5U. Gasta más al transmitir; 8 W es el promedio por ciclo de trabajo |
| `adcs` | 0.9 kg | 3 W | 9 | BCT XACT: ~0.9 kg, 0.5U, ~3 W (voló en MarCO) |
| `obc` | 0.2 kg | 1 W | 9 | SOA, cap. Aviónica: OBC comerciales de 0.1–0.2 kg y menos de 1 W |
| `inst-camera` | 0.6 kg | 4 W | 8 | Cámaras multiespectrales para CubeSat (0.5–1 kg, 3–5 W) |
| `inst-spectro` | 1.5 kg | 10 W | 6 | BIRCHES (Lunar IceCube): espectrómetro IR de ~1.5U con criocooler |
| `inst-mag` | 0.3 kg | 1 W | 9 | Magnetómetros fluxgate para CubeSat (0.1–0.3 kg, menos de 1 W) |
| `inst-radar` | 2.5 kg | 25 W | 5 | RainCube (radar Ka en 6U, ~20+ W). Un radar penetrante para CubeSat sigue en concepto |

## Diseños de referencia (todos válidos con los datos actuales)
- **Luna:** cohete `pico`, `struct-6u`, `solar-body`, `battery`, `prop-green` (2.5 kg), `comm-uhf`, `obc`, `inst-camera`.
- **Marte:** cohete `medio`, `struct-12u`, `solar-deploy`, `solar-body`, `battery`, `prop-green` (7 kg), `comm-x`, `adcs`, `obc`, `inst-camera`, `inst-mag`.
- **Europa:** cohete `pesado`, `struct-12u`, `rtg-mini`, `solar-deploy`, `prop-ion` (1.5 kg), `comm-x`, `obc`, `inst-mag`, `inst-camera`.

Si cambias datos, verifica que estos diseños sigan pasando en `tests/physics.test.html`.

## Destinos: Δv de inserción (GMAT / NASA Mission Viz)
El juego modela la inserción como **un solo quemado impulsivo** de frenado al llegar (como una maniobra `ImpulsiveBurn` de GMAT). El cohete ya dejó al CubeSat en la trayectoria de transferencia, así que ese Δv no lo paga el satélite.

| Destino | `dvRequired` | Referencia real | Supuesto del juego |
|---|---|---|---|
| Luna | 850 m/s | Captura en órbita lunar desde una transferencia directa: ~0.8–0.9 km/s | Valor real |
| Marte | 1200 m/s | MAVEN (2014): inserción de ~1.2 km/s en órbita elíptica, sin aerofrenado | Valor real (órbita elíptica) |
| Europa | 1800 m/s | Juno (2016): inserción en Júpiter de ~0.54 km/s. Pasar luego a órbita de Europa cuesta varios km/s más, aunque se usen asistencias gravitatorias | **Ludificado:** JOI + captura en Europa resumidos en un solo quemado, menor que el real, para que un CubeSat pueda lograrlo |

`travelDays` (5 / 210 / 2200) sigue los tiempos típicos: unos días a la Luna con transferencia directa (Apolo ~3), ~7 meses a Marte (MarCO, 2018) y ~5.5 años a Júpiter con asistencias (Europa Clipper: lanzamiento en 2024, llegada en 2030).

## Cohetes: alcance por destino
`destinations` dice qué energía de escape (C3) puede dar cada cohete. `maxPayloadKg` limita la masa total del CubeSat junto con 1.33 kg/U (gana el menor).

| Cohete | Destinos | Carga máx. | Referencia real |
|---|---|---|---|
| `pico` (Colibrí) | Luna | 15 kg | Electron + Photon lunar llevó a CAPSTONE (12U, ~25 kg) a la Luna en 2022 |
| `medio` (Cóndor, rideshare) | Luna, Marte | 30 kg | MarCO-A/B (6U, ~13.5 kg c/u) viajaron como carga secundaria del Atlas V de InSight hacia Marte en 2018 |
| `pesado` (Quetzal) | Luna, Marte, Europa | 60 kg | Para llegar a Júpiter hace falta un C3 muy alto: Europa Clipper usó un Falcon Heavy sin recuperación de etapas más asistencias de Marte y la Tierra |

Notas:
- Solo el `pico` limita de verdad la masa (15 kg < 12U × 1.33 = 15.96 kg). En los demás manda el límite por U.
- Cada destino tiene al menos un diseño ganador (ver «Diseños de referencia»), verificado en `tests/physics.test.html`.
- Los nombres de los cohetes son ficticios; costos y confiabilidad están ludificados.
