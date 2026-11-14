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
