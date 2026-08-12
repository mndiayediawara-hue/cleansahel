// admin-users-inline.js v2
// Detecta el modal de Edicion que ya tiene la app y le agrega la seccion de Permisos
(function() {
  'use strict';

  const API = 'https://cleansahel-production.up.railway.app/api';
  function getToken() { return localStorage.getItem('cleanerp-token') || ''; }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('cleanerp-user') || 'null'); } catch { return null; }
  }
  function isAdmin() { const u = getUser(); return u && u.role === 'admin'; }
  function isOnUsersPage() { return (window.location.hash || '').toLowerCase().includes('user'); }

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
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;padding:10px 16px;border-radius:6px;color:#fff;font-weight:500;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:320px;';
    t.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => { try { t.remove(); } catch {} }, 3000);
  }

  // Buscar usuarios en la lista y guardar el username de cada uno
  function getUsersInList() {
    const out = [];
    const rows = document.querySelectorAll('tr, li, div');
    rows.forEach(r => {
      const text = r.textContent || '';
      if (text.includes('@cleansahel.com') && !r.querySelector('tr, li')) {
        const m = text.match(/([a-zA-Z0-9_-]+)@cleansahel\.com/);
        if (m) out.push(m[1]);
      }
    });
    return out;
  }

  // Cuando se hace click en "Editar", guardar el username
  let editingUsername = null;
  document.addEventListener('click', e => {
    if (!isAdmin() || !isOnUsersPage()) return;
    const target = e.target;
    if (!target) return;
    const text = (target.textContent || '').trim().toLowerCase();
    if (text === 'editar' || text === 'edit') {
      // Buscar el username en la fila
      const row = target.closest('tr, li, div');
      if (row) {
        const m = (row.textContent || '').match(/([a-zA-Z0-9_-]+)@cleansahel\.com/);
        if (m) {
          editingUsername = m[1];
          // Esperar a que se abra el modal
          setTimeout(() => addPermsToEditModal(), 300);
        }
      }
    }
  }, true);

  // Añadir seccion de permisos al modal de Edicion
  async function addPermsToEditModal() {
    if (!editingUsername) return;
    // Detectar el modal (es un overlay o div con position fixed)
    const modals = document.querySelectorAll('div');
    let editModal = null;
    for (const m of modals) {
      const style = window.getComputedStyle(m);
      if (style.position === 'fixed' && m.offsetWidth > 0 && m.querySelector('input, select')) {
        // Es un modal con form
        const txt = m.textContent || '';
        if (txt.toLowerCase().includes('editar') || txt.toLowerCase().includes('email') || txt.toLowerCase().includes('rol')) {
          editModal = m;
          break;
        }
      }
    }
    if (!editModal) {
      // Reintentar
      setTimeout(addPermsToEditModal, 300);
      return;
    }
    if (editModal.querySelector('#aum-perms-section')) return; // ya inyectado

    try {
      const users = await api('/users');
      const u = users.find(x => x.username === editingUsername);
      if (!u) { editingUsername = null; return; }
      const defs = await api('/permissions/defaults');
      const perms = u.permissions || {};
      const isAdminUser = u.role === 'admin';

      // Crear la seccion
      const section = document.createElement('div');
      section.id = 'aum-perms-section';
      section.style.cssText = 'border-top:1px solid #334155;margin-top:12px;padding-top:12px;';

      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<h4 style="margin:0;font-size:13px;color:#a78bfa;">🔐 Permisos</h4>' +
        (!isAdminUser ? '<button type="button" id="aum-pm-selectall" style="background:#475569;color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Seleccionar todo</button>' : '') +
        '</div>';

      if (isAdminUser) {
        html += '<div style="padding:10px;background:#1e293b;border-radius:6px;text-align:center;color:#a78bfa;font-size:12px;">Los administradores tienen TODOS los permisos. No se pueden editar.</div>';
      } else {
        html += '<div style="max-height:240px;overflow:auto;border:1px solid #334155;border-radius:6px;font-size:11px;">';
        html += '<div style="display:grid;grid-template-columns:1fr 40px 40px 40px 40px;gap:1px;background:#334155;position:sticky;top:0;">';
        html += '<div style="background:#0f172a;padding:6px;">Módulo</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;">Ver</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;">Crear</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;">Editar</div>';
        html += '<div style="background:#0f172a;padding:6px;text-align:center;">X</div>';
        html += '</div>';
        for (const m of defs.modules) {
          const mp = perms[m.key] || {};
          html += '<div style="display:grid;grid-template-columns:1fr 40px 40px 40px 40px;gap:1px;background:#0f172a;">';
          html += '<div style="padding:5px;">' + m.label + '</div>';
          for (const a of ['view', 'create', 'edit', 'delete']) {
            const c = mp[a] ? 'checked' : '';
            html += '<div style="padding:5px;text-align:center;"><input type="checkbox" data-mod="' + m.key + '" data-act="' + a + '" ' + c + ' style="cursor:pointer;"></div>';
          }
          html += '</div>';
        }
        html += '</div>';
      }
      section.innerHTML = html;
      editModal.appendChild(section);

      // Boton "Guardar Permisos"
      if (!isAdminUser) {
        const btn = document.createElement('button');
        btn.id = 'aum-pm-save';
        btn.type = 'button';
        btn.textContent = '🔐 Guardar Permisos';
        btn.style.cssText = 'background:#7c3aed;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;margin-top:10px;width:100%;';
        btn.onclick = async () => {
          try {
            const newPerms = {};
            section.querySelectorAll('input[type=checkbox]').forEach(cb => {
              if (!newPerms[cb.dataset.mod]) newPerms[cb.dataset.mod] = {};
              newPerms[cb.dataset.mod][cb.dataset.act] = cb.checked;
            });
            await api('/users/' + u.id + '/permissions', 'PUT', { permissions: newPerms });
            toast('Permisos guardados en BD', 'success');
          } catch (e) { toast('Error: ' + e.message, 'error'); }
        };
        editModal.appendChild(btn);
      }

      // Select all
      const sa = document.getElementById('aum-pm-selectall');
      if (sa) sa.onclick = () => {
        section.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
      };

      toast('Sección de permisos agregada al modal', 'success');
    } catch (e) { console.error('[aum] error:', e); }
  }

  // Observer para limpiar la variable editingUsername al cerrar el modal
  const observer = new MutationObserver(() => {
    if (!isOnUsersPage()) editingUsername = null;
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
