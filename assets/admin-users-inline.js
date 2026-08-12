// admin-users-inline.js
// Inyecta botones de gestion inline al lado de cada usuario en la pantalla /users
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
    t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;padding:10px 16px;border-radius:6px;color:#fff;font-weight:500;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:320px;';
    t.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => { try { t.remove(); } catch {} }, 3000);
  }

  // Encontrar la lista de usuarios
  function findUserList() {
    // La app muestra "Usuarios y Permisos" + tabla/lista
    const tables = document.querySelectorAll('table');
    for (const t of tables) {
      const headers = Array.from(t.querySelectorAll('th, thead td')).map(h => h.textContent.toLowerCase());
      if (headers.some(h => h.includes('usuario') || h.includes('user'))) return t;
    }
    // Si no hay tabla, buscar listas
    const allH = document.querySelectorAll('h1, h2, h3, h4');
    for (const h of allH) {
      if ((h.textContent || '').toLowerCase().includes('usuarios')) {
        // buscar contenedores de items
        const container = h.closest('div, section, main');
        if (container) {
          const items = container.querySelectorAll('[class*="user"], [class*="card"], li, tr');
          if (items.length > 0) {
            return { container, items: Array.from(items).slice(0, 50) };
          }
        }
      }
    }
    return null;
  }

  // Mostrar modal de gestion
  async function openManageModal(userId) {
    try {
      const users = await api('/users');
      const u = users.find(x => x.id === userId);
      if (!u) { toast('Usuario no encontrado', 'error'); return; }
      const defs = await api('/permissions/defaults');
      const perms = u.permissions || {};

      const isAdminUser = u.role === 'admin';
      const me = getUser();
      const isMe = me && me.id === u.id;

      // Render modal
      const overlay = document.createElement('div');
      overlay.id = 'aum-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;';

      let permsHtml = '';
      if (isAdminUser) {
        permsHtml = '<div style="padding:12px;background:#1e293b;border-radius:6px;text-align:center;color:#a78bfa;font-size:12px;">Los administradores tienen TODOS los permisos automáticamente. No se pueden editar.</div>';
      } else {
        permsHtml = '<div style="max-height:280px;overflow:auto;border:1px solid #334155;border-radius:6px;">';
        permsHtml += '<div style="display:grid;grid-template-columns:1fr 40px 40px 40px 40px;gap:1px;background:#334155;font-size:11px;position:sticky;top:0;">';
        permsHtml += '<div style="background:#0f172a;padding:6px;">Modulo</div>';
        permsHtml += '<div style="background:#0f172a;padding:6px;text-align:center;">Ver</div>';
        permsHtml += '<div style="background:#0f172a;padding:6px;text-align:center;">Crear</div>';
        permsHtml += '<div style="background:#0f172a;padding:6px;text-align:center;">Editar</div>';
        permsHtml += '<div style="background:#0f172a;padding:6px;text-align:center;">X</div>';
        permsHtml += '</div>';
        for (const m of defs.modules) {
          const mp = perms[m.key] || {};
          permsHtml += '<div style="display:grid;grid-template-columns:1fr 40px 40px 40px 40px;gap:1px;background:#0f172a;font-size:11px;">';
          permsHtml += '<div style="padding:6px;">' + m.label + '</div>';
          for (const a of ['view', 'create', 'edit', 'delete']) {
            const c = mp[a] ? 'checked' : '';
            permsHtml += '<div style="padding:6px;text-align:center;"><input type="checkbox" data-mod="' + m.key + '" data-act="' + a + '" ' + c + ' style="cursor:pointer;"></div>';
          }
          permsHtml += '</div>';
        }
        permsHtml += '</div>';
        permsHtml += '<div style="margin-top:8px;display:flex;gap:6px;"><button type="button" id="aum-select-all" style="background:#475569;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Seleccionar todo</button></div>';
      }

      overlay.innerHTML = '<div style="background:#0f172a;color:#f1f5f9;border-radius:12px;max-width:520px;width:100%;max-height:90vh;overflow:auto;padding:18px;border:1px solid #334155;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
          '<h3 style="margin:0;font-size:15px;color:#a78bfa;">⚙️ Gestionar: ' + u.username + '</h3>' +
          '<button id="aum-close" style="background:transparent;color:#94a3b8;border:none;font-size:20px;cursor:pointer;padding:0 4px;">×</button>' +
        '</div>' +
        // Tabs
        '<div style="display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid #334155;">' +
          '<button class="aum-tab active" data-tab="datos" style="flex:1;padding:8px;background:#1e293b;color:#a78bfa;border:none;border-bottom:2px solid #7c3aed;cursor:pointer;font-size:12px;font-weight:500;">Datos</button>' +
          '<button class="aum-tab" data-tab="permisos" style="flex:1;padding:8px;background:transparent;color:#94a3b8;border:none;border-bottom:2px solid transparent;cursor:pointer;font-size:12px;font-weight:500;">Permisos</button>' +
        '</div>' +
        // Tab datos
        '<div class="aum-content" data-tab="datos">' +
          (!isMe ?
            '<div style="display:flex;gap:6px;margin-bottom:12px;align-items:center;padding:8px;background:#0f172a;border-radius:6px;">' +
              '<span style="font-size:12px;color:#94a3b8;">Estado:</span>' +
              '<button id="aum-toggle" data-active="' + u.active + '" style="background:' + (u.active ? '#f59e0b' : '#16a34a') + ';color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;">' + (u.active ? '🔴 Desactivar' : '🟢 Activar') + '</button>' +
            '</div>' : '') +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Nombre Completo</label><input id="aum-name" value="' + (u.fullName || '').replace(/"/g, '&quot;') + '" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;box-sizing:border-box;"></div>' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Email</label><input id="aum-email" value="' + (u.email || '').replace(/"/g, '&quot;') + '" type="email" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;box-sizing:border-box;"></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Rol</label><select id="aum-role" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;box-sizing:border-box;">' +
              '<option value="operario" ' + (u.role === 'operario' ? 'selected' : '') + '>Operario</option>' +
              '<option value="produccion" ' + (u.role === 'produccion' ? 'selected' : '') + '>Producción</option>' +
              '<option value="contabilidad" ' + (u.role === 'contabilidad' ? 'selected' : '') + '>Contabilidad</option>' +
              '<option value="admin" ' + (u.role === 'admin' ? 'selected' : '') + '>Admin</option>' +
            '</select></div>' +
            '<div><label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:3px;">Nueva contraseña (vacío = no cambiar)</label><input id="aum-pwd" type="password" placeholder="••••" style="width:100%;padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;box-sizing:border-box;"></div>' +
          '</div>' +
        '</div>' +
        // Tab permisos (oculto inicialmente)
        '<div class="aum-content" data-tab="permisos" style="display:none;">' + permsHtml + '</div>' +
        // Botones
        '<div style="display:flex;gap:6px;justify-content:flex-end;margin-top:14px;padding-top:12px;border-top:1px solid #334155;">' +
          (!isMe ? '<button id="aum-delete" style="background:#dc2626;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">🗑️ Eliminar</button>' : '') +
          '<div style="flex:1;"></div>' +
          '<button id="aum-cancel" style="background:#475569;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">Cancelar</button>' +
          '<button id="aum-save" style="background:#16a34a;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;">💾 Guardar</button>' +
        '</div>' +
      '</div>';

      document.body.appendChild(overlay);

      // Tabs
      overlay.querySelectorAll('.aum-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          overlay.querySelectorAll('.aum-tab').forEach(t => {
            t.style.background = 'transparent';
            t.style.color = '#94a3b8';
            t.style.borderBottom = '2px solid transparent';
            t.classList.remove('active');
          });
          tab.style.background = '#1e293b';
          tab.style.color = '#a78bfa';
          tab.style.borderBottom = '2px solid #7c3aed';
          tab.classList.add('active');
          overlay.querySelectorAll('.aum-content').forEach(c => {
            c.style.display = c.dataset.tab === tab.dataset.tab ? '' : 'none';
          });
        });
      });

      // Cerrar
      document.getElementById('aum-close').addEventListener('click', closeModal);
      document.getElementById('aum-cancel').addEventListener('click', closeModal);
      overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

      // Seleccionar todo
      const sa = document.getElementById('aum-select-all');
      if (sa) sa.addEventListener('click', () => {
        overlay.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
      });

      // Toggle active
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

      // Eliminar
      const del = document.getElementById('aum-delete');
      if (del) del.addEventListener('click', async () => {
        if (!confirm('¿Eliminar al usuario "' + u.username + '"?')) return;
        try {
          await api('/users/' + u.id, 'DELETE');
          toast('Eliminado', 'success');
          closeModal();
          // Re-inyectar botones
          injectButtons();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      });

      // Guardar
      document.getElementById('aum-save').addEventListener('click', async () => {
        try {
          const data = {
            fullName: document.getElementById('aum-name').value.trim(),
            email: document.getElementById('aum-email').value.trim(),
            role: document.getElementById('aum-role').value
          };
          await api('/users/' + u.id, 'PUT', data);
          toast('Datos guardados', 'success');

          // Cambiar contraseña si se proporcionó
          const np = document.getElementById('aum-pwd').value;
          if (np) {
            if (np.length < 4) { toast('Contraseña muy corta', 'error'); return; }
            await api('/users/' + u.id + '/password', 'PUT', { newPassword: np });
            toast('Contraseña cambiada', 'success');
          }

          // Guardar permisos si no es admin
          if (u.role !== 'admin') {
            const newPerms = {};
            overlay.querySelectorAll('input[type=checkbox]').forEach(cb => {
              if (!newPerms[cb.dataset.mod]) newPerms[cb.dataset.mod] = {};
              newPerms[cb.dataset.mod][cb.dataset.act] = cb.checked;
            });
            await api('/users/' + u.id + '/permissions', 'PUT', { permissions: newPerms });
            toast('Permisos guardados en BD', 'success');
          }

          closeModal();
          injectButtons();
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      });
    } catch (e) { toast('Error: ' + e.message, 'error'); }
  }

  function closeModal() {
    const o = document.getElementById('aum-overlay');
    if (o) o.remove();
  }

  // Inyectar botones de gestion al lado de cada usuario
  function injectButtons() {
    if (!isAdmin()) return;
    if (!isOnUsersPage()) return;

    // Buscar todos los elementos que parezcan usuarios
    // Estrategia: buscar divs/spans que contengan un email (patron @)
    const all = document.querySelectorAll('div, li, tr');
    const seen = new Set();
    let injected = 0;

    for (const el of all) {
      if (seen.has(el)) continue;
      const text = el.textContent || '';
      // Solo elementos con email (probablemente items de usuario)
      if (!text.includes('@cleansahel.com')) continue;
      // Que tenga un nombre de usuario conocido
      const match = text.match(/@cleansahel\.com/);
      if (!match) continue;
      // No inyectar dos veces en el mismo contenedor
      if (el.querySelector('.aum-btn-edit')) continue;
      // Solo items de tamaño razonable (no la pagina entera)
      const rect = el.getBoundingClientRect();
      if (rect.width < 100 || rect.width > 800) continue;

      // Crear boton
      const btn = document.createElement('button');
      btn.className = 'aum-btn-edit';
      btn.innerHTML = '⚙️ Gestionar';
      btn.style.cssText = 'background:#7c3aed;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:500;margin-left:8px;';
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Extraer username del texto
        const usernameMatch = text.match(/^([a-zA-Z0-9_-]+)/);
        if (!usernameMatch) return;
        const username = usernameMatch[1];
        // Buscar el ID
        try {
          const users = await api('/users');
          const u = users.find(x => x.username === username);
          if (u) openManageModal(u.id);
          else toast('No se encontró el usuario', 'error');
        } catch (e) { toast('Error: ' + e.message, 'error'); }
      };
      // Insertar al final del elemento
      el.appendChild(btn);
      injected++;
    }
    if (injected > 0) console.log('[aum] injected ' + injected + ' buttons');
  }

  // Throttle para no spamear
  let lastInject = 0;
  function tryInject() {
    if (!isAdmin() || !isOnUsersPage()) return;
    const now = Date.now();
    if (now - lastInject < 1000) return;
    lastInject = now;
    injectButtons();
  }

  // Observer para re-inyectar cuando React re-renderice
  const observer = new MutationObserver(tryInject);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Inyectar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInject);
  } else {
    tryInject();
  }
})();
