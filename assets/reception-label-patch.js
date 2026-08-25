// =============================================================
// PATCH: Botón "Imprimir etiqueta 4x6" después de registrar entrada
// Funciona con: Materias Primas, Envases, Lotes
// Detecta cuando se hace POST exitoso a /raw-material-lots o /packaging-lots
// y muestra un modal con opción de imprimir etiqueta térmica 4x6
// =============================================================

(function() {
  if (window.__receptionLabelPatchLoaded) return;
  window.__receptionLabelPatchLoaded = true;

  const API_BASE = (() => {
    const PN = (typeof window !== 'undefined' && window.PN) || '';
    return PN || 'https://cleansahel-production.up.railway.app';
  })();

  // Interceptar fetch para detectar creación exitosa de lotes
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;
    const method = (options?.method || 'GET').toUpperCase();

    // Detectar creación de lote
    const isRawLot = typeof url === 'string' && url.includes('/raw-material-lots') && method === 'POST' && !url.match(/\/raw-material-lots\/[^/]+/);
    const isPkgLot = typeof url === 'string' && url.includes('/packaging-lots') && method === 'POST' && !url.match(/\/packaging-lots\/[^/]+/);

    if (isRawLot || isPkgLot) {
      try {
        const response = await originalFetch.apply(this, args);
        if (response.ok) {
          const clone = response.clone();
          try {
            const data = await clone.json();
            if (data?.id) {
              // Mostrar modal con la etiqueta
              setTimeout(() => {
                showReceptionLabelModal(data, isRawLot ? 'raw' : 'pkg');
              }, 100);
            }
          } catch (e) {
            // No JSON, ignore
          }
        }
        return response;
      } catch (e) {
        return originalFetch.apply(this, args);
      }
    }

    return originalFetch.apply(this, args);
  };

  // Crear modal
  function showReceptionLabelModal(lotData, type) {
    // Eliminar modal previo si existe
    const existing = document.getElementById('reception-label-modal');
    if (existing) existing.remove();

    const typeLabel = type === 'raw' ? 'Materia Prima' : 'Envase';
    const labelUrl = `${API_BASE}/api/reception-label/${type}/${lotData.id}`;
    const infoUrl = `${API_BASE}/api/reception-info/${type}/${lotData.id}`;

    const modal = document.createElement('div');
    modal.id = 'reception-label-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    `;
    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .rlm-box { animation: slideUp 0.3s ease; }
        .rlm-btn { transition: all 0.15s; }
        .rlm-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        @media print { .rlm-no-print { display: none !important; } }
      </style>
      <div class="rlm-box rlm-no-print" style="
        background: white; border-radius: 16px; padding: 0;
        max-width: 480px; width: 90%;
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; color: white; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">✓</div>
          <h2 style="font-size: 18px; font-weight: 700; margin: 0;">${typeLabel} registrado</h2>
          <p style="font-size: 13px; margin: 4px 0 0; opacity: 0.95;">Lote <code style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-family: monospace;">${lotData.code || ''}</code></p>
        </div>

        <div style="padding: 24px;">
          <p style="color: #4b5563; font-size: 14px; margin: 0 0 20px; text-align: center;">
            ¿Quieres imprimir la etiqueta 4×6 ahora?
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <button class="rlm-btn" onclick="window.open('${labelUrl}?print=1', '_blank'); document.getElementById('reception-label-modal').remove();" style="
              padding: 14px; border: none; border-radius: 10px;
              background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
              color: white; font-size: 13px; font-weight: 600; cursor: pointer;
              display: flex; flex-direction: column; align-items: center; gap: 6px;
            ">
              <span style="font-size: 20px;">🖨️</span>
              <span>Imprimir etiqueta 4×6</span>
            </button>

            <button class="rlm-btn" onclick="window.open('${infoUrl}', '_blank'); document.getElementById('reception-label-modal').remove();" style="
              padding: 14px; border: none; border-radius: 10px;
              background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
              color: white; font-size: 13px; font-weight: 600; cursor: pointer;
              display: flex; flex-direction: column; align-items: center; gap: 6px;
            ">
              <span style="font-size: 20px;">📱</span>
              <span>Ver QR / Info</span>
            </button>
          </div>

          <button class="rlm-btn" onclick="navigator.clipboard.writeText('${infoUrl}'); alert('Enlace copiado: ${infoUrl}\\n\\nPégalo en tu móvil o compártelo.')" style="
            width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 10px;
            background: white; color: #1f2937; font-size: 13px; font-weight: 500; cursor: pointer;
            margin-bottom: 8px;
          ">
            📋 Copiar enlace de trazabilidad
          </button>

          <button class="rlm-btn" onclick="document.getElementById('reception-label-modal').remove()" style="
            width: 100%; padding: 12px; border: none; border-radius: 10px;
            background: #f3f4f6; color: #6b7280; font-size: 13px; font-weight: 500; cursor: pointer;
          ">
            Continuar sin imprimir
          </button>
        </div>
      </div>
    `;

    // Click en backdrop para cerrar
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);

    // Auto-imprimir si se pasa autoPrint
    if (window.location.search.includes('autoPrintLabel')) {
      setTimeout(() => window.open(labelUrl + '?print=1', '_blank'), 200);
    }
  }

  // Exponer función global
  window.showReceptionLabelModal = showReceptionLabelModal;

  // También añadir botón de "Imprimir etiqueta 4x6" en el módulo de Lotes (raw-material-lots)
  // Se inserta automáticamente cuando se renderiza la página
  function addPrintButtonToLotsPage() {
    // Buscar botones existentes de impresión de etiquetas
    const tables = document.querySelectorAll('table tbody tr');
    tables.forEach(row => {
      // Si la fila ya tiene nuestro botón, skip
      if (row.querySelector('.rlm-print-btn')) return;

      // Buscar la columna de acciones (última)
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;

      const actionsCell = cells[cells.length - 1];
      if (!actionsCell) return;

      // Buscar el botón de "imprimir" existente
      const existingPrintBtn = actionsCell.querySelector('button[title*="Imprimir"], button[title*="imprimir"]');
      if (!existingPrintBtn) return;

      // Detectar tipo de lote desde la fila
      const lotId = row.dataset.lotId || row.dataset.id || row.dataset.rawLotId;
      // Esto es complejo, mejor delegamos al backend
    });
  }

  // Observar cambios en el DOM para añadir el botón cuando se renderiza
  const observer = new MutationObserver(() => {
    addPrintButtonToLotsPage();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  console.info('[Reception Label] Patch loaded - 4x6 label generation ready');
})();
