// admin-users-panel.js v13 - Fix: detecta navegacion del sidebar
(function() {
  'use strict';
  console.log('[admin-panel v13] script cargado');

  const API = (window.__API_URL__ || 'https://cleansahel-production.up.railway.app/api');

  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('cleanerp-user') || 'null'); }
    catch { return null; }
  }
  function getToken() { return localStorage.getItem('cleanerp-token') || ''; }

  async function api(path, method = 'GET', body = null) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
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

  function isOnUsersPage() {
    const hash = window.location.hash || '';
    const path = window.location.pathname || '';
    return hash.includes('users') || hash.includes('user') ||
           path.includes('users') || path.includes('user');
  }

  // Modal de gestion
  function openPanel() {
    if (document.getElementById('admin-control-panel')) {
      document.getElementById('admin-control-panel').remove();
    }
    const overlay = document.createElement('div');
    overlay.id = 'admin-control-panel';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:#0f172a;color:#f1f5f9;border-radius:14px;max-width:1100px;width:100%;max-height:92vh;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,.6);display:flex;flex-direction:column;';
    modal.innerHTML = '<div style="padding:18px 24px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#1e293b,#0f172a);"><div><h2 style="margin:0;font-size:20px;font-weight:600;">Panel de Control</h2><p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Gestion centralizada: usuarios, modulos y acciones</p></div><button id="acp-close" style="background:none;border:none;color:#94a3b8;font-size:28px;cursor:pointer;padding:0;line-height:1;">x</button></div><div style="display:flex;background:#1e293b;border-bottom:1px solid #334155;"><button class="acp-tab active" data-tab="users" style="flex:1;padding:14px;background:#0f172a;color:#a78bfa;border:none;border-bottom:2px solid #7c3aed;cursor:pointer;font-size:14px;font-weight:500;">Usuarios y Permisos</button><button class="acp-tab" data-tab="modules" style="flex:1;padding:14px;background:transparent;color:#94a3b8;border:none;border-bottom:2px solid transparent;cursor:pointer;font-size:14px;font-weight:500;">Modulos y Accesos</button><button class="acp-tab" data-tab="actions" style="flex:1;padding:14px;background:transparent;color:#94a3b8;border:none;border-bottom:2px solid transparent;cursor:pointer;font-size:14px;font-weight:500;">Acciones Rapidas</button></div><div id="acp-content" style="flex:1;overflow:auto;padding:24px;"><p style="color:#94a3b8;">Cargando...</p></div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('acp-close').addEventListener('click', () => overlay.remove());
    modal.querySelectorAll('.acp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.acp-tab').forEach(t => { t.style.background = 'transparent'; t.style.color = '#94a3b8'; t.style.borderBottom = '2px solid transparent'; });
        tab.style.background = '#0f172a'; tab.style.color = '#a78bfa'; tab.style.borderBottom = '2px solid #7c3aed';
        const t = tab.dataset.tab;
        if (t === 'users') loadUsers();
        else if (t === 'modules') loadModules();
        else if (t === 'actions') loadActions();
      });
    });
    loadUsers();
  }

  async function loadUsers() {
    const content = document.getElementById('acp-content');
    content.innerHTML = '<p style="color:#94a3b8;">Cargando usuarios...</p>';
    let users;
    try { users = await api('/users'); }
    catch (e) { content.innerHTML = '<p style="color:#fca5a5;">Error: ' + e.message + '</p>'; return; }
    const rows = users.map(u => '<tr style="border-bottom:1px solid #334155;"><td style="padding:12px;font-weight:500;">' + u.username + '</td><td style="padding:12px;">' + (u.fullName || '') + '</td><td style="padding:12px;"><span style="background:' + (u.role === 'admin' ? '#7c3aed' : u.role === 'produccion' ? '#2563eb' : '#0891b2') + ';color:#fff;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:500;">' + u.role + '</span></td><td style="padding:12px;">' + (u.active ? '<span style="color:#22c55e;">● Activo</span>' : '<span style="color:#ef4444;">● Inactivo</span>') + '</td><td style="padding:12px;text-align:right;"><button class="acp-btn" data-act="edit" data-id="' + u.id + '" style="background:#2563eb;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">Editar</button><button class="acp-btn" data-act="perms" data-id="' + u.id + '" style="background:#7c3aed;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">Permisos</button><button class="acp-btn" data-act="pwd" data-id="' + u.id + '" data-name="' + u.username + '" style="background:#f59e0b;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">Contrasena</button><button class="acp-btn" data-act="toggle" data-id="' + u.id + '" data-active="' + (!u.active) + '" style="background:' + (u.active ? '#64748b' : '#22c55e') + ';color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;margin-right:4px;">' + (u.active ? 'Desactivar' : 'Activar') + '</button><button class="acp-btn" data-act="del" data-id="' + u.id + '" data-name="' + u.username + '" style="background:#dc2626;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">Eliminar</button></td></tr>').join('');
    content.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><p style="margin:0;color:#94a3b8;font-size:14px;">' + users.length + ' usuario(s)</p><button id="acp-new-user" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">+ Nuevo Usuario</button></div><table style="width:100%;border-collapse:collapse;font-size:14px;background:#1e293b;border-radius:8px;overflow:hidden;"><thead><tr style="background:#334155;text-align:left;"><th style="padding:12px;">Usuario</th><th style="padding:12px;">Nombre</th><th style="padding:12px;">Rol</th><th style="padding:12px;">Estado</th><th style="padding:12px;text-align:right;">Acciones</th></tr></thead><tbody>' + rows + '</tbody></table>';
    document.getElementById('acp-new-user').addEventListener('click', () => openUserForm());
    content.querySelectorAll('.acp-btn').forEach(btn => {
      btn.addEventListener('click', () => handleUserAction(btn.dataset.act, btn.dataset.id, btn.dataset.name, btn.dataset.active === 'true'));
    });
  }

  function openUserForm(userId) {
    const body = '<form id="acp-usr-form" style="display:grid;gap:14px;max-width:500px;"><div><label style="display:block;margin-bottom:4px;font-size:13px;color:#94a3b8;">Usuario *</label><input name="username" required ' + (userId ? 'readonly style="background:#0f172a;cursor:not-allowed;width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"' : 'style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"') + '></div><div><label style="display:block;margin-bottom:4px;font-size:13px;color:#94a3b8;">Nombre Completo *</label><input name="fullName" required style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"></div><div><label style="display:block;margin-bottom:4px;font-size:13px;color:#94a3b8;">Email</label><input name="email" type="email" style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"></div><div><label style="display:block;margin-bottom:4px;font-size:13px;color:#94a3b8;">Rol *</label><select name="role" required style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"><option value="operario">Operario</option><option value="produccion">Produccion</option><option value="contabilidad">Contabilidad</option><option value="admin">Administrador</option></select></div>' + (!userId ? '<div><label style="display:block;margin-bottom:4px;font-size:13px;color:#94a3b8;">Contrasena *</label><input name="password" type="password" required minlength="4" style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"></div>' : '') + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;"><button type="button" id="acp-usr-cancel" style="background:#475569;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancelar</button><button type="submit" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;">' + (userId ? 'Guardar' : 'Crear') + '</button></div></form>';
    showSubModal(userId ? 'Editar Usuario' : 'Nuevo Usuario', body, async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd);
      try {
        if (userId) { await api('/users/' + userId, 'PUT', data); showMessage('Usuario actualizado', 'success'); }
        else { await api('/users', 'POST', data); showMessage('Usuario creado', 'success'); }
        closeSubModal();
        loadUsers();
      } catch (e2) { showMessage('Error: ' + e2.message, 'error'); }
    });
    if (userId) {
      api('/users').then(users => {
        const u = users.find(x => x.id === userId);
        if (u) {
          const form = document.getElementById('acp-usr-form');
          if (form) { form.username.value = u.username; form.fullName.value = u.fullName || ''; form.email.value = u.email || ''; form.role.value = u.role; }
        }
      });
    }
  }

  async function openPermsEditor(userId) {
    let user, defaults;
    try { const users = await api('/users'); user = users.find(u => u.id === userId); defaults = await api('/permissions/defaults'); }
    catch (e) { showMessage('Error: ' + e.message, 'error'); return; }
    if (!user) { showMessage('Usuario no encontrado', 'error'); return; }
    const perms = user.permissions || {};
    const actions = defaults.actions;
    const cells = defaults.modules.map(m => {
      const mperms = perms[m.key] || {};
      const checks = actions.map(a => '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1;cursor:pointer;user-select:none;background:#1e293b;padding:4px 8px;border-radius:4px;"><input type="checkbox" data-mod="' + m.key + '" data-act="' + a.key + '" ' + (mperms[a.key] ? 'checked' : '') + ' style="width:14px;height:14px;cursor:pointer;">' + a.label + '</label>').join('');
      return '<tr style="border-bottom:1px solid #334155;"><td style="padding:10px;font-weight:500;background:#1e293b;">' + m.label + '</td><td style="padding:10px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">' + checks + '</div></td></tr>';
    }).join('');
    const body = '<p style="margin:0 0 16px;color:#94a3b8;font-size:13px;">Permisos para <strong style="color:#a78bfa;">' + user.username + '</strong></p><form id="acp-perms-form"><table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="background:#334155;"><th style="padding:10px;text-align:left;">Modulo</th><th style="padding:10px;text-align:left;">Acciones</th></tr></thead><tbody>' + cells + '</tbody></table><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;"><button type="button" id="acp-perms-cancel" style="background:#475569;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancelar</button><button type="submit" style="background:#16a34a;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;">Guardar</button></div></form>';
    showSubModal('Permisos de ' + user.username, body, async (e) => {
      e.preventDefault();
      const form = e.target;
      const newPerms = {};
      form.querySelectorAll('input[type=checkbox]').forEach(cb => {
        if (!newPerms[cb.dataset.mod]) newPerms[cb.dataset.mod] = {};
        newPerms[cb.dataset.mod][cb.dataset.act] = cb.checked;
      });
      try { await api('/users/' + userId + '/permissions', 'PUT', { permissions: newPerms }); showMessage('Permisos actualizados', 'success'); closeSubModal(); loadUsers(); }
      catch (e2) { showMessage('Error: ' + e2.message, 'error'); }
    });
  }

  function openPasswordForm(userId, username) {
    const body = '<form id="acp-pwd-form" style="display:grid;gap:14px;max-width:400px;"><p style="margin:0;color:#94a3b8;font-size:13px;">Contrasena de <strong style="color:#a78bfa;">' + username + '</strong></p><div><label style="display:block;margin-bottom:4px;font-size:13px;color:#94a3b8;">Nueva contrasena *</label><input name="newPassword" type="password" required minlength="4" style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;"><button type="button" id="acp-pwd-cancel" style="background:#475569;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancelar</button><button type="submit" style="background:#f59e0b;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:500;">Cambiar</button></div></form>';
    showSubModal('Cambiar contrasena', body, async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try { await api('/users/' + userId + '/password', 'PUT', { newPassword: fd.get('newPassword') }); showMessage('Contrasena cambiada', 'success'); closeSubModal(); loadUsers(); }
      catch (e2) { showMessage('Error: ' + e2.message, 'error'); }
    });
  }

  async function handleUserAction(action, userId, name, active) {
    if (action === 'edit') return openUserForm(userId);
    if (action === 'perms') return openPermsEditor(userId);
    if (action === 'pwd') return openPasswordForm(userId, name);
    if (action === 'toggle') {
      try { await api('/users/' + userId + '/status', 'PUT', { active }); showMessage(active ? 'Activado' : 'Desactivado', 'success'); loadUsers(); }
      catch (e) { showMessage('Error: ' + e.message, 'error'); }
      return;
    }
    if (action === 'del') {
      if (!confirm('Eliminar "' + name + '"?')) return;
      try { await api('/users/' + userId, 'DELETE'); showMessage('Eliminado', 'success'); loadUsers(); }
      catch (e) { showMessage('Error: ' + e.message, 'error'); }
    }
  }

  function loadModules() {
    const content = document.getElementById('acp-content');
    const modules = [
      { label: 'Inicio', icon: '🏠', path: '/' },
      { label: 'Materias Primas', icon: '🧪', path: '/raw-materials' },
      { label: 'Recetas', icon: '📋', path: '/recipes' },
      { label: 'Produccion', icon: '🏭', path: '/production' },
      { label: 'Lotes', icon: '📦', path: '/lots' },
      { label: 'Lotes de Materia Prima', icon: '🧬', path: '/raw-material-lots' },
      { label: 'Embalaje', icon: '📦', path: '/packaging' },
      { label: 'Clientes', icon: '👥', path: '/customers' },
      { label: 'Ventas', icon: '💰', path: '/orders' },
      { label: 'Compras', icon: '🛒', path: '/purchases' },
      { label: 'Gastos', icon: '💸', path: '/expenses' },
      { label: 'Proveedores', icon: '🚚', path: '/suppliers' },
      { label: 'Inventario', icon: '📊', path: '/inventory' },
      { label: 'Contabilidad', icon: '📈', path: '/accounting' },
      { label: 'Informes', icon: '📑', path: '/reports' },
      { label: 'Retiradas', icon: '⚠️', path: '/recalls' },
      { label: 'Configuracion', icon: '⚙️', path: '/settings' },
      { label: 'Usuarios', icon: '👥', path: '/users' },
    ];
    const cards = modules.map(m => '<a href="#' + m.path + '" data-path="' + m.path + '" class="acp-mod-link" style="display:flex;align-items:center;gap:10px;padding:14px;background:#1e293b;border:1px solid #334155;border-radius:8px;text-decoration:none;color:#f1f5f9;cursor:pointer;"><span style="font-size:24px;">' + m.icon + '</span><div style="flex:1;"><div style="font-weight:500;font-size:14px;">' + m.label + '</div><div style="font-size:11px;color:#64748b;">' + m.path + '</div></div><span style="color:#64748b;font-size:18px;">→</span></a>').join('');
    content.innerHTML = '<div style="margin-bottom:20px;"><label style="display:block;margin-bottom:6px;font-size:13px;color:#94a3b8;">Buscar modulo</label><input id="acp-mod-search" type="search" placeholder="Buscar..." style="width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;font-size:14px;"></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">' + cards + '</div>';
    document.getElementById('acp-mod-search').addEventListener('input', e => {
      const q = (e.target.value || '').toLowerCase();
      document.querySelectorAll('.acp-mod-link').forEach(c => { c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
    document.querySelectorAll('.acp-mod-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const path = link.dataset.path;
        document.getElementById('admin-control-panel').remove();
        try { history.pushState(null, '', '#' + path); window.dispatchEvent(new PopStateEvent('popstate')); } catch (e) {}
        setTimeout(() => { window.location.hash = '#' + path; }, 100);
      });
    });
  }

  async function loadActions() {
    const content = document.getElementById('acp-content');
    content.innerHTML = '<p style="color:#94a3b8;">Cargando datos...</p>';
    let products, lots, rawMaterials, recipes;
    try {
      [products, lots, rawMaterials, recipes] = await Promise.all([
        api('/products').catch(() => []),
        api('/lots').catch(() => []),
        api('/raw-materials').catch(() => []),
        api('/recipes').catch(() => []),
      ]);
    } catch (e) { content.innerHTML = '<p style="color:#fca5a5;">Error: ' + e.message + '</p>'; return; }
    content.innerHTML = '<div style="display:grid;gap:16px;">' +
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">Productos (' + products.length + ')</h3><div style="display:flex;flex-wrap:wrap;gap:8px;">' +
      (products.length === 0 ? '<p style="color:#64748b;font-size:13px;">No hay productos</p>' : products.map(p => '<div style="display:flex;align-items:center;gap:8px;background:#0f172a;padding:6px 10px;border-radius:6px;font-size:13px;"><span>' + p.code + ' - ' + p.name + '</span><button data-action="del-product" data-id="' + p.id + '" data-name="' + p.name + '" style="background:#dc2626;color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Borrar</button></div>').join('')) +
      '</div></div>' +
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">Lotes (' + lots.length + ')</h3><div style="display:flex;flex-wrap:wrap;gap:8px;max-height:300px;overflow:auto;">' +
      (lots.length === 0 ? '<p style="color:#64748b;font-size:13px;">No hay lotes</p>' : lots.map(l => '<div style="display:flex;align-items:center;gap:8px;background:#0f172a;padding:6px 10px;border-radius:6px;font-size:13px;"><span>' + l.lotNumber + '</span><button data-action="del-lot" data-id="' + l.id + '" data-name="' + l.lotNumber + '" style="background:#dc2626;color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Borrar</button></div>').join('')) +
      '</div></div>' +
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">Materias Primas (' + rawMaterials.length + ')</h3><div style="display:flex;flex-wrap:wrap;gap:8px;">' +
      (rawMaterials.length === 0 ? '<p style="color:#64748b;font-size:13px;">No hay materias primas</p>' : rawMaterials.map(r => '<div style="display:flex;align-items:center;gap:8px;background:#0f172a;padding:6px 10px;border-radius:6px;font-size:13px;"><span>' + r.code + ' - ' + r.name + ' (' + r.stock + ' ' + r.unit + ')</span><button data-action="del-rm" data-id="' + r.id + '" data-name="' + r.name + '" style="background:#dc2626;color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Borrar</button></div>').join('')) +
      '</div></div>' +
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">Recetas (' + recipes.length + ')</h3><div style="display:flex;flex-wrap:wrap;gap:8px;">' +
      (recipes.length === 0 ? '<p style="color:#64748b;font-size:13px;">No hay recetas</p>' : recipes.map(r => '<div style="display:flex;align-items:center;gap:8px;background:#0f172a;padding:6px 10px;border-radius:6px;font-size:13px;"><span>Receta ' + (r.id || '').slice(-6) + '</span><button data-action="del-recipe" data-id="' + r.id + '" data-name="Receta ' + (r.id || '').slice(-6) + '" style="background:#dc2626;color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Borrar</button></div>').join('')) +
      '</div></div></div>';
    content.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleQuickAction(btn.dataset.action, btn.dataset.id, btn.dataset.name));
    });
  }

  async function handleQuickAction(action, id, name) {
    if (action === 'del-lot') { if (!confirm('Borrar lote "' + name + '"?')) return; try { await api('/lots/' + id, 'DELETE'); showMessage('Lote borrado', 'success'); loadActions(); } catch (e) { showMessage('Error: ' + e.message, 'error'); } return; }
    if (action === 'del-product') { if (!confirm('Borrar producto "' + name + '"?')) return; try { await api('/products/' + id, 'DELETE'); showMessage('Producto borrado', 'success'); loadActions(); } catch (e) { showMessage('Error: ' + e.message, 'error'); } return; }
    if (action === 'del-rm') { if (!confirm('Borrar materia prima "' + name + '"?')) return; try { await api('/raw-materials/' + id, 'DELETE'); showMessage('MP borrada', 'success'); loadActions(); } catch (e) { showMessage('Error: ' + e.message, 'error'); } return; }
    if (action === 'del-recipe') { if (!confirm('Borrar receta "' + name + '"?')) return; try { await api('/recipes/' + id, 'DELETE'); showMessage('Receta borrada', 'success'); loadActions(); } catch (e) { showMessage('Error: ' + e.message, 'error'); } }
  }

  function showSubModal(title, body, onSubmit) {
    const existing = document.getElementById('acp-submodal');
    if (existing) existing.remove();
    const sub = document.createElement('div');
    sub.id = 'acp-submodal';
    sub.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;z-index:10;border-radius:14px;';
    sub.innerHTML = '<div style="background:#0f172a;color:#f1f5f9;border-radius:12px;max-width:600px;width:100%;max-height:90%;overflow:auto;padding:24px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;"><h3 style="margin:0;font-size:18px;font-weight:600;">' + title + '</h3><button id="acp-submodal-close" style="background:none;border:none;color:#94a3b8;font-size:24px;cursor:pointer;">x</button></div><div>' + body + '</div></div>';
    const panel = document.getElementById('admin-control-panel');
    if (panel) { const modal = panel.querySelector('div'); modal.style.position = 'relative'; modal.appendChild(sub); }
    else { document.body.appendChild(sub); }
    document.getElementById('acp-submodal-close').addEventListener('click', closeSubModal);
    const form = sub.querySelector('form');
    if (form && onSubmit) form.addEventListener('submit', onSubmit);
    const cancelBtn = sub.querySelector('button[id$="cancel"]');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSubModal);
  }
  function closeSubModal() { const m = document.getElementById('acp-submodal'); if (m) m.remove(); }

  // Banner - SIMPLE: inyectar cuando estamos en /users
  function injectBanner() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') return;
    if (document.getElementById('admin-control-panel-btn')) return;
    if (!isOnUsersPage()) {
      // Eliminar banner si ya existe y NO estamos en users
      const existing = document.getElementById('admin-control-panel-btn');
      if (existing) existing.remove();
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'admin-control-panel-btn';
    banner.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;padding:18px 20px;border-radius:10px;margin:0 0 18px;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,.3);display:flex;align-items:center;gap:14px;';
    banner.innerHTML = '<span style="font-size:28px;">⚙️</span><div style="flex:1;"><div style="font-size:16px;font-weight:600;">Panel de Control Centralizado</div><div style="font-size:12px;opacity:.9;margin-top:2px;">Toca para abrir gestion de usuarios, modulos y acciones</div></div><span style="background:rgba(255,255,255,.2);padding:6px 14px;border-radius:6px;font-size:13px;font-weight:500;">Abrir →</span>';
    banner.addEventListener('click', openPanel);
    document.body.insertBefore(banner, document.body.firstChild);
    console.log('[admin-panel] banner inyectado en /users');
  }

  function removeOld() {
    const old = document.getElementById('admin-users-btn');
    if (old) old.remove();
  }

  // Re-inyectar al cambiar de URL (React Router navega sin recargar)
  let lastUrl = window.location.href;
  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[admin-panel] URL cambio a:', lastUrl);
      removeOld();
      // Limpiar banner existente
      const old = document.getElementById('admin-control-panel-btn');
      if (old) old.remove();
      setTimeout(injectBanner, 100);
      setTimeout(injectBanner, 500);
      setTimeout(injectBanner, 1500);
    }
  }

  setInterval(checkUrlChange, 500);

  function start() {
    removeOld();
    injectBanner();
    setTimeout(injectBanner, 500);
    setTimeout(injectBanner, 1500);
    setTimeout(injectBanner, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
