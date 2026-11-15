# Simulador de cohetes reales · fuentes, modelo y calibración

Prototipo local (rama `feat/simulador-cohetes`, sin publicar). Tres cohetes reales, cada uno con la misión real que le corresponde en el juego:

| Cohete | Misión del juego | Misión real |
|---|---|---|
| Saturno V (AS-506) | Luna | Apolo 11, 16-jul-1969 |
| Atlas LV-3 Agena D | Marte | Mariner 4, 28-nov-1964: la primera nave que llegó a Marte |
| Falcon Heavy (desechable) | Europa / Júpiter | Europa Clipper, 14-oct-2024 |

Los modelos 3D son de JU4NMAX (`modelos/originales/`). `modelos/*.js` se generan desde ellos: solo la construcción del cohete, sin cambios.

## Fuentes de los datos (`cohetes.json`)

**Saturno V / Apolo 11 (NASA)**
- *Saturn V Launch Vehicle Flight Evaluation Report AS-506* (NASA; [texto](https://archive.org/stream/nasa_techdoc_19900066485/19900066485_djvu.txt)):
  - masa al encender: 2 938 315 kg; al soltar los brazos de sujeción: 2 899 008 kg; al cortar la S-IC: 827 292 kg;
  - S-IC seca: 130 122 kg; interetapas: 5 206 y 3 663 kg; S-II seca: 36 158 kg; S-IVB: 119 119 kg total y 11 189 kg seca;
  - unidad de instrumentos: 1 939 kg; nave: 45 693 kg;
  - tiempos: corte del motor central de la S-IC a 135.20 s, corte de la S-IC a 161.63 s, LES a 197.9 s, motor central de la S-II a 460.6 s, corte de la S-II a 548.22 s, órbita a 709.34 s (183.8 × 186.5 km), TLI de 346.9 s.
- *Apollo 11 Mission Operations Report* M-932-69-11 ([PDF](https://faculty.tamuc.edu/cdavis/resources/apollo_press/Apollo%2011%20Mission%20Operations%20Report.pdf)) y [Press Kit](https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_PressKit.pdf): masas por etapa en libras.
- Isp de F-1 y J-2: [Saturn V](https://en.wikipedia.org/wiki/Saturn_V), [S-IC](https://en.wikipedia.org/wiki/S-IC).
- Motores: F-1 de 1 522 000 lbf (= 6 770 kN) al nivel del mar y Isp 265 s ([Purdue/Rocketdyne](https://engineering.purdue.edu/AAE/research/propulsion/Info/rockets/liquids/f1)); J-2 de 1 033.1 kN en vacío, Isp 421 s en vacío y 200 s al nivel del mar ([Rocketdyne J-2](https://www.wikipedia.org/wiki/J-2S), [Astronautix](https://dcmpx.remotevs.com/com/astronautix/www/PL/j/j-2.html)).
- Torre de escape (LES): 4 200 kg ([Drew Ex Machina](https://www.drewexmachina.com/2024/12/08/apollo-a-002-testing-the-limits-of-the-launch-escape-system/)); el empuje de su motor (147 000 lbf) y el del motor de desprendimiento (31 500 lbf) vienen de la [tabla de datos clave del Apolo](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_18-13_Launch_Vehicle-Spacecraft_Key_Facts.htm), que no da su masa. La masa de la torre es la de un ensayo: no es la de vuelo del AS-506.

**Atlas LV-3 Agena D / Mariner 4**
- Mariner 4, 260.7 kg: [JPL Mission Library](https://space.jpl.nasa.gov/msl/QuickLooks/mariner34QL.html) y [Mariner 4](https://en.wikipedia.org/wiki/Mariner_4).
- Encendidos del Agena: 2 min 24 s a la órbita de espera y 1 min 35 s hacia Marte (relato de la misión, misma fuente).
- Etapas: [Atlas Agena D](https://astronautix.com/a/atlasagenad.html) y [Agena D](http://www.astronautix.com/a/agenad.html) en Encyclopedia Astronautica (Agena 6 821 kg total, 673 kg seca, 71.17 kN, Isp 300 s); [Atlas-Agena](https://en.wikipedia.org/wiki/Atlas-Agena); [MA-2](https://en.wikipedia.org/wiki/MA-2_(rocket_stage)) (~1 517 kN al despegar); 117 934 kg y 28.4 m en total.
- **Sin fuente independiente:** la cofia (500 kg) es el residuo del total publicado, y el reparto del propelente del Atlas sale de ese mismo total. Mariner 4 voló con una cofia metálica nueva, pero ninguna fuente consultada da su masa ([relato JPL/Drew Ex Machina](https://www.drewexmachina.com/mariner-4-to-mars/)).

**Falcon Heavy / Europa Clipper**
- [NASA – Liftoff of Europa Clipper](https://science.nasa.gov/blogs/europa-clipper/2024/10/14/liftoff-of-nasas-europa-clipper-2/); [JPL – press kit](https://www.jpl.nasa.gov/press-kits/europa-clipper/mission/): Falcon Heavy completamente desechable y ruta con asistencias de Marte (2025) y la Tierra (2026).
- [NASASpaceFlight](https://www.nasaspaceflight.com/2024/10/europa-clipper-launch/) y [Space.com](https://www.space.com/spacex-falcon-heavy-europa-clipper-launch): núcleo central desechado a 4 min 11 s y la afirmación de que el Falcon Heavy *no* podía mandarla directo a Júpiter.
- Masa de 6 065 kg: [Europa Clipper](https://en.wikipedia.org/wiki/Europa_Clipper).
- Etapas (Falcon 9 Block 5: 1.ª etapa 25.6 t seca y 395.7 t de propelente; 2.ª etapa 4 t y 107.5 t; Merlin 1D 845 kN, Isp 282/311 s; MVac 981 kN, Isp 348 s): [Falcon Heavy](https://en.wikipedia.org/wiki/Falcon_Heavy). Son fuentes secundarias: spacex.com no se pudo consultar.
- **Sin fuente:** la cofia (1 900 kg) y la regulación del núcleo central, ajustada para que su separación coincida con T+4:11. La búsqueda de la masa de la cofia del Falcon 9 no dio ninguna cifra; las dimensiones (5.2 m × 13.1 m) sí vienen de [SpaceX](https://www.spacex.com/vehicles/falcon-9/).

## Modelo físico (`ascenso.js`)
- **Ascenso** en el plano de la trayectoria, en coordenadas inerciales con centro en la Tierra:
  - gravedad μ/r²;
  - rotación terrestre según la latitud del sitio;
  - Isp interpolado entre nivel del mar y vacío según la presión;
  - arrastre ½ρv²·Cd·A (Cd = 0.5) con la atmósfera de [NASA Glenn](https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html) hasta 50 km y una caída exponencial más arriba.
- **Guiado:** programa de cabeceo en la atmósfera, como los cohetes reales. Después, la etapa superior busca la órbita de ~185 km y se apaga cuando el perigeo llega a la meta. El programa de cada cohete se calibró buscando una órbita circular y los tiempos históricos.
- **Salida al destino:** la ecuación del cohete con el propelente que queda en la etapa superior y un encendido impulsivo.
  - C3 = v² − 2μ/r.
  - El C3 necesario sale de la **transferencia de Hohmann**: Luna ≈ −2.0; Marte ≈ 8.7 (InSight lanzó con 8.19 y MAVEN con 12.2); Júpiter directo ≈ 77.3 km²/s².
  - No se encontró el C3 publicado de Mariner 4 ni el de Europa Clipper, así que no se inventa.

## Calibración contra la historia (`tests/simulador.test.mjs`, 36 pruebas)
| | Simulado | Real | Diferencia |
|---|---|---|---|
| Saturno V · corte de la S-IC | 166 s | 161.63 s | +2.6 % |
| Saturno V · corte de la S-II | 553 s | 548.22 s | +0.9 % |
| Saturno V · órbita | 705 s, 170 × 188 km | 709.34 s, 183.8 × 186.5 km | −0.6 % |
| Agena · 1.er encendido | 140 s | 144 s | −3 % |
| Agena · encendido a Marte | 108 s | 95 s | +14 % |
| Falcon Heavy · separación del núcleo central | 244 s | 251 s | −3 % |
| **Falcon Heavy → Marte (carga máx.)** | **16 763 kg** | 16 800 kg (SpaceX) | −0.2 % |
| **Saturno V → Luna (carga máx.)** | **48 041 kg** | ~48 t | ✓ |
| Europa Clipper directo a Júpiter | no llega (C3 70.8 < 77.3) | no podía | ✓ |

Las dos capacidades **no se ajustaron a mano**: salen solas de los datos de las etapas. Es la mejor señal de que el modelo es razonable.

**Lo que no cuadra:**
- La TLI del Saturno V dura 287 s contra 346.9 s reales (−17 %). El simulador calcula el mínimo para llegar a la distancia lunar; el Apolo 11 tomó una trayectoria de retorno libre, y el J-2 cambió su mezcla durante el encendido.
- La ficha del modelo 3D del Atlas menciona las misiones Gemini (vehículo blanco Agena). Mariner 4 voló en un Atlas LV-3 Agena D con otra cofia.

## Vista 3D (`escena.js`)
- Three.js 0.160.0, la misma versión que los modelos originales.
- **Vista local** a escala real (1 unidad = 1 m) con **origen flotante**: el cohete queda en el origen y la Tierra se mueve, así no tiembla por la precisión numérica.
- **Vista global** en km, con la órbita y la salida al destino.
- El mapa de la Tierra es **estilizado** (no es un mapa real) y no descarga imágenes.
- Las etapas se sueltan según la asignación de piezas de `modelos/index.js` y caen con gravedad.

## Valores sin fuente (declarados)
| Valor | Efecto en el resultado |
|---|---|
| Cofia del Atlas (500 kg) | 0 kg cambia la carga máxima en 3.6 % |
| Cofia del Falcon (1 900 kg) | 0–3 000 kg cambia la carga máxima en ±1.5 % |
| Regulación del núcleo central del Falcon | calibrada contra T+4:11 |
| Cd = 0.5 y programa de cabeceo | calibrados contra los tiempos históricos |

## Simulador de pilotaje (`pilotaje/`, en desarrollo)

### Constantes físicas (`pilotaje/cuerpos-datos.js`)
| Cuerpo | GM | Radio | Rotación | Fuente |
|---|---|---|---|---|
| Luna | 4 902.800 km³/s² | 1 737.4 km | 27.3217 d | [JPL SSD – parámetros de satélites](https://ssd.jpl.nasa.gov/sats/phys_par/) (GM, radio, DE440) y [NASA NSSDCA – Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) (rotación sidérea 655.720 h) |
| Marte | 4.2828×10¹³ m³/s² (= G·M) | 3 389.5 km | 24.6229 h | [NASA NSSDCA – Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) (masa 0.64169×10²⁴ kg, radio medio volumétrico, rotación sidérea) |
| Europa | 3 202.71210 km³/s² | 1 560.80 km | 3.55 d (sincrónica) | [JPL SSD – parámetros de satélites](https://ssd.jpl.nasa.gov/sats/phys_par/) (JUP365). La rotación sincrónica no viene de esa página: es una propiedad conocida de la luna, y el periodo se tomó de la ficha de NASA citada en el respaldo, **sin reconfirmar**; la ficha `galileanfact.html` devolvió 404 |

Comprobaciones en `tests/pilotaje.test.mjs`: la gravedad y la velocidad de escape salen iguales a las fichas de NASA (Luna 1.62 m/s² y 2.38 km/s; Marte 3.73 m/s² y 5.03 km/s) y la densidad de Europa coincide con la de JPL (3.013 g/cm³).

### Texturas (`texturas/`)
Origen: los zips `Luna-`, `Marte-`, `Tierra-` y `Europa-3D-NASA-4K` que aportó JU4NMAX. Cada README cita datos de NASA/USGS (Blue Marble, Black Marble, MOLA, Viking, LROC WAC, LOLA, Galileo), **pero no da el enlace ni la licencia de cada imagen, y los archivos no traen metadatos de procedencia**. Por eso el origen exacto de cada archivo **no está confirmado**.

| Archivo del simulador | Original | Tratamiento |
|---|---|---|
| `luna-albedo-4k.jpg` (escala de grises), `luna-relieve-2k.jpg` | `moon_map_4k.jpg`, `moon_bump_4k.jpg` (4000×2000) | JPG recomprimido; relieve a 2048 px |
| `marte-color-4k.jpg` | `mars_surface_8k.jpg` (8192×4096) | reducido a 4096 px |
| `marte-relieve-2k.png` | `mars_normal_4k.png` | a 2048 px **sin pérdida**: un JPG le quitaba casi la mitad del detalle (desviación de 5.3 a 3.1) |
| `europa-color-4k.jpg` | `europa_surface_4k.png` (14.4 MB) | PNG a JPG |
| `tierra-color-4k.jpg`, `tierra-nubes-2k.jpg`, `tierra-noche-2k.jpg` | `earth_surface_4k`, `earth_clouds_4k`, `earth_nightmap` | nubes y noche a 2048 px |

**Fuentes oficiales equivalentes** (para sustituir cuando se confirme el origen):
- Luna: [CGI Moon Kit, NASA SVS](https://svs.gsfc.nasa.gov/4720) (LROC color, LOLA).
- Marte: [Mars Viking Colorized Global Mosaic 232 m, USGS](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) (dominio público según el USGS).
- Tierra: Blue Marble y Black Marble de [NASA Earth Observatory](https://earthobservatory.nasa.gov/features/BlueMarble/BlueMarble.php).

**Licencia y crédito.** La NASA indica que [sus imágenes no son de dominio público](https://www.nasa.gov/multimedia/guidelines/index.html) y se usan según sus pautas de uso, con crédito. Antes de publicar: confirmar el origen de cada textura y acreditar a NASA (Earth Observatory para la Tierra).

### Lugares reales (`pilotaje/destinos.js`; longitudes en este positivo)
| Destino | Lugar | Lat, lon | Fuente |
|---|---|---|---|
| Luna | Base Tranquilidad (Apolo 11) | 0.67409° N, 23.47298° E | [NASA Apollo Lunar Surface Journal](https://nasa.gov/wp-content/uploads/static/history/alsj/a11/a11ov.html) (NSSDC) |
| Luna | Cráter Shackleton (Ø 20.92 km) | 89.67° S, 129.78° E | [USGS Gazetteer](https://planetarynames.wr.usgs.gov/Feature/5450); profundidad ~4.1 km (LOLA) en [MIT News](https://news.mit.edu/2012/shackletons-crater-0620.html). El USGS lista más de un juego de coordenadas (ESA midió 89.54° S, Ø 19 km) |
| Luna | Sitio de Chang'e 4 (cráter Von Kármán, Ø 186 km) | 45.457° S, 177.588° E | [ISPRS](https://isprs-archives.copernicus.org/articles/XLII-2-W13/1425/2019/isprs-archives-XLII-2-W13-1425-2019.pdf); [JGR Planets](https://research.vu.nl/en/publications/geological-characteristics-of-von-k%C3%A1rm%C3%A1n-crater-northwestern-sout/) |
| Marte | Cráter Jezero (Ø 45–50 km según la fuente) | 18.38° N, 77.58° E | [USGS](https://www.usgs.gov/media/images/jezero-crater-mars-2); [Planetary Society](https://planetary.org/articles/jezero-landing-site-mars-2020-rover) |
| Marte | Monte Olimpo (21.9 km, datum MOLA) | 18.65° N, 226.2° E (= 133.8° O) | [NASA Photojournal](https://science.nasa.gov/photojournal/pj-olympus-mons-25/) |
| Marte | Casquete polar norte (~1 000–1 100 km) | 90° N | [Mare Boreum](https://en.wikipedia.org/wiki/Mare_Boreum_quadrangle) (fuente secundaria) |
| Europa | Conamara Chaos (Ø 143.7 km) | 9.70° N, 272.70° O = 87.30° E | [USGS Gazetteer](https://planetarynames.wr.usgs.gov/Feature/1282) (IAU, 1997) |
| Europa | Tara Regio | 7.5° S, 74.5° O | **Derivado**: punto medio del recuadro del [USGS](https://planetarynames.wr.usgs.gov/Feature/14296) (lat −35…20, lon 42…107° O); no hay centro oficial. NaCl: [Trumbo et al.](https://arxiv.org/pdf/2201.01333) |
| Europa | Región polar sur | 90° S (región) | Hubble, diciembre de 2012 ([NASA/JPL](https://www.jpl.nasa.gov/news/hubble-sees-evidence-of-water-vapor-at-jupiter-moon/)); no hay latitud publicada en las fuentes consultadas |

Las coordenadas del USGS vienen en "oeste positivo, 0–360"; se convirtieron a este positivo (`lon_este = −lon_oeste`). Una prueba (`tests/destinos.test.mjs`) comprueba las conversiones y los rangos.

### Alineación de las texturas (comprobada mirando cada imagen)
| Cuerpo | Estado | Cómo se comprobó |
|---|---|---|
| Luna | **verificada**: lon 0° al centro, este a la derecha | Mare Crisium (17° N, 59° E), Mare Serenitatis (28° N, 17.5° E) y la cuenca Orientale (19° S, 93° O) caen donde les toca. La textura es en **escala de grises** (albedo), no a color |
| Marte | **verificada**: igual | Monte Olimpo (18.65° N, 133.8° O) y Valles Marineris |
| Europa | **no verificada** | El USGS dice "oeste positivo, 0–360" pero no dónde cae el 0° en la imagen; ningún rasgo reconocible permitió decidirlo. Hay que resolverlo antes de colocar marcadores en Europa |

### Misión de la Luna (Apolo 11): qué es real y qué es de juego
- **Referencia real, con la verificación más débil de este documento:** la órbita preliminar **114.1 × 313.9 km** (61.6 × 169.5 millas náuticas, 1 nmi = 1.852 km) por seguimiento tras el primer encendido de entrada en órbita. Sale de las transcripciones de las comunicaciones del Apolo 11 que reproduce [apollo11.spacelog.org](https://apollo11.spacelog.org/03:04:56:41) (texto de NASA reproducido por terceros). **No pude abrir esa página** (timeout y error 502) **ni confirmarla en un documento de NASA**: la página del Apollo Flight Journal que cité antes no contiene la cifra. La duración del encendido aparece como 5:57 y como 6:02 según la fuente.
- **No verificado, por eso no se muestra como dato:** el Δv de ese encendido, el número de órbitas lunares y la segunda órbita (LOI-2).
- **Simplificado para el juego y rotulado en pantalla:** velocidad de llegada (800 m/s), Δv disponible (1 400 m/s), fuerza del motor (3 m/s²), ritmo del tiempo (×1 a ×120) y plano de llegada polar con el periapsis a 30° S y el nodo en 10° E, elegido para que los 3 lugares queden a la vista en una vuelta. El Sol se coloca sobre 100° E para que Tranquilidad y Chang'e 4 reciban luz.
- **Distancia Tierra–Luna:** 384 400 km ([NSSDCA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)); radio de la Tierra 6 371.000 km y día sidéreo 23.9345 h ([NSSDCA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html)).
- **Cambio respecto al respaldo:** la tecla **E** gira la nave (como pedía el respaldo) y por eso **escanear** pasó a la barra espaciadora; en el respaldo las dos usaban la E.
