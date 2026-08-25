// ============================================================
// I18N POST-RENDER PATCH
// Se inyecta al final del bundle para traducir textos hardcodeados
// ============================================================
(function() {
  if (window.__i18nPatched) return;
  window.__i18nPatched = true;
  
  // Diccionario completo de traducciones (las mismas 117 claves que tiene el bundle)
  const dict = {
    es: {"nav.dashboard":"Dashboard","nav.alerts":"Alertas","nav.search":"Búsqueda","nav.scanner":"Escáner","nav.raw_materials":"Materias Primas","nav.raw_material_lots":"Lotes de MP","nav.packaging":"Embalaje","nav.recipes":"Recetas","nav.production":"Producción","nav.lots":"Lotes","nav.lot_generator":"Generar lote","nav.recalls":"Retiradas","nav.products":"Productos","nav.customers":"Clientes","nav.orders":"Pedidos","nav.sales":"Ventas","nav.purchases":"Compras","nav.expenses":"Gastos","nav.reports":"Informes","nav.history":"Historial","nav.users":"Usuarios","nav.settings":"Configuración","common.cancel":"Cancelar","common.save":"Guardar","common.delete":"Eliminar","common.edit":"Editar","common.create":"Crear","common.search":"Buscar","common.confirm":"Confirmar","common.close":"Cerrar","common.back":"Volver","common.next":"Siguiente","common.previous":"Anterior","common.yes":"Sí","common.no":"No","common.loading":"Cargando...","common.error":"Error","common.success":"Éxito","common.warning":"Advertencia","common.info":"Información"},
    fr: {"nav.dashboard":"Tableau de bord","nav.alerts":"Alertes","nav.search":"Recherche","nav.scanner":"Scanner","nav.raw_materials":"Matières Premières","nav.raw_material_lots":"Lots de MP","nav.packaging":"Emballage","nav.recipes":"Recettes","nav.production":"Production","nav.lots":"Lots","nav.lot_generator":"Générer lot","nav.recalls":"Rappels","nav.products":"Produits","nav.customers":"Clients","nav.orders":"Commandes","nav.sales":"Ventes","nav.purchases":"Achats","nav.expenses":"Dépenses","nav.reports":"Rapports","nav.history":"Historique","nav.users":"Utilisateurs","nav.settings":"Paramètres","common.cancel":"Annuler","common.save":"Enregistrer","common.delete":"Supprimer","common.edit":"Modifier","common.create":"Créer","common.search":"Rechercher","common.confirm":"Confirmer","common.close":"Fermer","common.back":"Retour","common.next":"Suivant","common.previous":"Précédent","common.yes":"Oui","common.no":"Non","common.loading":"Chargement...","common.error":"Erreur","common.success":"Succès","common.warning":"Attention","common.info":"Information"},
    en: {"nav.dashboard":"Dashboard","nav.alerts":"Alerts","nav.search":"Search","nav.scanner":"Scanner","nav.raw_materials":"Raw Materials","nav.raw_material_lots":"RM Lots","nav.packaging":"Packaging","nav.recipes":"Recipes","nav.production":"Production","nav.lots":"Lots","nav.lot_generator":"Generate Lot","nav.recalls":"Recalls","nav.products":"Products","nav.customers":"Customers","nav.orders":"Orders","nav.sales":"Sales","nav.purchases":"Purchases","nav.expenses":"Expenses","nav.reports":"Reports","nav.history":"History","nav.users":"Users","nav.settings":"Settings","common.cancel":"Cancel","common.save":"Save","common.delete":"Delete","common.edit":"Edit","common.create":"Create","common.search":"Search","common.confirm":"Confirm","common.close":"Close","common.back":"Back","common.next":"Next","common.previous":"Previous","common.yes":"Yes","common.no":"No","common.loading":"Loading...","common.error":"Error","common.success":"Success","common.warning":"Warning","common.info":"Information"},
    pt: {"nav.dashboard":"Painel","nav.alerts":"Alertas","nav.search":"Pesquisa","nav.scanner":"Scanner","nav.raw_materials":"Matérias-Primas","nav.raw_material_lots":"Lotes de MP","nav.packaging":"Embalagem","nav.recipes":"Receitas","nav.production":"Produção","nav.lots":"Lotes","nav.lot_generator":"Gerar Lote","nav.recalls":"Recalls","nav.products":"Produtos","nav.customers":"Clientes","nav.orders":"Pedidos","nav.sales":"Vendas","nav.purchases":"Compras","nav.expenses":"Despesas","nav.reports":"Relatórios","nav.history":"Histórico","nav.users":"Usuários","nav.settings":"Configurações","common.cancel":"Cancelar","common.save":"Salvar","common.delete":"Excluir","common.edit":"Editar","common.create":"Criar","common.search":"Pesquisar","common.confirm":"Confirmar","common.close":"Fechar","common.back":"Voltar","common.next":"Próximo","common.previous":"Anterior","common.yes":"Sim","common.no":"Não","common.loading":"Carregando...","common.error":"Erro","common.success":"Sucesso","common.warning":"Aviso","common.info":"Informação"}
  };
  
  // Mapa inverso: texto ES → clave i18n
  const esToKey = {};
  for (const k in dict.es) esToKey[dict.es[k]] = k;
  
  // Traductor
  function tr(key, lang) {
    return (dict[lang] && dict[lang][key]) || dict.es[key] || key;
  }
  
  // Función principal: traducir todos los textos visibles del DOM
  function translateDOM(lang) {
    if (!dict[lang]) lang = 'es';
    
    // Traducir todos los elementos de texto del sidebar y botones
    // Recorremos todos los elementos del DOM
    const all = document.querySelectorAll('a, button, span, div, h1, h2, h3, h4, h5, h6, label, p, td, th, li');
    for (const el of all) {
      // Solo traducir elementos con texto directo (no contenedores)
      if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
        const txt = el.textContent.trim();
        if (esToKey[txt]) {
          const newText = tr(esToKey[txt], lang);
          if (newText !== txt) {
            el.textContent = newText;
          }
        }
      }
    }
  }
  
  // Detectar cambios de idioma
  function checkLang() {
    const lang = localStorage.getItem('cleanerp-lang') || 'es';
    if (window.__currentLang !== lang) {
      window.__currentLang = lang;
      translateDOM(lang);
    }
  }
  
  // Observer para detectar cambios en el DOM
  const observer = new MutationObserver(() => {
    checkLang();
  });
  
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      setInterval(checkLang, 1000);
      checkLang();
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(checkLang, 1000);
    checkLang();
  }
  
  // Exponer función global para debug
  window.__translateUI = translateDOM;
  window.__i18nDict = dict;
})();
