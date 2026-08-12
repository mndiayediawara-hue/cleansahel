// admin-raw-material-lots-fix.js
// Genera lotes sintéticos de materia prima a partir del stock de raw_materials
// cuando el backend no tiene el endpoint /raw-material-lots

(function() {
  'use strict';

  const REAL_API = 'https://cleansahel.onrender.com/api';

  function getToken() {
    try {
      const userData = localStorage.getItem('cleanerp-user');
      if (!userData) return null;
      const user = JSON.parse(userData);
      return user.token || null;
    } catch (e) { return null; }
  }

  // Genera lotes sintéticos desde el stock de raw materials
  async function generateSyntheticLots() {
    const token = getToken();
    if (!token) return [];
    try {
      const res = await fetch(REAL_API + '/raw-materials', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return [];
      const materials = await res.json();
      const now = new Date();
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);

      // Generar un lote activo por cada material con stock > 0
      return materials
        .filter(m => m.stock > 0)
        .map((m, idx) => ({
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
          notes: 'Lote sintético generado automáticamente desde stock de materia prima',
          synthetic: true
        }));
    } catch (e) {
      return [];
    }
  }

  // Interceptar fetch para /api/raw-material-lots
  const originalFetch = window.fetch;
  window.fetch = async function(url, options) {
    options = options || {};
    const urlStr = typeof url === 'string' ? url : url.url;

    // Solo GET /api/raw-material-lots
    if (urlStr && urlStr.includes('/api/raw-material-lots') && (options.method || 'GET') === 'GET') {
      const syntheticLots = await generateSyntheticLots();
      return new Response(JSON.stringify(syntheticLots), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return originalFetch.apply(this, arguments);
  };

  console.log('[admin-raw-material-lots-fix] Cargado. Genera lotes sintéticos desde stock de raw_materials.');
})();
