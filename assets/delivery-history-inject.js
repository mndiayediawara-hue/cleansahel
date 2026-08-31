// ============================================================
// PATCH: Añadir rutas de delivery-history y delivery-stats
// sin reconstruir el bundle principal
// ============================================================

(function() {
  'use strict';
  
  // Esperar a que la app esté lista
  function waitForApp(callback, maxAttempts = 50) {
    let attempts = 0;
    function check() {
      attempts++;
      // Buscar el sidebar
      const sidebar = document.querySelector('aside, nav, [class*="sidebar"]');
      if (sidebar || attempts >= maxAttempts) {
        callback(sidebar);
      } else {
        setTimeout(check, 100);
      }
    }
    check();
  }
  
  // Añadir enlace al sidebar
  function patchSidebar(sidebar) {
    if (!sidebar) return;
    
    // Buscar la sección ENTREGA
    const sections = sidebar.querySelectorAll('[class*="section"], [class*="group"]');
    let entregaSection = null;
    
    for (const sec of sections) {
      const text = sec.textContent || '';
      if (text.includes('ENTREGAS') || text.includes('Entregas')) {
        entregaSection = sec;
        break;
      }
    }
    
    // Si encontramos la sección, añadir el enlace
    if (entregaSection) {
      const existingLink = entregaSection.querySelector('a[href*="delivery-history"]');
      if (!existingLink) {
        // Crear el enlace
        const link = document.createElement('a');
        link.href = '/delivery-history';
        link.textContent = 'Historial';
        link.className = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800';
        
        // Añadir icono SVG (History icon)
        link.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Historial`;
        
        entregaSection.appendChild(link);
      }
    }
  }
  
  // Manejar navegación a /delivery-history
  function handleDeliveryHistory() {
    if (!window.location.pathname.includes('delivery-history') && 
        !window.location.pathname.includes('delivery-stats')) {
      return;
    }
    
    // Interceptar cambios de ruta
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      checkRoute();
    };
    
    function checkRoute() {
      const path = window.location.pathname;
      
      if (path.includes('delivery-history')) {
        renderDeliveryHistory();
      } else if (path.includes('delivery-stats')) {
        renderDeliveryStats();
      }
    }
    
    checkRoute();
  }
  
  // Renderizar la página de historial de entregas
  function renderDeliveryHistory() {
    const root = document.getElementById('root');
    if (!root) return;
    
    // Verificar si ya está renderizado
    if (root.querySelector('.delivery-history-page')) return;
    
    root.innerHTML = `
      <div class="delivery-history-page min-h-screen bg-surface-50 dark:bg-surface-900 p-6">
        <div class="max-w-7xl mx-auto">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100">
              📋 Historial de Entregas
            </h1>
            <button id="dlhist-export-csv" class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Exportar CSV
            </button>
          </div>
          
          <!-- Filtros -->
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-4 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-xs font-medium text-surface-500 mb-1">Repartidor</label>
                <select id="dlhist-user" class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm">
                  <option value="">Todos</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-surface-500 mb-1">Cliente</label>
                <input id="dlhist-customer" type="text" placeholder="Nombre del cliente..." class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-surface-500 mb-1">Fecha desde</label>
                <input id="dlhist-from" type="date" class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm" />
              </div>
              <div>
                <label class="block text-xs font-medium text-surface-500 mb-1">Fecha hasta</label>
                <input id="dlhist-to" type="date" class="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 text-sm" />
              </div>
            </div>
          </div>
          
          <!-- Tabla -->
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-surface-100 dark:bg-surface-700/50">
                  <tr>
                    <th class="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-300">#</th>
                    <th class="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-300">Fecha</th>
                    <th class="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-300">Pedido</th>
                    <th class="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-300">Cliente</th>
                    <th class="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-300">Repartidor</th>
                    <th class="px-4 py-3 text-left font-semibold text-surface-700 dark:text-surface-300">Hora</th>
                  </tr>
                </thead>
                <tbody id="dlhist-tbody" class="divide-y divide-surface-200 dark:divide-surface-700">
                  <tr><td colspan="6" class="px-4 py-8 text-center text-surface-500">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
            <div id="dlhist-pagination" class="px-4 py-3 border-t border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <span class="text-sm text-surface-500">—</span>
              <div class="flex gap-1" id="dlhist-pages"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Cargar datos
    loadDeliveryHistory();
    
    // Event listeners
    document.getElementById('dlhist-export-csv')?.addEventListener('click', exportCSV);
    ['dlhist-user', 'dlhist-customer', 'dlhist-from', 'dlhist-to'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', loadDeliveryHistory);
      document.getElementById(id)?.addEventListener('input', loadDeliveryHistory);
    });
  }
  
  // Renderizar la página de estadísticas
  function renderDeliveryStats() {
    const root = document.getElementById('root');
    if (!root) return;
    if (root.querySelector('.delivery-stats-page')) return;
    
    root.innerHTML = `
      <div class="delivery-stats-page min-h-screen bg-surface-50 dark:bg-surface-900 p-6">
        <div class="max-w-7xl mx-auto">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6">
            📊 Estadísticas de Entregas
          </h1>
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-8 text-center text-surface-500">
            Cargando estadísticas...
          </div>
        </div>
      </div>
    `;
    
    loadDeliveryStats();
  }
  
  // API helper
  function apiFetch(url, options = {}) {
    const token = sessionStorage.getItem('token');
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    }).then(r => r.json());
  }
  
  // Cargar historial de entregas
  function loadDeliveryHistory() {
    const params = new URLSearchParams({ page: '1', limit: '20' });
    const user = document.getElementById('dlhist-user')?.value;
    const customer = document.getElementById('dlhist-customer')?.value;
    const from = document.getElementById('dlhist-from')?.value;
    const to = document.getElementById('dlhist-to')?.value;
    
    if (user) params.set('userId', user);
    if (customer) params.set('customerName', customer);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    
    const base = window.API_URL || '';
    apiFetch(base + '/api/delivery-history?' + params.toString())
      .then(data => {
        if (data.error) {
          document.getElementById('dlhist-tbody').innerHTML = 
            `<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">${data.error}</td></tr>`;
          return;
        }
        renderHistoryTable(data);
      })
      .catch(err => {
        document.getElementById('dlhist-tbody').innerHTML = 
          `<tr><td colspan="6" class="px-4 py-8 text-center text-red-500">Error: ${err.message}</td></tr>`;
      });
  }
  
  // Renderizar tabla
  function renderHistoryTable(data) {
    const tbody = document.getElementById('dlhist-tbody');
    const items = data.deliveries || [];
    
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-surface-500">No hay entregas registradas.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = items.map((d, i) => `
      <tr class="hover:bg-surface-50 dark:hover:bg-surface-700/50">
        <td class="px-4 py-3 text-surface-500">${(i + 1)}</td>
        <td class="px-4 py-3 text-surface-700 dark:text-surface-300">${d.date || '—'}</td>
        <td class="px-4 py-3 font-medium text-surface-900 dark:text-surface-100">${d.orderNumber || d.order_id || '—'}</td>
        <td class="px-4 py-3 text-surface-700 dark:text-surface-300">${d.customerName || d.customer_name || d.customerId || '—'}</td>
        <td class="px-4 py-3 text-surface-700 dark:text-surface-300">${d.userName || d.user_name || d.userId || '—'}</td>
        <td class="px-4 py-3 text-surface-500">${d.time || d.registeredAt || '—'}</td>
      </tr>
    `).join('');
    
    // Paginación
    const total = data.total || 0;
    const pages = data.pages || 1;
    const current = data.page || 1;
    document.querySelector('#dlhist-pagination span').textContent = 
      `Total: ${total} entregas`;
  }
  
  // Exportar CSV
  function exportCSV() {
    const rows = [['#', 'Fecha', 'Pedido', 'Cliente', 'Repartidor', 'Hora']];
    document.querySelectorAll('#dlhist-tbody tr').forEach((tr, i) => {
      if (tr.querySelector('td[colspan]')) return;
      const tds = tr.querySelectorAll('td');
      rows.push([i + 1, tds[1]?.textContent || '', tds[2]?.textContent || '', 
                 tds[3]?.textContent || '', tds[4]?.textContent || '', tds[5]?.textContent || '']);
    });
    
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entregas_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // Cargar estadísticas
  function loadDeliveryStats() {
    const base = window.API_URL || '';
    apiFetch(base + '/api/delivery-stats')
      .then(data => {
        if (data.error) return;
        renderStats(data);
      });
  }
  
  function renderStats(data) {
    const page = document.querySelector('.delivery-stats-page');
    if (!page) return;
    const summary = data.summary || {};
    page.innerHTML = `
      <div class="max-w-7xl mx-auto">
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6">📊 Estadísticas de Entregas</h1>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-4">
            <div class="text-xs text-surface-500 mb-1">Total</div>
            <div class="text-2xl font-bold text-surface-900 dark:text-surface-100">${summary.total || 0}</div>
          </div>
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-4">
            <div class="text-xs text-surface-500 mb-1">Hoy</div>
            <div class="text-2xl font-bold text-green-600">${summary.today || 0}</div>
          </div>
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-4">
            <div class="text-xs text-surface-500 mb-1">Esta semana</div>
            <div class="text-2xl font-bold text-blue-600">${summary.thisWeek || 0}</div>
          </div>
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-4">
            <div class="text-xs text-surface-500 mb-1">Este mes</div>
            <div class="text-2xl font-bold text-purple-600">${summary.thisMonth || 0}</div>
          </div>
          <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-4">
            <div class="text-xs text-surface-500 mb-1">Este año</div>
            <div class="text-2xl font-bold text-orange-600">${summary.thisYear || 0}</div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForApp(patchSidebar);
      handleDeliveryHistory();
    });
  } else {
    waitForApp(patchSidebar);
    handleDeliveryHistory();
  }
})();
