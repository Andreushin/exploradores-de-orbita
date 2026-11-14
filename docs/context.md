# CONTEXT.MD — Siderense Rocket Labs (NASA Space Apps Challenge)
 
## 🎯 1. Visión General del Proyecto (Qué se quiere)
**Siderense Rocket Labs** es un juego web interactivo de un solo jugador ejecutado directamente en el navegador (Vanilla HTML, CSS y JavaScript moderno). El juego enseña ingeniería de sistemas espaciales mediante la toma de decisiones basada en restricciones reales. 
El usuario asume el rol de director de misión, debiendo gestionar un presupuesto inicial, diseñar un satélite CubeSat, gestionar combustible finito y lograr una inserción orbital exitosa alrededor de un destino remoto, cerrando con un reporte de madurez técnica (CML).

---

## 👥 2. Público Objetivo y Jueces (A quiénes va enfocado)
- **Audiencia principal:** Jueces oficiales del **NASA Space Apps Challenge**, entusiastas del espacio, estudiantes y público general interesado en la divulgación científica.
- **Criterios de evaluación clave:** 
  - Uso correcto y justificado de datos y recursos oficiales de la NASA.
  - Viabilidad técnica y claridad educativa (cómo el juego demuestra que los requisitos científicos dictan la ingeniería).
  - Experiencia de usuario (UI/UX) limpia, responsiva y funcional en un link público.

---

## 🛠️ 3. Stack Tecnológico y Restricciones (Qué se necesita técnicamente)
- **Frontend:** HTML5, CSS3 y JavaScript puro (ES6+). **Cero frameworks** (sin React, Angular, o bundlers complejos) para garantizar un despliegue instantáneo y evitar fallos de compilación en 48 horas.
- **Gestión de Datos:** Archivos JSON desacoplados en una carpeta `/data` (`missions.json`, `pieces.json`, etc.) para separar la lógica de negocio de los valores numéricos.
- **Despliegue Autónomo:** Firebase Hosting conectado a un repositorio de GitHub mediante GitHub Actions (archivo `.yml`), integrado con un dominio de GoDaddy Registry para la versión final.

---

## 🛰️ 4. Referencias y Recursos Oficiales de la NASA Obligatorios
El proyecto se fundamenta estrictamente en la documentación provista por el challenge **Space Mission Design Game**:
1. **[Design and Develop Science Missions (DDSM)](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources):** Estructura los 4 segmentos de misión (Lanzamiento, Espacio, Tierra, Usuario) que el jugador configura en el Nivel 1.
2. **[Cubesat 101](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources):** Proporciona los rangos de masa, factores de forma (1U, 3U, 6U) y restricciones energéticas para el taller de ensamblaje (Nivel 2).
3. **[General Mission Analysis Tool (GMAT) / NASA Mission Viz](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources):** Inspira la lógica de combustible finito y trayectorias (Nivel 3).
4. **[Concept Maturity Levels (CMLs)](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources):** Marco de referencia para evaluar y graficar la madurez del diseño en la pantalla final de resultados.
5. **Inspiración UX/UI:** Modelo didáctico tomado de *A Learning Game About Telescopes* (validación inteligente de opciones incompatibles y retroalimentación interactiva).

---

## ⚠️ 5. Reglas de Diseño y Lógica de Negocio (Qué se espera y qué NO hacer)

### Lo que SÍ se espera:
- **Validación en tiempo real:** Cada clic o ajuste en los inputs debe actualizar instantáneamente las métricas visibles (presupuesto restante, masa acumulada, viabilidad).
- **Equilibrio de recursos (*Trade-offs*):** Demostrar que las decisiones tienen consecuencias (un satélite más pesado consume más combustible en la travesía).
- **Enfoque educativo riguroso:** Si una combinación de piezas o presupuesto no es viable físicamente, el sistema debe advert