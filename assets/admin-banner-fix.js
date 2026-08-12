// admin-banner-fix.js
// Fix: oculta agresivamente el banner "Sin conexion" cuando el backend responde
(function() {
  'use strict';

  const API = (window.__API_URL__ || 'https://cleansahel-production.up.railway.app/api');
  let backendOK = false;

  async function checkBackend() {
    try {
      const res = await fetch(API + '/health', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j && j.ok === true) {
          backendOK = true;
          return true;
        }
      }
    } catch {}
    backendOK = false;
    return false;
  }

  function removeBanner() {
    // Buscar todos los divs con "Sin conexion" en su texto y ocultarlos
    const all = document.querySelectorAll('div');
    let removed = 0;
    all.forEach(b => {
      const text = b.textContent || '';
      if ((text.includes('Sin conexion') || text.includes('Sin conexión')) &&
          (b.className || '').includes('fixed')) {
        if (b.style.display !== 'none') {
          b.style.display = 'none';
          b.style.visibility = 'hidden';
          b.style.opacity = '0';
          b.style.height = '0';
          b.style.overflow = 'hidden';
          b.style.padding = '0';
          b.style.margin = '0';
          try { b.remove(); removed++; } catch {}
        }
      }
    });
    return removed;
  }

  // Observer para detectar cuando React re-renderiza el banner
  const observer = new MutationObserver(() => {
    if (backendOK) removeBanner();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Loop principal
  async function loop() {
    while (true) {
      const ok = await checkBackend();
      if (ok) {
        // Eliminar banner inmediatamente
        removeBanner();
        // Y cada 500ms por 5s para asegurar
        for (let i = 0; i < 10; i++) {
          setTimeout(removeBanner, i * 500);
        }
        await new Promise(r => setTimeout(r, 30000));
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  loop();
})();
