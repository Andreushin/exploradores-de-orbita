// Registra el service worker (sw.js en la raíz) para que el juego funcione sin internet.
// Lo cargan todas las páginas; solo actúa donde los navegadores lo permiten (https o localhost).
const permitido = location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if ('serviceWorker' in navigator && permitido) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch((err) => console.warn('[sw] no se pudo registrar:', err));
  });
}
