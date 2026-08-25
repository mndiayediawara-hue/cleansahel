// =============================================================
// PATCH: Apartado Central de Lotes con búsqueda unificada
// - 4 secciones: Materias Primas | Envases y Embalajes | Producto Terminado | Producción
// - Búsqueda unificada
// - Generación automática de códigos
// - Trazabilidad bidireccional visual
// - Modal "Ver todos los lotes" con filtros
// =============================================================

(function() {
  if (window.__lotsCentralPatchLoaded) return;
  window.__lotsCentralPatchLoaded = true;

  const API_BASE = (() => {
    const PN = (typeof window !== 'undefined' && window.PN) || '';
    return PN || 'https://cleansahel-production.up.railway.app';
  })();

  const getToken = () => {
    try { return localStorage.getItem('cleanerp-token') || ''; } catch { return ''; }
  };

  // Helper para traducir según idioma actual
  const tr = (key) => {
    try {
      const lang = (localStorage.getItem('cleanerp-lang') || 'es').substring(0, 2);
      const dict = window.__i18n || {};
      return dict[lang]?.[key] || dict.es?.[key] || key;
    } catch { return key; }
  };

  const TYPE_INFO = {
    raw: { prefix: 'MP-', label: 'Materia Prima', icon: '🧪', color: '#0ea5e9', bg: '#e0f2fe' },
    envase: { prefix: 'ENV-', label: 'Envase', icon: '🧴', color: '#7c3aed', bg: '#ede9fe' },
    embalaje: { prefix: 'EMB-', label: 'Embalaje', icon: '📦', color: '#a16207', bg: '#fef3c7' },
    product: { prefix: 'PT-', label: 'Producto Terminado', icon: '🏷️', color: '#059669', bg: '#d1fae5' },
    production: { prefix: 'OP-', label: 'Orden Producción', icon: '⚙️', color: '#dc2626', bg: '#fee2e2' }
  };

  // 1. Cargar catálogo de tipos
  async function loadCatalog() {
    try {
      const res = await fetch(`${API_BASE}/api/lots-catalog`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  // 2. Buscar lotes en el endpoint central
  async function searchLots(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.query) params.set('query', filters.query);
      if (filters.status) params.set('status', filters.status);
      if (filters.limit) params.set('limit', filters.limit);
      const res = await fetch(`${API_BASE}/api/lots-central?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    } catch { return []; }
  }

  // 3. Buscar lote por código exacto
  async function getLotByCode(code) {
    try {
      const res = await fetch(`${API_BASE}/api/lots/by-code/${encodeURIComponent(code)}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  // 4. Trazabilidad bidireccional
  async function getTraceability(lotId, type) {
    try {
      if (type === 'product') {
        const res = await fetch(`${API_BASE}/api/lots/${lotId}/traceability`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return null;
        return await res.json();
      } else {
        const res = await fetch(`${API_BASE}/api/lots/${lotId}/reverse-traceability`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return null;
        return await res.json();
      }
    } catch { return null; }
  }

  // 5. Modal central de Lotes
  function showCentralLotsModal() {
    const existing = document.getElementById('lots-central-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'lots-central-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    `;
    modal.innerHTML = `
      <div style="
        background: white; border-radius: 16px; width: 95%; max-width: 1100px; height: 90vh;
        box-shadow: 0 25px 50px rgba(0,0,0,0.3);
        display: flex; flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
      ">
        <div style="
          background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
          color: white; padding: 20px 24px;
          display: flex; justify-content: space-between; align-items: center;
        ">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; margin: 0;">📋 Centro de Lotes</h2>
            <p style="font-size: 12px; margin: 4px 0 0; opacity: 0.9;">Búsqueda y trazabilidad unificada</p>
          </div>
          <button onclick="document.getElementById('lots-central-modal').remove()" style="
            background: rgba(255,255,255,0.2); color: white; border: none;
            width: 32px; height: 32px; border-radius: 50%; font-size: 18px;
            cursor: pointer;
          ">×</button>
        </div>

        <!-- Tabs -->
        <div id="lots-tabs" style="
          display: flex; gap: 4px; padding: 12px 24px 0;
          background: #f9fafb; border-bottom: 1px solid #e5e7eb;
          overflow-x: auto;
        ">
          <button class="lot-tab active" data-type="all" style="
            padding: 10px 18px; border: none; background: white; border-radius: 8px 8px 0 0;
            font-size: 13px; font-weight: 600; cursor: pointer; color: #1e3a8a;
            border-bottom: 3px solid #1e3a8a; white-space: nowrap;
          ">📋 Todos</button>
          <button class="lot-tab" data-type="raw" style="
            padding: 10px 18px; border: none; background: transparent; border-radius: 8px 8px 0 0;
            font-size: 13px; font-weight: 600; cursor: pointer; color: #6b7280; white-space: nowrap;
          ">🧪 Materias Primas</button>
          <button class="lot-tab" data-type="envase" style="
            padding: 10px 18px; border: none; background: transparent; border-radius: 8px 8px 0 0;
            font-size: 13px; font-weight: 600; cursor: pointer; color: #6b7280; white-space: nowrap;
          ">🧴 Envases</button>
          <button class="lot-tab" data-type="embalaje" style="
            padding: 10px 18px; border: none; background: transparent; border-radius: 8px 8px 0 0;
            font-size: 13px; font-weight: 600; cursor: pointer; color: #6b7280; white-space: nowrap;
          ">📦 Embalajes</button>
          <button class="lot-tab" data-type="product" style="
            padding: 10px 18px; border: none; background: transparent; border-radius: 8px 8px 0 0;
            font-size: 13px; font-weight: 600; cursor: pointer; color: #6b7280; white-space: nowrap;
          ">🏷️ Producto Terminado</button>
          <button class="lot-tab" data-type="production" style="
            padding: 10px 18px; border: none; background: transparent; border-radius: 8px 8px 0 0;
            font-size: 13px; font-weight: 600; cursor: pointer; color: #6b7280; white-space: nowrap;
          ">⚙️ Producción</button>
        </div>

        <!-- Buscador -->
        <div style="padding: 16px 24px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
          <div style="position: relative; max-width: 600px;">
            <input id="lots-search" type="text" placeholder="Buscar por código, lote interno, proveedor, material..." style="
              width: 100%; padding: 10px 16px 10px 40px;
              border: 1px solid #d1d5db; border-radius: 10px;
              font-size: 14px; outline: none;
              background: white;
            ">
            <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #9ca3af;">🔍</span>
          </div>
        </div>

        <!-- Resultados -->
        <div id="lots-results" style="flex: 1; overflow-y: auto; padding: 16px 24px;">
          <p style="text-align: center; color: #9ca3af; padding: 40px;">Cargando...</p>
        </div>
      </div>
    `;

    // Lógica de tabs
    let currentType = 'all';
    modal.querySelectorAll('.lot-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.lot-tab').forEach(t => {
          t.classList.remove('active');
          t.style.background = 'transparent';
          t.style.color = '#6b7280';
          t.style.borderBottom = 'none';
        });
        tab.classList.add('active');
        tab.style.background = 'white';
        tab.style.color = '#1e3a8a';
        tab.style.borderBottom = '3px solid #1e3a8a';
        currentType = tab.dataset.type;
        refreshResults();
      });
    });

    const search = modal.querySelector('#lots-search');
    let searchTimer;
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(refreshResults, 300);
    });

    async function refreshResults() {
      const query = search.value.trim();
      const results = await searchLots({ type: currentType === 'all' ? '' : currentType, query, limit: 100 });
      const container = modal.querySelector('#lots-results');
      if (results.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: #9ca3af; padding: 40px;">No se encontraron lotes</p>`;
        return;
      }
      container.innerHTML = results.map(r => {
        const info = TYPE_INFO[r.type] || TYPE_INFO.raw;
        const date = r.receivedAt || r.producedAt || '';
        const qty = r.quantityRemaining !== undefined ? r.quantityRemaining : r.quantity;
        const total = r.quantityReceived !== undefined ? r.quantityReceived : r.quantity;
        const name = r.materialName || r.productName || '-';
        const code = r.internalLotNumber || r.productionOrderNumber || '';
        return `
          <div onclick="window.__showLotDetail && window.__showLotDetail('${r.id}', '${r.type}', '${r.code}')" style="
            background: white; border: 1px solid #e5e7eb; border-radius: 12px;
            padding: 14px 16px; margin-bottom: 8px; cursor: pointer;
            display: flex; align-items: center; gap: 16px;
            transition: all 0.15s;
          " onmouseover="this.style.borderColor='${info.color}'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
            <div style="
              background: ${info.bg}; color: ${info.color};
              width: 48px; height: 48px; border-radius: 10px;
              display: flex; align-items: center; justify-content: center;
              font-size: 22px; flex-shrink: 0;
            ">${info.icon}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-weight: 700; font-size: 15px; color: #1f2937; font-family: monospace;">${r.code}</span>
                ${code ? `<span style="color: #6b7280; font-size: 12px;">(${code})</span>` : ''}
                <span style="
                  background: ${info.bg}; color: ${info.color};
                  padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
                ">${info.label}</span>
              </div>
              <p style="font-size: 13px; color: #4b5563; margin: 4px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</p>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div style="font-weight: 700; font-size: 15px; color: #1f2937;">${qty} <span style="font-weight: 400; font-size: 12px; color: #6b7280;">${r.unit || ''}</span></div>
              ${total !== qty ? `<div style="font-size: 11px; color: #6b7280;">de ${total}</div>` : ''}
              <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${date ? new Date(date).toLocaleDateString('es-ES') : ''}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    refreshResults();
    document.body.appendChild(modal);
  }

  // 6. Modal de detalle de un lote con trazabilidad
  async function showLotDetail(lotId, type, lotCode) {
    const info = TYPE_INFO[type] || TYPE_INFO.raw;

    // Crear modal de carga inmediatamente
    let modal = document.getElementById('lot-detail-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'lot-detail-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    `;
    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 24px; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="text-align: center; padding: 40px 0;">
          <div style="font-size: 32px; animation: pulse 1.5s infinite;">⏳</div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 12px;">Cargando detalles del lote...</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 4px; font-family: monospace;">${lotCode || lotId}</p>
        </div>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = '@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }';
    modal.appendChild(style);
    document.body.appendChild(modal);

    // Timeout: cerrar tras 8 segundos si no responde
    const timeoutId = setTimeout(() => {
      const m = document.getElementById('lot-detail-modal');
      if (m) {
        m.innerHTML = `
          <div style="background: white; border-radius: 16px; padding: 24px; max-width: 500px; width: 90%; font-family: -apple-system, sans-serif; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
            <h3 style="color: #dc2626; margin: 0 0 8px;">Sin respuesta del servidor</h3>
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px;">
              El servidor tardó demasiado en responder. Intenta de nuevo.
            </p>
            <button onclick="document.getElementById('lot-detail-modal').remove()" style="
              padding: 10px 24px; background: #1e3a8a; color: white;
              border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
            ">Cerrar</button>
          </div>
        `;
      }
    }, 8000);

    try {
      let lot = null;
      let traceHtml = '';

      // 1. Obtener datos del lote por su código
      if (lotCode) {
        const byCodeRes = await fetch(`${API_BASE}/api/lots/by-code/${encodeURIComponent(lotCode)}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (byCodeRes.ok) {
          const byCodeData = await byCodeRes.json();
          lot = byCodeData.lot;
        }
      }

      // 2. Obtener trazabilidad según tipo
      if (type === 'product' && lotId) {
        // PT → trazabilidad forward (qué MPs/envases se usaron)
        try {
          const traceRes = await fetch(`${API_BASE}/api/lots/${lotId}/traceability`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
          });
          if (traceRes.ok) {
            const traceData = await traceRes.json();
            traceHtml = buildTraceabilityHtml(traceData, 'forward');
          }
        } catch (e) {}
      } else if (lotId) {
        // MP/ENV/EMB → trazabilidad inversa (en qué PTs se usó)
        try {
          const revRes = await fetch(`${API_BASE}/api/lots/${lotId}/reverse-traceability`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
          });
          if (revRes.ok) {
            const revData = await revRes.json();
            traceHtml = buildTraceabilityHtml(revData, 'reverse');
          }
        } catch (e) {}
      }

      clearTimeout(timeoutId);
      if (!document.getElementById('lot-detail-modal')) return;

      // Construir HTML del modal de detalle
      const lotInfo = lot || {};
      const lotInfo2 = lotInfo.lot || lotInfo;
      const qty = lotInfo2.quantityRemaining !== undefined ? lotInfo2.quantityRemaining : lotInfo2.quantity || '-';
      const total = lotInfo2.quantityReceived !== undefined ? lotInfo2.quantityReceived : lotInfo2.quantity || '-';
      const unit = lotInfo2.unit || '';
      const supplier = lotInfo2.supplierName || lotInfo2.supplier || '-';
      const material = lotInfo2.materialName || lotInfo2.productName || lotInfo.name || '-';
      const receivedAt = lotInfo2.receivedAt || lotInfo2.createdAt || lotInfo2.date || '';
      const expiry = lotInfo2.expiryDate || lotInfo2.expiry || '';
      const internalLot = lotInfo2.internalLotNumber || lotInfo2.lotNumber || lotInfo2.internal_lot_number || '';
      const status = lotInfo2.status || 'activo';
      const usedPct = lotInfo2.percentUsed !== undefined ? lotInfo2.percentUsed :
        (total && qty && total > 0 ? Math.round(((total - qty) / total) * 100) : 0);

      const statusColor = status === 'bloqueado' ? '#dc2626' : status === 'agotado' ? '#6b7280' : '#10b981';
      const labelUrl = `${API_BASE}/api/reception-label/${type}/${lotId}`;
      const infoUrl = `${API_BASE}/api/reception-info/${type}/${lotId}`;

      document.getElementById('lot-detail-modal').innerHTML = `
        <style>
          .ldm-box { background: white; border-radius: 16px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 25px 50px rgba(0,0,0,0.3); }
          .ldm-header { background: linear-gradient(135deg, ${info.color} 0%, ${info.darkColor} 100%); padding: 24px 20px 20px; color: white; }
          .ldm-body { padding: 20px; }
          .ldm-section { margin-bottom: 20px; }
          .ldm-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin: 0 0 10px; }
          .ldm-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .ldm-row:last-child { border-bottom: none; }
          .ldm-label { font-size: 13px; color: #6b7280; }
          .ldm-value { font-size: 13px; font-weight: 600; color: #1f2937; text-align: right; }
          .ldm-trace-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
          .ldm-btn { transition: all 0.15s; }
          .ldm-btn:hover { transform: translateY(-1px); }
          @media (max-width: 480px) { .ldm-box { border-radius: 16px 16px 0 0; margin-top: auto; } }
        </style>
        <div class="ldm-box" onclick="event.stopPropagation()">
          <div class="ldm-header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                  <span style="font-size: 24px;">${info.icon}</span>
                  <span style="font-size: 11px; background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 4px; font-weight: 600;">${info.label}</span>
                </div>
                <h2 style="margin: 0; font-size: 22px; font-weight: 700; font-family: monospace;">${lotCode || lotId}</h2>
                <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">${material}</p>
              </div>
              <button onclick="document.getElementById('lot-detail-modal').remove()" style="
                background: rgba(255,255,255,0.2); border: none; border-radius: 8px;
                color: white; width: 32px; height: 32px; cursor: pointer; font-size: 18px;
                display: flex; align-items: center; justify-content: center;
              ">✕</button>
            </div>
          </div>

          <div class="ldm-body">
            <div class="ldm-section">
              <div class="ldm-section-title">Información del lote</div>
              ${internalLot ? `<div class="ldm-row"><span class="ldm-label">Lote interno</span><span class="ldm-value" style="font-family:monospace">${internalLot}</span></div>` : ''}
              <div class="ldm-row"><span class="ldm-label">Proveedor</span><span class="ldm-value">${supplier}</span></div>
              <div class="ldm-row"><span class="ldm-label">Cantidad</span><span class="ldm-value">${qty} / ${total} ${unit}</span></div>
              <div class="ldm-row"><span class="ldm-label">Fecha recepción</span><span class="ldm-value">${receivedAt ? new Date(receivedAt).toLocaleDateString('es-ES') : '-'}</span></div>
              ${expiry ? `<div class="ldm-row"><span class="ldm-label">Caducidad</span><span class="ldm-value" style="color:#dc2626">${new Date(expiry).toLocaleDateString('es-ES')}</span></div>` : ''}
              <div class="ldm-row">
                <span class="ldm-label">Estado</span>
                <span class="ldm-value" style="color:${statusColor}; font-weight:700; text-transform:uppercase; font-size:11px;">${status}</span>
              </div>
              <div class="ldm-row">
                <span class="ldm-label">% Usado</span>
                <span class="ldm-value">
                  <span style="display:inline-flex; align-items:center; gap:6px;">
                    <span style="flex:1; background:#e5e7eb; border-radius:4px; height:6px; width:80px;">
                      <span style="display:block; background:${info.color}; height:100%; border-radius:4px; width:${usedPct}%;"></span>
                    </span>
                    ${usedPct}%
                  </span>
                </span>
              </div>
            </div>

            ${traceHtml ? `
            <div class="ldm-section">
              <div class="ldm-section-title">📋 Trazabilidad</div>
              ${traceHtml}
            </div>` : ''}

            <div class="ldm-section">
              <div class="ldm-section-title">Acciones</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button class="ldm-btn" onclick="window.open('${labelUrl}?print=1','_blank')" style="
                  padding: 12px; border: 1px solid #d1d5db; border-radius: 10px;
                  background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
                  font-size: 13px; font-weight: 600; color: #1f2937;
                ">
                  <span>🖨️</span><span>Imprimir etiqueta</span>
                </button>
                <button class="ldm-btn" onclick="window.open('${infoUrl}','_blank')" style="
                  padding: 12px; border: 1px solid #d1d5db; border-radius: 10px;
                  background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
                  font-size: 13px; font-weight: 600; color: #1f2937;
                ">
                  <span>📱</span><span>Ver QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Click en backdrop para cerrar
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

    } catch (err) {
      clearTimeout(timeoutId);
      const m = document.getElementById('lot-detail-modal');
      if (m) {
        m.innerHTML = `
          <div style="background: white; border-radius: 16px; padding: 24px; max-width: 500px; width: 90%; font-family: -apple-system, sans-serif; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">❌</div>
            <h3 style="color: #dc2626; margin: 0 0 8px;">Error al cargar</h3>
            <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px;">No se pudieron cargar los detalles del lote.</p>
            <button onclick="document.getElementById('lot-detail-modal').remove()" style="
              padding: 10px 24px; background: #1e3a8a; color: white;
              border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
            ">Cerrar</button>
          </div>
        `;
      }
    }
  }

  // Helper: construir HTML de trazabilidad
  function buildTraceabilityHtml(data, direction) {
    if (direction === 'forward') {
      const lot = data.lot || {};
      const consumptions = data.consumptions || [];
      if (consumptions.length === 0) {
        return '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0;">Sin consumos registrados</p>';
      }
      return `
        <div style="border-left: 3px solid #10b981; padding-left: 12px; margin-bottom: 8px;">
          <div style="font-size:12px;color:#6b7280;">Producción: <strong>${data.productionOrder?.number || '-'}</strong></div>
          <div style="font-size:12px;color:#6b7280;">Pedido: <strong>${data.order?.number || '-'}</strong></div>
        </div>
        ${consumptions.map(c => `
          <div class="ldm-trace-item">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <span style="font-family:monospace;font-size:12px;font-weight:700;color:#1e3a8a;">${c.source_lot_code || c.sourceLotCode || '-'}</span>
                <span style="font-size:11px;color:#6b7280;margin-left:6px;">${c.material_name || c.materialName || ''}</span>
              </div>
              <span style="font-weight:700;font-size:14px;color:#1f2937;">${c.quantity_consumed || c.quantityConsumed || '-'} ${c.unit || ''}</span>
            </div>
          </div>
        `).join('')}
      `;
    } else {
      const usedIn = data.usedIn || [];
      if (usedIn.length === 0) {
        return '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0;">Este lote aún no ha sido usado en ninguna producción</p>';
      }
      return usedIn.map(u => `
        <div class="ldm-trace-item" style="border-left:3px solid #f59e0b;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-family:monospace;font-size:12px;font-weight:700;color:#1e3a8a;">${u.productionLotCode || '-'}</span>
              <span style="font-size:11px;color:#6b7280;margin-left:6px;">${u.productName || ''}</span>
            </div>
            <span style="font-weight:700;font-size:14px;color:#1f2937;">${u.quantityConsumed || '-'} ${u.unit || ''}</span>
          </div>
        </div>
      `).join('');
    }
  }

  window.__showLotDetail = showLotDetail;

  // 7. Exponer funciones globales
  window.showCentralLotsModal = showCentralLotsModal;
  window.lotsCentralSearch = searchLots;
  window.lotsCentralGetByCode = getLotByCode;
  window.lotsCentralTraceability = getTraceability;
  window.lotsCentralLoadCatalog = loadCatalog;
  window.lotsCentralTypeInfo = TYPE_INFO;

  // 8. Inyectar botón en el sidebar
  function injectSidebarButton() {
    // Buscar el sidebar
    const sidebar = document.querySelector('nav, aside, [class*="sidebar"]');
    if (!sidebar) return;
    if (document.getElementById('lots-central-btn')) return;

    // Buscar un item existente del sidebar (e.g. "Lotes", "Materias Primas")
    const links = sidebar.querySelectorAll('a, button, [role="link"]');
    let target = null;
    for (const link of links) {
      const text = (link.textContent || '').toLowerCase();
      if (text.includes('lote') || text.includes('lotes')) {
        target = link;
        break;
      }
    }

    const btn = document.createElement('button');
    btn.id = 'lots-central-btn';
    btn.onclick = showCentralLotsModal;
    btn.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 9998;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: white; border: none; padding: 12px 20px;
      border-radius: 30px; font-size: 14px; font-weight: 600;
      cursor: pointer; box-shadow: 0 8px 20px rgba(30, 58, 138, 0.4);
      display: flex; align-items: center; gap: 8px;
      transition: transform 0.15s;
    `;
    btn.onmouseover = () => btn.style.transform = 'translateY(-2px)';
    btn.onmouseout = () => btn.style.transform = 'translateY(0)';
    btn.innerHTML = `📋 Centro de Lotes`;
    document.body.appendChild(btn);
  }

  // 9. Auto-injectar cuando cargue la app
  if (document.readyState === 'complete') {
    setTimeout(injectSidebarButton, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(injectSidebarButton, 1000));
  }

  // También intentar de nuevo si el sidebar se monta tarde
  setTimeout(injectSidebarButton, 3000);
  setTimeout(injectSidebarButton, 6000);

  console.info('[Lots Central] Patch loaded - 5 types: MP, ENV, EMB, PT, OP');
})();
