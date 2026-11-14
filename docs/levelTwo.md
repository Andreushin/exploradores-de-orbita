# Nivel 2 · Taller del CubeSat

> Referencia para revisar y mantener el Nivel 2. **Owner:** Rol 3.
> **Recurso NASA:** CubeSat 101 — *Basic Concepts and Processes for First-Time CubeSat Developers*.
> **Inspiración UX:** *A Learning Game About Telescopes* (opciones incompatibles en gris con su explicación).
> **Relacionados:** [`levelOne.md`](levelOne.md) · [`context.md`](context.md) · [`fuentes.md`](fuentes.md)

## Índice
1. [Resumen](#1-resumen)
2. [Qué ve el jugador](#2-qué-ve-el-jugador)
3. [Reglas: ¿puede lanzar?](#3-reglas-puede-lanzar)
4. [Instrumentos según el objetivo científico](#4-instrumentos-según-el-objetivo-científico)
5. [Datos que lee y guarda](#5-datos-que-lee-y-guarda)
6. [Archivos](#6-archivos)
7. [Cómo probar](#7-cómo-probar)
8. [Cómo ajustarlo](#8-cómo-ajustarlo)
9. [Decisiones de diseño](#9-decisiones-de-diseño)
10. [Pendientes](#10-pendientes)

---

## 1. Resumen

| | |
|---|---|
| **Qué enseña** | La ciencia elegida dicta qué instrumentos sirven, y la masa, la energía y el presupuesto limitan lo que se puede llevar. |
| **Qué hace el jugador** | Elige estructura (3U / 6U / 12U), energía, propulsión, radio, control de actitud, computadora e instrumentos, y carga el propelente. |
| **Cómo gana** | Pasa las 11 verificaciones de `physics.validateDesign` → **🚀 Lanzar**. |
| **Cómo entra** | Desde el Nivel 1 validado (**Siguiente: Taller del CubeSat**) o **☰ Niveles → Nivel 2**. |
| **Cómo sale** | **🚀 Lanzar** guarda `journey.dvAvailable` y abre el Nivel 3 (Travesía). |

---

## 2. Qué ve el jugador

- **Objetivo científico** del Nivel 1 en el encabezado (🎯), con el aviso de que los instrumentos que no sirven aparecen en gris.
- **Catálogo por categoría.** Cada pieza muestra masa en gramos, volumen en U, energía, costo y TRL.
  - **Estructuras:** su descripción y su masa máxima (`U × 1.33 kg`, CubeSat 101).
  - **Instrumentos:** ✔ por qué sirve, o ✘ por qué no sirve, en gris y deshabilitado.
- **Slider de propelente**, si hay propulsión.
- **4 medidores en vivo** (`role="meter"`). Se actualizan al agregar o quitar piezas y **mientras se arrastra** el propelente:

| Medidor | Muestra | Verde | Amarillo | Rojo |
|---|---|---|---|---|
| Δv | Δv contra el requerido (con línea) | ≥ 110 % del requerido | 100–110 % ("margen justo") | < requerido |
| Masa | g contra el límite que manda | < 85 % | 85–100 % | > 100 % |
| Energía | consumo contra generación | < 85 % | 85–100 % | > 100 %, o generación menor al mínimo del destino |
| Costo | costo contra el segmento Espacio | < 85 % | 85–100 % | > 100 % |

- **Aviso del cohete:** si la masa supera la carga útil del cohete del Nivel 1, y ese es el límite que manda, aparece "🚫 … solo lleva N g: así no podrá despegar".
- **Lista de verificaciones** (✔ / ✘) y botones **Atrás** / **🚀 Lanzar**.

---

## 3. Reglas: ¿puede lanzar?

**🚀 Lanzar** solo se habilita si pasan las 11 verificaciones de `validateDesign` (`js/physics.js`, Rol 2):

| Verificación | Regla |
|---|---|
| Estructura | Hay un factor de forma |
| Computadora | Hay OBC |
| Masa | Masa húmeda ≤ `min(U × 1.33 kg, carga útil del cohete)` |
| Volumen | Las piezas caben en las U |
| Energía | Genera ≥ consumo y ≥ el mínimo del destino (solar ∝ 1/d²) |
| Batería | Si hay quemados químicos, lleva batería |
| Radio | Alcance ≥ dificultad de comunicaciones del destino |
| Propelente | Hay propulsión y el propelente no supera su máximo |
| Δv | Δv (Tsiolkovsky) ≥ requerido para la inserción |
| Costo | Costo ≤ `budget.space` del Nivel 1 |
| Ciencia | Al menos un instrumento |

Los instrumentos incompatibles con el objetivo **no se pueden elegir**. Si el objetivo cambia, se quitan al volver a entrar.

---

## 4. Instrumentos según el objetivo científico

Lo define `data/workshop.json → instrumentFit[missionId][scienceTargetIdx]`. Cada entrada lleva `ok` y la razón `why` en ES y EN.

| Destino · objetivo | Sirven | No sirven | Referencias |
|---|---|---|---|
| Luna · hielo en cráteres polares | cámara, espectrómetro, radar | magnetómetro | ShadowCam, M3 (Chandrayaan-1), Mini-RF (LRO) |
| Luna · mapeo de regolito | cámara, espectrómetro, radar | magnetómetro | LROC |
| Marte · metano atmosférico | espectrómetro | cámara, magnetómetro, radar | Trace Gas Orbiter |
| Marte · campo magnético remanente | magnetómetro | cámara, espectrómetro, radar | Mars Global Surveyor, MAVEN |
| Europa · océano bajo el hielo | magnetómetro, radar, cámara | espectrómetro | Galileo, REASON y EIS (Europa Clipper) |
| Europa · plumas de vapor | espectrómetro, cámara, magnetómetro | radar | Hubble, Galileo |

Sin objetivo elegido (`plan.scienceTargetIdx == null`), todo es compatible. Así no se rompen partidas guardadas antes de este cambio.

---

## 5. Datos que lee y guarda

| Lee | De | Para |
|---|---|---|
| `missionId`, `plan.scienceTargetIdx` | Nivel 1 | Requisitos del destino y compatibilidad de instrumentos |
| `rocketId` | Nivel 1 | Carga útil (límite de masa y aviso del cohete) |
| `budget.space` | Nivel 1 | Límite de costo |

| Escribe | Contenido |
|---|---|
| `satellite.formFactor` | Id de la estructura |
| `satellite.pieces` | Ids de las piezas (quita los instrumentos incompatibles al entrar) |
| `satellite.propellantKg` | Propelente cargado |
| `journey.dvAvailable` (al lanzar) | Δv del diseño. Desbloquea el Nivel 3 (`js/levels.js`) |

---

## 6. Archivos

| Archivo | Responsabilidad |
|---|---|
| `js/screens/workshop.js` | UI del taller. Funciones puras exportadas: `limitLevel`, `dvLevel`, `meterData`, `rocketOverload`, `instrumentStatus`, `incompatibleSelected` |
| `css/screens/workshop.css` | Catálogo, medidores, instrumentos en gris, encabezado del objetivo |
| `data/workshop.json` | Compatibilidad instrumento ↔ objetivo y descripción de 3U / 6U / 12U |
| `data/i18n/{es,en}/workshop.json` | Textos |
| `data/pieces.json`, `js/physics.js` | Piezas y reglas físicas (Rol 2) |

---

## 7. Cómo probar

```bash
python3 -m http.server 8000
# Juego:   http://localhost:8000
# Pruebas: http://localhost:8000/tests/physics.test.html
```

Recorrido manual sugerido (en ES y EN, escritorio y 360 px):
1. Completa el Nivel 1 con **Marte · metano** y entra al Taller. Solo el espectrómetro está activo, y el resto aparece en gris con su razón.
2. Vuelve al Nivel 1, cambia a **campo magnético** y regresa. Si tenías el espectrómetro, se quita y aparece el aviso.
3. Arrastra el propelente sin soltar: Δv y Masa cambian en vivo. Por debajo del requerido, Δv se pone rojo.
4. Con el **Colibrí** y una estructura **12U** cargada, aparece el aviso del cohete y Lanzar queda deshabilitado.
5. Arma un diseño de referencia (`docs/fuentes.md`) → **🚀 Lanzar** abre la Travesía.

---

## 8. Cómo ajustarlo

| Quiero… | Edito |
|---|---|
| Cambiar qué instrumento sirve para un objetivo | `data/workshop.json → instrumentFit` (`ok` + `why` en ES y EN) |
| Agregar un objetivo a un destino | `missions.json → scienceTargets` (Rol 2) **y** una entrada en el mismo índice de `instrumentFit` |
| Agregar un instrumento | `pieces.json` (Rol 2) **y** su entrada en cada objetivo de `instrumentFit` |
| Cambiar los cortes de color | `WARN_AT` y `DV_MARGIN` en `js/screens/workshop.js` |
| Cambiar la descripción de las estructuras | `data/workshop.json → formFactors` |

---

## 9. Decisiones de diseño

- **Integrado en el sistema de niveles, no en una carpeta `nivel2/` aislada.** El borrador de la especificación pedía un `index.html` propio con `localStorage`. Se descartó por la misma razón que en el Nivel 1: el router, el estado compartido, el desbloqueo de niveles y el E2E dependen de que cada nivel sea una pantalla (`js/levels.js`).
- **3U / 6U / 12U, no 1U / 3U / 6U.** Los diseños viables de Marte y Europa necesitan 12U. Quitar 12U obligaría a rebalancear `pieces.json` (Rol 2) y los diseños de referencia.
- **La compatibilidad la decide el objetivo científico.** Es la decisión del Nivel 1 que mejor muestra que "la ciencia dicta la ingeniería".
- **Las incompatibilidades se basan en misiones reales**, para que la razón en gris enseñe algo concreto (por ejemplo, Galileo detectó el océano de Europa con un magnetómetro).
- **Masa en gramos:** las piezas de un CubeSat pesan cientos de gramos, y en kg se leían casi iguales.
- **Medidores con `role="meter"`, nunca `slider`:** el E2E busca el único slider del taller (el propelente).
- **Accesibilidad:**
  - cada estado se muestra con color **y** con ícono o texto (✔ / ✘, "margen justo");
  - la razón del gris va asociada con `aria-describedby`;
  - el aviso del cohete usa `role="alert"`.

---

## 10. Pendientes

- [ ] **E2E:** los diseños de referencia (`e2e/checkpoint.spec.mjs → REFERENCE`, Rol 1) deben elegir objetivo e instrumentos compatibles. Por ejemplo, Marte con cámara + magnetómetro no sirve para ningún objetivo de Marte: usar magnetómetro con "campo magnético", o espectrómetro con "metano".
- [ ] Prueba visual en navegador real (escritorio y celular, ES y EN).
- [ ] #15: vista del CubeSat ensamblado con las U ocupadas.
- [ ] #16: tooltips de CubeSat 101 por subsistema. Este nivel ya cubre instrumentos y estructuras.
