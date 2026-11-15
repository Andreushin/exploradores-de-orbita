# SpaceX Falcon Heavy - Modelo 3D Interactivo WebGL

Visualización 3D interactiva de alta fidelidad del cohete **Falcon Heavy de SpaceX**, el vehículo espacial superpesado operativo más potente de la era moderna, con sus tres núcleos propulsores (Center Core y 2 Side Boosters) y un total de 27 motores Merlin 1D.

---

## 📦 Contenido del Paquete

1. **`index.html`**
   - Portal unificado con selector por pestañas para alternar entre el cohete completo ensamblado y el despiece interactivo.

2. **`falcon-heavy-assembled.html`**
   - Cohete Falcon Heavy completo de 70 metros de altura a escala real:
     - **3 Núcleos de Primera Etapa (Triple Core)**: Center Core y 2 Side Boosters con sus conos aerodinámicos superiores.
     - **27 Motores Merlin 1D**: Distribución Octaweb en cada núcleo (8 exteriores en círculo + 1 central x 3 núcleos).
     - **12 Aletas de Rejilla Hipersónicas (Grid Fins)**: 4 en cada núcleo, modeladas en titanio forjado para guiado atmosférico.
     - **12 Trenes de Aterrizaje de Fibra de Carbono (Landing Legs)**: Plegados en la base de los 3 núcleos.
     - **Segunda Etapa & Interetapa de Fibra de Carbono**: Estructura de composite con motor de vacío.
     - **Cofia Aerodinámica de 5.2 Metros**: Acabado blanco con emblema de misión USSF (Fuerza Espacial) y SpaceX.
   - Botón interactivo `🔥 Encender 27 Motores Merlin 1D` con columnas de fuego gemelas simultáneas y luz reactiva.
   - Botón interactivo `🦵 Trenes de Aterrizaje` con animación cinemática suave de despliegue angular.
   - 4 Cámaras guiadas preestablecidas:
     - *Vista Global*: Todo el vehículo superpesado en perspectiva cinematográfica.
     - *Cofia & 2da Etapa*: Acercamiento a la cofia de 5.2 m y segunda etapa.
     - *Grid Fins*: Detalle de las aletas de rejilla de titanio.
     - *Base Octaweb (27)*: Primer plano de los 27 motores Merlin 1D y faldón de popa.

3. **`falcon-heavy-exploded.html`**
   - Despiece interactivo tridimensional CAD:
     1. **Cofia Bipartita (Fairing Clamshell)**: Las dos mitades se abren lateralmente dejando al descubierto la carga útil en su interior (satélite con paneles solares).
     2. **Segunda Etapa & MVac**: Cilindro con el gigantesco motor Merlin 1D Vacuum y tobera de niobio radiante.
     3. **Interetapa de Fibra de Carbono**: Anillo de separación con empujadores neumáticos y domo LOX.
     4. **Núcleo Central (Center Core)**: Con sus 4 grid fins, trenes de aterrizaje y Octaweb de 9 motores Merlin.
     5. **Propulsor Lateral 1 (Side Booster B10xx-L)**: Se separa hacia la izquierda reproduciendo la maniobra de separación del Falcon Heavy.
     6. **Propulsor Lateral 2 (Side Booster B10xx-R)**: Se separa hacia la derecha reproduciendo la maniobra de separación del Falcon Heavy.
   - Control deslizante manual de separación (0% = Ensamblado, 100% = Despiece total).
   - Animación automática de respiración (`⚡ Separación Auto`).
   - Clic interactivo sobre cualquier parte para abrir tarjeta de telemetría y especificaciones técnicas de SpaceX.

---

## 🚀 Cómo Integrar en tu Página Web

### Opción A: Mediante un iframe (La forma más fácil y limpia)
Copia `falcon-heavy-assembled.html` y/o `falcon-heavy-exploded.html` a la carpeta pública de tu web y añade:

```html
<!-- Cohete Completo Ensamblado -->
<iframe 
  src="falcon-heavy-assembled.html" 
  width="100%" 
  height="700px" 
  style="border: none; border-radius: 12px; overflow: hidden;"
  allow="autoplay; fullscreen">
</iframe>

<!-- Despiece Interactivo -->
<iframe 
  src="falcon-heavy-exploded.html" 
  width="100%" 
  height="700px" 
  style="border: none; border-radius: 12px; overflow: hidden;"
  allow="autoplay; fullscreen">
</iframe>
```

### Opción B: Ejecución Local Directa
Simplemente haz doble clic en cualquiera de los archivos `.html` (`index.html`, `falcon-heavy-assembled.html` o `falcon-heavy-exploded.html`) en tu navegador preferido (Chrome, Edge, Firefox, Brave, Safari). No requiere servidores locales ni dependencias externas; Three.js se carga automáticamente vía CDN segura (cdnjs).

---

© SpaceX / NASA / USSF Archive.
