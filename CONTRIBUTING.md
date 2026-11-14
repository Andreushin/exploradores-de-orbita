# Cómo trabajamos (4 roles, sin pisarnos)

**Regla de oro:** cada archivo tiene un único dueño (ver comentario `OWNER:` al inicio). Si necesitas un cambio en un archivo ajeno, pídeselo a su dueño.

🗂 **Tablero Kanban:** https://github.com/users/Andreushin/projects/2 · 📖 **Guía del equipo:** [issue #24](https://github.com/Andreushin/exploradores-de-orbita/issues/24)

| Rol | Responsable | Rama | Archivos |
|---|---|---|---|
| 1 · Core e integración | @Andreushin | `feat/core` | `index.html`, `js/main.js`, `js/state.js`, `js/i18n.js`, `css/base.css`, `data/i18n/*/common.json`, `README.md`, `CONTRIBUTING.md` |
| 2 · Datos y física | @tommycc2010-hub | `feat/data-physics` | `data/{missions,rockets,pieces,events}.json`, `js/physics.js`, `tests/`, `docs/fuentes.md` |
| 3 · Pantallas 1–2 | @JU4NMAX | `feat/screens-1-2` | `js/screens/{mission,workshop}.js`, `css/screens/{mission,workshop}.css`, `data/i18n/*/{mission,workshop}.json` |
| 4 · Pantallas 3–4 | @AslanCM | `feat/screens-3-4` | `js/screens/{journey,report}.js`, `js/canvas/*`, `css/screens/{journey,report}.css`, `data/i18n/*/{journey,report}.json` |

## Contratos (no se cambian sin avisar)
- **Pantalla:** `export default { id, mount(container, ctx), unmount() }`. Cada pantalla crea su propio DOM dentro de `container`.
- **ctx:** `{ state, update, subscribe, reset, data, physics, t, tx, goTo }`.
  - `update({ budget: { space: 60 } })` mezcla por rama (no borra el resto de `budget`).
  - `t('mission.title', vars)` → textos de `data/i18n/<lang>/<ns>.json`. `tx({es, en})` → textos dentro de los JSON de datos.
- **Estado:** ver esquema en `js/state.js`.
- **Física:** firmas exportadas en `js/physics.js` (`deltaV`, `validateDesign`, `insertionOutcome`, `scienceScore`, `computeCML`, …).
- **Textos nuevos:** agrégalos SIEMPRE en `es` y `en` del namespace de tu pantalla.

## Cómo llegan los commits a `main`
`main` está protegida: **nadie hace push directo**, ni el admin. Todo entra por Pull Request.

1. **Rama** desde `main` actualizado: `feat/…`, `fix/…`, `data/…`, `docs/…` o `chore/…`.
2. **Commits** pequeños con el formato de abajo.
3. **PR** a `main` usando la plantilla. El **título del PR** también sigue el formato, porque se convierte en el commit final.
4. **Revisión:** aprobación de @Andreushin (CODEOWNERS). Sus propios PRs los fusiona él como admin.
5. **Check automático** `Formato del título del PR` en verde.
6. **Merge:** solo *Squash and merge* (1 PR = 1 commit en `main`). La rama se borra sola.

```bash
git checkout main && git pull
git checkout -b feat/taller-medidores
# ... trabajar ...
git commit -m "feat(taller): barra de masa con color por límite"
git pull --rebase origin main      # nunca merge de main en tu rama
git push -u origin feat/taller-medidores
gh pr create --fill                # o desde la web
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
| `docs` | README, CONTRIBUTING, fuentes |
| `refactor` | reorganizar código sin cambiar comportamiento |
| `test` | pruebas |
| `chore` | configuración, repo, tareas varias |

**Alcances:** `core`, `fisica`, `datos`, `mision`, `taller`, `travesia`, `reporte`, `canvas`, `repo`. El alcance es opcional.

Ejemplos: `feat(travesia): quemado de inserción con barra de precisión` · `fix(taller): Δv no se actualizaba al quitar propelente` · `data(fisica): subir Isp del iónico a 1600 s`.

### Reglas de los PR
- Un PR por tarea; pequeño y fácil de revisar (idealmente < 300 líneas).
- Solo tocas archivos de tu rol (ver tabla). Si no, avisa en la descripción.
- Antes de pedir revisión: juegas el flujo completo en local, en ES y EN, sin errores en consola.
- Después del **H24 (feature freeze)** solo se aceptan `fix`, `data`, `style`, `i18n` y `docs`.

## Checkpoints (≤36 h)
- **H12:** flujo de 4 pantallas navegable en `main` + primer deploy a GitHub Pages.
- **H24:** feature freeze. Después solo balanceo, bugs, móvil y textos.
- **H32–H36:** video demo, README y entrega.
- Recortables en orden: eventos aleatorios → gráfica del reporte → animación elaborada → 3er destino.
