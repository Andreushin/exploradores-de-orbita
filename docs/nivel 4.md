# 🛰️ Especificación Técnica: Pantalla / Nivel 4 (Siderense Rocket Labs)
**Módulo independiente:** Carpeta `nivel4/` (Archivos aislados: `index.html`, `nivel4.css`, `nivel4.js`)

## 🎯 Objetivo de la Pantalla
Mostrar el reporte final de éxito o fracaso, presentar los datos científicos simulados (inspirados en misiones reales de la NASA) y evaluar el proyecto mediante el marco de [Concept Maturity Levels (CMLs)](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299)[cite: 1].

## 📊 Componentes del Reporte Final
- **Barra de Madurez CML:** Muestra el nivel técnico alcanzado (CML 1 al 4) según las decisiones tomadas en las pantallas anteriores[cite: 1].
- **Datos Científicos Simulados:** Visualización de curvas de luz o espectros generados por el CubeSat, comparándolos conceptualmente con misiones reales de la NASA.
- **Botón de Reinicio / Menú Principal:** Permite volver a jugar para optimizar el presupuesto.

## 🚫 Aislamiento Estructural
- **Aislamiento de Estilos:** Usar estrictamente `nivel4.css`.
- Garantizar que las rutas de redirección hacia el menú principal o repositorios funcionen de manera limpia al desplegar en Firebase Hosting o GitHub Pages.