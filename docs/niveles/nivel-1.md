# Nivel 1 · Diseña tu misión

> Referencia para revisar y mantener el Nivel 1. **Responsable:** @AslanCM · vive en la app principal (`js/screens/mission.js`).
> **Recurso NASA:** Design and Develop Science Missions (DDSM).
> **Relacionados:** [`fuentes.md`](../fuentes.md)

## Índice
1. [Resumen](#1-resumen)
2. [Flujo por pasos](#2-flujo-por-pasos)
3. [Fondos interactivos](#3-fondos-interactivos)
4. [Reglas: ¿pasa o no pasa?](#4-reglas-pasa-o-no-pasa)
5. [Datos que guarda](#5-datos-que-guarda)
6. [Archivos](#6-archivos)
7. [Cómo probar](#7-cómo-probar)
8. [Cómo ajustarlo](#8-cómo-ajustarlo)
9. [Decisiones de diseño](#9-decisiones-de-diseño)
10. [Pendientes](#10-pendientes)

---

## 1. Resumen

| | |
|---|---|
| **Qué enseña** | Los requerimientos científicos dictan la ingeniería y el presupuesto. |
| **Qué hace el jugador** | Define su proyecto y, paso a paso, elige una tarjeta para cada segmento de la misión (Lanzamiento, Espacio, Tierra, Usuario). |
| **Cómo gana** | Cubre lo que exige el destino sin pasarse del presupuesto. Si elige de más sin justificación, pierde madurez (CML). |
| **Cómo entra** | Botón **Comenzar** del inicio, o **☰ Niveles → Nivel 1**. |
| **Cómo sale** | **Siguiente: Taller del CubeSat** (desbloquea el Nivel 2). |

---

## 2. Flujo por pasos

En la parte superior hay un bloque fijo con:
- la **barra de pasos**: se puede volver a cualquier paso abierto; ✔ marca los resueltos;
- la **barra de presupuesto**: máximo en USD, asignado, disponible (en rojo si es negativo) y madurez CML.

| # | Paso | Qué hace el jugador | Para avanzar |
|---|---|---|---|
| 1 | 🪐 **Proyecto** | Nombre, destino (fija el presupuesto máximo: 100 / 160 / 230 M$) y objetivo científico. Ve lo que exige el destino (Δv, luz solar, potencia, viaje y nivel mínimo por segmento). | Nombre + destino + objetivo |
| 2 | 🚀 **Lanzamiento** | Elige el cohete. | Tarjeta que llegue al destino |
| 3 | 🛰️ **Espacio** | Elige la clase de nave. | Tarjeta de nivel suficiente |
| 4 | 📡 **Tierra** | Elige la red de antenas. | Tarjeta de nivel suficiente |
| 5 | 🧪 **Usuario** | Elige el enfoque de datos. | Cualquier tarjeta |
| 6 | ✅ **Revisión** | Ve los 4 segmentos, las alertas y puede **Cambiar** cualquiera. | Misión sin bloqueos → **Taller** |

En los pasos 2 a 5 se mantiene la **lista de la categoría**:
- **Opciones disponibles** (izquierda): las 3 tarjetas del segmento. Cada una tiene un botón **`?`** con «Qué se tiene en cuenta» y «Qué NO se debe hacer».
- **Misión configurada** (panel lateral derecho, plegable):
  - la ranura del segmento;
  - la retroalimentación inmediata (✔ justo / ✔ con margen / ▲ sobra / ✘ no alcanza);
  - un mini resumen de la misión, donde cada fila lleva a su paso.
  - **Se recoge** con **Colapsar ›**, con `Esc` o con un clic fuera del panel. Queda una pestaña en el borde derecho con lo asignado (`$25M Asignado`); un clic en ella lo vuelve a sacar. Recuerda si estaba abierto o recogido al cambiar de paso, pero **cada vez que se entra al Nivel 1 (primera vez, Continuar o tras Reiniciar) empieza abierto**. Al arrastrar una tarjeta del banco se abre solo, porque es el destino del arrastre.
- **Interacción:** arrastrar y soltar, o un clic en cualquier parte de la tarjeta del banco (menos en el `?`, que abre su información). Las tarjetas del banco **no tienen botón «Añadir»**: con teclado se llega a la tarjeta con Tab y se añade con Enter o Espacio. **← Quitar** (solo en la tarjeta ya colocada) la devuelve al banco. Todo funciona en celular. Soltar otra tarjeta reemplaza la anterior.

**Navegación:** **← Anterior** / **Siguiente: {paso} →**. Si no se puede avanzar, un texto explica por qué. Los pasos 2 a 5 se abren al completar el Proyecto; la Revisión se abre cuando hay una tarjeta en cada segmento.

---

## 3. Fondos interactivos

Cada paso tiene su escena (SVG + CSS) detrás del contenido. Las escenas cambian con un fundido y **reaccionan a la tarjeta elegida** (su nivel 1–3):

| Paso | Escena | Reacción |
|---|---|---|
| Proyecto | Nebulosa con el planeta destino | El planeta toma el color del destino elegido |
| Lanzamiento | Rampa al amanecer | El cohete aparece y crece según su tamaño; enciende motores y humo |
| Espacio | El CubeSat orbitando la Tierra | Nivel 2 agrega paneles y antena; nivel 3, el RTG brillante |
| Tierra | Antena de noche, a la derecha | Una sola antena que crece de pequeña a grande (nivel 1 → 3) y emite ondas de señal |
| Usuario | Centro de datos | Panel de datos crudos → curva calibrada → barras de análisis |
| Revisión | Trayectoria Tierra → destino | Una nave recorre la ruta |

**Tinte del fondo** según la elección: 🔴 rojo = no alcanza · 🟠 ámbar = sobredimensionado · 🟢 verde = bien.

Con **movimiento reducido** (preferencia del sistema) las escenas quedan estáticas, pero siguen mostrando el estado final de cada nivel.

---

## 4. Reglas: ¿pasa o no pasa?

### 4.1 Nivel exigido por segmento
Cada tarjeta tiene un **nivel** (1–3). El destino exige un mínimo, y se tolera un margen por encima:

| Segmento | Nivel exigido | Margen sin penalización |
|---|---|---|
| Lanzamiento | El destino debe estar en `rockets.json → destinations` | 0 (un cohete mayor no aporta nada) |
| Espacio | `segments.json → requirements.space` (Luna 1, Marte 2, Europa 3) | 1 |
| Tierra | `missions.json → commsDifficulty` | 1 |
| Usuario | `segments.json → requirements.user` (hoy 1) | 2 (elegir más es un trade-off científico válido) |

### 4.2 Estado de cada segmento

| Estado | Cuándo | Efecto |
|---|---|---|
| ○ Vacío | Sin tarjeta | **Bloquea** |
| ✘ Insuficiente | Nivel menor o cohete que no llega | **Bloquea** (riesgo de fallo técnico) |
| ✔ Justo lo necesario | Nivel = exigido | Sin efecto |
| ✔ Con margen | Por encima, dentro del margen | Sin efecto |
| ▲ Sobredimensionado | Por encima del margen | Pasa, pero resta **15 pts por nivel extra** |

### 4.3 Presupuesto y madurez
- **Exceso de presupuesto:** **bloquea** y resta 1 pt por M$ excedido (máx. 40).
- **Madurez inicial** = 100 − penalización. Fija el **tope de CML**: ≥90 → 4 · ≥65 → 3 · ≥40 → 2 · resto → 1.

### 4.4 Ejemplos (verificados en las pruebas)

| Configuración | Resultado |
|---|---|
| Luna: Colibrí + nave cercana + UHF + estándar ($66M / $100M) | ✅ Pasa · CML 4 |
| Luna con el Cóndor (rideshare) | ✅ Pasa · −15 → CML 3 |
| Luna con todo al máximo ($192M) | ⛔ Excede presupuesto · CML 1 |
| Marte con el Colibrí | ⛔ El cohete no llega |
| Europa sin segmento Tierra | ⛔ Falta un segmento |

---

## 5. Datos que guarda

`js/screens/mission.js` escribe en el estado global (`js/state.js`):

| Campo | Contenido | Lo usa |
|---|---|---|
| `missionId` | Destino | Todos los niveles |
| `rocketId` | Igual a `plan.cards.launch` | Taller (carga útil en `validateDesign`) |
| `budget.total` | Presupuesto máximo del destino | Encabezado |
| `budget.{launch,space,ground,user}` | Costo de cada tarjeta | Taller (`budget.space` = dinero para piezas), `scienceScore` |
| `plan.step` | Paso actual (0–5) | Volver al mismo paso al regresar al nivel |
| `plan.projectName`, `plan.scienceTargetIdx` | Identidad y objetivo | Selector de niveles, reporte |
| `plan.cards` | Id de la tarjeta por segmento | Nivel 1 |
| `plan.maturity`, `plan.penalty`, `plan.cmlCap` | Madurez inicial y tope de CML | Reporte (**pendiente**, ver §10) |
| `plan.validated` | `true` al pasar al Taller | Desbloquea el Nivel 2 (`js/levels.js`) |

Volver a abrir el nivel **no** invalida la misión. Solo un cambio real (nombre, destino, objetivo o tarjetas) pone `validated` en `false`.

---

## 6. Archivos

| Archivo | Responsabilidad |
|---|---|
| `js/screens/mission.js` | UI del asistente: pasos, tarjetas, arrastrar y soltar, ventanas `?`, navegación |
| `js/screens/mission-scenes.js` | Fondos SVG por paso (`createScenes().update({ step, planet, level, status })`) |
| `js/budget.js` | Reglas puras, sin DOM: `cardCatalog`, `requiredLevels`, `evaluatePlan`, `stepStatus`, `STEPS` |
| `data/segments.json` | Tarjetas de Espacio, Tierra y Usuario; niveles exigidos; márgenes; penalizaciones; umbrales de CML |
| `data/rockets.json` | Tarjetas de Lanzamiento (Rol 2) |
| `data/i18n/{es,en}/mission.json` | Todos los textos |
| `css/screens/mission.css` | Estilos del nivel y de las escenas. Conserva `.segment-row`, que usa el Taller |
| `tests/budget.test.html` | 21 pruebas de reglas, pasos e integración con el Taller |

---

## 7. Cómo probar

```bash
python3 -m http.server 8000
# Juego:   http://localhost:8000
# Pruebas: http://localhost:8000/tests/budget.test.html  (deben salir 21 PASS)
#          http://localhost:8000/tests/physics.test.html
```

Recorrido manual sugerido (en ES y EN, escritorio y celular):
1. Comenzar → Paso 1. Sin nombre válido, destino u objetivo, «Siguiente» queda deshabilitado con el motivo. El nombre necesita al menos 3 letras (`validProjectName` en `js/budget.js`): «123» o «ab» no valen, «Marte 2» sí. Bajo el campo, un aviso se pone rojo cuando el texto escrito no cumple.
2. Lanzamiento con Marte: el Colibrí pone el fondo rojo y bloquea; el Cóndor lo pone verde.
3. Arrastrar una tarjeta y también añadirla con un clic (o con Tab + Enter); abrir y cerrar `?` con Esc.
4. Elegir de más (DSN para la Luna): fondo ámbar, la barra baja a CML 3.
5. Revisión → «Cambiar» → volver → «Siguiente: Taller».
6. Activar «reducir movimiento» en el sistema: las escenas quedan quietas.

---

## 8. Cómo ajustarlo

| Quiero… | Edito |
|---|---|
| Cambiar costos o textos de tarjetas | `data/segments.json → cards` (cada una: `id`, `level`, `cost`, `icon`, `name`, `desc`) |
| Hacerlo más o menos estricto | `rules.margin`, `penalty.perExcessLevel`, `cmlCap` |
| Agregar un destino | `missions.json` + `requirements.space` / `requirements.user` + un cohete en `rockets.json` que lo alcance |
| Cambiar un fondo | `js/screens/mission-scenes.js` (SVG) y la sección «Escenas» de `mission.css` |

Después de cambiar datos, corre `tests/budget.test.html`. La prueba «con $X de Espacio el Taller permite el diseño de referencia» avisa si el Nivel 2 se vuelve imposible.

---

## 9. Decisiones de diseño

- **Por pasos, un segmento a la vez:** reduce la carga visual, deja que el fondo cuente qué se está decidiendo y refuerza las 4 preguntas de DDSM.
- **3 tarjetas por segmento:** con una sola tarjeta no habría ninguna decisión; con tres aparece el trade-off.
- **Sobredimensionar penaliza pero no bloquea:** una misión cara puede aprobarse con menor madurez. Lo que bloquea es lo que haría fallar la misión.
- **Presupuesto por destino y no un valor fijo de $100M:** con 100 M$ fijos, Europa sería imposible, porque su único cohete cuesta 80 M$.
- **Fondos en SVG + CSS y no WebGL:** son ligeros, se ven nítidos a cualquier tamaño y respetan el movimiento reducido.
- **Arquitectura modular y no un `index.html` autocontenido:** el proyecto pide datos en `/data`, y las otras pantallas comparten el router y el estado.
- **Accesibilidad:**
  - el arrastre es opcional (hay botones equivalentes);
  - el foco vuelve a la tarjeta movida;
  - los estados usan ícono + texto, no solo color;
  - la retroalimentación usa `aria-live`;
  - la barra de pasos marca `aria-current`.

---

## 10. Pendientes

- [ ] El Reporte (Rol 4) aún no limita el CML final con `plan.cmlCap`. Basta una línea en `js/screens/report.js`: `cml = Math.min(cml, state.plan.cmlCap)`.
- [ ] Prueba visual en navegador real (escritorio y celular, ES y EN).
- [ ] En pantallas táctiles el arrastre HTML5 no funciona; se usan Añadir/Quitar. Si se quiere arrastre táctil, habría que implementarlo con Pointer Events.
