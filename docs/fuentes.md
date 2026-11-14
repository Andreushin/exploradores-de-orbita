# Fuentes y supuestos (OWNER: Rol 2)

Valores ludificados: conservan el orden de magnitud real pero se ajustan para que cada destino tenga al menos un diseño ganador.

| Dato | Valor en el juego | Referencia |
|---|---|---|
| Masa por unidad U | 1.33 kg/U | CubeSat 101 / CubeSat Design Specification |
| Ecuación del cohete | Δv = Isp · g0 · ln(m0/mf) | GMAT (modelo de maniobras impulsivas) |
| Generación solar | ∝ 1/d² (UA) | Ley del inverso del cuadrado |
| Isp gas frío / monoprop verde / iónico | 70 / 220 / 1500 s | Órdenes de magnitud típicos para CubeSats |
| Inserción Luna / Marte / Europa | 850 / 1200 / 1800 m/s | Ludificado (valores reales de captura mayores en Júpiter) |
| Niveles CML 1–4 | Napkin · Feasibility · Trade space · Point design | NASA Concept Maturity Levels |

## Diseños de referencia (todos válidos con los datos actuales)
- **Luna:** cohete `pico`, `struct-6u`, `solar-body`, `battery`, `prop-green` (2.5 kg), `comm-uhf`, `obc`, `inst-camera`.
- **Marte:** cohete `medio`, `struct-12u`, `solar-deploy`, `solar-body`, `battery`, `prop-green` (6 kg), `comm-x`, `adcs`, `obc`, `inst-camera`, `inst-mag`.
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
