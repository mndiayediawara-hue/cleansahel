// admin-users-inline.js v4 - INTERCEPTA el boton Editar y muestra MI modal completo
(function() {
  'use strict';
  console.log('[aum v4] cargado');

  const API = 'https://cleansahel-production.up.railway.app/api';
  function getToken() { return localStorage.getItem('cleanerp-token') || ''; }
  function isAdmin() {
    try { const u = JSON.parse(localStorage.getItem('cleanerp-user') || 'null'); return u && u.role === 'admin'; } catch { return false; }
  }
  function isOnUsersPage() {
    const h = (window.location.hash || '').toLowerCase();
    const p = (window.location.pathname || '').toLowerCase();
    return h.includes('user') || p.includes('user');
  }

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

  // Extraer username del row
  function findUsernameInRow(el) {
    let cur = el;
    for (let i = 0; i < 6 && cur; i++) {
      const t = cur.textContent || '';
      const m = t.match(/([a-zA-Z0-9_-]+)@cleansahel\.com/);
      if (m) return m[1];
      cur = cur.parentElement;
    }
    return null;
  }

  // Mi modal completo
  let currentModal = null;
  async function showMyModal(username) {
    closeMyModal();
    try {
      const users = await api('/users');
      const u = users.find(x => x.username === username);
      if (!u) { toast('Usuario no encontrado: ' + username, 'error'); return; }
      const defs = await api('/permissions/defaults');
      const perms = u.permissions || {};
      const isAdminUser = u.role === 'admin';
      const me = (() => { try { return JSON.parse(localStorage.getItem('cleanerp-user') || 'null'); } catch { return null; } })();
      const isMe = me && me.id === u.id;

      const overlay = document.createElement('div');
      overlay.id = 'aum-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';

      const initial = (u.username || '?').charAt(0).toUpperCase();
      let permsRows = '';
      for (const m of defs.modules) {
        const mp = perms[m.key] || {};
        permsRows += '<tr><td style="padding:6px;font-size:12px;border-bottom:1px solid #334155;">' + m.label + '<br><small style="color:#64748b;">' + m.key + '</small></td>';
        for (const a of ['view', 'create', 'edit', 'delete']) {
          const c = mp[a] ? 'checked' : '';
          permsRows += '<td style="padding:6px;text-align:center;border-bottom:1px solid #334155;"><input type="checkbox" data-mod="' + m.key + '" data-act="' + a + '" ' + c + ' style="cursor:pointer;width:16px;height:16px;"></td>';
        }
        permsRows += '</tr>';
      }

      overlay.innerHTML = '<div style="background:#0f172a;color:#f1f5f9;border-radius:12px;max-width:560px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.6);border:1px solid #334155;">' +
        // Header
        '<div style="padding:14px 16px;border-bottom:1px solid #334155;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#1e293b,#0f172a);">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;">' + initial + '</div>' +
          '<div style="flex:1;"><div style="font-weight:600;font-size:14px;">' + u.username + '</div><div style="font-size:11px;color:#94a3b8;">' + (u.fullName || '') + '</div></div>' +
          '<button id="aum-close" style="background:transparent;color:#94a3b8;border:none;font-size:20px;cursor:pointer;padding:0 6px;">×</button>' +
        '</div>' +
        // Tabs
        '<div style="display:flex;border-bottom:1px solid #334155;background:#1e293b;">' +
          '<button class="aum-tab active" data-tab="datos" style="flex:1;padding:10px;background:#0f172a;color:#a78bfa;border:none;border-bottom:2px solid #7c3aed;cursor:pointer;font-size:12px;font-weight:500;">Datos</button>' +
          '<button class="aum-tab" data-tab="permisos" style="flex:1;padding:10px;background:transparent;color:#94a3b8;border:none;border-bottom:2px solid transparent;cursor:pointer;font-size:12px;font-weight:500;">Permisos</button>' +
        '</div>' +
        // Tab datos
        '<div class="aum-c" data-tab="datos" style="padding:14px;">' +
          // Estado
          '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:#0f172a;border-radius:6px;margin-bottom:10px;">' +
            '<span style="font-size:12px;color:#94a3b8;">Estado:</span>' +
            (!isMe ?
              '<button id="aum-toggle" data-active="' + u.active + '" style="background:' + (u.active ? '#f59e0b' : '#16a34a') + ';color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;">' + (u.active ? '🔴 Desactivar' : '🟢 Activar') + '</button>' :
              '<span style="color:#94a3b8;font-size:12px;">No puedes desactivarte a ti mismo</span>') +
          '</div>' +
          // Username y nombre
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Username</label><input value="' + u.username + '" disabled style="width:100%;padding:6px 8px;background:#1e293b;border:1px solid #334155;border-radius:4px;color:#94a3b8;font-size:12px;box-sizing:border-box;"></div>' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Nombre Completo</label><input id="aum-name" value="' + (u.fullName || '').replace(/"/g, '&quot;') + '" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:12px;box-sizing:border-box;"></div>' +
          '</div>' +
          // Email y rol
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Email</label><input id="aum-email" value="' + (u.email || '').replace(/"/g, '&quot;') + '" type="email" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:12px;box-sizing:border-box;"></div>' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Rol</label><select id="aum-role" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:12px;box-sizing:border-box;">' +
              '<option value="operario" ' + (u.role === 'operario' ? 'selected' : '') + '>Operario</option>' +
              '<option value="produccion" ' + (u.role === 'produccion' ? 'selected' : '') + '>Producción</option>' +
              '<option value="contabilidad" ' + (u.role === 'contabilidad' ? 'selected' : '') + '>Contabilidad</option>' +
              '<option value="admin" ' + (u.role === 'admin' ? 'selected' : '') + '>Admin</option>' +
            '</select></div>' +
          '</div>' +
          // Contraseña
          '<div style="margin-bottom:8px;">' +
            '<label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Nueva contraseña (dejar vacío para NO cambiar)</label>' +
            '<input id="aum-pwd" type="password" placeholder="••••" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:12px;box-sizing:border-box;">' +
          '</div>' +
        '</div>' +
        // Tab permisos
        '<div class="aum-c" data-tab="permisos" style="display:none;padding:14px;">' +
          (isAdminUser ?
            '<div style="padding:14px;background:#1e293b;border-radius:6px;text-align:center;color:#a78bfa;font-size:12px;">Los administradores tienen TODOS los permisos automáticamente.<br>No se pueden editar.</div>' :
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span style="font-size:11px;color:#94a3b8;">Marca lo que puede hacer</span>' +
              '<button type="button" id="aum-sa" style="background:#475569;color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Marcar todo</button>' +
            '</div>' +
            '<div style="max-height:280px;overflow:auto;border:1px solid #334155;border-radius:6px;font-size:11px;">' +
              '<table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="background:#334155;">' +
                  '<th style="padding:6px;text-align:left;">Módulo</th>' +
                  '<th style="padding:6px;text-align:center;">Ver</th>' +
                  '<th style="padding:6px;text-align:center;">Crear</th>' +
                  '<th style="padding:6px;text-align:center;">Editar</th>' +
                  '<th style="padding:6px;text-align:center;">X</th>' +
                '</tr></thead>' +
                '<tbody>' + permsRows + '</tbody>' +
              '</table>' +
            '</div>') +
        '</div>' +
        // Footer botones
        '<div style="padding:12px 14px;border-top:1px solid #334155;display:flex;gap:6px;align-items:center;background:#1e293b;">' +
          (!isMe ? '<button id="aum-del" style="background:#dc2626;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11px;">🗑️ Eliminar</button>' : '') +
          '<div style="flex:1;"></div>' +
          '<button id="aum-cancel" style="background:#475569;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">Cancelar</button>' +
          '<button id="aum-save" style="background:#16a34a;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;">💾 Guardar</button>' +
        '</div>' +
      '</div>';

      document.body.appendChild(overlay);
      currentModal = overlay;

      // Tabs
      overlay.querySelectorAll('.aum-tab').forEach(t => {
        t.addEventListener('click', () => {
          overlay.querySelectorAll('.aum-tab').forEach(x => {
            x.style.background = 'transparent';
            x.style.color = '#94a3b8';
            x.style.borderBottom = '2px solid transparent';
            x.classList.remove('active');
          });
          t.style.background = '#0f172a';
          t.style.color = '#a78bfa';
          t.style.borderBottom = '2px solid #7c3aed';
          t.classList.add('active');
          overlay.querySelectorAll('.aum-c').forEach(c => {
            c.style.display = c.dataset.tab === t.dataset.tab ? '' : 'none';
          });
        });
      });

      // Cerrar
      document.getElementById('aum-close').addEventListener('click', closeMyModal);
      document.getElementById('aum-cancel').addEventListener('click', closeMyModal);
      overlay.addEventListener('click', e => { if (e.target === overlay) closeMyModal(); });

      // Toggle
      const tg = document.getElementById('aum-toggle');
      if (tg) tg.addEventListener('click', async () => {
        const newActive = tg.dataset.active === 'true' ? false : true;
        try {
          await api('/users/' + u.id + '/status', 'PUT', { active: newActive });
          toast(newActive ? 'Activado' : 'Desactivado', 'success');
          tg.dataset.active = String(newActive);
          tg.textContent = newActive ? '🔴 Desactivar' : '🟢 Activar';
          tg.style.background = newActive ? '#f59e0b' : '#16a34a';
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      });

      // Select all
      const sa = document.getElementById('aum-sa');
      if (sa) sa.addEventListener('click', () => {
        overlay.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
      });

      // Eliminar
      const del = document.getElementById('aum-del');
      if (del) del.addEventListener('click', async () => {
        if (!confirm('¿Eliminar al usuario "' + u.username + '"?')) return;
        try {
          await api('/users/' + u.id, 'DELETE');
          toast('Eliminado', 'success');
          closeMyModal();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      });

      // Guardar
      document.getElementById('aum-save').addEventListener('click', async () => {
        try {
          // Guardar datos
          const data = {
            fullName: document.getElementById('aum-name').value.trim(),
            email: document.getElementById('aum-email').value.trim(),
            role: document.getElementById('aum-role').value
          };
          await api('/users/' + u.id, 'PUT', data);
          toast('Datos guardados', 'success');

          // Contraseña
          const np = document.getElementById('aum-pwd').value;
          if (np) {
            if (np.length < 4) { toast('Contraseña muy corta (min 4)', 'error'); return; }
            await api('/users/' + u.id + '/password', 'PUT', { newPassword: np });
            toast('Contraseña cambiada', 'success');
            document.getElementById('aum-pwd').value = '';
          }

          // Permisos
          if (!isAdminUser) {
            const newPerms = {};
            overlay.querySelectorAll('input[type=checkbox]').forEach(cb => {
              if (!newPerms[cb.dataset.mod]) newPerms[cb.dataset.mod] = {};
              newPerms[cb.dataset.mod][cb.dataset.act] = cb.checked;
            });
            await api('/users/' + u.id + '/permissions', 'PUT', { permissions: newPerms });
            toast('Permisos guardados', 'success');
          }

          // Recargar la lista de usuarios en la app
          setTimeout(() => closeMyModal(), 500);
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      });
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  }

  function closeMyModal() {
    if (currentModal) { currentModal.remove(); currentModal = null; }
  }

  // Interceptar click en "Editar" o "Gestionar"
  document.addEventListener('click', e => {
    if (!isAdmin() || !isOnUsersPage()) return;
    const t = e.target;
    if (!t) return;
    const text = (t.textContent || '').trim().toLowerCase();
    if (text !== 'editar' && text !== 'edit' && text !== 'gestionar') return;

    // Prevenir el modal de la app
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Buscar username
    const username = findUsernameInRow(t);
    if (!username) {
      toast('No se encontró el username', 'error');
      return;
    }
    showMyModal(username);
  }, true);

  // Cerrar con ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMyModal();
  });

  // Limpiar modal si el usuario navega a otra pagina
  const observer = new MutationObserver(() => {
    if (!isOnUsersPage()) closeMyModal();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
