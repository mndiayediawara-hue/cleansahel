// Standalone delivery server - no db.js dependency
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())

const API_ORIGIN = 'https://cleansahel.onrender.com'

const DELIVERY_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#1e3a8a">
  <title>SAHEL - Entregas</title>
  <script src="https://unpkg.com/html5-qrcode" type="text/javascript"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; color: #111827; min-height: 100vh; }
    .header { background: #1e3a8a; color: white; padding: 14px 16px; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 10; }
    .header h1 { font-size: 15px; font-weight: 600; }
    .header .sub { font-size: 10px; opacity: .85; }
    .container { max-width: 600px; margin: 0 auto; padding: 12px; }
    .card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 10px; }
    .card h2 { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
    .scanner { width: 100%; aspect-ratio: 1; max-height: 280px; background: #000; border-radius: 8px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; }
    .scanner button { background: #1e3a8a; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; margin-top: 10px; font-family: inherit; }
    .manual-input { display: flex; gap: 6px; margin-top: 10px; }
    .manual-input input { flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 15px; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; }
    .manual-input input:focus { outline: none; border-color: #1e3a8a; box-shadow: 0 0 0 3px rgba(30,58,138,.15); }
    .manual-input button { background: #1e3a8a; color: white; border: none; padding: 10px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .customer-info { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 10px; }
    .customer-info h3 { font-size: 17px; color: #111827; margin-bottom: 4px; }
    .customer-info .code { display: inline-block; background: #1e3a8a; color: white; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; }
    .customer-info .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .order { background: white; border-radius: 8px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 8px; border-left: 4px solid #1e3a8a; }
    .order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .order-number { font-family: monospace; font-weight: 600; color: #1e3a8a; font-size: 14px; }
    .order-total { font-size: 17px; font-weight: 700; color: #111827; margin: 6px 0; }
    .order-items { font-size: 12px; color: #4b5563; padding: 6px 0; border-top: 1px solid #e5e7eb; }
    .order-btn { width: 100%; background: #10b981; color: white; border: none; padding: 11px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; font-family: inherit; }
    .order-btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .order-delivered { background: #f0fdf4; border-left-color: #10b981; }
    .order-delivered-info { font-size: 12px; color: #047857; margin-top: 6px; font-style: italic; }
    .empty { text-align: center; padding: 24px 12px; color: #6b7280; }
    .login-box { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.1); text-align: center; max-width: 360px; margin: 40px auto; }
    .login-box input { width: 100%; padding: 10px; margin: 6px 0; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
    .login-box button { width: 100%; background: #1e3a8a; color: white; border: none; padding: 11px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; font-family: inherit; }
    .login-error { color: #dc2626; font-size: 13px; margin-top: 8px; }
    .hidden { display: none; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .toast { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 10px 16px; border-radius: 6px; font-size: 13px; z-index: 100; opacity: 0; transition: opacity 0.2s; }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <div style="width:32px;height:32px;background:white;color:#1e3a8a;font-weight:bold;display:flex;align-items:center;justify-content:center;border-radius:4px;font-size:12px">SH</div>
    <div>
      <h1>SAHEL · Entregas</h1>
      <div class="sub">Escanear QR o introducir código</div>
    </div>
  </div>
  <div class="container">
    <div id="loginSection" class="login-box hidden">
      <p style="color: #6b7280; margin-bottom: 12px;">Inicia sesión para continuar</p>
      <input type="text" id="loginUser" placeholder="Usuario" autocomplete="username" />
      <input type="password" id="loginPass" placeholder="Contraseña" autocomplete="current-password" />
      <button onclick="doLogin()">Iniciar sesión</button>
      <div id="loginError" class="login-error hidden"></div>
    </div>
    <div id="mainSection" class="hidden">
      <div class="card">
        <h2>1. Escanear QR del cliente</h2>
        <div id="qr-reader" class="scanner"></div>
        <button id="startScanBtn" onclick="startScanner()">Iniciar cámara</button>
        <div style="margin-top: 10px; text-align: center; color: #6b7280; font-size: 11px;">o introduce el código manualmente</div>
        <div class="manual-input">
          <input type="text" id="codeInput" placeholder="CL-00001" value="" autocomplete="off" />
          <button onclick="lookupCustomer()">Buscar</button>
        </div>
      </div>
      <div id="resultSection"></div>
    </div>
  </div>
  <div id="toast" class="toast"></div>
  <script>
    const API = '${API_ORIGIN}/api'
    let token = localStorage.getItem('cleanerp-token') || new URLSearchParams(window.location.search).get('token')
    if (token) { localStorage.setItem('cleanerp-token', token); showMain() } else { document.getElementById('loginSection').classList.remove('hidden') }
    function showToast(msg, color) { const t = document.getElementById('toast'); t.textContent = msg; t.style.background = color || '#1f2937'; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500) }
    async function doLogin() {
      const username = document.getElementById('loginUser').value.trim()
      const password = document.getElementById('loginPass').value
      if (!username || !password) { document.getElementById('loginError').textContent = 'Introduce usuario y contraseña'; document.getElementById('loginError').classList.remove('hidden'); return }
      try {
        const res = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
        if (!res.ok) throw new Error('Credenciales incorrectas')
        const data = await res.json()
        token = data.token
        localStorage.setItem('cleanerp-token', token)
        document.getElementById('loginSection').classList.add('hidden')
        document.getElementById('mainSection').classList.remove('hidden')
        showMain()
      } catch (e) { document.getElementById('loginError').textContent = e.message; document.getElementById('loginError').classList.remove('hidden') }
    }
    function showMain() { document.getElementById('mainSection').classList.remove('hidden'); const prefill = document.getElementById('codeInput').value.trim(); if (prefill) lookupCustomer() }
    function startScanner() {
      const readerEl = document.getElementById('qr-reader'); readerEl.innerHTML = ''
      const html5QrCode = new Html5Qrcode('qr-reader')
      const startBtn = document.getElementById('startScanBtn')
      startBtn.disabled = true; startBtn.textContent = 'Escaneando...'
      html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 },
        (decodedText) => { html5QrCode.stop().then(() => { startBtn.disabled = false; startBtn.textContent = 'Reiniciar cámara'; const codeMatch = decodedText.match(/CL-\\d{4,6}/); const code = codeMatch ? codeMatch[0] : decodedText.trim(); document.getElementById('codeInput').value = code; lookupCustomer() }).catch(() => {}) },
        (error) => {}
      ).catch(err => { startBtn.disabled = false; startBtn.textContent = 'Iniciar cámara'; showToast('Error al acceder a la cámara: ' + err.message, '#dc2626') })
    }
    async function lookupCustomer() {
      const code = document.getElementById('codeInput').value.trim().toUpperCase()
      if (!code) { showToast('Introduce un código', '#dc2626'); return }
      document.getElementById('codeInput').value = code
      try {
        const res = await fetch(API + '/delivery/lookup/' + encodeURIComponent(code), { headers: { 'Authorization': 'Bearer ' + token } })
        if (res.status === 404) { showToast('Cliente no encontrado: ' + code, '#dc2626'); document.getElementById('resultSection').innerHTML = ''; return }
        if (!res.ok) throw new Error('Error al buscar cliente')
        const data = await res.json()
        renderCustomer(data)
      } catch (e) { showToast('Error: ' + e.message, '#dc2626') }
    }
    function renderCustomer(data) {
      const c = data.customer; const orders = data.pendingOrders; const delivered = data.deliveredOrders
      let html = '<div class="customer-info"><h3>' + escapeHtml(c.name) + '</h3><span class="code">' + escapeHtml(c.code) + '</span>'
      if (c.company) html += '<div class="meta">' + escapeHtml(c.company) + '</div>'
      if (c.phone) html += '<div class="meta">Tel: ' + escapeHtml(c.phone) + '</div>'
      if (c.address) html += '<div class="meta">' + escapeHtml(c.address) + (c.city ? ', ' + escapeHtml(c.city) : '') + '</div>'
      html += '</div>'
      if (orders.length === 0 && delivered.length === 0) { html += '<div class="empty">No hay pedidos para este cliente</div>' } else {
        if (orders.length > 0) { html += '<div class="card"><h2>Pedidos pendientes (' + orders.length + ')</h2>' + orders.map(o => '<div class="order"><div class="order-header"><span class="order-number">' + escapeHtml(o.number) + '</span><span class="badge badge-ok">Pendiente</span></div><div class="order-total">' + formatCurrency(o.total) + '</div><div class="order-items">' + (o.items||[]).map(i => escapeHtml(i.product_name||i.name||'Item') + ' x' + i.quantity + ' (' + formatCurrency(i.unit_price||i.price||0) + ')').join('<br>') + '</div><button class="order-btn" onclick="markDelivered(\'' + o.id + '\')">Marcar como entregado</button></div>').join('') + '</div>' }
        if (delivered.length > 0) { html += '<div class="card"><h2>Entregados (' + delivered.length + ')</h2>' + delivered.map(o => '<div class="order order-delivered"><div class="order-header"><span class="order-number">' + escapeHtml(o.number) + '</span><span class="badge badge-ok">Entregado</span></div><div class="order-total">' + formatCurrency(o.total) + '</div><div class="order-delivered-info">Entregado el ' + (o.delivered_at ? new Date(o.delivered_at).toLocaleString('es-SN') : '') + '</div></div>').join('') + '</div>' }
      }
      document.getElementById('resultSection').innerHTML = html
    }
    async function markDelivered(orderId) { if (!confirm('¿Confirmar entrega?')) return; try { const res = await fetch(API + '/delivery/' + orderId, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }); if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error'); } showToast('¡Entregado!', '#10b981'); lookupCustomer() } catch (e) { showToast('Error: ' + e.message, '#dc2626') } }
    function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
    function formatCurrency(n) { return (n||0).toLocaleString('es-SN', {style:'currency', currency:'XOF'}) }
    function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
  </script>
</body>
</html>`

// Proxy delivery-mobile requests to the real Render API
app.get('/delivery-mobile', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(DELIVERY_HTML)
})

// Proxy auth to real API
app.post('/auth/login', express.json(), async (req, res) => {
  try {
    const response = await fetch(`${API_ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(502).json({ error: 'No se pudo conectar al servidor' })
  }
})

// Proxy delivery endpoints
app.get('/delivery/lookup/:code', async (req, res) => {
  try {
    const auth = req.headers.authorization
    const response = await fetch(`${API_ORIGIN}/api/delivery/lookup/${req.params.code}`, {
      headers: { authorization: auth }
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(502).json({ error: 'No se pudo conectar al servidor' })
  }
})

app.post('/delivery/:orderId', express.json(), async (req, res) => {
  try {
    const response = await fetch(`${API_ORIGIN}/api/delivery/${req.params.orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: req.headers.authorization || '' },
      body: JSON.stringify(req.body)
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(502).json({ error: 'No se pudo conectar al servidor' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log('Delivery proxy running on port ' + PORT)
})
