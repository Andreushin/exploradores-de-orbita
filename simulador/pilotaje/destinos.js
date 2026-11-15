// OWNER: Rol 3 (@JU4NMAX) — Destinos del simulador de pilotaje: lugares reales y misión de referencia.
// Latitud y longitud en GRADOS, ESTE POSITIVO (−180…180). Las fuentes del USGS usan "oeste positivo, 0–360":
// se convirtieron (lon_este = −lon_oeste). Enlaces completos en simulador/FUENTES.md.
// Todo lo marcado como `simplificado` se rotula así en pantalla.

const L = (es, en) => ({ es, en });

export const DESTINOS = {
  luna: {
    id: 'luna', cuerpo: 'luna', jugable: true,
    cohete: 'saturno-v',
    textura: {
      color: 'texturas/luna-albedo-4k.jpg', relieve: 'texturas/luna-relieve-2k.jpg',
      // Comprobado a ojo con Mare Crisium (17° N, 59° E), Mare Serenitatis (28° N, 17.5° E) y la cuenca Orientale (19° S, 93° O):
      // longitud 0° al centro, este a la derecha, norte arriba.
      alineacion: { estado: 'verificada', lonCentro: 0, esteADerecha: true },
    },
    mision: {
      nombre: L('Apolo 11', 'Apollo 11'),
      fecha: L('16–24 de julio de 1969', 'July 16–24, 1969'),
      resumen: L(
        'La nave de mando Columbia dio vueltas a la Luna mientras Armstrong y Aldrin bajaban en el Águila.',
        'The Columbia command module orbited the Moon while Armstrong and Aldrin descended in the Eagle.',
      ),
      // Órbita preliminar por seguimiento tras el primer encendido de entrada en órbita (LOI-1):
      // 61.6 × 169.5 millas náuticas = 114.1 × 313.9 km. La cifra aparece en las transcripciones de las comunicaciones
      // del Apolo 11 (apollo11.spacelog.org, texto de NASA reproducido por terceros). NO se pudo abrir esa página ni
      // confirmarla en el documento original: es la referencia menos sólida de la misión. Ver FUENTES.md.
      orbitaObjetivo: {
        alturaPerilunioKm: 114.1, alturaApolunioKm: 313.9,
        verificacion: 'transcripción de terceros, sin confirmar en el documento original',
        enlace: 'https://apollo11.spacelog.org/03:04:56:41',
      },
      // La duración del encendido LOI-1 aparece como 5:57 y como 6:02 según la fuente: se muestra como rango.
      encendidoRealS: [357, 362],
      noVerificado: ['Δv de LOI-1', 'número de órbitas lunares', 'segunda órbita (LOI-2)'],
    },
    // Condiciones de juego (simplificado): el plano de llegada es polar para que los 3 lugares queden a la vista.
    llegada: {
      simplificado: true,
      vInfinito: 800,           // m/s
      alturaPeriapsisKm: 114.1, // se pasa por la altura del perilunio de la órbita objetivo
      radiosIniciales: 4,       // distancia inicial en radios lunares
      planoPolar: { lonNodoGrados: 10, latPeriapsisGrados: -30 },
      sol: { latGrados: 0, lonGrados: 100 }, // Sol sobre 100° E: Tranquilidad y Chang'e 4 reciben luz
    },
    lugares: [
      {
        id: 'tranquilidad',
        nombre: L('Base Tranquilidad (Apolo 11)', 'Tranquility Base (Apollo 11)'),
        lat: 0.67409, lon: 23.47298,
        dato: L('Aquí alunizó el Águila el 20 de julio de 1969, en el Mar de la Tranquilidad.', 'The Eagle landed here on July 20, 1969, in Mare Tranquillitatis.'),
        fuente: 'NASA Apollo Lunar Surface Journal (NSSDC)',
        enlace: 'https://nasa.gov/wp-content/uploads/static/history/alsj/a11/a11ov.html',
      },
      {
        id: 'shackleton',
        nombre: L('Cráter Shackleton', 'Shackleton crater'),
        lat: -89.67, lon: 129.78, diametroKm: 20.92,
        dato: L('Cráter de ~21 km y ~4 km de profundidad junto al polo sur. Su fondo nunca recibe luz solar y puede guardar hielo.', 'A ~21 km crater, ~4 km deep, beside the south pole. Its floor never sees sunlight and may hold ice.'),
        fuente: 'USGS Gazetteer (centro y diámetro); NASA/LRO LOLA vía MIT News (profundidad)',
        enlace: 'https://planetarynames.wr.usgs.gov/Feature/5450',
        observarDeNoche: true, // el fondo está en sombra permanente: se observa con el altímetro láser (LOLA)
        nota: L('El USGS lista más de un juego de coordenadas; se usa el vigente. ESA midió antes 89.54° S, Ø 19 km.', 'The USGS lists more than one coordinate set; the current one is used. ESA earlier measured 89.54° S, Ø 19 km.'),
      },
      {
        id: 'change4',
        nombre: L('Sitio de Chang’e 4 (lado oculto)', 'Chang’e 4 site (far side)'),
        lat: -45.457, lon: 177.588,
        dato: L('Primer alunizaje en el lado oculto (3 de enero de 2019), dentro del cráter Von Kármán (Ø 186 km) y de la cuenca Polo Sur–Aitken.', 'First landing on the far side (January 3, 2019), inside Von Kármán crater (Ø 186 km) and the South Pole–Aitken basin.'),
        fuente: 'ISPRS Archives (punto de contacto); JGR Planets (Von Kármán)',
        enlace: 'https://isprs-archives.copernicus.org/articles/XLII-2-W13/1425/2019/isprs-archives-XLII-2-W13-1425-2019.pdf',
      },
    ],
  },

  marte: {
    id: 'marte', cuerpo: 'marte', jugable: false, cohete: 'atlas-agena-d',
    textura: {
      color: 'texturas/marte-color-4k.jpg', relieve: 'texturas/marte-relieve-2k.png',
      // Comprobado con el Monte Olimpo (226.2° E = 133.8° O) y Valles Marineris: 0° al centro, este a la derecha.
      alineacion: { estado: 'verificada', lonCentro: 0, esteADerecha: true },
    },
    mision: null, // pendiente: se define al construir la misión de Marte
    lugares: [
      {
        id: 'jezero', nombre: L('Cráter Jezero (Perseverance)', 'Jezero crater (Perseverance)'),
        lat: 18.38, lon: 77.58, diametroKm: 45,
        dato: L('Antiguo lago con un delta de río. Perseverance aterrizó aquí el 18 de febrero de 2021. Las fuentes dan entre 45 y 50 km de diámetro.', 'Ancient lake with a river delta. Perseverance landed here on February 18, 2021. Sources give 45–50 km in diameter.'),
        fuente: 'USGS; The Planetary Society', enlace: 'https://www.usgs.gov/media/images/jezero-crater-mars-2',
      },
      {
        id: 'olimpo', nombre: L('Monte Olimpo', 'Olympus Mons'),
        lat: 18.65, lon: 226.2 - 360, alturaKm: 21.9,
        dato: L('El volcán más alto del Sistema Solar: 21.9 km sobre el nivel de referencia de MOLA.', 'The tallest volcano in the Solar System: 21.9 km above the MOLA datum.'),
        fuente: 'NASA Photojournal (altura MOLA)', enlace: 'https://science.nasa.gov/photojournal/pj-olympus-mons-25/',
      },
      {
        id: 'polo-norte', nombre: L('Casquete polar norte', 'North polar cap'),
        lat: 90, lon: 0, diametroKm: 1100,
        dato: L('Depósitos de hielo de agua de unos 1 000–1 100 km de ancho (fuente secundaria).', 'Water-ice deposits about 1,000–1,100 km across (secondary source).'),
        fuente: 'Mare Boreum quadrangle (secundaria)', enlace: 'https://en.wikipedia.org/wiki/Mare_Boreum_quadrangle',
      },
    ],
  },

  europa: {
    id: 'europa', cuerpo: 'europa', jugable: false, cohete: 'falcon-heavy',
    textura: {
      color: 'texturas/europa-color-4k.jpg', relieve: null,
      // NO verificada: el USGS dice "oeste positivo, 0–360" pero no dónde cae el 0° en la imagen. La zona parda
      // (hemisferio delantero) queda a la derecha, lo que sugiere lon_este = (x / ancho) · 360.
      alineacion: { estado: 'no verificada', lonCentro: 180, esteADerecha: true },
    },
    mision: null,
    lugares: [
      {
        id: 'conamara', nombre: L('Conamara Chaos', 'Conamara Chaos'),
        lat: 9.70, lon: -272.70 + 360, diametroKm: 143.7, // 272.70° O = 87.30° E
        dato: L('Terreno caótico: bloques de hielo desplazados sobre algo más blando. Nombre adoptado por la IAU en 1997.', 'Chaos terrain: ice blocks displaced over something softer. Name adopted by the IAU in 1997.'),
        fuente: 'USGS Gazetteer', enlace: 'https://planetarynames.wr.usgs.gov/Feature/1282',
      },
      {
        id: 'tara', nombre: L('Tara Regio', 'Tara Regio'),
        lat: -7.5, lon: -74.5,
        dato: L('Región de terreno caótico con cloruro de sodio detectado por el Hubble. Su centro se calculó a partir del recuadro del USGS (lat −35…20, lon 42…107° O); no hay un centro oficial.', 'Chaos-terrain region where Hubble detected sodium chloride. Its center was computed from the USGS bounding box (lat −35…20, lon 42…107° W); there is no official center.'),
        fuente: 'USGS Gazetteer (recuadro); Trumbo et al. (Hubble)', enlace: 'https://planetarynames.wr.usgs.gov/Feature/14296',
        centroDerivado: true,
      },
      {
        id: 'polo-sur', nombre: L('Región polar sur', 'South polar region'),
        lat: -90, lon: 0,
        dato: L('El Hubble vio señales de vapor de agua sobre esta región en diciembre de 2012. Se interpretan como posibles chorros; no se han fotografiado directamente.', 'Hubble saw signs of water vapor over this region in December 2012, interpreted as possible plumes; they were not imaged directly.'),
        fuente: 'NASA/JPL (Hubble)', enlace: 'https://www.jpl.nasa.gov/news/hubble-sees-evidence-of-water-vapor-at-jupiter-moon/',
        region: true,
      },
    ],
  },
};
