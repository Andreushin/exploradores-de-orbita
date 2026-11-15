// OWNER: Rol 3 (@JU4NMAX) — Constantes físicas de los destinos del simulador de pilotaje.
// Cada valor trae su fuente. μ (GM) en m³/s²; radio en m; rotación en s.
//   Luna    · JPL SSD, Planetary Satellite Physical Parameters (GM 4902.800 km³/s², R 1737.4 km, DE440)
//             y NASA NSSDCA Moon Fact Sheet (rotación sidérea 655.720 h = 27.3217 d)
//   Marte   · NASA NSSDCA Mars Fact Sheet (R 3389.5 km, rotación sidérea 24.6229 h, masa 0.64169×10²⁴ kg);
//             GM = G·M = 4.2828×10¹³ m³/s² con G = 6.6743×10⁻¹¹ (consistente con la masa de la ficha)
//   Europa  · JPL SSD, Planetary Satellite Physical Parameters (GM 3202.71210 km³/s², R 1560.80 km, JUP365)
//             Rotación: sincrónica con su periodo orbital (acoplamiento de marea), 3.55 d.
// Enlaces completos en simulador/FUENTES.md.

const H = 3600;
const DIA = 86400;

export const CUERPOS = {
  luna: {
    id: 'luna', nombre: { es: 'la Luna', en: 'the Moon' },
    mu: 4.9028e12, radio: 1737.4e3, rotacion: 27.3217 * DIA,
    fuente: 'JPL SSD (GM, radio) y NASA NSSDCA Moon Fact Sheet (rotación)',
  },
  marte: {
    id: 'marte', nombre: { es: 'Marte', en: 'Mars' },
    mu: 6.6743e-11 * 0.64169e24, radio: 3389.5e3, rotacion: 24.6229 * H,
    fuente: 'NASA NSSDCA Mars Fact Sheet (GM = G·M)',
  },
  europa: {
    id: 'europa', nombre: { es: 'Europa', en: 'Europa' },
    mu: 3.20271210e12, radio: 1560.8e3, rotacion: 3.55 * DIA,
    fuente: 'JPL SSD (GM, radio); rotación sincrónica con su órbita',
  },
};
