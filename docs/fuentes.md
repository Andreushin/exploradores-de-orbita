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

## Diseños de referencia (todos válidos con los datos actuales)
- **Luna:** cohete `pico`, `struct-6u`, `solar-body`, `battery`, `prop-green` (2.5 kg), `comm-uhf`, `obc`, `inst-camera`.
- **Marte:** cohete `medio`, `struct-12u`, `solar-deploy`, `solar-body`, `battery`, `prop-green` (6 kg), `comm-x`, `adcs`, `obc`, `inst-camera`, `inst-mag`.
- **Europa:** cohete `pesado`, `struct-12u`, `rtg-mini`, `solar-deploy`, `prop-ion` (1.5 kg), `comm-x`, `obc`, `inst-mag`, `inst-camera`.

Si cambias datos, verifica que estos diseños sigan pasando en `tests/physics.test.html`.
