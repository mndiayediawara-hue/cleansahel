// Script de traducción embebido - SOLO para documentos
// Se inyecta directamente en el HTML del documento

const DICT = {"es":{"Imprimir / Guardar PDF":"Imprimir / Guardar PDF","Enviar por email":"Enviar por email","Cerrar":"Cerrar","HOJA DE PEDIDO":"HOJA DE PEDIDO","PEDIDO N°":"PEDIDO N°","Fecha":"Fecha","Pedido N°":"Pedido N°","N°":"N°","Descripción":"Descripción","Presentación":"Presentación","Cantidad":"Cantidad","Precio Unitario":"Precio Unitario","Total":"Total","Subtotal":"Subtotal","Descuento":"Descuento","Transporte":"Transporte","TOTAL GENERAL":"TOTAL GENERAL","I.V.A.":"I.V.A.","IVA":"IVA","Base imponible":"Base imponible","Datos del Cliente":"Datos del Cliente","Detalles del Pedido":"Detalles del Pedido","Nombre:":"Nombre:","Dirección:":"Dirección:","Teléfono:":"Teléfono:","Email:":"Email:","NIF / VAT:":"NIF / VAT:","Fecha del pedido:":"Fecha del pedido:","Fecha de entrega:":"Fecha de entrega:","Condiciones de pago:":"Condiciones de pago:","Vendedor:":"Vendedor:","Referencia:":"Referencia:","Notas:":"Notas:","Condiciones Generales":"Condiciones Generales","Firma y sello del cliente":"Firma y sello del cliente","¡GRACIAS POR SU CONFIANZA!":"¡GRACIAS POR SU CONFIANZA!","FACTURA":"FACTURA","Factura N°":"Factura N°","Forma de pago":"Forma de pago","Vencimiento":"Vencimiento","Importe":"Importe","Tarjeta de Cliente":"Tarjeta de Cliente","Cliente":"Cliente","Entrega de Pedidos":"Entrega de Pedidos","Buscar cliente":"Buscar cliente","Escanear QR o escribir código":"Escanear QR o escribir código","Buscar":"Buscar","Pedidos pendientes":"Pedidos pendientes","Pedidos entregados":"Pedidos entregados","Sin pedidos pendientes":"Sin pedidos pendientes","Entregar":"Entregar","Ya entregados":"Ya entregados","Volver":"Volver","Cargando...":"Cargando...","Cliente no encontrado":"Cliente no encontrado","Verificar el código":"Verificar el código","Error de conexion":"Error de conexión","No se puede conectar con el servidor":"No se puede conectar con el servidor","Pedido ya entregado":"Pedido ya entregado","Entrega registrada":"Entrega registrada","Pedido no encontrado":"Pedido no encontrado","Iniciar sesion":"Iniciar sesión","Iniciar sesión":"Iniciar sesión","Accede a tu panel de control":"Accede a tu panel de control","Usuario":"Usuario","Contrasena":"Contraseña","Contraseña":"Contraseña","Entrar":"Entrar","Entrando...":"Entrando...","Cuentas de prueba":"Cuentas de prueba","Administrador":"Administrador","Produccion":"Producción","Producción":"Producción","Almacen":"Almacén","Almacén":"Almacén","Comercial":"Comercial","Contabilidad":"Contabilidad"},"fr":{"Imprimir / Guardar PDF":"Imprimer / Sauvegarder PDF","Enviar por email":"Envoyer par email","Cerrar":"Fermer","HOJA DE PEDIDO":"BON DE COMMANDE","PEDIDO N°":"COMMANDE N°","Fecha":"Date","Pedido N°":"Commande N°","N°":"N°","Descripción":"Description","Presentación":"Présentation","Cantidad":"Quantité","Precio Unitario":"Prix Unitaire","Total":"Total","Subtotal":"Sous-total","Descuento":"Remise","Transporte":"Transport","TOTAL GENERAL":"TOTAL GÉNÉRAL","I.V.A.":"T.V.A.","IVA":"TVA","Base imponible":"Base imposable","Datos del Cliente":"Données du Client","Detalles del Pedido":"Détails de la Commande","Nombre:":"Nom :","Dirección:":"Adresse :","Teléfono:":"Téléphone :","Email:":"Email :","NIF / VAT:":"NIF / TVA :","Fecha del pedido:":"Date de commande :","Fecha de entrega:":"Date de livraison :","Condiciones de pago:":"Conditions de paiement :","Vendedor:":"Vendeur :","Referencia:":"Référence :","Notas:":"Notes :","Condiciones Generales":"Conditions Générales","Firma y sello del cliente":"Signature et cachet du client","¡GRACIAS POR SU CONFIANZA!":"MERCI DE VOTRE CONFIANCE !","FACTURA":"FACTURE","Factura N°":"Facture N°","Forma de pago":"Mode de paiement","Vencimiento":"Échéance","Importe":"Montant","Tarjeta de Cliente":"Carte Client","Cliente":"Client","Entrega de Pedidos":"Livraison de Commandes","Buscar cliente":"Rechercher client","Escanear QR o escribir código":"Scanner QR ou saisir le code","Buscar":"Rechercher","Pedidos pendientes":"Commandes en attente","Pedidos entregados":"Commandes livrées","Sin pedidos pendientes":"Aucune commande en attente","Entregar":"Livrer","Ya entregados":"Déjà livrées","Volver":"Retour","Cargando...":"Chargement...","Cliente no encontrado":"Client non trouvé","Verificar el código":"Vérifier le code","Error de conexion":"Erreur de connexion","No se puede conectar con el servidor":"Impossible de se connecter au serveur","Pedido ya entregado":"Commande déjà livrée","Entrega registrada":"Livraison enregistrée","Pedido no encontrado":"Commande non trouvée","Iniciar sesion":"Se connecter","Iniciar sesión":"Se connecter","Accede a tu panel de control":"Accédez à votre tableau de bord","Usuario":"Utilisateur","Contrasena":"Mot de passe","Contraseña":"Mot de passe","Entrar":"Entrer","Entrando...":"Connexion...","Cuentas de prueba":"Comptes de test","Administrador":"Administrateur","Produccion":"Production","Producción":"Production","Almacen":"Entrepôt","Almacén":"Entrepôt","Comercial":"Commercial","Contabilidad":"Comptabilité"},"en":{"Imprimir / Guardar PDF":"Print / Save PDF","Enviar por email":"Send by email","Cerrar":"Close","HOJA DE PEDIDO":"ORDER FORM","PEDIDO N°":"ORDER N°","Fecha":"Date","Pedido N°":"Order N°","N°":"N°","Descripción":"Description","Presentación":"Presentation","Cantidad":"Quantity","Precio Unitario":"Unit Price","Total":"Total","Subtotal":"Subtotal","Descuento":"Discount","Transporte":"Shipping","TOTAL GENERAL":"GRAND TOTAL","I.V.A.":"V.A.T.","IVA":"VAT","Base imponible":"Taxable base","Datos del Cliente":"Customer Details","Detalles del Pedido":"Order Details","Nombre:":"Name:","Dirección:":"Address:","Teléfono:":"Phone:","Email:":"Email:","NIF / VAT:":"Tax ID:","Fecha del pedido:":"Order date:","Fecha de entrega:":"Delivery date:","Condiciones de pago:":"Payment terms:","Vendedor:":"Seller:","Referencia:":"Reference:","Notas:":"Notes:","Condiciones Generales":"General Conditions","Firma y sello del cliente":"Customer signature and stamp","¡GRACIAS POR SU CONFIANZA!":"THANK YOU FOR YOUR TRUST!","FACTURA":"INVOICE","Factura N°":"Invoice N°","Forma de pago":"Payment method","Vencimiento":"Due date","Importe":"Amount","Tarjeta de Cliente":"Customer Card","Cliente":"Customer","Entrega de Pedidos":"Order Delivery","Buscar cliente":"Search customer","Escanear QR o escribir código":"Scan QR or type code","Buscar":"Search","Pedidos pendientes":"Pending orders","Pedidos entregados":"Delivered orders","Sin pedidos pendientes":"No pending orders","Entregar":"Deliver","Ya entregados":"Already delivered","Volver":"Back","Cargando...":"Loading...","Cliente no encontrado":"Customer not found","Verificar el código":"Verify the code","Error de conexion":"Connection error","No se puede conectar con el servidor":"Cannot connect to server","Pedido ya entregado":"Order already delivered","Entrega registrada":"Delivery registered","Pedido no encontrado":"Order not found","Iniciar sesion":"Sign in","Iniciar sesión":"Sign in","Accede a tu panel de control":"Access your control panel","Usuario":"User","Contrasena":"Password","Contraseña":"Password","Entrar":"Sign in","Entrando...":"Signing in...","Cuentas de prueba":"Test accounts","Administrador":"Administrator","Produccion":"Production","Producción":"Production","Almacen":"Warehouse","Almacén":"Warehouse","Comercial":"Sales","Contabilidad":"Accounting"},"pt":{"Imprimir / Guardar PDF":"Imprimir / Salvar PDF","Enviar por email":"Enviar por email","Cerrar":"Fechar","HOJA DE PEDIDO":"FOLHA DE PEDIDO","PEDIDO N°":"PEDIDO N°","Fecha":"Data","Pedido N°":"Pedido N°","N°":"N°","Descripción":"Descrição","Presentación":"Apresentação","Cantidad":"Quantidade","Precio Unitario":"Preço Unitário","Total":"Total","Subtotal":"Subtotal","Descuento":"Desconto","Transporte":"Transporte","TOTAL GENERAL":"TOTAL GERAL","I.V.A.":"I.V.A.","IVA":"IVA","Base imponible":"Base tributável","Datos del Cliente":"Dados do Cliente","Detalles del Pedido":"Detalhes do Pedido","Nombre:":"Nome:","Dirección:":"Endereço:","Teléfono:":"Telefone:","Email:":"Email:","NIF / VAT:":"CNPJ/CPF:","Fecha del pedido:":"Data do pedido:","Fecha de entrega:":"Data de entrega:","Condiciones de pago:":"Condições de pagamento:","Vendedor:":"Vendedor:","Referencia:":"Referência:","Notas:":"Notas:","Condiciones Generales":"Condições Gerais","Firma y sello del cliente":"Assinatura e carimbo do cliente","¡GRACIAS POR SU CONFIANZA!":"OBRIGADO PELA SUA CONFIANÇA!","FACTURA":"FATURA","Factura N°":"Fatura N°","Forma de pago":"Forma de pagamento","Vencimiento":"Vencimento","Importe":"Valor","Tarjeta de Cliente":"Cartão de Cliente","Cliente":"Cliente","Entrega de Pedidos":"Entrega de Pedidos","Buscar cliente":"Buscar cliente","Escanear QR o escribir código":"Escanear QR ou digitar código","Buscar":"Pesquisar","Pedidos pendientes":"Pedidos pendentes","Pedidos entregados":"Pedidos entregues","Sin pedidos pendientes":"Sem pedidos pendentes","Entregar":"Entregar","Ya entregados":"Já entregues","Volver":"Voltar","Cargando...":"Carregando...","Cliente no encontrado":"Cliente não encontrado","Verificar el código":"Verifique o código","Error de conexion":"Erro de conexão","No se puede conectar con el servidor":"Não é possível conectar ao servidor","Pedido ya entregado":"Pedido já entregue","Entrega registrada":"Entrega registrada","Pedido no encontrado":"Pedido não encontrado","Iniciar sesion":"Entrar","Iniciar sesión":"Entrar","Accede a tu panel de control":"Aceda ao seu painel de controlo","Usuario":"Utilizador","Contrasena":"Palavra-passe","Contraseña":"Palavra-passe","Entrar":"Entrar","Entrando...":"Entrando...","Cuentas de prueba":"Contas de teste","Administrador":"Administrador","Produccion":"Produção","Producción":"Produção","Almacen":"Armazém","Almacén":"Armazém","Comercial":"Comercial","Contabilidad":"Contabilidade"}};

function applyDocI18n() {
  if (window.__docI18nApplied) return;
  window.__docI18nApplied = true;

  const urlParams = new URLSearchParams(window.location.search);
  const lang = (urlParams.get('lang') || localStorage.getItem('cleanerp-lang') || 'es').toLowerCase();
  if (!DICT[lang]) lang = 'es';

  // Mapa ES normalizado -> clave
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esToKey = {};
  for (const k in DICT.es) {
    esToKey[k] = k;
    esToKey[norm(k)] = k;
  }

  function tr(key) {
    return (DICT[lang] && DICT[lang][key]) || DICT.es[key] || key;
  }

  // Traducir text nodes
  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue || '';
      if (!raw.trim()) return;
      const txt = raw.trim();
      if (txt.length < 2 || txt.length > 100) return;
      const key = esToKey[txt] || esToKey[norm(txt)];
      if (key) {
        const newText = tr(key);
        if (newText !== txt) {
          node.nodeValue = raw.replace(txt, newText);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') return;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (node.placeholder) {
          const k = esToKey[node.placeholder] || esToKey[norm(node.placeholder)];
          if (k) node.placeholder = tr(k);
        }
        return;
      }
      for (const child of node.childNodes) translateNode(child);
    }
  }

  // Aplicar a todo el body
  translateNode(document.body);
  document.documentElement.lang = lang;
  document.title = (lang === 'es' ? 'Hoja de Pedido' : (lang === 'fr' ? 'Bon de Commande' : (lang === 'en' ? 'Order Form' : 'Folha de Pedido')));
}

// Ejecutar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyDocI18n);
} else {
  applyDocI18n();
}

// Re-aplicar para contenido dinámico
const obs = new MutationObserver(() => {
  clearTimeout(window.__docI18nTimeout);
  window.__docI18nTimeout = setTimeout(applyDocI18n, 50);
});
obs.observe(document.body, { childList: true, subtree: true });

// Cambios de idioma
window.addEventListener('storage', e => {
  if (e.key === 'cleanerp-lang') {
    window.location.reload();
  }
});

console.log('[doc-i18n] Idioma:', new URLSearchParams(window.location.search).get('lang') || localStorage.getItem('cleanerp-lang') || 'es');
