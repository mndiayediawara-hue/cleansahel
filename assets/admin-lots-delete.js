(function() {
  'use strict';
  
  // Verificar si el usuario es admin
  function getCurrentUser() {
    try {
      const userStr = localStorage.getItem('cleanerp-user');
      if (!userStr) return null;
      return JSON.parse(userStr);
    } catch { return null; }
  }
  
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    console.log('[admin-delete] Usuario no es admin, función desactivada');
    return;
  }
  
  console.log('[admin-delete] Usuario admin detectado, función activa');
  
  // Token
  function getToken() {
    return localStorage.getItem('cleanerp-token');
  }
  
  // Detectar si estamos en Producción
  function isOnProductionPage() {
    return window.location.pathname.includes('/cleansahel/#/production') || 
           window.location.hash.includes('/production') ||
           window.location.hash === '#/production';
  }
  
  // Crear UI
  function createManageSection() {
    // Verificar si ya existe
    if (document.getElementById('admin-lots-manage')) return;
    
    const section = document.createElement('div');
    section.id = 'admin-lots-manage';
    section.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 2px solid #dc2626; padding: 12px 16px; box-shadow: 0 -4px 12px rgba(0,0,0,0.1); z-index: 9999; max-height: 50vh; overflow-y: auto; font-family: system-ui, sans-serif;';
    
    section.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">ADMIN</span>
          <strong style="color: #dc2626;">Gestión de Fabricaciones (Eliminar)</strong>
        </div>
        <button id="admin-lots-toggle" style="background: #f3f4f6; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Mostrar / Ocultar</button>
      </div>
      <div id="admin-lots-content" style="display: none;"></div>
    `;
    
    document.body.appendChild(section);
    
    document.getElementById('admin-lots-toggle').onclick = () => {
      const content = document.getElementById('admin-lots-content');
      if (content.style.display === 'none') {
        content.style.display = 'block';
        loadLots();
      } else {
        content.style.display = 'none';
      }
    };
  }
  
  // Cargar fabricaciones
  async function loadLots() {
    const content = document.getElementById('admin-lots-content');
    if (!content) return;
    
    content.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 12px;">Cargando fabricaciones...</p>';
    
    const token = getToken();
    if (!token) {
      content.innerHTML = '<p style="color: #dc2626;">No hay sesión activa</p>';
      return;
    }
    
    try {
      const res = await fetch('https://cleansahel-production.up.railway.app/api/lots', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      if (!res.ok) throw new Error('Error ' + res.status);
      
      const lots = await res.json();
      
      if (!lots || lots.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 12px;">No hay fabricaciones registradas</p>';
        return;
      }
      
      content.innerHTML = '<div style="max-height: 300px; overflow-y: auto;">' + 
        lots.slice(0, 30).map(lot => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; gap: 8px;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; font-size: 13px;">${lot.lotNumber || lot.id}</div>
              <div style="font-size: 11px; color: #6b7280;">
                ${lot.productId || '?'} · ${formatQty(lot.quantity)} L · ${lot.status || '?'} · ${formatDate(lot.producedAt)}
              </div>
            </div>
            <button data-lot-id="${lot.id}" data-lot-name="${lot.lotNumber || lot.id}" 
                    class="admin-lot-delete-btn"
                    style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap;">
              🗑️ Eliminar
            </button>
          </div>
        `).join('') + '</div>';
      
      // Bind delete buttons
      content.querySelectorAll('.admin-lot-delete-btn').forEach(btn => {
        btn.onclick = () => handleDelete(btn.dataset.lotId, btn.dataset.lotName);
      });
    } catch (e) {
      content.innerHTML = '<p style="color: #dc2626;">Error: ' + e.message + '</p>';
    }
  }
  
  function formatQty(q) {
    if (q == null) return '?';
    return Number(q).toLocaleString('es-ES', { maximumFractionDigits: 0 });
  }
  
  function formatDate(d) {
    if (!d) return '?';
    try {
      return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch { return '?'; }
  }
  
  async function handleDelete(lotId, lotName) {
    if (!confirm('⚠️ ¿Eliminar la fabricación "' + lotName + '"?\n\nEsta acción:\n• Borra el lote definitivamente\n• Devuelve el stock de las materias primas consumidas\n• NO se puede deshacer\n\n¿Continuar?')) {
      return;
    }
    
    const token = getToken();
    if (!token) return;
    
    try {
      const res = await fetch('https://cleansahel-production.up.railway.app/api/lots/' + encodeURIComponent(lotId), {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      if (res.status === 403) {
        alert('❌ No tienes permisos para eliminar (requiere admin)');
        return;
      }
      if (res.status === 404) {
        alert('❌ Endpoint no disponible. Espera a que Render re-despliegue (Manual Deploy en dashboard).');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert('❌ Error: ' + (data.error || res.status));
        return;
      }
      
      const data = await res.json();
      alert('✅ ' + (data.message || 'Lote eliminado correctamente') + '\n\nStock devuelto a las materias primas.');
      loadLots(); // Recargar lista
    } catch (e) {
      alert('❌ Error de red: ' + e.message);
    }
  }
  
  // Inicializar
  function init() {
    if (!isOnProductionPage()) return;
    if (document.getElementById('admin-lots-manage')) return;
    createManageSection();
  }
  
  // Detectar navegación SPA
  let lastHash = window.location.hash;
  function checkNavigation() {
    if (window.location.hash !== lastHash) {
      lastHash = window.location.hash;
      const existing = document.getElementById('admin-lots-manage');
      if (existing) existing.remove();
      setTimeout(init, 500);
    }
  }
  
  // Intentar cada 500ms hasta detectar la página
  let attempts = 0;
  const initInterval = setInterval(() => {
    if (isOnProductionPage() && !document.getElementById('admin-lots-manage')) {
      createManageSection();
      clearInterval(initInterval);
    }
    if (++attempts > 60) clearInterval(initInterval);
  }, 500);
  
  setInterval(checkNavigation, 1000);
})();
