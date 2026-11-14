# 🛰️ Especificación Técnica: Pantalla / Nivel 3 (Siderense Rocket Labs)
**Módulo independiente:** Carpeta `nivel3/` (Archivos aislados: `index.html`, `nivel3.css`, `nivel3.js`)

## 🎯 Objetivo de la Pantalla
Simulación del viaje espacial hacia el destino remoto y la inserción orbital. Toma como referencia los conceptos de trayectorias y propulsión de [General Mission Analysis Tool (GMAT)](https://software.nasa.gov/software/GSC-19468-1) y la visualización interactiva de [NASA Mission Viz](https://nasa.github.io/mission-viz/).

## 🚀 Mecánicas de Juego y Visualización
- **Combustible Finito ($\Delta v$):** El consumo de combustible durante el trayecto se calcula dinámicamente en función del peso total del CubeSat diseñado en la Pantalla 2 (a mayor masa, mayor consumo de combustible para frenar y entrar en órbita).
- **Toma de Decisiones Críticas:** El usuario toma decisiones en puntos clave del trayecto (ej. *Corrección de trayectoria* y *Maniobra de frenado orbital*).

## 🚫 Reglas de Negocio y Aislamiento
- Si el combustible se agota debido a un satélite sobredimensionado, la misión fracasa y se muestra una pantalla de reintento educativo.
- **Aislamiento de Estilos:** Usar estrictamente `nivel3.css`.
- Al finalizar con éxito, se redirige a la carpeta `nivel4/`.