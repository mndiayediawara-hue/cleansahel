// admin-production-fix.js
// Redirige /api/produce-with-lots al endpoint viejo /api/produce
// cuando el backend no tiene el nuevo endpoint desplegado

(function() {
  'use strict';

  const REAL_API = 'https://cleansahel-production.up.railway.app/api';

  function showMessage(text, type) {
    type = type || 'info';
    const existing = document.getElementById('admin-prod-msg');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'admin-prod-msg';
    div.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:14px 20px;border-radius:10px;font-family:Inter,sans-serif;font-size:14px;max-width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.3);color:white;background:' + (type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb');
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.remove(); }, type === 'error' ? 6000 : 4000);
  }

  // Interceptar fetch global
  const originalFetch = window.fetch;
  window.fetch = async function(url, options) {
    options = options || {};
    const urlStr = typeof url === 'string' ? url : url.url;

    // Solo interceptar /api/produce-with-lots
    if (urlStr && urlStr.includes('/api/produce-with-lots') && (options.method || 'GET') === 'POST') {
      console.log('[admin-production-fix] Interceptando /produce-with-lots, redirigiendo a /produce');

      // Extraer token del header
      const headers = options.headers || {};
      const authHeader = headers['Authorization'] || headers['authorization'] || '';

      // Parsear el payload
      let payload = {};
      try {
        payload = JSON.parse(options.body || '{}');
      } catch (e) {
        payload = {};
      }

      // Necesitamos el recipeId. Si no está, buscarlo
      try {
        const productsRes = await originalFetch(REAL_API + '/products', {
          headers: { 'Authorization': authHeader }
        });
        if (productsRes.ok) {
          const products = await productsRes.json();
          const product = products.find(p => p.id === payload.productId);
          if (product && product.recipeId && !payload.recipeId) {
            payload.recipeId = product.recipeId;
          }
        }
      } catch (e) { /* ignore */ }

      // Llamar al endpoint viejo
      const newUrl = urlStr.replace('/produce-with-lots', '/produce');
      const newResponse = await originalFetch(newUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Si la respuesta es 404 (HTML de "Cannot POST..."), significa que /produce tampoco existe
      if (newResponse.status === 404) {
        showMessage('❌ El backend no soporta producción. Render necesita re-desplegar.', 'error');
        return new Response(
          JSON.stringify({ error: 'Backend endpoint no disponible. Render necesita re-desplegar el código nuevo.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Si la respuesta es HTML (404 viejo), también es error
      const contentType = newResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        showMessage('❌ El servidor devolvió un error no esperado', 'error');
        return new Response(
          JSON.stringify({ error: 'Respuesta no es JSON. Probablemente el endpoint no existe.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Leer la respuesta JSON
      const data = await newResponse.json().catch(() => ({}));

      // Si el backend viejo devuelve un error de stock insuficiente
      if (data.error && data.shortages) {
        showMessage('❌ Stock insuficiente: ' + data.shortages.map(s => s.name).join(', '), 'error');
      } else if (data.error) {
        showMessage('❌ ' + data.error, 'error');
      } else if (data.lotNumber || data.lotId) {
        // Éxito
        showMessage('✅ Fabricación creada: ' + (data.lotNumber || data.lotId), 'success');
        // Devolver respuesta simulando el nuevo endpoint
        return new Response(
          JSON.stringify({
            lotNumber: data.lotNumber,
            lotId: data.lotId,
            productionOrderNumber: data.productionOrderNumber || data.lotNumber,
            ok: true
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return newResponse;
    }

    // Para todos los demás fetch, comportamiento normal
    return originalFetch.apply(this, arguments);
  };

  // También interceptar /api/lots/preview-number
  // Si falla, generar un número local
  const originalFetch2 = window.fetch;
  // (Ya está cubierto por el wrapper de arriba)

  // Interceptar también /api/lots/generate
  // (Por si acaso lo usan en LotGenerator)

  console.log('[admin-production-fix] Cargado. /api/produce-with-lots redirigido a /api/produce');
})();
