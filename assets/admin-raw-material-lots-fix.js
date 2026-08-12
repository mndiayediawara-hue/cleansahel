// admin-raw-material-lots-fix.js v2
// Genera lotes sintéticos de materia prima a partir del stock de raw_materials
// v2: Más robusto, intercepta múltiples variantes de URL, fuerza re-cálculo

(function() {
  'use strict';

  const REAL_API = 'https://cleansahel-production.up.railway.app/api';
  let _cachedLots = null;
  let _cacheTime = 0;

  function getToken() {
    try {
      const userData = localStorage.getItem('cleanerp-user');
      if (!userData) return null;
      const user = JSON.parse(userData);
      return user.token || null;
    } catch (e) { return null; }
  }

  async function generateSyntheticLots(force = false) {
    // Cache por 30 segundos
    if (!force && _cachedLots && (Date.now() - _cacheTime) < 30000) {
      return _cachedLots;
    }
    const token = getToken();
    if (!token) return [];
    try {
      const res = await fetch(REAL_API + '/raw-materials', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) {
        console.warn('[admin-rm-lots-fix] raw-materials GET falló:', res.status);
        return [];
      }
      const materials = await res.json();
      const now = new Date();
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);

      _cachedLots = materials
        .filter(m => m.stock && m.stock > 0)
        .map((m) => ({
          id: 'synthetic-lot-' + m.id,
          internalLotNumber: 'LOT-' + m.code + '-001',
          supplierLotNumber: 'AUTO-' + m.code,
          rawMaterialId: m.id,
          supplierId: m.supplierId || '',
          receivedDate: now.toISOString(),
          manufactureDate: null,
          expiryDate: futureDate.toISOString(),
          quantityReceived: m.stock,
          quantityRemaining: m.stock,
          unit: m.unit,
          certificates: [],
          status: 'activo',
          receivedBy: 'system',
          notes: 'Lote sintético',
          synthetic: true
        }));
      _cacheTime = Date.now();
      console.log('[admin-rm-lots-fix] Generados ' + _cachedLots.length + ' lotes sintéticos');
      return _cachedLots;
    } catch (e) {
      console.error('[admin-rm-lots-fix] Error:', e);
      return [];
    }
  }

  // Interceptar fetch - múltiples variantes
  const originalFetch = window.fetch;
  window.fetch = async function(url, options) {
    options = options || {};
    const urlStr = typeof url === 'string' ? url : (url ? url.url : '');

    // CUALQUIER llamada a raw-material-lots
    if (urlStr && urlStr.includes('raw-material-lots') && !urlStr.includes('preview-number') && (options.method || 'GET') === 'GET') {
      const syntheticLots = await generateSyntheticLots();
      return new Response(JSON.stringify(syntheticLots), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return originalFetch.apply(this, arguments);
  };

  // También: parchear directamente window para acceso fácil
  window.__forceRefreshSyntheticLots = () => {
    _cachedLots = null;
    return generateSyntheticLots(true);
  };

  console.log('[admin-rm-lots-fix v2] Cargado. Intercepta /raw-material-lots con synthetic lots.');
})();
