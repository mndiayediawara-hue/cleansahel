// admin-users-panel.js
// Patch DESHABILITADO: la app ya tiene su propia pantalla de Usuarios y Permisos
// Este script solo elimina el boton flotante violeta si existe
(function() {
  'use strict';

  function removeFloatingButton() {
    const btn = document.getElementById('admin-users-btn');
    if (btn) btn.remove();
    // Eliminar cualquier boton violeta con texto "Gestion de Usuarios"
    document.querySelectorAll('button').forEach(b => {
      if (b.textContent && b.textContent.includes('Gestión de Usuarios') &&
          b.textContent.includes('👥')) {
        b.remove();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeFloatingButton);
  } else {
    removeFloatingButton();
  }
  setInterval(removeFloatingButton, 1000);
})();
