# Nivel 2 · Taller del CubeSat

> Referencia para revisar y mantener el Nivel 2. **Responsable:** @JU4NMAX · vive en `nivel2/`.
> **Recurso NASA:** CubeSat 101 — *Basic Concepts and Processes for First-Time CubeSat Developers*.
> **Inspiración UX:** *A Learning Game About Telescopes* (opciones incompatibles en gris con su explicación).
> **Página aislada:** `nivel2/` · contrato de datos en [`contrato-niveles.md`](../contrato-niveles.md).
> **Relacionados:** [`nivel-1.md`](nivel-1.md) · [`fuentes.md`](../fuentes.md)


## Especificación

El jugador entra al taller de ensamblaje. Según [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf), elige el factor de forma y los instrumentos científicos bajo los límites de masa, energía y presupuesto que vienen del Nivel 1.

- **Factores de forma:** 3U (equilibrio para misiones estándar), 6U y 12U (más capacidad, más masa y costo).
- **Validación inteligente** (inspirada en [A Learning Game About Telescopes](https://science.nasa.gov/mission/webb/game-build-it-yourself/)): un instrumento incompatible con el objetivo científico del Nivel 1 se muestra en gris y explica la razón técnica.
- **Medidores en vivo:** masa total (gramos) y consumo de energía (W).
- Si la masa supera la carga útil del cohete del Nivel 1, se bloquea la salida y se avisa que el cohete no podrá despegar.
- Estilos aislados en `nivel2.css`. Al validar guarda `satellite` en `eo-mision` y continúa a `nivel3/`.

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
| **Cómo entra** | `nivel2/`: desde el «Siguiente» del Nivel 1, desde **☰ Niveles → Nivel 2** o desde el Nivel 3 (`levelHref(2)`). Sin misión guardada abre en **modo demo**. |
| **Cómo sale** | **🚀 Validar y lanzar** guarda `satellite` con su resumen y abre `nivel3/`. **← Nivel 1** vuelve a la app principal (`levelHref(1)`). |

---

## 2. Qué ve el jugador

- **Pantalla de 3 columnas, sin scroll de página** (escritorio): **catálogo** a la izquierda (con scroll propio), **visor del CubeSat** al centro y **telemetría** (propelente, medidores, verificaciones, consejos y botones) a la derecha. En celular (≤ 860 px) se apilan y una barra fija abajo resume Δv, masa, energía y costo.
- **Visor SVG del CubeSat** (`renderSVG` en `nivel2/nivel2.js`): dibuja el chasis como rejilla de unidades U (3U, 6U o 12U) y cada pieza al instalarla: las internas (batería, ADCS, computadora, instrumentos) entran en las celdas, los paneles se despliegan a los lados, la tobera con su llama sale por abajo, las antenas por arriba y el RTG por un costado. El volumen que sobra se marca en rojo parpadeante. Los colores salen solo de los tokens del nivel (`--n2-*`): **naranja** = propulsión, **azul** = el resto de piezas. Verde, amarillo y rojo se reservan para ✔ / ▲ / ✘, así que la categoría la dice el rótulo de cada pieza y no el color.
- **↺ Reiniciar ensamblaje** (barra superior): vacía la estructura, las piezas y el propelente.
- **Objetivo científico** del Nivel 1 en el encabezado (🎯), con el aviso de que los instrumentos que no sirven aparecen en gris.
- **Catálogo por categoría.** Cada pieza muestra masa en gramos, volumen en U, energía, costo y TRL con su significado corto («TRL 4 · en laboratorio»).
  - **Botón ⓘ** en cada pieza: un popover nativo (mismo patrón que el «?» del Nivel 1) que explica qué es el TRL, qué significa el nivel de esa pieza y por qué lo tiene (su `desc`). Se cierra con Esc o con un clic afuera.
  - **Estructuras:** su descripción y su masa máxima (`U × 1.33 kg`, CubeSat 101), en la fuente de los números: en Space Grotesk «15 960» se leía como «45 960».
  - **Instrumentos:** ✔ por qué sirve, o ✘ por qué no sirve, en gris y deshabilitado.
- **Slider de propelente**, si hay propulsión.
- **5 medidores en vivo** (`role="meter"`). Se actualizan al agregar o quitar piezas y **mientras se arrastra** el propelente:

| Medidor | Muestra | Verde | Amarillo | Rojo |
|---|---|---|---|---|
| Δv | Δv contra el requerido (con línea) | ≥ 110 % del requerido | 100–110 % ("margen justo") | < requerido |
| Masa | g contra el límite que manda | < 85 % | 85–100 % | > 100 % |
| Energía | **neto** = generación − consumo (puede ser negativo); la barra muestra el consumo contra la generación | consumo < 85 % de lo generado | 85–100 % | neto negativo, o generación menor al mínimo del destino |
| Batería | Wh que cubren eclipses y quemados contra los Wh usables (50 % de la capacidad) | < 85 % | 85–100 % | > 100 % |
| Costo | costo contra el segmento Espacio | < 85 % | 85–100 % | > 100 % |

- **Aviso del cohete:** si la masa supera la carga útil del cohete del Nivel 1, y ese es el límite que manda, aparece "🚫 … solo lleva N g: así no podrá despegar".
- **Antes de elegir estructura nada se juzga:** los medidores quedan en gris (`— / — g`, «Elige una estructura») y las verificaciones en ○ pendiente, en vez de mostrar ✔ porque «0 g cabe en cualquier límite». La batería sigue pendiente mientras no haga falta ni haya una. Reglas: `checkState` y `meterData` en `js/taller-reglas.js`.
- **Lista de verificaciones** (✔ / ✘ / ○) y botones **Atrás** / **🚀 Lanzar**.
- **💡 Consejos con números** bajo las verificaciones que fallan (hasta 2, `tradeHints` en `js/taller-reglas.js`). Orientan el *trade study* sin regalar nada: «la 3U admite 3 990 g y con el propelente de la misión pesaría unos 5 042 g: prueba la 6U», «con el monopropelente verde ($8M) el total baja a $26M», «faltan 178 m/s: carga 2.0 kg». Solo sugieren alternativas que sirven (una propulsión que llegue al Δv con su tanque, un instrumento compatible con el objetivo).
- **En celular (≤ 860 px)** una barra fija abajo resume Δv, masa, energía y costo con ✔ / ▲ / ✘ / ○, y **Ver detalle ↓** lleva al panel completo.

---

## 3. Reglas: ¿puede lanzar?

**🚀 Lanzar** solo se habilita si pasan las 11 verificaciones de `validateDesign` (`js/physics.js`, Rol 2):

| Verificación | Regla |
|---|---|
| Estructura | Hay un factor de forma |
| Computadora | Hay OBC |
| Masa | Masa húmeda ≤ `min(U × 1.33 kg, carga útil del cohete)` |
| Volumen | Las piezas caben en las U |
| Energía | Neto ≥ 0 (generación − consumo) y generación ≥ el mínimo del destino (solar ∝ 1/d²; la estructura trae paneles de serie) |
| Batería | Los Wh usables cubren el eclipse y los quemados químicos (ver «Modelo de energía» en `docs/fuentes.md`) |
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

Usa el helper `js/mision-store.js` (clave `eo-mision`, ver `docs/contrato-niveles.md`). **Solo escribe la sección `satellite`.**

| Lee | Del Nivel 1 | Para |
|---|---|---|
| `missionId`, `plan.scienceTargetIdx` | destino y objetivo | requisitos del destino y compatibilidad de instrumentos |
| `rocketId` | cohete | carga útil (límite de masa y aviso del cohete) |
| `budget.space` | segmento Espacio | límite de costo |

| Escribe | Cuándo |
|---|---|
| `satellite.{formFactor, pieces, propellantKg}` + `validated: false` | en cada cambio (también si quita instrumentos incompatibles al entrar) |
| `satellite.{dryKg, wetKg, isp, dvAvailable, maxPayloadKg}` + `validated: true` | al pulsar **🚀 Validar y lanzar** |

**Modo demo:** si no hay misión, o le falta destino, cohete o `budget.space`, usa la Luna con el Colibrí, el objetivo «Hielo en cráteres polares» y el diseño de referencia. Mientras se edita no guarda nada. Al lanzar guarda la misión de ejemplo **solo si `eo-mision` está vacío**, así nunca pisa un Nivel 1 a medias.

---

## 6. Archivos

| Archivo | Responsabilidad |
|---|---|
| `nivel2/index.html` | Página aislada: encabezado, botón ES/EN, catálogo y panel |
| `nivel2/nivel2.js` | UI, modo demo y lectura/escritura del contrato. Exporta `pickMission`, `satelliteSummary` y `DEMO` para las pruebas |
| `nivel2/nivel2.css` | Estilos aislados; todas las clases llevan el prefijo `n2-` |
| `nivel2/textos.js` | Textos ES/EN del nivel |
| `js/taller-reglas.js` | Reglas puras, sin DOM: `limitLevel`, `dvLevel`, `meterData`, `rocketOverload`, `grams`, `instrumentStatus`, `incompatibleSelected`. |
| `data/workshop.json` | Compatibilidad instrumento ↔ objetivo y descripción de 3U / 6U / 12U |
| `js/physics.js`, `data/pieces.json` | Piezas y reglas físicas (Rol 2), importadas sin copiar fórmulas |
| `js/mision-store.js` | Contrato entre niveles (Rol 1) |

---

## 7. Cómo probar

```bash
python3 -m http.server 8000
# Nivel 2: http://localhost:8000/nivel2/
```

En la consola del navegador:
```js
localStorage.removeItem('eo-mision')   // empezar de cero → modo demo
JSON.parse(localStorage.getItem('eo-mision')).satellite   // ver lo que guardó el nivel
```

Recorrido manual sugerido (en ES y EN, escritorio y 360 px):
1. Sin datos: aparece el aviso **Modo demo** y el diseño de la Luna ya puede lanzarse.
2. Completa el Nivel 1 con **Marte · metano** y abre `nivel2/`: solo el espectrómetro está activo, y el resto aparece en gris con su razón.
3. Vuelve al Nivel 1, cambia a **campo magnético** y regresa: si tenías el espectrómetro, se quita y aparece el aviso.
4. Arrastra el propelente sin soltar: Δv y Masa cambian en vivo.
5. Con el **Colibrí** y una estructura **12U** cargada, aparece el aviso del cohete y Lanzar queda deshabilitado.
6. **🚀 Validar y lanzar** → `satellite.validated: true` con su resumen, y se abre `nivel3/`.

---

## 8. Cómo ajustarlo

| Quiero… | Edito |
|---|---|
| Cambiar qué instrumento sirve para un objetivo | `data/workshop.json → instrumentFit` (`ok` + `why` en ES y EN) |
| Agregar un objetivo a un destino | `missions.json → scienceTargets` (Rol 2) **y** una entrada en el mismo índice de `instrumentFit` |
| Agregar un instrumento | `pieces.json` (Rol 2) **y** su entrada en cada objetivo de `instrumentFit` |
| Cambiar los cortes de color | `WARN_AT` y `DV_MARGIN` en `js/taller-reglas.js` |
| Cambiar la descripción de las estructuras | `data/workshop.json → formFactors` |

---

## 9. Decisiones de diseño

- **Página aislada en `nivel2/`**, como pide el contrato de #49 y como ya hace `nivel3/`. Se pasa la misión por `eo-mision` y no por el estado de la app.
- **Lógica compartida en `js/taller-reglas.js`:** los medidores (#47) y la compatibilidad viven en un solo lugar. `nivel2/` y la pantalla `workshop` de la app los importan, así que no hay fórmulas copiadas.
- **Textos propios (`nivel2/textos.js`):** no toca los i18n compartidos ni la prueba de traducciones de la app.
- **Sin cambios en archivos del Rol 1:** el nivel carga sus propios datos (`../data/*.json`), así que no hace falta tocar `js/main.js`.
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

- [x] **Carpeta publicada (contrato, #52):** `2` está en `FOLDER_LEVELS` (`js/mision-store.js`) y la entrada `workshop` de `js/levels.js` tiene `folder: 2` y `done: satellite.validated`. El «Siguiente» del Nivel 1, el menú y el «Volver al taller» del Nivel 3 llevan a `nivel2/`.
- [x] Se retiró la pantalla `js/screens/workshop.js` de la app: el Taller vive solo en `nivel2/`.
- [ ] **E2E** (pausado en #46): cuando se reactive, los diseños de referencia deben elegir objetivo e instrumentos compatibles. Por ejemplo, Marte con cámara + magnetómetro no sirve para ningún objetivo de Marte: usar magnetómetro con «campo magnético» (sigue siendo válido: Δv 1382 m/s, 14.80 kg).
- [ ] Prueba visual en navegador real (escritorio y celular, ES y EN).
- [ ] #16: tooltips de CubeSat 101 por subsistema. Ya cubre instrumentos, estructuras y el TRL de cada pieza (ⓘ).
- **Balanceo (revisado con `gemini-code-leve-2-fix.md`):** no hace falta rebalancear. 6U + monopropelente verde ya cumple la Luna con $20M (Δv 1027 / 850 m/s); 3U + verde es físicamente imposible (el motor ocupa 3U y la Luna pide ~5 kg contra 3.99 kg de la 3U), y es justo lo que enseña el nivel. El presupuesto mayor (ruta iónica) ya existe en el Nivel 1 con la nave interplanetaria ($50M).
- [x] #15: vista del CubeSat ensamblado con las U ocupadas (visor SVG, §2).
