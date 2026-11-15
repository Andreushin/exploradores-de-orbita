# NASA Atlas-Agena D - Modelo 3D Interactivo WebGL

Visualización 3D interactiva de alta fidelidad del lanzador y vehículo objetivo **Atlas-Agena D** de la NASA (1965-1966), clave durante el **Proyecto Gemini** y misiones interplanetarias históricas como Mariner y Lunar Orbiter.

---

## 📦 Contenido del Paquete

1. **`index.html`**
   - Portal unificado con pestañas interactivas para alternar entre el cohete completo ensamblado y el despiece interactivo.

2. **`atlas-agena-assembled.html`**
   - Cohete Atlas-Agena D completo (32.0 metros de altura).
   - Tanque de acero inoxidable presurizado ("Balloon Tank") con reflejo metálico pulido y rotulación vertical `UNITED STATES`.
   - Banda de damero blanco y negro (*roll checkerboard*) de alta precisión en la interetapa.
   - Encendido interactivo de motores Rocketdyne (`🔥 Encender Motores Rocketdyne`) con columnas de fuego y luz dinámica.
   - 4 cámaras guiadas:
     - *Vista Global*: Todo el vehículo espacial en perspectiva cinematográfica.
     - *Agena D / ATV*: Vehículo objetivo con puerto de atraque TDA y antenas de radar.
     - *Tanque Atlas*: Acero inoxidable pulido y tuberías de alimentación LOX.
     - *Motores Booster*: Detalle de los motores XLR89, sustainer XLR105 y vernier.

3. **`atlas-agena-exploded.html`**
   - Despiece interactivo tridimensional:
     1. **Cofia Aerodinámica (Nose Shroud)**: Protector superior cónico con apertura de eyección.
     2. **Vehículo Objetivo Agena D (ATV)**: Etapa superior con motor Bell 8096 (XLR81), adaptador de acoplamiento TDA para Gemini, antenas de radar y calcomanía de la bandera de EE.UU.
     3. **Interetapa Atlas-Agena**: Cono de transición con el damero blanco y negro de referencia óptica.
     4. **Tanque Atlas SLV-3**: Estructura de acero inoxidable con rotulado y motor sustainer central.
     5. **Faldón Desechable Booster**: Arquitectura "Stage and a half" con los dos motores de aceleración XLR89 y toberas vernier.
   - Control deslizante de separación manual (0% = Ensamblado, 100% = Despiece total).
   - Modo automático de respiración (`⚡ Separación Auto`).
   - Clic interactivo en cualquier pieza para desplegar ficha histórica con especificaciones técnicas reales de la NASA.

---

## 🚀 Cómo Integrar en tu Página Web

### Opción A: Mediante un iframe (Recomendado)
Copia `atlas-agena-assembled.html` y/o `atlas-agena-exploded.html` a la carpeta pública de tu web:

```html
<!-- Cohete Completo Ensamblado -->
<iframe 
  src="atlas-agena-assembled.html" 
  width="100%" 
  height="700px" 
  style="border: none; border-radius: 12px; overflow: hidden;"
  allow="autoplay; fullscreen">
</iframe>

<!-- Despiece Interactivo -->
<iframe 
  src="atlas-agena-exploded.html" 
  width="100%" 
  height="700px" 
  style="border: none; border-radius: 12px; overflow: hidden;"
  allow="autoplay; fullscreen">
</iframe>
```

### Opción B: Ejecución Local Directa
Haz doble clic en cualquiera de los archivos `.html` (`index.html`, `atlas-agena-assembled.html` o `atlas-agena-exploded.html`) en tu navegador web favorito (Chrome, Edge, Firefox, Brave, Safari). Funciona de inmediato sin necesidad de servidores locales.

---

© NASA / Gemini Mission Archive & Horizon Models.
