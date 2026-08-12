// admin-raw-materials-fix.js
// Valida códigos de materia prima antes de enviar y sugiere uno libre si hay duplicado

(function() {
  'use strict';

  function getApi() {
    if (window.__API_URL__) return window.__API_URL__;
    return 'https://cleansahel-production.up.railway.app/api';
  }

  function getToken() {
    try {
      const userData = localStorage.getItem('cleanerp-user');
      if (!userData) return null;
      const user = JSON.parse(userData);
      return user.token || null;
    } catch (e) { return null; }
  }

  function showMessage(text, type) {
    type = type || 'info';
    const existing = document.getElementById('admin-rm-msg');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'admin-rm-msg';
    div.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:14px 20px;border-radius:10px;font-family:Inter,sans-serif;font-size:14px;max-width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.3);color:white;background:' + (type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb');
    div.textContent = text;
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.remove(); }, type === 'error' ? 6000 : 3500);
  }

  // Cache de códigos existentes
  let existingCodes = null;

  async function loadExistingCodes() {
    if (existingCodes !== null) return existingCodes;
    const token = getToken();
    if (!token) return new Set();
    try {
      const res = await fetch(getApi() + '/raw-materials', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        existingCodes = new Set(data.map(m => (m.code || '').toLowerCase()).filter(c => c));
        return existingCodes;
      }
    } catch (e) { /* ignore */ }
    existingCodes = new Set();
    return existingCodes;
  }

  function isMaterialsPage() {
    const hash = window.location.hash;
    return hash.includes('/raw-materials') || hash.includes('/materias');
  }

  // Interceptar clicks en "Guardar" del modal de Nueva Materia Prima
  document.addEventListener('click', async function(e) {
    if (!isMaterialsPage()) return;
    const target = e.target;
    const btn = target.closest('button');
    if (!btn) return;
    const text = (btn.textContent || '').trim().toLowerCase();
    if (!text.includes('guardar')) return;

    // Buscar el modal
    const modal = btn.closest('.fixed') || btn.closest('[role="dialog"]') || document.querySelector('div[class*="modal"]');
    if (!modal) return;

    // Buscar el input de código
    const codeInput = modal.querySelector('input.input');
    if (!codeInput) return;

    const code = (codeInput.value || '').trim();
    if (!code) return;

    // Verificar si el código ya existe
    const codes = await loadExistingCodes();
    if (codes.has(code.toLowerCase())) {
      // Sugerir un código libre
      const match = code.match(/^([A-Z\-]+)(\d+)$/);
      let suggested = code;
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10);
        for (let i = num + 1; i < num + 100; i++) {
          const tryCode = prefix + String(i).padStart(match[2].length, '0');
          if (!codes.has(tryCode.toLowerCase())) {
            suggested = tryCode;
            break;
          }
        }
      } else {
        suggested = code + '-NEW';
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showMessage('❌ El código "' + code + '" ya existe. Te sugiero usar "' + suggested + '"', 'error');

      // Reemplazar el valor del input
      codeInput.value = suggested;
      codeInput.focus();
      codeInput.select();
      return false;
    }
  }, true);

  // Observar cambios en el modal para re-cachear cuando se abre
  let lastModalState = false;
  setInterval(function() {
    if (!isMaterialsPage()) return;
    const hasModal = !!document.querySelector('div.fixed input.input');
    if (hasModal && !lastModalState) {
      // Modal se acaba de abrir
      lastModalState = true;
      existingCodes = null; // Forzar recarga
      loadExistingCodes();
    } else if (!hasModal && lastModalState) {
      lastModalState = false;
    }
  }, 500);

  console.log('[admin-raw-materials-fix] Cargado. Validación de códigos duplicados activa.');
})();
