// admin-banner-remove.js
// SCRIPT DEDICADO: elimina el banner "Panel de Control" cuando NO estamos en /users
// Y aplica permisos al sidebar
(function() {
  'use strict';
  console.log('[banner-remove] cargado');

  const PERMS = {
    '/': 'home',
    '/raw-materials': 'raw_materials',
    '/recipes': 'recipes',
    '/production': 'production',
    '/lots': 'lots',
    '/lot-generator': 'lots',
    '/raw-material-lots': 'raw_materials',
    '/packaging': 'packaging',
    '/customers': 'customers',
    '/orders': 'sales',
    '/sales': 'sales',
    '/purchases': 'sales',
    '/expenses': 'accounting',
    '/suppliers': 'customers',
    '/inventory': 'inventory',
    '/accounting': 'accounting',
    '/reports': 'reports',
    '/recalls': 'recalls',
    '/alerts': 'home',
    '/search': 'home',
    '/scan': 'home',
    '/users': 'users',
    '/settings': 'settings',
    '/dashboard': 'home',
  };

  function isOnUsersPage() {
    const hash = (window.location.hash || '').toLowerCase();
    return hash.includes('user');
  }

  function getUser() {
    try { return JSON.parse(localStorage.getItem('cleanerp-user') || 'null'); } catch { return null; }
  }

  function isAdmin() {
    const u = getUser();
    return u && u.role === 'admin';
  }

  function hasPerm(module, action) {
    if (isAdmin()) return true;
    const u = getUser();
    if (!u || !u.permissions) return false;
    if (!u.permissions[module]) return false;
    return u.permissions[module][action] === true;
  }

  // Eliminar el banner
  function removeBanner() {
    const banner = document.getElementById('admin-control-panel-btn');
    if (banner) {
      banner.remove();
      console.log('[banner-remove] banner eliminado');
    }
  }

  // Inyectar banner SOLO en /users
  function ensureBanner() {
    if (isOnUsersPage() && isAdmin()) {
      // Dejar que admin-users-panel.js se encargue de inyectarlo
      return;
    }
    removeBanner();
  }

  // Aplicar permisos al sidebar
  function applySidebarPermissions() {
    if (isAdmin()) return;
    const user = getUser();
    if (!user || !user.permissions) return;

    // Buscar todos los links
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const path = href.replace(/^#/, '');
      if (!path) return;
      const module = PERMS[path];
      if (!module) return;
      if (!hasPerm(module, 'view')) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
    });
  }

  // Bloquear clicks a rutas sin permiso
  function blockUnauthorizedClicks(e) {
    if (isAdmin()) return;
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href || !href.startsWith('#')) return;
    const path = href.replace(/^#/, '');
    const module = PERMS[path];
    if (module && !hasPerm(module, 'view')) {
      e.preventDefault();
      e.stopPropagation();
      // Mostrar mensaje
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;padding:14px 20px;border-radius:8px;background:#dc2626;color:#fff;font-size:14px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.2);';
      div.textContent = 'No tienes permiso para acceder a ' + path;
      document.body.appendChild(div);
      setTimeout(() => { try { div.remove(); } catch {} }, 3000);
      return false;
    }
  }

  // Loop principal: cada 200ms verificar
  function loop() {
    ensureBanner();
    applySidebarPermissions();
  }

  setInterval(loop, 200);
  document.addEventListener('click', blockUnauthorizedClicks, true);

  // Ejecutar inmediatamente
  loop();
})();
