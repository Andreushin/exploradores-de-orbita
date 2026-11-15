# Colibrí · el holograma que cuenta la historia

> **Responsable:** Rol 1 (@Andreushin). Un mentor entusiasta, algo nerd con la ciencia y muy alentador, que usa analogías de vuelo y de naturaleza. Cuenta el relato y el *porqué* de cada paso, y mantiene siempre visible un **AHORA / LUEGO** para que el jugador nunca dude de qué hace ni qué sigue.
> **Relacionados:** [`contrato-niveles.md`](contrato-niveles.md) · [`fuentes.md`](fuentes.md) (sección «Colibrí») · [`niveles/nivel-3.md`](niveles/nivel-3.md)

## Cómo se ve y cómo se porta

- **Holograma de trazo:** SVG inline solo con `stroke` (sin relleno), cian de la identidad (`--n3-info` / `--accent-2`). El aleteo es una animación CSS infinita muy rápida; al hablar, siete barras de «ondas de audio» suben y bajan debajo. **Sin Canvas**: todo SVG + CSS.
- **Cuatro ánimos** (`mood`): neutral, feliz, asombro y alerta; cambian el ojo.
- **Una línea a la vez.** `alta` (los errores del jugador) interrumpe lo que se decía; `normal` espera turno (máximo 3 en cola); `baja` (anécdotas) no hace cola. Al cambiar de pantalla o de paso se vacía lo anterior.
- **Una vez por partida.** Las líneas con `once: true` se marcan «vistas» al llegar a su última página. Se guardan en `localStorage['eo-colibri']`, **fuera** de `eo-mision`. «Reiniciar» y «Nueva misión» las borran (`forgetColibri()`); el silencio y el minimizado son preferencias y se conservan.
- **Controles** (solo icono, con `aria-label`): saltar, silenciar (`aria-pressed`) y minimizar. `Esc` calla la línea. No hay atajos globales y las teclas de Colibrí no llegan a la página (el Nivel 3 usa Espacio en el frenado).
- **Accesibilidad:** el SVG lleva `aria-hidden="true"`; el texto completo de cada página va a una región `.sr-only` con `role="status"` y la copia visible, con `aria-hidden`, se escribe con `js/typewriter.js`. No roba el foco. Con `prefers-reduced-motion`: alas quietas, ondas fijas y texto completo de golpe. Si el puntero o el foco están encima, la página no se retira.
- **Si falla, el juego sigue.** Se carga con `import()` dinámico y `try/catch`; sin su CSS o sin almacenamiento simplemente no aparece.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/colibri.js` | `createColibri()` (DOM + SVG + CSS inyectado) y `createVoice()` (la política: cola, prioridades, «una vez», silencio; sin DOM). Exporta `interpolate`, `resolveLine`, `resolveGoal`, `createStore`, `forgetColibri`. |
| `css/colibri.css` | Estilos con prefijo `eo-col`. Se coloca desde cada página con `--col-x`, `--col-y` y `--col-z`. |
| `js/colibri-guion.js` | `GUION` (las líneas) y `OBJETIVOS` («AHORA / LUEGO»). Un solo guion para todo el juego. |
| `js/colibri-app.js` | Adaptador de la app principal: Inicio, selector, Nivel 1 y Reporte. Solo **lee** el estado. |
| `js/typewriter.js` · `css/a11y.css` | Máquina de escribir y clase `.sr-only` compartidas. |
| `tests/colibri.test.mjs` | Guion (paridad ES/EN, ≤ 110 caracteres, variables), política de voz y adaptador. |

## API

```js
const colibri = createColibri({ getLang: () => lang });
colibri.float({ tam: 'grande', x: '12px', y: '56px', z: 35 }); // flotante, abajo a la izquierda
colibri.dock(contenedor);                                       // acoplado: la última línea se queda a la vista
colibri.say('n1.project', { dest: 'Luna' });                    // → true si la dijo o la encoló
colibri.react('n1.sobregasto');                                 // reacción al jugador: se puede repetir, no antes de 20 s
colibri.setGoal('n1.project');                                  // «AHORA / LUEGO» fijo (clave de OBJETIVOS o { ahora, luego })
colibri.setLang('en'); colibri.skip(); colibri.clear();         // idioma · saltar · callar lo que se decía
colibri.mute(true); colibri.minimize(true); colibri.destroy();
```

## Cómo añadir una línea

1. En `js/colibri-guion.js`: `'nivel.tema'` con `es` y `en` (lista de páginas, **≤ 110 caracteres** cada una), `prio` (`alta` solo para errores del jugador), `mood` y, si lleva `{variables}`, su lista `vars`. Convención de ids: `inicio.hola`, `n1.project`, `n4.cml.3`.
2. Si cuenta un dato real, cítalo en [`fuentes.md`](fuentes.md) → «Colibrí».
3. Dila desde el adaptador de la pantalla (`say` / `react`), nunca desde `mission.js` ni `report.js`.
4. `node tests/colibri.test.mjs` (paridad ES/EN, longitud y variables) y `node scripts/precache.mjs`.

## Dónde habla (app principal)

| Pantalla | Cuándo | Líneas |
|---|---|---|
| Inicio | primera vez · con partida · todo completado | `inicio.hola` (3 páginas) · `inicio.regreso` · `inicio.completo` |
| Niveles | primera vez | `levels.hola` |
| Nivel 1 | cada paso (`plan.step`) | `n1.project` · `n1.launch` · `n1.space` · `n1.ground` · `n1.user` · `n1.review` |
| Nivel 1 | se pasa del presupuesto · una tarjeta se queda corta | `n1.sobregasto` · `n1.insuficiente` (reacciones) |
| Reporte | al abrirlo | `n4.hola.<resultado>` → `n4.cml.<1-4>` → `n4.mejorar` o `n4.cierre` |

El «AHORA / LUEGO» de cada pantalla está en `OBJETIVOS` (`start`, `levels`, `n1.<paso>`, `report`).
