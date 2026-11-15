# NASA Apolo 11 / Saturno V - Modelo 3D Interactivo WebGL

Visualización 3D interactiva de alta fidelidad del cohete **Saturno V de la misión Apolo 11 (1969)**, modelado conforme a los diagramas esquemáticos oficiales de la NASA.

---

## 📦 Contenido del Paquete

1. **`index.html`**
   - Portal unificado con selector por pestañas para alternar entre el cohete completo ensamblado y el despiece interactivo.

2. **`apollo11-assembled.html`**
   - Cohete Saturno V completo de 110.6 metros totalmente ensamblado.
   - Encendido interactivo de motores F-1 (`🔥 Encender Motores F-1`) con columnas de fuego gemelas y luz volumétrica dinámica.
   - 4 cámaras guiadas:
     - *Vista Global*: Todo el vehículo espacial en perspectiva cinematográfica.
     - *Nave Apolo (CSM/LES)*: Módulo de Mando, Servicio y Torre de Escape.
     - *Segunda Etapa (S-II)*: Interetapas y motores J-2 criogénicos.
     - *Motores F-1*: Detalle de las 5 toberas Rocketdyne F-1 y aletas aerodinámicas.
   - Rotación automática de órbita y telemetría de misión en tiempo real.

3. **`apollo11-exploded.html`**
   - Despiece interactivo vertical y lateral de todas las fases del Saturno V:
     1. **S-IC (Primera Etapa)**: 5 motores F-1, 4 aletas estabilizadoras, patrón de giro blanco y negro, letras "USA" en rojo y banderas de EE.UU.
     2. **S-II (Segunda Etapa)**: 5 motores criogénicos J-2, interetapa acanalada, rotulación "UNITED STATES".
     3. **S-IVB (Tercera Etapa) & SLA**: Motor J-2 para inyección translunar (TLI), Unidad de Instrumentos (IU) y adaptador cónico.
     4. **CSM (Columbia)**: Módulo de Servicio cilíndrico de aluminio pulido con motor SPS y Módulo de Mando cónico reflectivo.
     5. **LES (Launch Escape System)**: Torre reticular de titanio, motor de escape y torre de eyección.
     6. **LM (Eagle / Águila)**: Módulo Lunar independiente inspeccionable con láminas doradas de Kapton, 4 patas de aterrizaje y etapa de ascenso de titanio y aluminio.
   - Control deslizante manual de separación (0% = Ensamblado, 100% = Despiece total).
   - Animación automática de respiración / separación (`⚡ Separación Auto`).
   - Clic interactivo sobre cualquier parte para abrir tarjeta de telemetría e historia con especificaciones técnicas detalladas.

---

## 🚀 Cómo Integrar en tu Página Web

### Opción A: Mediante un iframe (La forma más fácil y limpia)
Copia `apollo11-assembled.html` y/o `apollo11-exploded.html` a la carpeta pública de tu web y añade:

```html
<!-- Cohete Completo Ensamblado -->
<iframe 
  src="apollo11-assembled.html" 
  width="100%" 
  height="700px" 
  style="border: none; border-radius: 12px; overflow: hidden;"
  allow="autoplay; fullscreen">
</iframe>

<!-- Despiece Interactivo -->
<iframe 
  src="apollo11-exploded.html" 
  width="100%" 
  height="700px" 
  style="border: none; border-radius: 12px; overflow: hidden;"
  allow="autoplay; fullscreen">
</iframe>
```

### Opción B: Ejecución Local
Simplemente haz doble clic en cualquiera de los archivos `.html` (`index.html`, `apollo11-assembled.html` o `apollo11-exploded.html`) en tu navegador preferido (Chrome, Edge, Firefox, Brave, Safari). No requiere servidores locales ni dependencias externas; Three.js se carga automáticamente vía CDN segura (cdnjs).

---

© NASA / Apollo 11 Mission Archive.
