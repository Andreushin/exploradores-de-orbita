# 🚀 Exploradores de Órbita (Orbit Explorers) — Space Mission Design Game

**Equipo:** Parche ColomboMexicano · **Challenge:** NASA Space Apps 2026 — Space Mission Design Game

**▶ Jugar:** https://andreushin.github.io/exploradores-de-orbita/ · **Repo:** https://github.com/Andreushin/exploradores-de-orbita · **Tablero:** https://github.com/users/Andreushin/projects/2

Juego web de un jugador (HTML5 + CSS3 + JavaScript vanilla) donde diseñas una misión científica: repartes el presupuesto entre los 4 segmentos de una misión, ensamblas un CubeSat bajo restricciones reales de masa, volumen y energía, viajas con combustible finito (ecuación de Tsiolkovsky) y ejecutas la inserción orbital. Al final recibes datos científicos simulados y un nivel de madurez CML de la NASA.

## Cómo correrlo
```bash
git clone https://github.com/Andreushin/exploradores-de-orbita.git
cd exploradores-de-orbita
python3 -m http.server 8000
# abrir http://localhost:8000
```
> Abrir `index.html` con doble clic no funciona: el navegador bloquea `fetch()` de los JSON en `file://`.

## Flujo
1. **Misión y presupuesto** — destino (Luna, Marte, Europa), cohete y reparto Lanzamiento / Espacio / Tierra / Usuario.
2. **Taller CubeSat** — factor de forma (3U/6U/12U), energía, propulsión, comunicaciones, ADCS, computadora e instrumentos.
3. **Travesía e inserción** — animación en Canvas, eventos con decisiones, quemado de frenado interactivo.
4. **Reporte** — resultado, datos científicos simulados y barra CML 1–4.

## Recursos de la NASA utilizados
| Recurso | Uso |
|---|---|
| Design and Develop Science Missions | 4 segmentos (Lanzamiento, Espacio, Tierra, Usuario) para el presupuesto |
| CubeSat 101 | Unidades U, 1.33 kg/U, subsistemas, restricciones de energía |
| GMAT / NASA Mission Viz | Relación masa–propelente–Δv e inserción orbital |
| Concept Maturity Levels (CML) | Barra de madurez del reporte final |

Detalle de valores y fuentes: [`docs/fuentes.md`](docs/fuentes.md).

## Estructura
```
index.html            css/base.css  css/screens/*.css
js/main.js  js/state.js  js/i18n.js  js/physics.js
js/screens/{mission,workshop,journey,report}.js   js/canvas/draw.js
data/{missions,rockets,pieces,events}.json        data/i18n/{es,en}/*.json
tests/physics.test.html
```
Cómo trabajamos en equipo: [`CONTRIBUTING.md`](CONTRIBUTING.md).
