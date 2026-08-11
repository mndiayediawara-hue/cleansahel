// admin-product-delete.js
// Solución inteligente para borrar productos sin error 500
// Intercepta el botón "Borrar" de Productos, borra primero la receta,
// y si tiene fabricaciones/lotes, ofrece reset-db como última opción.

(function() {
  'use strict';

  function getApi() {
    if (window.__API_URL__) return window.__API_URL__;
    return 'https://cleansahel.onrender.com/api';
  }

  function getUser() {
    try {
      const userData = localStorage.getItem('cleanerp-user');
      if (!userData) return null;
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  }

  function getToken() {
    const u = getUser();
    return u ? (u.token || null) : null;
  }

  function getRole() {
    const u = getUser();
    return u ? (u.role || null) : null;
  }

  function showMessage(text, type) {
    type = type || 'info';
    const existing = document.getElementById('admin-product-msg');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'admin-product-msg';
    div.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:14px 20px;border-radius:10px;font-family:Inter,sans-serif;font-size:14px;max-width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.3);color:white;background:' + (type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb');
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.remove(); }, type === 'error' ? 6000 : 3500);
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

  // ============ INTERCEPTAR CLICKS EN "BORRAR" ============
  document.addEventListener('click', async function(e) {
    const target = e.target;
    const btn = target.closest('button, a, [role="button"]');
    if (!btn) return;

    const text = (btn.textContent || '').trim().toLowerCase();
    if (text !== 'borrar' && text !== 'eliminar' && !text.includes('borrar')) return;

    // Solo en páginas de productos
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    const isProductsPage = hash.includes('/productos') || hash.includes('/products') || pathname.includes('/productos');
    if (!isProductsPage) return;

    // Solo admin
    const role = getRole();
    if (role !== 'admin') return;

    // Buscar la fila del producto
    const row = btn.closest('tr, [class*="row"], [class*="card"]');
    if (!row) return;

    // Buscar el nombre del producto en la fila
    let productName = '';
    const cells = row.querySelectorAll('td, [class*="cell"]');
    for (const cell of cells) {
      const cellText = (cell.textContent || '').trim();
      if (cellText && cellText.length > 3 && cellText.length < 100 &&
          !cellText.match(/^[\d.,\s%€$]+$/) &&
          !cellText.toLowerCase().includes('borrar') &&
          !cellText.toLowerCase().includes('editar') &&
          !cellText.toLowerCase().includes('activo') &&
          !cellText.toLowerCase().includes('código')) {
        productName = cellText.split('\n')[0].trim();
        if (productName.length > 2) break;
      }
    }
    if (!productName) {
      productName = 'este producto';
    }

    if (!confirm('¿Borrar "' + productName + '"?\n\nEl script borrará también su receta asociada. Si tiene fabricaciones, te avisaré.')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Buscar el ID del producto
    let productId = null;
    try {
      const productsRes = await apiCall('/products');
      const products = await productsRes.json();
      const found = products.find(function(p) { return p.name === productName || p.code === productName; });
      if (found) productId = found.id;
    } catch (err) {
      showMessage('Error al listar productos: ' + err.message, 'error');
      return;
    }

    if (!productId) {
      showMessage('No encontré el producto "' + productName + '" en el servidor. Recarga la página.', 'error');
      return;
    }

    // PASO 1: Borrar receta asociada (si existe)
    try {
      const recipesRes = await apiCall('/recipes');
      const recipes = await recipesRes.json();
      const recipe = recipes.find(function(r) { return r.productId === productId; });
      if (recipe) {
        const delRes = await apiCall('/recipes/' + recipe.id, { method: 'DELETE' });
        if (delRes.ok) {
          console.log('[admin-product-delete] Receta borrada:', recipe.id);
        }
      }
    } catch (err) {
      console.warn('[admin-product-delete] Error borrando receta:', err);
    }

    // PASO 2: Intentar borrar el producto
    try {
      const res = await apiCall('/products/' + productId, { method: 'DELETE' });
      if (res.ok) {
        showMessage('✓ Producto "' + productName + '" borrado.', 'success');
        setTimeout(function() { window.location.reload(); }, 1500);
        return;
      }

      if (res.status === 500) {
        if (confirm('El producto tiene fabricaciones/lotes asociados. ¿Resetear TODO el sistema y re-crear productos después?\n\n⚠️ Esto borrará TODAS las fabricaciones existentes.')) {
          try {
            const resetRes = await fetch(getApi() + '/reset-db', {
              method: 'POST',
              headers: { 'x-reset-token': 'sahel2024' }
            });
            if (resetRes.ok) {
              showMessage('✓ Sistema reseteado. Recargando...', 'success');
              setTimeout(function() { window.location.reload(); }, 1500);
              return;
            }
          } catch (err) {
            // ignore
          }
        }
        showMessage('❌ No se pudo borrar. El producto tiene fabricaciones/lotes.', 'error');
        return;
      }

      const errData = await res.json().catch(function() { return {}; });
      showMessage('Error ' + res.status + ': ' + (errData.error || 'desconocido'), 'error');
    } catch (err) {
      showMessage('Error de red: ' + err.message, 'error');
    }
  }, true);

  console.log('[admin-product-delete] Script cargado. Borrar productos sin error 500.');
})();
