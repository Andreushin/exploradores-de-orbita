// OWNER: Rol 1 — Enlaces a los simuladores 3D (simulador/ y simulador/pilotaje/), visibles en el inicio y en el selector de niveles.
// Son páginas aparte (con su propio idioma): se abren en la misma pestaña y el botón «Atrás» vuelve al juego.
const ICONO_COHETE = '<svg class="explore-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" d="M12 2c3 2.2 4.5 5.4 4.5 9l1.8 3.2v3.3l-3-1.3H8.7l-3 1.3v-3.3L7.5 11C7.5 7.4 9 4.2 12 2zM12 9.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM12 17.5v4"/></svg>';
const ICONO_ORBITA = '<svg class="explore-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19.2" cy="7.2" r="1.3" fill="currentColor"/></svg>';

/** Dos enlaces visibles a los simuladores 3D. `t` es la función de traducción del contexto de la pantalla. */
export function explorarLinks(t) {
  const nav = document.createElement('nav');
  nav.className = 'explore';
  nav.setAttribute('aria-label', t('menu.explore.title'));
  const enlace = (href, icono, titulo, desc) => `
    <li><a class="explore-link" href="${href}">${icono}<span><b>${titulo}</b><small>${desc}</small></span></a></li>`;
  nav.innerHTML = `
    <p class="explore-title">${t('menu.explore.title')}</p>
    <ul class="explore-list">
      ${enlace('simulador/', ICONO_COHETE, t('menu.explore.rockets'), t('menu.explore.rocketsDesc'))}
      ${enlace('simulador/pilotaje/', ICONO_ORBITA, t('menu.explore.orbital'), t('menu.explore.orbitalDesc'))}
    </ul>`;
  return nav;
}
