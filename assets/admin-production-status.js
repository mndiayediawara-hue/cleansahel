// admin-production-status.js
// Añade gestión de estado de producción (Pendiente → En curso → Fabricada)
// Se inyecta en la página de Producción y añade un panel con:
// - Lista de todas las fabricaciones con estado
// - Botones para cambiar estado
// - Confirmación antes de crear
// - Historial de lo fabricado
// - Cantidad total fabricada por producto

(function() {
  'use strict';

  function getApi() {
    if (window.__API_URL__) return 'https://cleansahel.onrender.com/api';
    return 'https://cleansahel.onrender.com/api';
  }

  function getUser() {
    try {
      const userData = localStorage.getItem('cleanerp-user');
      if (!userData) return null;
      return JSON.parse(userData);
    } catch (e) { return null; }
  }

  function getToken() {
    const u = getUser();
    return u ? (u.token || null) : null;
  }

  function getRole() {
    const u = getUser();
    return u ? (u.role || null) : null;
  }

  async function apiCall(path, options) {
    options = options || {};
    const token = getToken();
    if (!token) throw new Error('No hay sesión activa');
    const url = getApi() + path;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    return res;
  }

  // Estado local (en localStorage para persistir)
  function loadLocalStatuses() {
    try {
      return JSON.parse(localStorage.getItem('cleanerp-production-statuses') || '{}');
    } catch (e) { return {}; }
  }
  function saveLocalStatuses(statuses) {
    try {
      localStorage.setItem('cleanerp-production-statuses', JSON.stringify(statuses));
    } catch (e) {}
  }

  const STATUS_COLORS = {
    'pendiente': { bg: '#fef3c7', text: '#92400e', label: '⏳ Pendiente' },
    'en_curso': { bg: '#dbeafe', text: '#1e40af', label: '🔄 En curso' },
    'fabricada': { bg: '#d1fae5', text: '#065f46', label: '✅ Fabricada' },
    'completado': { bg: '#d1fae5', text: '#065f46', label: '✅ Completado' },
    'cancelado': { bg: '#fee2e2', text: '#991b1b', label: '❌ Cancelado' }
  };

  function getStatusInfo(status) {
    return STATUS_COLORS[status] || STATUS_COLORS['pendiente'];
  }

  function isProductionPage() {
    const hash = window.location.hash;
    return hash.includes('/production') || hash.includes('/produccion');
  }

  // ============ INTERCEPTAR CREACIÓN DE PRODUCCIÓN PARA CONFIRMACIÓN ============
  document.addEventListener('click', async function(e) {
    if (!isProductionPage()) return;
    const target = e.target;
    const btn = target.closest('button');
    if (!btn) return;
    const text = (btn.textContent || '').trim().toLowerCase();

    // Detectar botón "Iniciar" o "Crear" o "Producir"
    if (text.includes('iniciar producción') || text.includes('crear lote') || text.includes('producir')) {
      const confirmed = confirm('¿Confirmar la producción?\n\n' +
        'Esta acción creará un lote en el sistema.\n' +
        'Una vez creado, podrás cambiar su estado a:\n' +
        '⏳ Pendiente → 🔄 En curso → ✅ Fabricada');
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  // ============ INYECTAR PANEL DE ESTADO DE PRODUCCIÓN ============
  async function injectProductionPanel() {
    if (!isProductionPage()) return;
    if (document.getElementById('admin-production-panel')) return;

    // Esperar a que la página cargue
    await new Promise(r => setTimeout(r, 1500));

    // Buscar el contenedor principal
    const root = document.getElementById('root');
    if (!root) return;

    // Crear panel
    const panel = document.createElement('div');
    panel.id = 'admin-production-panel';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:50vh;overflow-y:auto;background:#1f2937;color:white;padding:16px;box-shadow:0 -4px 20px rgba(0,0,0,0.3);z-index:99998;font-family:Inter,sans-serif;border-top:3px solid #3b82f6;';
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><h3 style="margin:0;font-size:16px;font-weight:700;">📋 Estado de Producción</h3><button id="close-prod-panel" style="background:transparent;border:1px solid #6b7280;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">Cerrar</button></div><div id="prod-panel-content">Cargando...</div>';
    document.body.appendChild(panel);

    document.getElementById('close-prod-panel').addEventListener('click', function() {
      panel.remove();
    });

    // Cargar datos
    await renderPanelContent();
  }

  async function renderPanelContent() {
    const content = document.getElementById('prod-panel-content');
    if (!content) return;
    content.innerHTML = '⏳ Cargando fabricaciones...';

    try {
      const [lotsRes, productsRes] = await Promise.all([
        apiCall('/lots'),
        apiCall('/products')
      ]);
      const lots = await lotsRes.json();
      const products = await productsRes.json();

      const localStatuses = loadLocalStatuses();
      const productMap = {};
      products.forEach(p => { productMap[p.id] = p; });

      // Calcular cantidad total fabricada por producto
      const totalsByProduct = {};
      lots.forEach(l => {
        const status = localStatuses[l.id] || l.status || 'completado';
        if (status !== 'cancelado') {
          if (!totalsByProduct[l.productId]) totalsByProduct[l.productId] = 0;
          totalsByProduct[l.productId] += (l.quantity || 0);
        }
      });

      // Ordenar por fecha (más reciente primero)
      const sortedLots = [...lots].sort((a, b) => (b.producedAt || '').localeCompare(a.producedAt || ''));

      // Render
      let html = '<div style="display:grid;gap:8px;">';

      // Resumen
      html += '<div style="background:#374151;padding:10px;border-radius:8px;margin-bottom:8px;font-size:12px;">';
      html += '<strong>📊 Resumen:</strong> ' + lots.length + ' fabricación(es) en total';
      html += '</div>';

      // Lista de fabricaciones
      sortedLots.slice(0, 20).forEach(lot => {
        const status = localStatuses[lot.id] || lot.status || 'completado';
        const statusInfo = getStatusInfo(status);
        const product = productMap[lot.productId];
        const productName = product ? product.name : 'Producto desconocido';
        const date = lot.producedAt ? new Date(lot.producedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '?';
        const qty = lot.quantity || 0;

        html += '<div style="background:#374151;padding:10px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
        html += '<div style="flex:1;min-width:200px;">';
        html += '<div style="font-weight:600;font-size:13px;">' + (lot.lotNumber || lot.id) + '</div>';
        html += '<div style="font-size:11px;opacity:0.8;">' + productName + ' · ' + qty + ' ud · ' + date + '</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px;align-items:center;">';
        html += '<span style="background:' + statusInfo.bg + ';color:' + statusInfo.text + ';padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">' + statusInfo.label + '</span>';
        html += '<select data-lot-id="' + lot.id + '" class="prod-status-select" style="background:#1f2937;color:white;border:1px solid #6b7280;padding:3px 6px;border-radius:6px;font-size:11px;">';
        ['pendiente', 'en_curso', 'fabricada', 'completado', 'cancelado'].forEach(s => {
          const sel = s === status ? ' selected' : '';
          html += '<option value="' + s + '"' + sel + '>' + getStatusInfo(s).label + '</option>';
        });
        html += '</select>';
        html += '</div>';
        html += '</div>';
      });

      // Cantidad total fabricada por producto
      html += '<div style="background:#1e3a8a;padding:10px;border-radius:8px;margin-top:8px;font-size:12px;">';
      html += '<strong>🏭 Total fabricado por producto:</strong><br>';
      Object.keys(totalsByProduct).forEach(pid => {
        const p = productMap[pid];
        if (p) {
          html += '<div style="display:flex;justify-content:space-between;margin-top:4px;"><span>' + p.name + '</span><strong>' + totalsByProduct[pid] + ' ud</strong></div>';
        }
      });
      html += '</div>';

      // Aviso
      html += '<div style="background:#451a03;padding:8px;border-radius:6px;margin-top:8px;font-size:11px;border-left:3px solid #f59e0b;">';
      html += '⚠️ Los cambios de estado se guardan localmente (en este navegador). El servidor no soporta cambios de estado aún.';
      html += '</div>';

      html += '</div>';
      content.innerHTML = html;

      // Manejar cambios de estado
      content.querySelectorAll('.prod-status-select').forEach(sel => {
        sel.addEventListener('change', function() {
          const lotId = this.getAttribute('data-lot-id');
          const newStatus = this.value;
          const statuses = loadLocalStatuses();
          statuses[lotId] = newStatus;
          saveLocalStatuses(statuses);
          // Re-render
          renderPanelContent();
        });
      });
    } catch (err) {
      content.innerHTML = '❌ Error: ' + err.message;
    }
  }

  // ============ INIT ============
  // Detectar navegación al Producción
  let lastHash = '';
  setInterval(function() {
    if (window.location.hash !== lastHash) {
      lastHash = window.location.hash;
      // Si entramos a producción, inyectar panel
      if (isProductionPage()) {
        // Pequeño delay para que React renderice
        setTimeout(injectProductionPanel, 800);
      } else {
        // Si salimos, quitar panel
        const panel = document.getElementById('admin-production-panel');
        if (panel) panel.remove();
      }
    }
  }, 500);

  console.log('[admin-production-status] Script cargado.');
})();
