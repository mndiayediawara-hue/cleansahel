// admin-banner-fix.js
// Fix: reintenta el health check cada 5s y oculta el banner si responde
(function() {
  'use strict';

  const API = (window.__API_URL__ || 'https://cleansahel-production.up.railway.app/api');

  async function check() {
    try {
      const res = await fetch(API + '/health', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j && j.ok === true) {
          // Ocultar banner rojo
          const banners = document.querySelectorAll('div');
          banners.forEach(b => {
            const text = b.textContent || '';
            if (text.includes('Sin conexion') || text.includes('Sin conexión')) {
              if (b.style.position === 'fixed' || b.className.includes('fixed')) {
                b.style.display = 'none';
                b.remove();
              }
            }
          });
          return true;
        }
      }
    } catch {}
    return false;
  }

  async function loop() {
    while (true) {
      const ok = await check();
      if (ok) {
        // Check every 30s once OK
        await new Promise(r => setTimeout(r, 30000));
      } else {
        // Check every 5s while not OK
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // Start loop
  loop();
})();
