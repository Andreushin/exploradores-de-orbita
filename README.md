# 🚀 Exploradores de Órbita (Orbit Explorers) — Space Mission Design Game

**Equipo:** Parche ColomboMexicano · **Challenge:** NASA Space Apps 2026 — Space Mission Design Game

**▶ Jugar:** https://andreushin.github.io/exploradores-de-orbita/ · **Repo:** https://github.com/Andreushin/exploradores-de-orbita · **Tablero:** https://github.com/users/Andreushin/projects/2

Juego web de un jugador (HTML5 + CSS3 + JavaScript vanilla, sin frameworks), bilingüe ES/EN. Eres director de una misión científica: defines qué vas a estudiar y armas los 4 segmentos de la misión, ensamblas un CubeSat bajo restricciones reales de masa, volumen y energía, viajas con combustible finito (ecuación de Tsiolkovsky) y ejecutas la inserción orbital. Al final recibes datos científicos simulados y tu nivel de madurez CML de la NASA.

**La idea central:** los requisitos científicos dictan la ingeniería. Cada decisión tiene consecuencias visibles. Un satélite más pesado gasta más combustible. Lo que falta pone en riesgo la misión, y lo que sobra sin justificación baja la madurez.

## Cómo correrlo
```bash
git clone https://github.com/Andreushin/exploradores-de-orbita.git
cd exploradores-de-orbita
python3 -m http.server 8000
# abrir http://localhost:8000
```
> Abrir `index.html` con doble clic no funciona: el navegador bloquea `fetch()` de los JSON en `file://`.

## Los 4 niveles
| Nivel | Qué hace el jugador | Recurso NASA | Dónde vive |
|---|---|---|---|
| **1 · Diseña tu misión** | Nombre del proyecto, destino (Luna, Marte, Europa), objetivo científico y una tarjeta por segmento (Lanzamiento, Espacio, Tierra, Usuario). Lo insuficiente bloquea; lo sobredimensionado baja la madurez. | Design and Develop Science Missions | app principal |
| **2 · Taller del CubeSat** | Factor de forma, energía, propulsión, radio, ADCS, computadora e instrumentos. Los incompatibles con el objetivo aparecen en gris; medidores en vivo de masa, energía, costo y Δv. | CubeSat 101 | `nivel2/` |
| **3 · Travesía e inserción** | Presupuesto de Δv, combustible en kg que depende de la masa, corrección de trayectoria, un evento en ruta y el frenado orbital. Sin combustible hay un reintento educativo. | GMAT / NASA Mission Viz | `nivel3/` |
| **4 · Reporte** | Resultado, CML final (con el tope del plan), datos científicos por instrumento comparados con misiones reales y qué mejorar. | Concept Maturity Levels | app principal |

Inspiración de UX: *A Learning Game About Telescopes* (NASA/Webb), con opciones incompatibles explicadas y retroalimentación inmediata.

## Recursos de la NASA utilizados
| Recurso | Uso |
|---|---|
| Design and Develop Science Missions | 4 segmentos de la misión y su relación con los requisitos científicos (Nivel 1) |
| CubeSat 101 | Unidades U, 1.33 kg/U, subsistemas, restricciones de energía (Nivel 2) |
| GMAT / NASA Mission Viz | Maniobras impulsivas, relación masa–propelente–Δv, transferencias de Hohmann (Nivel 3) |
| Concept Maturity Levels (CML) | Evaluación final de la madurez del concepto (Nivel 4) |

Detalle de valores y fuentes: [`docs/fuentes.md`](docs/fuentes.md).

## Estructura
```
index.html                 app principal (Inicio, menú de niveles, Nivel 1 y Nivel 4)
js/main.js                 router, header y guardado de la misión
js/state.js · i18n.js      estado de la app y traducciones (data/i18n/{es,en}/*.json)
js/levels.js               catálogo de niveles y desbloqueo
js/mision-store.js         contrato de datos entre niveles (localStorage: eo-mision)
js/physics.js              Tsiolkovsky, validación del diseño, puntaje y CML
js/screens/                start, levels, mission (+ mission-scenes), report
js/budget.js               reglas del Nivel 1 · js/science-data.js: reglas del Nivel 4
js/taller-reglas.js        reglas del Nivel 2 · js/canvas/starry-bg.js: fondo del inicio
nivel2/  nivel3/           niveles en página aislada (index.html, nivelN.css, nivelN.js, textos.js)
data/                      misiones, cohetes, piezas, eventos, segmentos, taller, ciencia
css/                       base.css + estilos de cada pantalla de la app principal
tests/                     pruebas en el navegador (physics, science, report, budget)
docs/                      contrato-niveles.md, fuentes.md y niveles/nivel-1…4.md
```

Cómo trabajamos en equipo: [`CONTRIBUTING.md`](CONTRIBUTING.md).
