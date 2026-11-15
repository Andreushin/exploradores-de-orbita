# Cómo trabajamos

🗂 **Tablero Kanban:** https://github.com/users/Andreushin/projects/2 · 📖 **Guía del equipo:** [issue #24](https://github.com/Andreushin/exploradores-de-orbita/issues/24) · 🔗 **Contrato entre niveles:** [`docs/contrato-niveles.md`](docs/contrato-niveles.md)

## Un nivel por persona

Cada quien es dueño de su nivel y solo toca sus archivos. Lo compartido (`js/` común, `data/`, contrato) se cambia avisando en el PR.

| Nivel | Responsable | Dónde vive | Documento |
|---|---|---|---|
| 1 · Diseña tu misión | @AslanCM | app principal: `js/screens/mission.js`, `mission-scenes.js`, `js/budget.js`, `css/screens/mission.css`, `data/segments.json` | [`nivel-1.md`](docs/niveles/nivel-1.md) |
| 2 · Taller del CubeSat | @JU4NMAX | `nivel2/`, `js/taller-reglas.js`, `data/workshop.json` | [`nivel-2.md`](docs/niveles/nivel-2.md) |
| 3 · Travesía e inserción | @Andreushin | `nivel3/` | [`nivel-3.md`](docs/niveles/nivel-3.md) |
| 4 · Reporte y CML | @tommycc2010-hub | app principal: `js/screens/report.js`, `js/science-data.js`, `css/screens/report.css`, `data/science.json` | [`nivel-4.md`](docs/niveles/nivel-4.md) |

**Compartido:**
- **Núcleo de la app**, @Andreushin: `index.html`, `js/main.js`, `js/state.js`, `js/i18n.js`, `js/levels.js`, `js/mision-store.js`, `js/screens/{start,levels}.js`, `css/base.css`, `css/screens/menu.css`, `assets/`, `.github/`.
- **Física y datos comunes**, @tommycc2010-hub: `js/physics.js`, `data/{missions,rockets,pieces,events}.json`, `docs/fuentes.md`, `tests/`.

## Reglas

1. **Datos entre niveles:** solo por `eo-mision` con `js/mision-store.js` (ver el [contrato](docs/contrato-niveles.md)). Cada nivel escribe **solo su sección**.
2. **No copies lógica:** importa `js/physics.js` y `data/*.json`.
3. **Estilos aislados:** los niveles en carpeta usan solo su `nivelN.css`, con prefijo de clases (`n2-`, `n3-`). La app principal usa `css/base.css` y el CSS de su pantalla.
4. **Bilingüe ES/EN:** todo texto nuevo va en los dos idiomas. App principal: `data/i18n/{es,en}/<ns>.json`. Niveles en carpeta: su `textos.js`.
5. **Modo demo:** cada nivel funciona solo, aunque no haya datos del nivel anterior.
6. **Sin código muerto:** si algo deja de usarse, se borra en el mismo PR (archivos, claves de i18n, clases CSS).
7. **Accesibilidad compartida:** el texto solo para lectores de pantalla usa la clase `.sr-only` de `css/a11y.css`, y las líneas que se escriben poco a poco usan `js/typewriter.js` (texto completo en `.sr-only`, copia visible con `aria-hidden="true"`, respeta `prefers-reduced-motion`). No crees otra copia. Hoy quedan copias propias en `css/screens/report.css`, `nivel2/nivel2.css` y `simulador/simulador.css`: se migran cuando sus dueños toquen esos archivos.

### Pantallas de la app principal (niveles 1 y 4, inicio y menú)
- **Pantalla:** `export default { id, mount(container, ctx), unmount() }`. Cada pantalla crea su propio DOM dentro de `container`.
- **ctx:** `{ state, update, subscribe, reset, data, physics, t, tx, goTo }`.
  - `update({ budget: { space: 60 } })` mezcla por rama (no borra el resto de `budget`).
  - `t('mission.title', vars)` busca en `data/i18n/<lang>/<ns>.json`; `tx({ es, en })` traduce los textos de los JSON de datos.
- **Niveles:** se registran en `js/levels.js`. Si un nivel vive en su carpeta, lleva `folder: N` y `goTo` redirige ahí.

## Cómo llegan los commits a `main`

`main` está protegida: nadie hace push directo, todo entra por Pull Request.

1. **Rama** desde `main` actualizado: `feat/…`, `fix/…`, `refactor/…`, `docs/…` o `chore/…`.
2. **Commits** pequeños con el formato de abajo.
3. **PR** con la plantilla y `Closes #N`. El **título** sigue el mismo formato, porque se convierte en el commit final.
4. **Revisión:** @Andreushin aprueba (CODEOWNERS) o pide cambios explicando el motivo.
5. **Check automático:** `Formato del título del PR` en verde.
6. **Merge:** solo *Squash and merge* (1 PR = 1 commit en `main`); la rama se borra sola.

```bash
git checkout main && git pull
git checkout -b feat/nivel2-tooltips
# ... trabajar ...
git commit -m "feat(nivel2): tooltips de CubeSat 101 por subsistema"
git pull --rebase origin main
git push -u origin feat/nivel2-tooltips
gh pr create --fill
```

### Formato de mensajes (Conventional Commits, en español)
```
tipo(alcance): descripción en imperativo, minúsculas, sin punto final
```
| Tipo | Uso |
|---|---|
| `feat` | funcionalidad nueva |
| `fix` | corrección de bug |
| `data` | cambios en JSON de datos o balanceo |
| `style` | CSS / aspecto visual |
| `i18n` | textos y traducciones |
| `docs` | documentación |
| `refactor` | reorganizar o limpiar código sin cambiar el comportamiento |
| `test` | pruebas |
| `chore` | configuración, repo, tareas varias |

**Alcances:** `nivel1`, `nivel2`, `nivel3`, `nivel4` (uno por nivel), `core`, `fisica`, `datos`, `repo`. También se aceptan `mision`, `taller`, `travesia`, `reporte` y `canvas`. El alcance es opcional.

## Pruebas

| Qué | Dónde (con `python3 -m http.server 8000`) | Cuándo |
|---|---|---|
| Física y diseños de referencia | `http://localhost:8000/tests/physics.test.html` | al cambiar datos o `physics.js` |
| Puntaje científico y CML | `tests/science.test.html` | al cambiar la fórmula de ciencia |
| Reporte (CML final, sugerencias, series) | `tests/report.test.html` | al cambiar el Nivel 4 |
| Presupuesto del Nivel 1 | `tests/budget.test.html` | al cambiar el Nivel 1 |

Pruebas en Node (sin navegador): `node tests/typewriter.test.mjs` al cambiar `js/typewriter.js`; `node tests/colibri.test.mjs` al cambiar el guion o `js/colibri*.js`. Al añadir o cambiar cualquier archivo del juego corre `node scripts/precache.mjs` (regenera `sw.js`) y `node tests/offline.test.mjs`: si `sw.js` queda viejo, la prueba falla.

Antes de pedir revisión, **juega el flujo completo** (Inicio → Nivel 1 → `nivel2/` → `nivel3/` → Reporte) en ES y EN, sin errores en la consola, y revisa el ancho de 360 px.

Si cambias el balance de datos, actualiza los diseños de referencia en `docs/fuentes.md` y en `tests/physics.test.html`.
