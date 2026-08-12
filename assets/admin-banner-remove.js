// admin-banner-remove.js v18 - Banner mini, siempre visible (no tapa nada)
(function() {
  'use strict';
  console.log('[banner-remove v18] cargado');

  const PERMS = {
    '/': 'home', '/raw-materials': 'raw_materials', '/recipes': 'recipes',
    '/production': 'production', '/lots': 'lots', '/lot-generator': 'lots',
    '/raw-material-lots': 'raw_materials', '/packaging': 'packaging',
    '/customers': 'customers', '/orders': 'sales', '/sales': 'sales',
    '/purchases': 'sales', '/expenses': 'accounting', '/suppliers': 'customers',
    '/inventory': 'inventory', '/accounting': 'accounting', '/reports': 'reports',
    '/recalls': 'recalls', '/alerts': 'home', '/search': 'home', '/scan': 'home',
    '/users': 'users', '/settings': 'settings', '/dashboard': 'home',
  };

  function getUser() {
    try { return JSON.parse(localStorage.getItem('cleanerp-user') || 'null'); } catch { return null; }
  }
  function isAdmin() { const u = getUser(); return u && u.role === 'admin'; }
  function hasPerm(module, action) {
    if (isAdmin()) return true;
    const u = getUser();
    if (!u || !u.permissions) return false;
    if (!u.permissions[module]) return false;
    return u.permissions[module][action] === true;
  }

  // Mini boton flotante (esquina inferior derecha, pequeño, no tapa nada)
  function ensureMiniButton() {
    if (!isAdmin()) {
      const existing = document.getElementById('acp-mini-btn');
      if (existing) existing.remove();
      return;
    }
    if (document.getElementById('acp-mini-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'acp-mini-btn';
    btn.innerHTML = '⚙️';
    btn.title = 'Panel de Control';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99998;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;border:none;cursor:pointer;font-size:22px;box-shadow:0 4px 12px rgba(124,58,237,.4);display:flex;align-items:center;justify-content:center;';
    btn.addEventListener('click', openPanel);
    document.body.appendChild(btn);
    console.log('[banner-remove] mini button creado');
  }

  function openPanel() {
    if (document.getElementById('admin-control-panel')) document.getElementById('admin-control-panel').remove();
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

  function getToken() { return localStorage.getItem('cleanerp-token') || ''; }
  async function api(path, method = 'GET', body = null) {
    const res = await fetch('https://cleansahel-production.up.railway.app/api' + path, {
      method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) throw new Error('Error ' + res.status);
    return res.json();
  }

  function showMessage(text, type) {
    type = type || 'info';
    const existing = document.getElementById('acp-toast');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'acp-toast';
    div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;padding:14px 20px;border-radius:8px;font-size:14px;font-weight:500;color:#fff;';
    div.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb';
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(() => { try { div.remove(); } catch {} }, 3000);
  }

  async function loadUsers() {
    const content = document.getElementById('acp-content');
    content.innerHTML = '<p style="color:#94a3b8;">Cargando...</p>';
    let users;
    try { users = await api('/users'); } catch (e) { content.innerHTML = '<p style="color:#fca5a5;">Error: ' + e.message + '</p>'; return; }
    const rows = users.map(u => '<tr style="border-bottom:1px solid #334155;"><td style="padding:12px;">' + u.username + '</td><td style="padding:12px;">' + (u.fullName || '') + '</td><td style="padding:12px;"><span style="background:' + (u.role === 'admin' ? '#7c3aed' : '#2563eb') + ';color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;">' + u.role + '</span></td><td style="padding:12px;">' + (u.active ? '🟢' : '🔴') + '</td><td style="padding:12px;text-align:right;"><button data-act="edit" data-id="' + u.id + '" style="background:#2563eb;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;margin:2px;">Editar</button> <button data-act="perms" data-id="' + u.id + '" style="background:#7c3aed;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;margin:2px;">Permisos</button> <button data-act="pwd" data-id="' + u.id + '" data-name="' + u.username + '" style="background:#f59e0b;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;margin:2px;">Pwd</button> <button data-act="toggle" data-id="' + u.id + '" data-active="' + (!u.active) + '" style="background:#64748b;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;margin:2px;">' + (u.active ? 'Off' : 'On') + '</button> <button data-act="del" data-id="' + u.id + '" data-name="' + u.username + '" style="background:#dc2626;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;margin:2px;">X</button></td></tr>').join('');
    content.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><p style="margin:0;color:#94a3b8;font-size:13px;">' + users.length + ' usuario(s)</p><button id="acp-new" style="background:#16a34a;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;">+ Nuevo</button></div><table style="width:100%;border-collapse:collapse;font-size:12px;background:#1e293b;border-radius:6px;overflow:hidden;"><thead><tr style="background:#334155;"><th style="padding:10px;text-align:left;">User</th><th style="padding:10px;text-align:left;">Nombre</th><th style="padding:10px;text-align:left;">Rol</th><th style="padding:10px;text-align:left;">Estado</th><th style="padding:10px;text-align:right;">Acciones</th></tr></thead><tbody>' + rows + '</tbody></table>';
    document.getElementById('acp-new').addEventListener('click', () => openUserForm());
    content.querySelectorAll('button[data-act]').forEach(btn => btn.addEventListener('click', () => handleAction(btn.dataset.act, btn.dataset.id, btn.dataset.name, btn.dataset.active === 'true')));
  }

  function openUserForm(uid) {
    const body = '<form id="acp-uf" style="display:grid;gap:10px;max-width:400px;"><input name="username" placeholder="Usuario" required ' + (uid ? 'readonly' : '') + ' style="padding:8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;"><input name="fullName" placeholder="Nombre completo" required style="padding:8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;"><input name="email" type="email" placeholder="Email" style="padding:8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;"><select name="role" required style="padding:8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;"><option value="operario">Operario</option><option value="produccion">Produccion</option><option value="contabilidad">Contabilidad</option><option value="admin">Admin</option></select>' + (!uid ? '<input name="password" type="password" placeholder="Contrasena (min 4)" required minlength="4" style="padding:8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;">' : '') + '<div style="display:flex;gap:6px;justify-content:flex-end;"><button type="button" id="acp-uf-cancel" style="background:#475569;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Cancelar</button><button type="submit" style="background:#16a34a;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Guardar</button></div></form>';
    showSub(body, async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const d = Object.fromEntries(fd);
      try { if (uid) { await api('/users/' + uid, 'PUT', d); showMessage('Actualizado', 'success'); } else { await api('/users', 'POST', d); showMessage('Creado', 'success'); } closeSub(); loadUsers(); } catch (e2) { showMessage('Error: ' + e2.message, 'error'); }
    });
    if (uid) { api('/users').then(us => { const u = us.find(x => x.id === uid); if (u) { const f = document.getElementById('acp-uf'); if (f) { f.username.value = u.username; f.fullName.value = u.fullName || ''; f.email.value = u.email || ''; f.role.value = u.role; } } }); }
  }

  async function openPerms(uid) {
    let user, defaults;
    try { const users = await api('/users'); user = users.find(u => u.id === uid); defaults = await api('/permissions/defaults'); } catch (e) { return; }
    if (!user) return;
    const perms = user.permissions || {};
    const cells = defaults.modules.map(m => {
      const mp = perms[m.key] || {};
      const checks = defaults.actions.map(a => '<label style="display:flex;align-items:center;gap:4px;font-size:11px;background:#1e293b;padding:3px 6px;border-radius:3px;color:#cbd5e1;"><input type="checkbox" data-mod="' + m.key + '" data-act="' + a.key + '" ' + (mp[a.key] ? 'checked' : '') + ' style="width:12px;height:12px;">' + a.label + '</label>').join('');
      return '<tr><td style="padding:6px;font-size:12px;background:#1e293b;">' + m.label + '</td><td style="padding:6px;"><div style="display:flex;gap:4px;flex-wrap:wrap;">' + checks + '</div></td></tr>';
    }).join('');
    const body = '<p style="margin:0 0 12px;color:#94a3b8;font-size:12px;">Permisos de <strong style="color:#a78bfa;">' + user.username + '</strong></p><form id="acp-pf"><div style="max-height:60vh;overflow:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#334155;"><th style="padding:6px;text-align:left;font-size:11px;">Modulo</th><th style="padding:6px;text-align:left;font-size:11px;">Acciones</th></tr></thead><tbody>' + cells + '</tbody></table></div><div style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px;"><button type="button" id="acp-pf-cancel" style="background:#475569;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Cancelar</button><button type="submit" style="background:#16a34a;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Guardar</button></div></form>';
    showSub(body, async (e) => {
      e.preventDefault();
      const form = e.target;
      const newPerms = {};
      form.querySelectorAll('input[type=checkbox]').forEach(cb => { if (!newPerms[cb.dataset.mod]) newPerms[cb.dataset.mod] = {}; newPerms[cb.dataset.mod][cb.dataset.act] = cb.checked; });
      try {
        await api('/users/' + uid + '/permissions', 'PUT', { permissions: newPerms });
        showMessage('Permisos guardados en la BD', 'success');
        closeSub();
        loadUsers();
        // Si soy yo, recargar
        const me = getUser();
        if (me && me.id === uid) {
          try { const me2 = await api('/auth/me'); me.permissions = me2.permissions; localStorage.setItem('cleanerp-user', JSON.stringify(me)); } catch {}
        }
      } catch (e2) { showMessage('Error: ' + e2.message, 'error'); }
    });
  }

  function openPwd(uid, name) {
    const body = '<form id="acp-pwf" style="display:grid;gap:10px;max-width:350px;"><p style="margin:0;color:#94a3b8;font-size:12px;">Contrasena de <strong style="color:#a78bfa;">' + name + '</strong></p><input name="np" type="password" placeholder="Nueva contrasena" required minlength="4" style="padding:8px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;"><div style="display:flex;gap:6px;justify-content:flex-end;"><button type="button" id="acp-pwf-cancel" style="background:#475569;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Cancelar</button><button type="submit" style="background:#f59e0b;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Cambiar</button></div></form>';
    showSub(body, async (e) => { e.preventDefault(); try { await api('/users/' + uid + '/password', 'PUT', { newPassword: e.target.np.value }); showMessage('Contrasena cambiada', 'success'); closeSub(); loadUsers(); } catch (e2) { showMessage('Error: ' + e2.message, 'error'); } });
  }

  async function handleAction(act, uid, name, active) {
    if (act === 'edit') return openUserForm(uid);
    if (act === 'perms') return openPerms(uid);
    if (act === 'pwd') return openPwd(uid, name);
    if (act === 'toggle') { try { await api('/users/' + uid + '/status', 'PUT', { active }); showMessage(active ? 'Activado' : 'Desactivado', 'success'); loadUsers(); } catch (e) { showMessage('Error', 'error'); } return; }
    if (act === 'del') { if (!confirm('Eliminar "' + name + '"?')) return; try { await api('/users/' + uid, 'DELETE'); showMessage('Eliminado', 'success'); loadUsers(); } catch (e) { showMessage('Error: ' + e.message, 'error'); } }
  }

  function loadModules() {
    const content = document.getElementById('acp-content');
    const mods = [
      { l: 'Inicio', i: '🏠', p: '/' }, { l: 'Materias Primas', i: '🧪', p: '/raw-materials' },
      { l: 'Recetas', i: '📋', p: '/recipes' }, { l: 'Produccion', i: '🏭', p: '/production' },
      { l: 'Lotes', i: '📦', p: '/lots' }, { l: 'Lotes MP', i: '🧬', p: '/raw-material-lots' },
      { l: 'Embalaje', i: '📦', p: '/packaging' }, { l: 'Clientes', i: '👥', p: '/customers' },
      { l: 'Ventas', i: '💰', p: '/orders' }, { l: 'Compras', i: '🛒', p: '/purchases' },
      { l: 'Gastos', i: '💸', p: '/expenses' }, { l: 'Proveedores', i: '🚚', p: '/suppliers' },
      { l: 'Inventario', i: '📊', p: '/inventory' }, { l: 'Contabilidad', i: '📈', p: '/accounting' },
      { l: 'Informes', i: '📑', p: '/reports' }, { l: 'Retiradas', i: '⚠️', p: '/recalls' },
      { l: 'Configuracion', i: '⚙️', p: '/settings' }, { l: 'Usuarios', i: '👥', p: '/users' },
    ];
    const cards = mods.map(m => '<a href="#' + m.p + '" data-p="' + m.p + '" class="acp-ml" style="display:flex;align-items:center;gap:8px;padding:10px;background:#1e293b;border:1px solid #334155;border-radius:6px;text-decoration:none;color:#f1f5f9;"><span style="font-size:20px;">' + m.i + '</span><span style="flex:1;font-size:13px;">' + m.l + '</span><span style="color:#64748b;">→</span></a>').join('');
    content.innerHTML = '<input id="acp-mod-search" placeholder="Buscar..." style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#f1f5f9;font-size:13px;margin-bottom:12px;"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">' + cards + '</div>';
    document.getElementById('acp-mod-search').addEventListener('input', e => { const q = e.target.value.toLowerCase(); document.querySelectorAll('.acp-ml').forEach(c => c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none'); });
    document.querySelectorAll('.acp-ml').forEach(l => l.addEventListener('click', e => { e.preventDefault(); const p = l.dataset.p; document.getElementById('admin-control-panel').remove(); try { history.pushState(null, '', '#' + p); window.dispatchEvent(new PopStateEvent('popstate')); } catch (e) {} setTimeout(() => window.location.hash = '#' + p, 100); }));
  }

  async function loadActions() {
    const content = document.getElementById('acp-content');
    content.innerHTML = '<p style="color:#94a3b8;">Cargando...</p>';
    let products, lots, rms, recipes;
    try { [products, lots, rms, recipes] = await Promise.all([api('/products').catch(() => []), api('/lots').catch(() => []), api('/raw-materials').catch(() => []), api('/recipes').catch(() => [])]); } catch (e) { content.innerHTML = '<p style="color:#fca5a5;">Error</p>'; return; }
    content.innerHTML = '<div style="display:grid;gap:12px;">' +
      sec('Productos (' + products.length + ')', products.map(p => item(p.code + ' - ' + p.name, 'del-product', p.id, p.name))) +
      sec('Lotes (' + lots.length + ')', lots.slice(0, 20).map(l => item(l.lotNumber, 'del-lot', l.id, l.lotNumber))) +
      sec('Materias Primas (' + rms.length + ')', rms.map(r => item(r.code + ' - ' + r.name, 'del-rm', r.id, r.name))) +
      sec('Recetas (' + recipes.length + ')', recipes.map(r => item('Receta ' + (r.id || '').slice(-6), 'del-recipe', r.id, 'Receta ' + (r.id || '').slice(-6)))) +
      '</div>';
    content.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => handleQuick(b.dataset.act, b.dataset.id, b.dataset.name)));
  }

  function sec(title, items) { return '<div style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:12px;"><h3 style="margin:0 0 8px;font-size:14px;font-weight:600;">' + title + '</h3><div style="display:flex;flex-wrap:wrap;gap:6px;max-height:200px;overflow:auto;">' + (items.length ? items.join('') : '<p style="color:#64748b;font-size:12px;margin:0;">vacio</p>') + '</div></div>'; }
  function item(text, act, id, name) { return '<div style="display:flex;align-items:center;gap:4px;background:#0f172a;padding:4px 8px;border-radius:4px;font-size:12px;"><span>' + text + '</span><button data-act="' + act + '" data-id="' + id + '" data-name="' + name + '" style="background:#dc2626;color:#fff;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:10px;">X</button></div>'; }

  async function handleQuick(act, id, name) {
    if (!confirm('Borrar "' + name + '"?')) return;
    try {
      const endpoint = act === 'del-lot' ? '/lots/' : act === 'del-product' ? '/products/' : act === 'del-rm' ? '/raw-materials/' : act === 'del-recipe' ? '/recipes/' : null;
      if (endpoint) { await api(endpoint + id, 'DELETE'); showMessage('Borrado', 'success'); loadActions(); }
    } catch (e) { showMessage('Error: ' + e.message, 'error'); }
  }

  function showSub(body, onSubmit) {
    const existing = document.getElementById('acp-sub'); if (existing) existing.remove();
    const sub = document.createElement('div'); sub.id = 'acp-sub';
    sub.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;z-index:10;border-radius:14px;';
    sub.innerHTML = '<div style="background:#0f172a;color:#f1f5f9;border-radius:12px;max-width:600px;width:100%;max-height:90%;overflow:auto;padding:20px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><h3 style="margin:0;font-size:16px;font-weight:600;">Formulario</h3><button id="acp-sub-close" style="background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;">x</button></div>' + body + '</div>';
    const panel = document.getElementById('admin-control-panel');
    if (panel) { const modal = panel.querySelector('div'); modal.style.position = 'relative'; modal.appendChild(sub); } else { document.body.appendChild(sub); }
    document.getElementById('acp-sub-close').addEventListener('click', closeSub);
    const form = sub.querySelector('form'); if (form && onSubmit) form.addEventListener('submit', onSubmit);
    const cancelBtn = sub.querySelector('button[id$="cancel"]'); if (cancelBtn) cancelBtn.addEventListener('click', closeSub);
  }
  function closeSub() { const m = document.getElementById('acp-sub'); if (m) m.remove(); }

  // Aplicar permisos al sidebar
  function applySidebarPermissions() {
    if (isAdmin()) return;
    const user = getUser();
    if (!user || !user.permissions) return;
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const path = href.replace(/^#/, '');
      if (!path) return;
      const module = PERMS[path];
      if (module && !hasPerm(module, 'view')) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
    });
  }

  // Solo ejecutar UNA VEZ, y re-aplicar en cambios de URL
  let lastUrl = window.location.href;
  function checkChanges() {
    const newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      applySidebarPermissions();
    }
    // Solo crear el boton si NO existe (no recrear)
    if (!document.getElementById('acp-mini-btn')) {
      ensureMiniButton();
    }
  }
  // Verificar cada 1 segundo (NO cada 200ms - eso causa parpadeo)
  setInterval(checkChanges, 1000);
  // Ejecutar al inicio
  checkChanges();
  document.addEventListener('click', (e) => {
    if (isAdmin()) return;
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    const path = href.replace(/^#/, '');
    const module = PERMS[path];
    if (module && !hasPerm(module, 'view')) {
      e.preventDefault(); e.stopPropagation();
      showMessage('Sin permiso para ' + path, 'error');
    }
  }, true);

  loop();
})();
