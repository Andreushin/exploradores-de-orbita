# Nivel 4 · Reporte de misión

> Referencia para revisar y mantener el Nivel 4. **Responsable:** @tommycc2010-hub · vive en la app principal (`js/screens/report.js`).
> **Recurso NASA:** Concept Maturity Levels (CML).
> **Relacionados:** [`fuentes.md`](../fuentes.md) · [`nivel-1.md`](nivel-1.md)


## Especificación

Reporte final de éxito o fracaso, con datos científicos simulados (inspirados en misiones reales de la NASA) y evaluación del proyecto con los [Concept Maturity Levels (CML)](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299).

- **Barra de madurez CML** (1 a 4) según las decisiones de los niveles anteriores.
- **Datos científicos simulados:** curvas o espectros por instrumento, comparados conceptualmente con misiones reales.
- **Botones:** volver a jugar para optimizar el presupuesto y volver al menú principal.

## Índice
1. [Resumen](#1-resumen)
2. [Qué muestra la pantalla](#2-qué-muestra-la-pantalla)
3. [CML final](#3-cml-final)
4. [Qué mejorar para subir de CML](#4-qué-mejorar-para-subir-de-cml)
5. [Datos científicos simulados](#5-datos-científicos-simulados)
6. [Datos que lee y guarda](#6-datos-que-lee-y-guarda)
7. [Archivos](#7-archivos)
8. [Cómo probar](#8-cómo-probar)
9. [Cómo ajustarlo](#9-cómo-ajustarlo)
10. [Decisiones de diseño](#10-decisiones-de-diseño)
11. [Pendientes](#11-pendientes)

---

## 1. Resumen

| | |
|---|---|
| **Qué enseña** | La madurez de un concepto (CML) depende de todas las decisiones: presupuesto, diseño, travesía e inserción. Y una órbita no basta: los segmentos Tierra y Usuario deciden cuánta ciencia llega a los científicos. |
| **Qué hace el jugador** | Ve su resultado, el CML alcanzado y por qué, qué mejorar, y los datos que «midió» cada instrumento comparados con una misión real de la NASA. |
| **Cómo gana** | CML 4 (diseño puntual): diseño válido, órbita estable, puntaje científico ≥ 50 y sin penalizaciones que bajen el tope en el Nivel 1. |
| **Cómo entra** | Botón **Ver reporte →** al terminar la Travesía (Nivel 3), o **☰ Niveles → Nivel 4 · Reporte de madurez** cuando ya está desbloqueado. |
| **Cómo sale** | **Menú principal** (selector de niveles), **Rediseñar CubeSat** (vuelve al Taller) o **Nueva misión** (reinicia y va al Nivel 1). |

---

## 2. Qué muestra la pantalla

En orden, de arriba abajo:

1. **Título**, nombre del proyecto (si el jugador lo escribió) y resultado de la inserción: órbita, excéntrica, sobrevuelo, choque o sin propelente (`no-fuel`, del Nivel 3).
2. **Barra CML 1–4**: cada nivel con su nombre y una explicación corta.
   - Los niveles alcanzados se llenan en orden, con animación. Si el sistema tiene activado «reducir movimiento», aparecen sin animación.
   - El nivel final queda resaltado (`aria-current="step"`).
   - Los niveles que el jugador habría alcanzado pero que bloqueó el presupuesto del Nivel 1 se marcan con borde punteado y 🔒.
3. **Qué mejorar para subir de CML**: el motivo y una lista de sugerencias (ver §4). Si llegó a CML 4, se muestra «¡Diseño puntual logrado!».
4. **Datos científicos simulados**:
   - puntaje científico, más el efecto de los eventos de la travesía si lo hubo;
   - objetivos científicos del destino, con el que eligió el jugador resaltado;
   - una gráfica por instrumento instalado (ver §5).
5. **Resumen de ingeniería**: Δv al lanzar, Δv usado, masa lanzada, eventos enfrentados y madurez del Nivel 1 con su tope de CML.
6. **Lo que aprendiste** y los 3 botones del pie.

---

## 3. CML final

Se calcula en `finalCml()` (`js/science-data.js`):

**CML final = mínimo entre el CML por desempeño y el tope del Nivel 1**

- **CML por desempeño** (`computeCML` en `js/physics.js`):

  | CML | Condición |
  |---|---|
  | 1 · Idea en servilleta | El diseño no cumple las restricciones del Taller |
  | 2 · Factibilidad inicial | Diseño válido, pero no quedó en órbita: sobrevuelo, choque, sin propelente o cualquier otro resultado. Es una lista blanca: solo `orbit` y `eccentric` cuentan como «en órbita» |
  | 3 · Espacio de compromisos | En órbita, pero excéntrica o con puntaje < 50 (`CML4_MIN_SCORE`) |
  | 4 · Diseño puntual | Órbita estable y puntaje ≥ 50 |

- **Tope del Nivel 1** (`plan.cmlCap`): sale de la madurez del plan (100 − penalizaciones). ≥ 90 → 4 · ≥ 65 → 3 · ≥ 40 → 2 · si no, 1. Ver [`nivel-1.md`](nivel-1.md) §4.3.

**Puntaje científico del reporte** = `scienceScore()` + la suma de `science` de los eventos elegidos, limitado a **0..100** (`reportScore()`). Acepta los dos formatos de evento: el del Nivel 3 (`{ id, choice: <índice>, hit, dv, science }`, ver `contrato-niveles.md`) y el de la travesía de la app principal (`{ id, choice: { science } }`). La fórmula de `scienceScore` está en `fuentes.md` → «Puntaje científico y CML».

**Motivo** (`reason`), que decide el texto y las sugerencias:

| Motivo | Cuándo |
|---|---|
| `max` | Llegó a CML 4 |
| `budget` | El tope del Nivel 1 es menor que el CML por desempeño |
| `design` | El diseño no es válido |
| `insertion` | Sobrevuelo, choque o sin propelente |
| `eccentric` | Órbita excéntrica |
| `science` | Órbita estable, pero puntaje < 50 |

Si el tope es **igual** al CML por desempeño, manda el motivo del desempeño: lo que hay que corregir primero es eso.

---

## 4. Qué mejorar para subir de CML

`improvementHints()` devuelve una lista de claves de `report.json → hints`. Nunca queda vacía: si no hay nada concreto, sugiere llegar a 50 puntos con órbita estable.

| Motivo | Sugerencias |
|---|---|
| `max` | Probar un destino más difícil o lograr más ciencia con menos presupuesto |
| `budget` | Volver al Nivel 1 y no sobredimensionar ni pasarse del presupuesto (muestra madurez y penalización) |
| `design` | Una por cada check del Taller que falló, con su texto de `workshop.json → checks` |
| `insertion` | Sobrevuelo: frenar más tiempo o llevar más propelente. Choque: soltar el quemado antes. Sin propelente: aligerar el satélite, llevar más propelente o subir el Isp |
| `eccentric` | Afinar el quemado: una órbita estable necesita del 95% al 110% del Δv requerido |
| `science` | Según el caso: agregar un instrumento (si hay menos de 4), invertir más en Tierra (hasta `GROUND_FULL`), más en Usuario (hasta `USER_FULL`), o cuidar los eventos si restaron ciencia |

---

## 5. Datos científicos simulados

Por cada instrumento instalado se dibuja una gráfica (canvas) con dos curvas:
- **Referencia NASA (conceptual)**, punteada: la forma típica de la señal en ese destino.
- **Tu CubeSat (simulado)**: la misma señal con ruido.

Debajo va la ficha de la misión real que la inspira. **No son datos reales**: la página lo aclara con una nota.

### 5.1 Instrumentos y misiones de referencia (`data/science.json`)

| Instrumento | Gráfica | Luna | Marte | Europa |
|---|---|---|---|---|
| `inst-camera` | Reflectancia por banda (400–1000 nm) | LRO · LROC (2009) | MRO · HiRISE (2006) | Galileo · SSI (1995) |
| `inst-spectro` | Espectro infrarrojo (1–4 µm) | Chandrayaan-1 · M3 de la NASA (2009): OH/agua cerca de 3 µm | MRO · CRISM (2006): minerales hidratados | Galileo · NIMS (1995): hielo de agua a 1.5 y 2.0 µm |
| `inst-mag` | Campo magnético en una órbita (0–12 h) | Lunar Prospector (1998): anomalías en la corteza | Mars Global Surveyor / MAVEN (1997): campos fósiles | Galileo · MAG (1995): campo inducido → océano salado |
| `inst-radar` | Eco de radar por profundidad | LRO · Mini-RF (2009): hielo en cráteres polares | MRO · SHARAD (2006): capas de hielo enterradas | Europa Clipper · REASON (2024, llega en 2030) |

### 5.2 Cómo se genera la señal (`signalAt`)

Cada destino tiene un modelo con componentes opcionales que se suman:

**señal = base + pendiente + onda + bultos − bandas de absorción + caída exponencial**

| Componente | Para qué sirve | Ejemplo |
|---|---|---|
| `slope` | Color general de la superficie | Marte, rojo: la reflectancia sube hacia 1000 nm |
| `bands` | Absorciones (gaussianas hacia abajo) | Hielo de agua de Europa a 1.5 y 2.0 µm |
| `bumps` | Picos (gaussianas hacia arriba) | Campos de la corteza de Marte; reflector bajo el hielo de Europa |
| `wave` | Señal periódica | Campo inducido de Europa con la rotación de Júpiter (~11 h) |
| `decay` | Caída desde la superficie | Eco de radar que se atenúa con la profundidad |

### 5.3 Qué cambia con la partida (`instrumentSeries`)

| Resultado | Datos medidos |
|---|---|
| Órbita / excéntrica | Todos los puntos, con ruido = `MAX_NOISE` (0.5) × rango de la señal × (1 − puntaje/100). Con 100 puntos coincide con la referencia. |
| Sobrevuelo o sin propelente (`PASSED_BY`) | Solo una ventana corta, el 30% central (`FLYBY_WINDOW`), con el mismo ruido |
| Choque | Ningún dato: la gráfica dice «Sin señal» |

El ruido es **reproducible**: la semilla sale de la misión, las piezas, el propelente y el resultado (`hashSeed` + `seededRandom`), así que la gráfica no cambia al recargar o al cambiar de idioma.

---

## 6. Datos que lee y guarda

| Campo | Uso |
|---|---|
| `missionId`, `satellite.*`, `budget.*` | Diseño, validación (`validateDesign`) y puntaje (`scienceScore`) |
| `journey.outcome`, `journey.events`, `journey.dvAvailable`, `journey.dvUsed` | Resultado, efecto de los eventos y resumen. Si el jugador viene de `nivel3/`, la app retoma todo de `eo-mision` (`js/mision-store.js`) y abre `#report` |
| `plan.cmlCap`, `plan.maturity`, `plan.penalty` | Tope de CML y sugerencia de presupuesto |
| `plan.projectName`, `plan.scienceTargetIdx` | Encabezado y objetivo resaltado |
| **Escribe** `report.score`, `report.cml` | `report.cml > 0` marca el Nivel 4 como completado (`js/levels.js`) |
| **Escribe** `report.scienceData` | `[{ id, measured }]`, una serie por instrumento |

---

## 7. Archivos

| Archivo | Responsabilidad |
|---|---|
| `js/screens/report.js` | UI del nivel: barra CML, sugerencias, gráficas en canvas, resumen y botones |
| `js/science-data.js` | Lógica pura, sin DOM: `finalCml`, `improvementHints`, `reportScore`, `instrumentSeries`, `signalAt`, `seededRandom` |
| `data/science.json` | Modelos de señal y referencias NASA por instrumento y destino (ES/EN) |
| `data/i18n/{es,en}/report.json` | Todos los textos del nivel |
| `css/screens/report.css` | Estilos del nivel, todos bajo `#screen-report`. Solo se carga al abrir el nivel (`js/levels.js`) |
| `tests/report.test.html` | 69 pruebas: CML final, sugerencias, puntaje, series y datos completos en ES/EN |

`science.json` se carga con una ruta relativa al módulo (`new URL('../../data/science.json', import.meta.url)`). Así funciona igual en la raíz, y en GitHub Pages (`/exploradores-de-orbita/`), sin tocar `main.js`.

---

## 8. Cómo probar

```bash
python3 -m http.server 8000
# Juego:   http://localhost:8000
# Pruebas: http://localhost:8000/tests/report.test.html   (deben salir 69 PASS)
#          http://localhost:8000/tests/science.test.html
#          http://localhost:8000/tests/physics.test.html
```

Recorrido manual sugerido (en ES y EN, escritorio y celular):
1. Juega una misión completa y llega al reporte: la barra se llena en orden y el nivel final queda resaltado.
2. Repite con un Nivel 1 penalizado (Luna con el Cóndor): el CML queda en 3 y CML 4 aparece con 🔒.
3. Prueba los cuatro resultados de la inserción:
   - frenar poco → sobrevuelo: pocos datos;
   - frenar de más → choque: «Sin señal»;
   - quedarse corto por poco → órbita excéntrica.
4. Cambia de idioma en el reporte: textos y gráficas se redibujan iguales.
5. Prueba los 3 botones del pie.
6. Activa «reducir movimiento» en el sistema: la barra aparece sin animación.

---

## 9. Cómo ajustarlo

| Quiero… | Dónde |
|---|---|
| Agregar un instrumento | Pieza en `pieces.json` (`category: "instrument"`) + entrada en `science.json` con `model` y `reference` para cada destino. `report.test.html` avisa si falta |
| Agregar un destino | Su `model` y su `reference` en cada instrumento de `science.json` |
| Cambiar la misión de referencia o su dato | `science.json → <instrumento>.reference.<destino>` (ES y EN) |
| Más o menos ruido | `MAX_NOISE` en `js/science-data.js` |
| Datos más escasos en sobrevuelo | `FLYBY_WINDOW` en `js/science-data.js` |
| Cambiar el umbral de CML 4 | `CML4_MIN_SCORE` en `js/physics.js` (también lo usa el texto de las sugerencias) |
| Cambiar textos | `data/i18n/{es,en}/report.json`. La prueba exige las mismas claves en los dos idiomas |

---

## 10. Decisiones de diseño

- **Dentro del juego y no en una carpeta `nivel4/` aparte:** el estado de la partida vive en memoria. Una página aparte habría perdido el diseño, la travesía y el plan, o habría obligado a pasarlos por `localStorage` o por la URL. El aislamiento se mantiene igual: el CSS solo se carga para este nivel y todas sus reglas van bajo `#screen-report`.
- **CML = mínimo entre desempeño y tope del Nivel 1:** así las decisiones de presupuesto del Nivel 1 cuentan al final, como pide el marco CML: un concepto caro o mal justificado es menos maduro aunque vuele bien.
- **Comparación conceptual y no datos reales:** los datos reales de cada misión pesan mucho, tienen formatos distintos y no corresponden a un CubeSat. Una curva con la forma típica enseña lo mismo (qué se busca y cómo se ve) sin engañar: la página dice que es una simulación.
- **Ruido relativo al rango de la señal:** con ruido absoluto, una señal sutil (la reflectancia lunar varía ~0.1) quedaba tapada. Ahora el puntaje controla la calidad de los datos de forma pareja en todos los instrumentos.
- **Ruido con semilla:** la gráfica no «baila» al recargar ni al cambiar de idioma.
- **La referencia se dibuja encima de lo medido:** siempre se ve, incluso con 100 puntos, cuando las dos curvas coinciden.
- **Seguridad:** el nombre del proyecto que escribe el jugador se inserta como texto (`textContent`), nunca como HTML.
- **Accesibilidad:**
  - cada gráfica tiene `role="img"` y una descripción;
  - la leyenda usa estilo de línea (punteada o continua), no solo color;
  - la animación respeta «reducir movimiento».

---

## 11. Pendientes

- [x] La prueba E2E se eliminó en la auditoría del repo; la cobertura queda en `tests/report.test.html` y `tests/science.test.html`.
- [ ] Prueba visual en celular real (táctil), en ES y EN.
- [ ] Opcional: mover el reporte a su carpeta `nivel4/` (forma de trabajo de `contrato-niveles.md`). Al hacerlo, agregar `4` a `FOLDER_LEVELS` en `js/mision-store.js` y `folder: 4` en `js/levels.js`: el Nivel 3 lo detecta solo. Hoy funciona dentro de la app principal (`../#report`).
- [ ] Opcional: botón para descargar el reporte (imagen o PDF) y compartirlo.
