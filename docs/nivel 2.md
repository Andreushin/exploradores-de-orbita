# 🛰️ Especificación Técnica: Pantalla / Nivel 2 (Siderense Rocket Labs)
**Módulo independiente:** Carpeta `nivel2/` (Archivos aislados: `index.html`, `nivel2.css`, `nivel2.js`)

## 🎯 Objetivo de la Pantalla
El jugador entra al taller de ensamblaje espacial. Basado en el documento oficial [Cubesat 101 - Basic Concepts and Processes for First-Time CubeSat Developers](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf), el usuario elige el factor de forma (1U, 3U, 6U) y los instrumentos científicos bajo los límites estrictos de masa, energía y presupuesto heredados de la Pantalla 1[cite: 1].

## 🃏 Componentes y Reglas de Interacción
- **Factores de Forma (CubeSat Units):**
  - *1U:* Económico pero con espacio mínimo.
  - *3U:* Balance óptimo para misiones científicas estándar.
  - *6U:* Alta capacidad instrumental pero mayor costo de lanzamiento.
- **Validación Inteligente (Inspirado en [A Learning Game About Telescopes](https://science.nasa.gov/mission/webb/game-build-it-yourself/)):**
  - Si el usuario selecciona un instrumento incompatible con la categoría elegida en la Pantalla 1, **el sistema lo deshabilitará automáticamente (en gris)** y explicará la razón técnica.
  - Medidores en vivo de masa total (gramos) y consumo energético (Watts).

## 🚫 Reglas de Negocio y Aislamiento
- Si la masa acumulada supera el límite del cohete seleccionado en el Nivel 1, se bloquea la salida y se advierte que el cohete no podrá despegar.
- **Aislamiento de Estilos:** Usar estrictamente `nivel2.css`. No compartir clases con otras pantallas.
- Al validar con éxito, los datos del satélite se guardan en `localStorage` y redirigen a la carpeta `nivel3/`.