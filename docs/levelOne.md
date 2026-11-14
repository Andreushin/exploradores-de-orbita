# Nivel 1 · Diseña tu misión (DDSM)

> Documento de referencia para revisar y mantener el Nivel 1. Owner: Rol 3.
> Recurso NASA: **Design and Develop Science Missions (DDSM)**. Ver también `docs/context.md` y `docs/fuentes.md`.

## 1. Qué enseña

El jugador aprende que **los requerimientos científicos dictan la ingeniería y el presupuesto**. Una misión de la NASA se arma con cuatro segmentos (Lanzamiento, Espacio, Tierra, Usuario). Para cada uno hay que elegir lo que el destino necesita: si elige menos, la misión falla; si elige mucho más sin justificación, pierde madurez (CML).

## 2. Cómo se juega

1. **Requerimientos científicos.** El jugador:
   - escribe el nombre del proyecto;
   - elige el destino (Luna, Marte o Europa), que fija el **presupuesto máximo** (100 / 160 / 230 M$);
   - elige un objetivo científico de ese destino.

   Aparece un panel con lo que exige el destino: Δv, luz solar, potencia, días de viaje y el **nivel mínimo por segmento**.
2. **Segmentos de la misión.** El tablero tiene dos columnas:
   - **Opciones disponibles** (izquierda): el banco de tarjetas, 3 por segmento.
   - **Misión configurada** (derecha): el área de aceptación, con una ranura por segmento.

   Las tarjetas se mueven **arrastrando** o con los botones **Añadir → / ← Quitar**, que funcionan en celular y con teclado. Soltar una tarjeta nueva en un segmento reemplaza la anterior.
3. **Barra de presupuesto fija** bajo el encabezado: presupuesto máximo en USD, asignado, disponible (en rojo si es negativo) y madurez inicial (CML). Se actualiza con cada movimiento.
4. **Botón `?` en cada tarjeta.** Abre una ventana con «Qué se tiene en cuenta» y «Qué NO se debe hacer» del segmento. Se cierra con Esc, con clic afuera o con «Entendido».
5. **Revisión de diseño.** Muestra alertas pedagógicas y lo que falta para continuar. Cuando todo cumple, se habilita **«Siguiente: Taller del CubeSat»**.

## 3. Reglas (¿pasa o no pasa?)

Cada tarjeta tiene un **nivel** de 1 a 3. El destino exige un nivel mínimo por segmento:

| Segmento | Nivel exigido | Margen tolerado |
|---|---|---|
| Lanzamiento | El cohete debe tener al destino en `rockets.json → destinations` | 0 (un cohete más grande no aporta nada) |
| Espacio | `segments.json → requirements.space` (Luna 1, Marte 2, Europa 3) | 1 |
| Tierra | `missions.json → commsDifficulty` | 1 |
| Usuario | `segments.json → requirements.user` (hoy 1 en todos) | 2 (elegir más es un trade-off científico válido) |

Estados de cada ranura:

| Estado | Cuándo | Efecto |
|---|---|---|
| Vacío | No hay tarjeta | **Bloquea** («falta el segmento X») |
| Insuficiente | Nivel menor al exigido o cohete que no llega | **Bloquea** (riesgo de fallo técnico) |
| Justo lo necesario | Nivel = exigido | ✔ |
| Con margen | Por encima, dentro del margen | ✔ sin penalización |
| Sobredimensionado | Por encima del margen | Pasa, pero resta **15 pts por nivel extra** («sobrefinanciación sin justificación») |

Además:
- **Exceso de presupuesto:** si la suma supera el máximo, **bloquea** y resta 1 pt por M$ excedido (máx. 40). La alerta lo marca como «Misión sobrefinanciada o financieramente inviable».
- **Madurez inicial** = 100 − penalización. Define el **tope de CML** alcanzable: ≥90 → CML 4, ≥65 → 3, ≥40 → 2, si no → 1.
- **Para continuar** se necesita: nombre, destino, objetivo científico, los 4 segmentos sin insuficiencias y no exceder el presupuesto.

Ejemplos (verificados en `tests/budget.test.html`):

| Configuración | Resultado |
|---|---|
| Luna: Colibrí + nave cercana + UHF + estándar ($66M de $100M) | Pasa, CML 4 |
| Luna con el Cóndor (rideshare) | Pasa, −15 → CML 3 |
| Luna con todo al máximo ($192M) | Bloquea, CML 1 |
| Marte con el Colibrí | Bloquea: el cohete no llega |
| Europa sin segmento Tierra | Bloquea: falta un segmento |

## 4. Qué guarda para los siguientes niveles

Lo escribe `js/screens/mission.js` en el estado global (`js/state.js`):

| Campo | Contenido | Lo usa |
|---|---|---|
| `missionId` | Destino elegido | Todos los niveles |
| `rocketId` | Igual a `plan.cards.launch` | Taller (`validateDesign`: carga útil) |
| `budget.total` | Presupuesto máximo del destino | Encabezado (HUD) |
| `budget.{launch,space,ground,user}` | Costo de la tarjeta elegida en cada segmento | Taller (`budget.space` = dinero para piezas), `scienceScore` (Tierra y Usuario) |
| `plan.projectName`, `plan.scienceTargetIdx` | Identidad y objetivo de la misión | Selector de niveles, reporte |
| `plan.cards` | Id de la tarjeta por segmento | Nivel 1 al volver a abrirlo |
| `plan.maturity`, `plan.penalty`, `plan.cmlCap` | Madurez inicial y tope de CML | **Pendiente:** el Reporte (Rol 4) aún no aplica `cmlCap` |
| `plan.validated` | `true` al pulsar «Siguiente» | Desbloquea el Taller en el selector de niveles (`js/levels.js`) |

Volver a abrir el Nivel 1 **no** invalida la misión. Solo un cambio real (nombre, destino, objetivo o tarjetas) pone `validated` en `false`, y entonces hay que volver a validar.

## 5. Archivos

| Archivo | Rol |
|---|---|
| `js/screens/mission.js` | UI: requerimientos, barra de presupuesto, tablero, arrastrar y soltar, ventanas de información, revisión |
| `js/budget.js` | Reglas puras, sin DOM: `cardCatalog`, `requiredLevels`, `evaluatePlan` |
| `data/segments.json` | Tarjetas de Espacio, Tierra y Usuario; niveles exigidos; márgenes; penalizaciones; umbrales de CML |
| `data/rockets.json` | Tarjetas de Lanzamiento (Rol 2) |
| `data/i18n/{es,en}/mission.json` | Todos los textos (preguntas, ayudas, alertas, bloqueos) |
| `css/screens/mission.css` | Estilos. Conserva `.segment-row`, que usa el Taller |
| `tests/budget.test.html` | 15 pruebas: misiones óptimas, sobredimensionado, insuficiente, omisión, exceso e integración con el Taller |

## 6. Cómo ajustarlo

- **Cambiar costos o agregar tarjetas:** edita `data/segments.json` (cada tarjeta: `id`, `level`, `cost`, `icon`, `name`, `desc` bilingües). Después abre `tests/budget.test.html`. La prueba «con $X de Espacio el Taller permite el diseño de referencia» avisa si el Nivel 2 se vuelve imposible.
- **Hacerlo más o menos estricto:** `rules.margin` (tolerancia por segmento), `penalty.perExcessLevel` y `cmlCap`.
- **Agregar un destino:** necesita su entrada en `missions.json`, `requirements.space` y `requirements.user` en `segments.json`, y algún cohete con ese destino en `rockets.json`.

## 7. Decisiones de diseño

- **3 tarjetas por segmento y no 1:** con una sola tarjeta por segmento bastaría moverlas todas y no habría ninguna decisión que tomar. Con tres aparece el trade-off.
- **Presupuesto por destino y no un valor fijo de $100M:** con un tope fijo de 100 M$, Europa sería imposible, porque solo el cohete que la alcanza cuesta 80 M$.
- **Sobredimensionar no bloquea, solo penaliza:** refleja la realidad de que una misión cara puede aprobarse, pero con menor madurez. Lo que sí bloquea es lo que haría fallar la misión.
- **Dentro de la arquitectura modular y no como `index.html` autocontenido:** `docs/context.md` pide datos desacoplados en `/data`, y las otras pantallas dependen del router y del estado compartido.
- **Accesibilidad:** el arrastre es opcional (botones equivalentes) y el foco vuelve a la tarjeta movida. El estado no depende solo del color (ícono + texto) y el mensaje de validación usa `aria-live`.

## 8. Pendientes conocidos

- El Reporte (Rol 4) aún no limita el CML final con `plan.cmlCap`. Basta una línea en `js/screens/report.js`: `cml = Math.min(cml, state.plan.cmlCap)`.
- En pantallas táctiles el arrastre HTML5 no funciona: se usan los botones Añadir/Quitar.
- Falta una prueba visual en navegador real (escritorio y móvil), ES y EN.
