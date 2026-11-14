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

## Nivel 1 · Tarjetas por segmento (`data/segments.json`, reglas en `js/budget.js`)

Los 4 segmentos vienen de *Design and Develop Science Missions*. Cada segmento ofrece 3 tarjetas (nivel 1–3). Los costos salen de los propios datos del juego, no son arbitrarios:

| Segmento | Tarjetas (M$) | De dónde sale |
|---|---|---|
| Lanzamiento | 25 / 45 / 80 | `rockets.json` (nivel = orden por costo; cumple si el destino está en `destinations`) |
| Espacio | 25 / 50 / 75 | Cubren los diseños de referencia de arriba (22 / 45 / 69 M$) con poco margen |
| Tierra | 8 / 15 / 25 | Nivel exigido = `commsDifficulty`; 25 M$ es donde `scienceScore` satura el factor Tierra |
| Usuario | 5 / 8 / 12 | Siempre ≤ 15 M$, donde `scienceScore` satura el factor Usuario |

Reglas (ludificadas): nivel menor al exigido → bloquea. Por encima del exigido se tolera un margen (Lanzamiento 0, Espacio 1, Tierra 1, Usuario 2); más allá resta 15 pts por nivel. Pasarse del presupuesto bloquea y resta 1 pt por M$ (máx. 40). Madurez = 100 − penalización → tope de CML: ≥90 → 4, ≥65 → 3, ≥40 → 2, si no 1. Detalle en `docs/levelOne.md`; escenarios en `tests/budget.test.html`.
