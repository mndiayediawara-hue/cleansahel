// admin-recalls-fix.js
// Workaround: guarda retiradas en localStorage cuando el backend no tiene /api/recalls
// También desactiva la preview de trazabilidad

(function() {
  'use strict';

  const STORAGE_KEY = 'cleanerp-local-recalls';

  function getLocalRecalls() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) { return []; }
  }

  function saveLocalRecalls(recalls) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recalls));
    } catch (e) {}
  }

  function getUser() {
    try {
      const userData = localStorage.getItem('cleanerp-user');
      if (!userData) return null;
      return JSON.parse(userData);
    } catch (e) { return null; }
  }

  function showMessage(text, type) {
    type = type || 'info';
    const existing = document.getElementById('admin-rec-msg');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'admin-rec-msg';
    div.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:14px 20px;border-radius:10px;font-family:Inter,sans-serif;font-size:14px;max-width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.3);color:white;background:' + (type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb');
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.remove(); }, type === 'error' ? 6000 : 4000);
  }

  // Interceptar fetch para /api/recalls
  const originalFetch = window.fetch;
  window.fetch = async function(url, options) {
    options = options || {};
    const urlStr = typeof url === 'string' ? url : url.url;

    // POST /api/recalls
    if (urlStr && urlStr.includes('/api/recalls') && (options.method || 'GET') === 'POST' && !urlStr.match(/\/api\/recalls\/[^\/]+\/(complete|cancel)/)) {
      console.log('[admin-recalls-fix] Interceptando POST /api/recalls');
      try {
        const body = JSON.parse(options.body || '{}');
        const user = getUser();

        // Crear la retirada local
        const newRecall = {
          id: 'local-recall-' + Date.now(),
          reference: 'REC-LOCAL-' + Date.now().toString().slice(-6),
          lotType: body.lotType || 'producto_terminado',
          sourceLotId: body.lotId || '',
          sourceLotNumber: 'Manual-' + (body.lotId || 'N/A').slice(0, 8),
          reason: body.reason || '',
          severity: body.severity || 'alta',
          initiatedBy: user ? user.id : 'local',
          initiatedAt: new Date().toISOString(),
          status: 'iniciado',
          affectedProductLots: [],
          affectedCustomers: [],
          totalAffected: 0,
          notes: 'Guardado localmente (backend sin desplegar)',
          localOnly: true
        };

        // Guardar en localStorage
        const recalls = getLocalRecalls();
        recalls.unshift(newRecall);
        saveLocalRecalls(recalls);

        showMessage('✅ Retirada guardada localmente: ' + newRecall.reference, 'success');

        return new Response(JSON.stringify(newRecall), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        showMessage('❌ Error al guardar retirada: ' + e.message, 'error');
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/recalls - combinar backend con local
    if (urlStr && urlStr.match(/\/api\/recalls\/?$/) && (options.method || 'GET') === 'GET') {
      const response = await originalFetch.apply(this, arguments);
      try {
        const backendRecalls = await response.clone().json();
        const localRecalls = getLocalRecalls();
        return new Response(JSON.stringify([...localRecalls, ...backendRecalls]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return response;
      }
    }

    // GET /api/traceability/:type/:id - devolver datos vacíos
    if (urlStr && urlStr.includes('/api/traceability/')) {
      return new Response(JSON.stringify({
        affectedProductLots: [],
        affectedCustomers: [],
        totalAffected: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return originalFetch.apply(this, arguments);
  };

  console.log('[admin-recalls-fix] Cargado. Retiradas se guardan en localStorage.');
})();
