// admin-users-panel.js
// Panel completo de gestion de usuarios y permisos
// Solo visible para administradores
(function() {
  'use strict';

  const API = (window.__API_URL__ || 'https://cleansahel-production.up.railway.app/api');

  function getCurrentUser() {
    try {
      const u = JSON.parse(localStorage.getItem('cleanerp-user') || 'null');
      return u;
    } catch { return null; }
  }

  function getToken() { return localStorage.getItem('cleanerp-token') || ''; }

  async function api(path, method = 'GET', body = null) {
    const res = await fetch(API + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Error ' + res.status);
    }
    return res.json();
  }

  function showMessage(text, type) {
    type = type || 'info';
    const existing = document.getElementById('admin-users-toast');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'admin-users-toast';
    div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;padding:14px 20px;border-radius:8px;font-size:14px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.2);color:#fff;max-width:400px;';
    if (type === 'error') div.style.background = '#dc2626';
    else if (type === 'success') div.style.background = '#16a34a';
    else div.style.background = '#2563eb';
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(() => { try { div.remove(); } catch {} }, 4000);
  }

  function buildModal(title, body) {
    const existing = document.getElementById('admin-users-modal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'admin-users-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:#1f2937;color:#f3f4f6;border-radius:12px;max-width:900px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.5);';
    modal.innerHTML = `
      <div style="padding:20px 24px;border-bottom:1px solid #374151;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#1f2937;z-index:1;">
        <h2 style="margin:0;font-size:20px;font-weight:600;">${title}</h2>
        <button id="admin-users-close" style="background:none;border:none;color:#9ca3af;font-size:24px;cursor:pointer;padding:0;line-height:1;">x</button>
      </div>
      <div id="admin-users-body" style="padding:24px;">${body}</div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.getElementById('admin-users-close').addEventListener('click', closeModal);
    return modal;
  }

  function closeModal() {
    const m = document.getElementById('admin-users-modal');
    if (m) m.remove();
  }

  async function openUsersList() {
    let users;
    try {
      users = await api('/users');
    } catch (e) {
      showMessage('Error cargando usuarios: ' + e.message, 'error');
      return;
    }
    const rows = users.map(u => `
      <tr data-user-id="${u.id}" style="border-bottom:1px solid #374151;">
        <td style="padding:12px;font-weight:500;">${u.username}</td>
        <td style="padding:12px;">${u.fullName || ''}</td>
        <td style="padding:12px;"><span style="background:${u.role === 'admin' ? '#7c3aed' : u.role === 'produccion' ? '#2563eb' : '#0891b2'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${u.role}</span></td>
        <td style="padding:12px;">${u.active ? '<span style="color:#16a34a;">o Activo</span>' : '<span style="color:#dc2626;">o Inactivo</span>'}</td>
        <td style="padding:12px;">
          <button class="usr-btn" data-act="edit" data-id="${u.id}" style="background:#2563eb;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">Editar</button>
          <button class="usr-btn" data-act="perms" data-id="${u.id}" style="background:#7c3aed;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">Permisos</button>
          <button class="usr-btn" data-act="pwd" data-id="${u.id}" data-name="${u.username}" style="background:#f59e0b;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">Contrasena</button>
          <button class="usr-btn" data-act="toggle" data-id="${u.id}" data-active="${!u.active}" style="background:${u.active ? '#6b7280' : '#16a34a'};color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">${u.active ? 'Desactivar' : 'Activar'}</button>
          <button class="usr-btn" data-act="del" data-id="${u.id}" data-name="${u.username}" style="background:#dc2626;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:12px;">Eliminar</button>
        </td>
      </tr>
    `).join('');
    const body = `
      <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <p style="margin:0;color:#9ca3af;font-size:14px;">${users.length} usuario(s)</p>
        <button id="usr-new" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">+ Nuevo Usuario</button>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#374151;text-align:left;">
              <th style="padding:12px;">Usuario</th>
              <th style="padding:12px;">Nombre</th>
              <th style="padding:12px;">Rol</th>
              <th style="padding:12px;">Estado</th>
              <th style="padding:12px;">Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    buildModal('Gestion de Usuarios', body);
    document.getElementById('usr-new').addEventListener('click', () => openUserForm(null));
    document.querySelectorAll('.usr-btn').forEach(btn => {
      btn.addEventListener('click', () => handleUserAction(btn.dataset.act, btn.dataset.id, btn.dataset.name, btn.dataset.active === 'true'));
    });
  }

  async function openUserForm(userId) {
    let user = { username: '', fullName: '', email: '', role: 'operario' };
    if (userId) {
      try {
        const users = await api('/users');
        user = users.find(u => u.id === userId) || user;
      } catch (e) {
        showMessage('Error: ' + e.message, 'error');
        return;
      }
    }
    const body = `
      <form id="usr-form" style="display:grid;gap:14px;max-width:500px;">
        <div>
          <label style="display:block;margin-bottom:4px;font-size:13px;color:#9ca3af;">Usuario *</label>
          <input name="username" value="${user.username || ''}" required ${userId ? 'readonly style="background:#374151;cursor:not-allowed;"' : ''} style="width:100%;padding:8px 12px;background:#111827;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;font-size:14px;">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:13px;color:#9ca3af;">Nombre Completo *</label>
          <input name="fullName" value="${user.fullName || ''}" required style="width:100%;padding:8px 12px;background:#111827;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;font-size:14px;">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:13px;color:#9ca3af;">Email</label>
          <input name="email" type="email" value="${user.email || ''}" style="width:100%;padding:8px 12px;background:#111827;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;font-size:14px;">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:13px;color:#9ca3af;">Rol *</label>
          <select name="role" required style="width:100%;padding:8px 12px;background:#111827;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;font-size:14px;">
            <option value="operario" ${user.role === 'operario' ? 'selected' : ''}>Operario</option>
            <option value="produccion" ${user.role === 'produccion' ? 'selected' : ''}>Produccion</option>
            <option value="contabilidad" ${user.role === 'contabilidad' ? 'selected' : ''}>Contabilidad</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </div>
        ${!userId ? `
        <div>
          <label style="display:block;margin-bottom:4px;font-size:13px;color:#9ca3af;">Contrasena *</label>
          <input name="password" type="password" required minlength="4" style="width:100%;padding:8px 12px;background:#111827;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;font-size:14px;">
        </div>` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="usr-cancel" style="background:#6b7280;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancelar</button>
          <button type="submit" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;">${userId ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `;
    buildModal(userId ? 'Editar Usuario' : 'Nuevo Usuario', body);
    document.getElementById('usr-cancel').addEventListener('click', openUsersList);
    document.getElementById('usr-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd);
      try {
        if (userId) {
          await api('/users/' + userId, 'PUT', data);
          showMessage('Usuario actualizado', 'success');
        } else {
          await api('/users', 'POST', data);
          showMessage('Usuario creado', 'success');
        }
        openUsersList();
      } catch (e2) {
        showMessage('Error: ' + e2.message, 'error');
      }
    });
  }

  async function openPermsEditor(userId) {
    let user, defaults;
    try {
      const users = await api('/users');
      user = users.find(u => u.id === userId);
      defaults = await api('/permissions/defaults');
    } catch (e) {
      showMessage('Error: ' + e.message, 'error');
      return;
    }
    if (!user) { showMessage('Usuario no encontrado', 'error'); return; }
    const perms = user.permissions || {};
    const actions = defaults.actions;
    const cells = defaults.modules.map(m => {
      const mperms = perms[m.key] || {};
      const checks = actions.map(a => `
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;cursor:pointer;user-select:none;">
          <input type="checkbox" data-mod="${m.key}" data-act="${a.key}" ${mperms[a.key] ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;">
          ${a.label}
        </label>
      `).join('');
      return `<tr><td style="padding:8px;font-weight:500;">${m.label}</td><td colspan="4" style="padding:8px;"><div style="display:flex;gap:12px;">${checks}</div></td></tr>`;
    }).join('');
    const body = `
      <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">Permisos para <strong>${user.username}</strong>${user.role === 'admin' ? ' <span style="color:#7c3aed;">(admin siempre tiene todos los permisos)</span>' : ''}</p>
      <form id="perms-form">
        <div style="overflow-x:auto;max-height:60vh;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead style="position:sticky;top:0;background:#1f2937;">
              <tr style="background:#374151;">
                <th style="padding:8px;text-align:left;">Modulo</th>
                <th style="padding:8px;text-align:left;">Acciones</th>
              </tr>
            </thead>
            <tbody>${cells}</tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button type="button" id="perms-cancel" style="background:#6b7280;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancelar</button>
          <button type="submit" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;">Guardar</button>
        </div>
      </form>
    `;
    buildModal('Permisos de ' + user.username, body);
    document.getElementById('perms-cancel').addEventListener('click', openUsersList);
    document.getElementById('perms-form').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target;
      const newPerms = {};
      form.querySelectorAll('input[type=checkbox]').forEach(cb => {
        if (!newPerms[cb.dataset.mod]) newPerms[cb.dataset.mod] = {};
        newPerms[cb.dataset.mod][cb.dataset.act] = cb.checked;
      });
      try {
        await api('/users/' + userId + '/permissions', 'PUT', { permissions: newPerms });
        showMessage('Permisos actualizados', 'success');
        openUsersList();
      } catch (e2) {
        showMessage('Error: ' + e2.message, 'error');
      }
    });
  }

  function openPasswordForm(userId, username) {
    const body = `
      <form id="pwd-form" style="display:grid;gap:14px;max-width:400px;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">Cambiar contrasena de <strong>${username}</strong></p>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:13px;color:#9ca3af;">Nueva contrasena *</label>
          <input name="newPassword" type="password" required minlength="4" style="width:100%;padding:8px 12px;background:#111827;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;font-size:14px;">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button type="button" id="pwd-cancel" style="background:#6b7280;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancelar</button>
          <button type="submit" style="background:#f59e0b;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;">Cambiar</button>
        </div>
      </form>
    `;
    buildModal('Cambiar contrasena', body);
    document.getElementById('pwd-cancel').addEventListener('click', openUsersList);
    document.getElementById('pwd-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('/users/' + userId + '/password', 'PUT', { newPassword: fd.get('newPassword') });
        showMessage('Contrasena cambiada', 'success');
        openUsersList();
      } catch (e2) {
        showMessage('Error: ' + e2.message, 'error');
      }
    });
  }

  async function handleUserAction(action, userId, name, active) {
    if (action === 'edit') return openUserForm(userId);
    if (action === 'perms') return openPermsEditor(userId);
    if (action === 'pwd') return openPasswordForm(userId, name);
    if (action === 'toggle') {
      try {
        await api('/users/' + userId + '/status', 'PUT', { active });
        showMessage(active ? 'Usuario activado' : 'Usuario desactivado', 'success');
        openUsersList();
      } catch (e) { showMessage('Error: ' + e.message, 'error'); }
      return;
    }
    if (action === 'del') {
      if (!confirm('Eliminar al usuario "' + name + '"?\n\nEsta accion no se puede deshacer.')) return;
      try {
        await api('/users/' + userId, 'DELETE');
        showMessage('Usuario eliminado', 'success');
        openUsersList();
      } catch (e) { showMessage('Error: ' + e.message, 'error'); }
      return;
    }
  }

  function addUsersMenuButton() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') return;
    if (document.getElementById('admin-users-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'admin-users-btn';
    btn.textContent = 'Gestion de Usuarios';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:999997;background:#7c3aed;color:#fff;border:none;padding:12px 20px;border-radius:9999px;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(124,58,237,.4);';
    btn.addEventListener('click', openUsersList);
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addUsersMenuButton);
  } else {
    addUsersMenuButton();
  }
  setTimeout(addUsersMenuButton, 2000);
  setTimeout(addUsersMenuButton, 5000);
})();
