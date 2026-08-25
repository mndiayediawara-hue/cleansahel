// =============================================================
// PATCH: Centro de Lotes - Vista Central Unificada
// - NO es un modal flotante. Es una página completa accesible desde sidebar
// - Se abre en su propia vista, no bloquea ningún formulario
// - Muestra todos los lotes del sistema (MP, ENV, EMB, PT, OP)
// - Click en cualquier lote abre detalle con trazabilidad
// - Buscador unificado con filtros por tipo
// =============================================================

(function() {
  if (window.__lotsCentralPatchLoaded) return;
  window.__lotsCentralPatchLoaded = true;

  const API_BASE = (() => {
    try { return window.PN || 'https://cleansahel-production.up.railway.app'; } catch { return 'https://cleansahel-production.up.railway.app'; }
  })();

  const getToken = () => {
    try { return localStorage.getItem('cleanerp-token') || ''; } catch { return ''; }
  };

  const TYPE_INFO = {
    raw:       { label: 'Materia Prima',   icon: '🧪', color: '#0ea5e9', bg: '#e0f2fe',   dark: '#0284c7' },
    envase:    { label: 'Envase',          icon: '🧴', color: '#7c3aed', bg: '#ede9fe',   dark: '#6d28d9' },
    embalaje:  { label: 'Embalaje',        icon: '📦', color: '#a16207', bg: '#fef3c7',   dark: '#92400e' },
    product:   { label: 'Prod. Terminado', icon: '🏭', color: '#059669', bg: '#d1fae5',   dark: '#047857' },
    production:{ label: 'Orden Producción', icon: '⚙️', color: '#dc2626', bg: '#fee2e2',   dark: '#b91c1c' }
  };

  // ─────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────
  async function api(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json', ...opts.headers }
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  }

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ─────────────────────────────────────────
  // NAVEGACIÓN: página completa en vez de modal
  // ─────────────────────────────────────────
  function openCentroLotes() {
    // Crear un div que ocupe toda la pantalla, detrás del sidebar si lo hay
    const existing = document.getElementById('centro-lotes-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'centro-lotes-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9000;
      background: #f3f4f6;
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: cl-slideIn 0.25s ease;
      overflow: hidden;
    `;
    overlay.innerHTML = `
      <style>
        @keyframes cl-slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cl-fade { from { opacity: 0; } to { opacity: 1; } }
        .cl-header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: white; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .cl-tabs { display: flex; gap: 4px; padding: 10px 16px; background: white; border-bottom: 1px solid #e5e7eb; overflow-x: auto; flex-shrink: 0; }
        .cl-tab { padding: 8px 14px; border: none; background: transparent; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: #6b7280; white-space: nowrap; transition: all 0.15s; }
        .cl-tab.active { background: #1e3a8a; color: white; }
        .cl-tab:hover:not(.active) { background: #f3f4f6; }
        .cl-search { padding: 12px 16px; background: white; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
        .cl-search input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px; box-sizing: border-box; outline: none; }
        .cl-search input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .cl-body { flex: 1; overflow-y: auto; padding: 12px 16px; }
        .cl-lot-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; cursor: pointer; display: flex; align-items: center; gap: 14px; transition: all 0.15s; }
        .cl-lot-card:hover { border-color: #2563eb; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .cl-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .cl-code { font-weight: 700; font-size: 15px; font-family: monospace; color: #1f2937; }
        .cl-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .cl-empty { text-align: center; padding: 60px 20px; color: #9ca3af; }
        .cl-loading { text-align: center; padding: 40px; color: #9ca3af; }
        .cl-stat-bar { height: 4px; background: #e5e7eb; border-radius: 2px; margin-top: 6px; }
        .cl-stat-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
        .cl-back-btn { background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; }
        .cl-back-btn:hover { background: rgba(255,255,255,0.3); }
        @media (max-width: 480px) { .cl-lot-card { padding: 12px; } }
      </style>
    `;

    document.body.appendChild(overlay);
    renderCentroLotesApp(overlay);
  }

  async function renderCentroLotesApp(container) {
    let currentType = 'all';
    let currentQuery = '';
    let lots = [];
    let loading = true;
    let catalog = null;
    let debounceTimer = null;

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'cl-header';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="cl-back-btn" id="cl-close" title="Cerrar">✕</button>
        <div>
          <h1 style="margin:0;font-size:18px;font-weight:700;">📋 Centro de Lotes</h1>
          <p style="margin:2px 0 0;font-size:11px;opacity:0.85;">Vista central de trazabilidad</p>
        </div>
      </div>
      <div style="font-size:12px;opacity:0.9;text-align:right;">
        <div id="cl-counts" style="font-weight:600;">-</div>
        <div style="font-size:10px;opacity:0.8;">lotes en sistema</div>
      </div>
    `;
    container.querySelector('.cl-header') ? container.querySelector('.cl-header').replaceWith(header) : container.insertBefore(header, container.firstChild);
    document.getElementById('cl-close').onclick = () => document.getElementById('centro-lotes-overlay').remove();

    // ── Tabs ──
    const tabs = document.createElement('div');
    tabs.className = 'cl-tabs';
    tabs.innerHTML = `
      <button class="cl-tab active" data-type="all">📋 Todos</button>
      <button class="cl-tab" data-type="raw">🧪 MP</button>
      <button class="cl-tab" data-type="envase">🧴 ENV</button>
      <button class="cl-tab" data-type="embalaje">📦 EMB</button>
      <button class="cl-tab" data-type="product">🏭 PT</button>
      <button class="cl-tab" data-type="production">⚙️ OP</button>
    `;
    container.querySelector('.cl-tabs') ? container.querySelector('.cl-tabs').replaceWith(tabs) : container.insertBefore(tabs, container.querySelector('.cl-body'));

    // ── Search ──
    const searchBox = document.createElement('div');
    searchBox.className = 'cl-search';
    searchBox.innerHTML = `
      <input type="text" id="cl-search-input" placeholder="Buscar por código, proveedor, material..." />
    `;
    container.querySelector('.cl-search') ? container.querySelector('.cl-search').replaceWith(searchBox) : container.insertBefore(searchBox, container.querySelector('.cl-body'));

    // ── Body ──
    let body = container.querySelector('.cl-body') || (() => {
      const b = document.createElement('div');
      b.className = 'cl-body';
      container.appendChild(b);
      return b;
    })();

    function renderBody() {
      if (loading) {
        body.innerHTML = '<div class="cl-loading">⏳ Cargando lotes...</div>';
        return;
      }
      if (lots.length === 0) {
        body.innerHTML = `
          <div class="cl-empty">
            <div style="font-size:48px;margin-bottom:12px;">📭</div>
            <p style="font-size:15px;font-weight:600;margin:0 0 4px;">Sin lotes${currentQuery ? ' para esta búsqueda' : ''}</p>
            <p style="font-size:13px;margin:0;">${currentType !== 'all' ? 'Prueba con otra categoría o busca en Todos.' : 'Registra una recepción para ver los lotes aquí.'}</p>
          </div>`;
        return;
      }
      body.innerHTML = lots.map(r => {
        const info = TYPE_INFO[r.type] || TYPE_INFO.raw;
        const qty = r.quantityRemaining !== undefined ? r.quantityRemaining : r.quantity || 0;
        const total = r.quantityReceived !== undefined ? r.quantityReceived : r.quantity || qty;
        const pct = total > 0 ? Math.round(((total - qty) / total) * 100) : 0;
        const name = r.materialName || r.productName || r.name || '-';
        const date = r.receivedAt || r.producedAt || r.createdAt || '';
        return `
          <div class="cl-lot-card" onclick="window.__showLotDetail('${r.id}', '${r.type}', '${r.code}')">
            <div class="cl-icon" style="background:${info.bg};color:${info.color};">${info.icon}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="cl-code">${r.code || r.id}</span>
                <span class="cl-badge" style="background:${info.bg};color:${info.color};">${info.label}</span>
              </div>
              <p style="margin:4px 0 0;font-size:13px;color:#4b5563;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</p>
              ${pct > 0 ? `<div class="cl-stat-bar"><div class="cl-stat-fill" style="width:${pct}%;background:${info.color};"></div></div>` : ''}
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-weight:700;font-size:15px;">${qty} <span style="font-weight:400;font-size:12px;color:#6b7280;">${r.unit || 'ud'}</span></div>
              <div style="font-size:11px;color:#9ca3af;">${date ? formatDate(date) : ''}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    async function loadLots() {
      loading = true;
      renderBody();
      try {
        const params = new URLSearchParams();
        if (currentType !== 'all') params.set('type', currentType);
        if (currentQuery) params.set('query', currentQuery);
        params.set('limit', '200');
        const data = await api(`/api/lots-central?${params}`);
        lots = data.results || [];
      } catch {
        lots = [];
      }
      loading = false;
      renderBody();
    }

    async function loadCatalog() {
      try {
        catalog = await api('/api/lots-catalog');
        const counts = catalog?.counts || {};
        document.getElementById('cl-counts').textContent = Object.values(counts).reduce((a, b) => a + b, 0);
      } catch {}
    }

    // Tab clicks
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.cl-tab');
      if (!tab) return;
      tabs.querySelectorAll('.cl-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentType = tab.dataset.type;
      loadLots();
    });

    // Search with debounce
    document.getElementById('cl-search-input').addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentQuery = e.target.value.trim();
        loadLots();
      }, 300);
    });

    // Init
    await loadCatalog();
    await loadLots();
  }

  // ─────────────────────────────────────────
  // DETALLE DE LOTE con trazabilidad
  // ─────────────────────────────────────────
  async function showLotDetail(lotId, type, lotCode) {
    let modal = document.getElementById('lot-detail-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'lot-detail-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      display: flex; align-items: flex-end; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const info = TYPE_INFO[type] || TYPE_INFO.raw;
    const closeModal = () => modal.remove();

    modal.innerHTML = `
      <div style="
        background: white; width: 100%; max-width: 700px; max-height: 92vh;
        border-radius: 20px 20px 0 0;
        box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
        display: flex; flex-direction: column;
        overflow: hidden;
        animation: cl-modalUp 0.25s ease;
      ">
        <style>
          @keyframes cl-modalUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          .ldm2-header { background: linear-gradient(135deg, ${info.color} 0%, ${info.dark} 100%); padding: 20px 20px 16px; color: white; }
          .ldm2-body { padding: 16px 20px 24px; overflow-y: auto; flex: 1; }
          .ldm2-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
          .ldm2-row:last-child { border-bottom: none; }
          .ldm2-label { font-size: 13px; color: #6b7280; }
          .ldm2-value { font-size: 13px; font-weight: 600; color: #1f2937; text-align: right; }
          .ldm2-section { margin-bottom: 16px; }
          .ldm2-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin: 0 0 8px; }
          .ldm2-trace { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
          .ldm2-action { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .ldm2-btn { padding: 12px; border: 1px solid #d1d5db; border-radius: 10px; background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #1f2937; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s; }
          .ldm2-btn:hover { background: #f9fafb; border-color: #2563eb; color: #2563eb; }
          .ldm2-handle { width: 40px; height: 4px; background: #d1d5db; border-radius: 2px; margin: 8px auto 0; }
        </style>

        <div class="ldm2-handle" onclick="document.getElementById('lot-detail-modal').remove()"></div>

        <div class="ldm2-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-size:24px;">${info.icon}</span>
                <span style="font-size:11px;background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:4px;font-weight:600;">${info.label}</span>
              </div>
              <h2 id="ldm2-code" style="margin:0;font-size:22px;font-weight:700;font-family:monospace;">${lotCode || lotId}</h2>
              <p id="ldm2-name" style="margin:4px 0 0;font-size:13px;opacity:0.9;">Cargando...</p>
            </div>
            <button onclick="document.getElementById('lot-detail-modal').remove()" style="
              background:rgba(255,255,255,0.2);border:none;border-radius:8px;color:white;
              width:32px;height:32px;cursor:pointer;font-size:18px;
            ">✕</button>
          </div>
        </div>

        <div class="ldm2-body" id="ldm2-body">
          <div style="text-align:center;padding:20px;color:#9ca3af;">
            <div style="font-size:28px;animation:pulse 1.5s infinite;">⏳</div>
            <p style="margin:8px 0 0;font-size:13px;">Cargando detalles...</p>
          </div>
        </div>
      </div>
    `;

    // Click backdrop = close
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.body.appendChild(modal);

    const timeoutId = setTimeout(() => {
      const b = document.getElementById('ldm2-body');
      if (b) b.innerHTML = '<div style="text-align:center;padding:20px;"><p style="color:#dc2626;">⏱️ Sin respuesta del servidor. Cierra y vuélvelo a intentar.</p></div>';
    }, 8000);

    try {
      let lotData = null;

      // 1. Obtener datos por código
      if (lotCode) {
        try {
          const byCode = await api(`/api/lots/by-code/${encodeURIComponent(lotCode)}`);
          lotData = byCode.lot || byCode;
        } catch {}
      }

      // 2. Trazabilidad
      let traceHtml = '';
      try {
        if (type === 'product') {
          const t = await api(`/api/lots/${lotId}/traceability`);
          traceHtml = buildTraceHtml(t, 'forward');
        } else {
          const t = await api(`/api/lots/${lotId}/reverse-traceability`);
          traceHtml = buildTraceHtml(t, 'reverse');
        }
      } catch {}

      clearTimeout(timeoutId);

      const lot = lotData || {};
      const qty = lot.quantityRemaining !== undefined ? lot.quantityRemaining : lot.quantity || '-';
      const total = lot.quantityReceived !== undefined ? lot.quantityReceived : lot.quantity || qty;
      const unit = lot.unit || '';
      const supplier = lot.supplierName || lot.supplier || '-';
      const material = lot.materialName || lot.productName || lot.name || '-';
      const receivedAt = lot.receivedAt || lot.createdAt || lot.date || '';
      const expiry = lot.expiryDate || lot.expiry || '';
      const internalLot = lot.internalLotNumber || lot.lotNumber || lot.internal_lot_number || '';
      const status = lot.status || 'activo';
      const pct = total > 0 && qty !== '-' ? Math.round(((total - qty) / total) * 100) : 0;
      const statusColor = status === 'bloqueado' ? '#dc2626' : status === 'agotado' ? '#6b7280' : '#10b981';
      const labelUrl = `${API_BASE}/api/reception-label/${type}/${lotId}`;
      const infoUrl = `${API_BASE}/api/reception-info/${type}/${lotId}`;

      document.getElementById('ldm2-name').textContent = material;
      document.getElementById('ldm2-body').innerHTML = `
        <div class="ldm2-section">
          <div class="ldm2-section-title">Información</div>
          ${internalLot ? `<div class="ldm2-row"><span class="ldm2-label">Lote interno</span><span class="ldm2-value" style="font-family:monospace">${internalLot}</span></div>` : ''}
          <div class="ldm2-row"><span class="ldm2-label">Proveedor</span><span class="ldm2-value">${supplier}</span></div>
          <div class="ldm2-row"><span class="ldm2-label">Cantidad</span><span class="ldm2-value">${qty} / ${total} ${unit}</span></div>
          <div class="ldm2-row"><span class="ldm2-label">Fecha recepción</span><span class="ldm2-value">${receivedAt ? formatDate(receivedAt) : '-'}</span></div>
          ${expiry ? `<div class="ldm2-row"><span class="ldm2-label">Caducidad</span><span class="ldm2-value" style="color:#dc2626">${formatDate(expiry)}</span></div>` : ''}
          <div class="ldm2-row">
            <span class="ldm2-label">Estado</span>
            <span class="ldm2-value" style="color:${statusColor};font-weight:700;text-transform:uppercase;font-size:11px;">${status}</span>
          </div>
          ${pct > 0 ? `
          <div class="ldm2-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
            <span class="ldm2-label">% Usado</span>
            <div style="display:flex;align-items:center;gap:8px;width:100%;">
              <div style="flex:1;height:6px;background:#e5e7eb;border-radius:3px;">
                <div style="height:100%;width:${pct}%;background:${info.color};border-radius:3px;"></div>
              </div>
              <span style="font-size:12px;font-weight:600;color:#1f2937;min-width:35px;text-align:right;">${pct}%</span>
            </div>
          </div>` : ''}
        </div>

        ${traceHtml ? `
        <div class="ldm2-section">
          <div class="ldm2-section-title">📋 Trazabilidad</div>
          ${traceHtml}
        </div>` : ''}

        <div class="ldm2-section">
          <div class="ldm2-section-title">Acciones</div>
          <div class="ldm2-action">
            <button class="ldm2-btn" onclick="window.open('${labelUrl}?print=1','_blank')">
              🖨️ Imprimir etiqueta
            </button>
            <button class="ldm2-btn" onclick="window.open('${infoUrl}','_blank')">
              📱 Ver QR
            </button>
          </div>
        </div>
      `;

    } catch (err) {
      clearTimeout(timeoutId);
      const b = document.getElementById('ldm2-body');
      if (b) b.innerHTML = `<div style="text-align:center;padding:20px;"><p style="color:#dc2626;">❌ Error al cargar: ${err.message}</p><button onclick="document.getElementById('lot-detail-modal').remove()" style="margin-top:12px;padding:8px 20px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;">Cerrar</button></div>`;
    }
  }

  function buildTraceHtml(data, direction) {
    if (direction === 'forward') {
      const consumptions = data.consumptions || [];
      if (consumptions.length === 0) return '<p style="color:#9ca3af;font-size:13px;">Sin consumos registrados</p>';
      return `
        <div style="border-left:3px solid #10b981;padding-left:12px;margin-bottom:8px;font-size:12px;color:#6b7280;">
          Producción: <strong>${data.productionOrder?.number || '-'}</strong> · Pedido: <strong>${data.order?.number || '-'}</strong>
        </div>
        ${consumptions.map(c => `
          <div class="ldm2-trace">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <span style="font-family:monospace;font-size:12px;font-weight:700;color:#1e3a8a;">${c.source_lot_code || '-'}</span>
                <span style="font-size:11px;color:#6b7280;margin-left:6px;">${c.material_name || ''}</span>
              </div>
              <span style="font-weight:700;font-size:14px;">${c.quantity_consumed} ${c.unit || ''}</span>
            </div>
          </div>
        `).join('')}
      `;
    } else {
      const usedIn = data.usedIn || [];
      if (usedIn.length === 0) return '<p style="color:#9ca3af;font-size:13px;">Este lote aún no se ha usado en ninguna producción</p>';
      return usedIn.map(u => `
        <div class="ldm2-trace" style="border-left:3px solid #f59e0b;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-family:monospace;font-size:12px;font-weight:700;color:#1e3a8a;">${u.productionLotCode || '-'}</span>
              <span style="font-size:11px;color:#6b7280;margin-left:6px;">${u.productName || ''}</span>
            </div>
            <span style="font-weight:700;font-size:14px;">${u.quantityConsumed} ${u.unit || ''}</span>
          </div>
        </div>
      `).join('');
    }
  }

  // ─────────────────────────────────────────
  // INYECTAR BOTÓN EN EL SIDEBAR
  // ─────────────────────────────────────────
  function injectSidebarButton() {
    const existing = document.getElementById('cl-sidebar-btn');
    if (existing) return;

    // Buscar el nav
    const nav = document.querySelector('nav, aside');
    if (!nav) return;

    // Crear el botón
    const btn = document.createElement('a');
    btn.id = 'cl-sidebar-btn';
    btn.href = '#';
    btn.title = 'Centro de Lotes';
    btn.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; margin: 4px 8px;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: white; border-radius: 10px; font-size: 14px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      transition: all 0.15s; box-shadow: 0 2px 8px rgba(30,58,138,0.3);
    `;
    btn.innerHTML = `<span style="font-size:18px;">📋</span><span>Centro de Lotes</span>`;
    btn.onclick = (e) => { e.preventDefault(); openCentroLotes(); };

    // Buscar dónde insertar: después de "Producción" o al final del nav
    const prodLink = Array.from(nav.querySelectorAll('a')).find(a => a.textContent.includes('Producción'));
    if (prodLink && prodLink.parentElement) {
      const li = prodLink.parentElement;
      const container = li.parentElement;
      if (container) {
        const newLi = document.createElement('li');
        newLi.appendChild(btn);
        container.insertBefore(newLi, li.nextSibling);
      } else {
        nav.appendChild(btn);
      }
    } else {
      nav.appendChild(btn);
    }
  }

  // ─────────────────────────────────────────
  // EXPONER funciones globales
  // ─────────────────────────────────────────
  window.__showLotDetail = showLotDetail;
  window.__openCentroLotes = openCentroLotes;
  window.showCentralLotsModal = openCentroLotes;

  // ─────────────────────────────────────────
  // MUTATION OBSERVER para re-inyectar
  // ─────────────────────────────────────────
  const observer = new MutationObserver(() => {
    injectSidebarButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ─────────────────────────────────────────
  // INICIALIZAR
  // ─────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectSidebarButton, 1000));
  } else {
    setTimeout(injectSidebarButton, 1000);
  }
  setInterval(injectSidebarButton, 3000);

  console.info('[Centro de Lotes] Patch loaded - Vista central unificada');
})();
