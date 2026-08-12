// admin-users-inline.js v3 - ULTIMO INTENTO
(function() {
  'use strict';
  console.log('[aum v3] cargado');

  const API = 'https://cleansahel-production.up.railway.app/api';
  function getToken() { return localStorage.getItem('cleanerp-token') || ''; }
  function isAdmin() {
    try { const u = JSON.parse(localStorage.getItem('cleanerp-user') || 'null'); return u && u.role === 'admin'; } catch { return false; }
  }
  function isOnUsersPage() { return (window.location.hash || '').toLowerCase().includes('user') || (window.location.pathname || '').toLowerCase().includes('user'); }

  async function api(path, method = 'GET', body = null) {
    const res = await fetch(API + path, {
      method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
      const t = await res.text();
      let m = 'Error ' + res.status;
      try { m = JSON.parse(t).error || m; } catch {}
      throw new Error(m);
    }
    return res.json();
  }

  function toast(text, type) {
    type = type || 'info';
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;padding:10px 16px;border-radius:6px;color:#fff;font-weight:500;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:300px;';
    t.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => { try { t.remove(); } catch {} }, 3000);
  }

  // Cache de modales ya procesados
  const processedModals = new WeakSet();

  // Buscar el username del modal abierto
  function findUsernameInModal(modal) {
    // Buscar el username en inputs o en el titulo del modal
    const inputs = modal.querySelectorAll('input');
    for (const inp of inputs) {
      const v = inp.value || '';
      const ph = inp.placeholder || '';
      // El campo username suele ser readonly o tiene @admin
      if (v.includes('@') || ph.toLowerCase().includes('user')) return v;
      // Si es readonly, es el username
      if (inp.readOnly && v.length > 0) return v;
    }
    // Buscar titulo
    const title = modal.querySelector('h1, h2, h3, h4, h5, [class*="title"]');
    if (title) {
      const t = title.textContent || '';
      const m = t.match(/([a-zA-Z0-9_-]+)@cleansahel/);
      if (m) return m[1];
    }
    return null;
  }

  // Crear la seccion de permisos e inyectarla en el modal
  async function injectPermsSection(modal) {
    if (!isAdmin() || !isOnUsersPage()) return;
    if (processedModals.has(modal)) return;
    processedModals.add(modal);

    const username = findUsernameInModal(modal);
    if (!username) {
      console.log('[aum] no encontre username en el modal');
      return;
    }
    console.log('[aum] inyectando permisos para', username);

    try {
      const users = await api('/users');
      const u = users.find(x => x.username === username);
      if (!u) return;
      const defs = await api('/permissions/defaults');
      const perms = u.permissions || {};
      const isAdminUser = u.role === 'admin';

      // Crear contenedor para los permisos
      const section = document.createElement('div');
      section.id = 'aum-perms-' + u.id;
      section.style.cssText = 'border-top:2px solid #7c3aed;margin-top:16px;padding-top:12px;background:rgba(124,58,237,.08);border-radius:0 0 6px 6px;padding-left:8px;padding-right:8px;padding-bottom:12px;';

      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
        '<h4 style="margin:0;font-size:14px;color:#a78bfa;">🔐 Permisos del Usuario</h4>' +
        (!isAdminUser ? '<button type="button" id="aum-pm-sa-' + u.id + '" style="background:#475569;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Marcar todo</button>' : '') +
        '</div>';

      if (isAdminUser) {
        html += '<div style="padding:12px;background:#1e293b;border-radius:6px;text-align:center;color:#a78bfa;font-size:12px;">Los administradores tienen TODOS los permisos automáticamente.</div>';
      } else {
        html += '<div style="max-height:280px;overflow:auto;border:1px solid #334155;border-radius:6px;font-size:11px;">';
        // Header
        html += '<div style="display:grid;grid-template-columns:1fr 50px 50px 50px 50px;gap:1px;background:#334155;position:sticky;top:0;z-index:1;">';
        html += '<div style="background:#0f172a;padding:6px;font-weight:600;">Módulo</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;font-weight:600;">Ver</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;font-weight:600;">Crear</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;font-weight:600;">Editar</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;font-weight:600;">Eliminar</div>';
        html += '</div>';
        // Rows
        for (const m of defs.modules) {
          const mp = perms[m.key] || {};
          html += '<div style="display:grid;grid-template-columns:1fr 50px 50px 50px 50px;gap:1px;background:#0f172a;">';
          html += '<div style="padding:6px;">' + m.label + '</div>';
          for (const a of ['view', 'create', 'edit', 'delete']) {
            const c = mp[a] ? 'checked' : '';
            html += '<div style="padding:6px;text-align:center;"><input type="checkbox" data-mod="' + m.key + '" data-act="' + a + '" ' + c + ' style="cursor:pointer;width:16px;height:16px;"></div>';
          }
          html += '</div>';
        }
        html += '</div>';

        // Boton guardar
        html += '<button type="button" id="aum-pm-save-' + u.id + '" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;margin-top:10px;width:100%;">💾 Guardar Permisos en la Base de Datos</button>';
      }

      section.innerHTML = html;
      // Inyectar al final del modal (despues del contenido de la app)
      modal.appendChild(section);

      // Eventos
      const sa = document.getElementById('aum-pm-sa-' + u.id);
      if (sa) sa.onclick = () => {
        section.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
      };
      const sv = document.getElementById('aum-pm-save-' + u.id);
      if (sv) sv.onclick = async () => {
        try {
          const newPerms = {};
          section.querySelectorAll('input[type=checkbox]').forEach(cb => {
            if (!newPerms[cb.dataset.mod]) newPerms[cb.dataset.mod] = {};
            newPerms[cb.dataset.mod][cb.dataset.act] = cb.checked;
          });
          await api('/users/' + u.id + '/permissions', 'PUT', { permissions: newPerms });
          toast('Permisos guardados correctamente en la BD', 'success');
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      };

      toast('Sección de permisos añadida al modal', 'success');
      console.log('[aum] permisos inyectados OK');
    } catch (e) { console.error('[aum] error:', e); toast('Error al cargar permisos: ' + e.message, 'error'); }
  }

  // Detectar modales nuevos
  function checkForNewModals() {
    if (!isAdmin() || !isOnUsersPage()) return;
    // Buscar todos los elementos con position fixed que tengan inputs
    const all = document.querySelectorAll('div');
    for (const el of all) {
      if (processedModals.has(el)) continue;
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'absolute') continue;
      if (el.offsetWidth < 200 || el.offsetWidth > 1500) continue;
      if (el.offsetHeight < 100 || el.offsetHeight > 2000) continue;
      // Tiene inputs?
      const inputs = el.querySelectorAll('input, select');
      if (inputs.length < 2) continue;
      // Es un modal?
      const txt = (el.textContent || '').toLowerCase();
      const looksLikeEdit = txt.includes('editar') || txt.includes('edit') || txt.includes('email') || txt.includes('rol') || txt.includes('password') || txt.includes('contrase') || txt.includes('username') || txt.includes('usuario');
      if (!looksLikeEdit) continue;
      // Es candidato. Esperar un poco para que se renderice y luego inyectar.
      setTimeout(() => injectPermsSection(el), 500);
    }
  }

  // Ejecutar periodicamente (con throttling) y tambien en mutaciones
  let lastCheck = 0;
  function throttledCheck() {
    const now = Date.now();
    if (now - lastCheck < 1000) return;
    lastCheck = now;
    checkForNewModals();
  }
  setInterval(throttledCheck, 1500);
  const observer = new MutationObserver(throttledCheck);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  // Tambien al cargar
  setTimeout(checkForNewModals, 1000);
  setTimeout(checkForNewModals, 3000);
})();
