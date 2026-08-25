// ============================================================
// I18N PATCH v3 - Global, completo, todos los textos
// ============================================================
(function() {
  if (window.__i18nPatched) return;
  window.__i18nPatched = true;

  // =============== DICCIONARIO COMPLETO ===============
  const dict = {
    es: {
      // Sidebar - Navegación
      'Dashboard': 'Dashboard', 'Alertas': 'Alertas', 'Búsqueda': 'Búsqueda', 'Escáner': 'Escáner',
      'Materias Primas': 'Materias Primas', 'Lotes de MP': 'Lotes de MP', 'Embalaje': 'Embalaje',
      'Recetas': 'Recetas', 'Producción': 'Producción', 'Lotes': 'Lotes', 'Generar lote': 'Generar lote',
      'Retiradas': 'Retiradas', 'Productos': 'Productos', 'Clientes': 'Clientes', 'Pedidos': 'Pedidos',
      'Ventas': 'Ventas', 'Compras': 'Compras', 'Gastos': 'Gastos', 'Informes': 'Informes',
      'Historial': 'Historial', 'Usuarios': 'Usuarios', 'Configuración': 'Configuración',
      'Reportes': 'Reportes', 'Inventario': 'Inventario', 'Trazabilidad': 'Trazabilidad',
      // Comunes
      'Cancelar': 'Cancelar', 'Guardar': 'Guardar', 'Eliminar': 'Eliminar', 'Editar': 'Editar',
      'Crear': 'Crear', 'Buscar': 'Buscar', 'Confirmar': 'Confirmar', 'Cerrar': 'Cerrar',
      'Volver': 'Volver', 'Siguiente': 'Siguiente', 'Anterior': 'Anterior',
      'Sí': 'Sí', 'No': 'No', 'Cargando...': 'Cargando...', 'Error': 'Error',
      'Éxito': 'Éxito', 'Advertencia': 'Advertencia', 'Información': 'Información',
      'Nuevo': 'Nuevo', 'Nueva': 'Nueva', 'Agregar': 'Agregar', 'Añadir': 'Añadir',
      'Quitar': 'Quitar', 'Borrar': 'Borrar', 'Actualizar': 'Actualizar', 'Refrescar': 'Refrescar',
      'Recargar': 'Recargar', 'Exportar': 'Exportar', 'Importar': 'Importar',
      'Imprimir': 'Imprimir', 'Descargar': 'Descargar', 'Subir': 'Subir',
      'Activo': 'Activo', 'Inactivo': 'Inactivo', 'Pendiente': 'Pendiente',
      'Confirmado': 'Confirmado', 'En proceso': 'En proceso', 'Completado': 'Completado',
      'Cancelado': 'Cancelado', 'Entregado': 'Entregado', 'Acabada': 'Acabada',
      'Nombre': 'Nombre', 'Descripción': 'Descripción', 'Código': 'Código',
      'Categoría': 'Categoría', 'Unidad': 'Unidad', 'Stock': 'Stock', 'Stock mínimo': 'Stock mínimo',
      'Stock máximo': 'Stock máximo', 'Precio': 'Precio', 'Coste': 'Coste', 'Costo': 'Costo',
      'Cantidad': 'Cantidad', 'Total': 'Total', 'Subtotal': 'Subtotal',
      'Fecha': 'Fecha', 'Estado': 'Estado', 'Notas': 'Notas', 'Dirección': 'Dirección',
      'Ciudad': 'Ciudad', 'País': 'País', 'Teléfono': 'Teléfono', 'Email': 'Email',
      'Contacto': 'Contacto', 'CIF': 'CIF', 'NIF': 'NIF', 'IVA': 'IVA',
      'Proveedor': 'Proveedor', 'Cliente': 'Cliente', 'Usuario': 'Usuario',
      'Contraseña': 'Contraseña', 'Permisos': 'Permisos', 'Rol': 'Rol', 'Acciones': 'Acciones',
      'Buenos días': 'Buenos días', 'Buenas tardes': 'Buenas tardes', 'Buenas noches': 'Buenas noches',
      'Aquí tienes el estado actual de tu fábrica en tiempo real.': 'Aquí tienes el estado actual de tu fábrica en tiempo real.',
      'Valor del inventario': 'Valor del inventario', 'Materias primas': 'Materias primas',
      'Envases y embalajes': 'Envases y embalajes', 'Productos terminados': 'Productos terminados',
      'Stock bajo': 'Stock bajo', 'Producción hoy': 'Producción hoy',
      'Producción semanal': 'Producción semanal', 'Producción mensual': 'Producción mensual',
      'Ventas hoy': 'Ventas hoy', 'Ventas del mes': 'Ventas del mes',
      'Gastos del mes': 'Gastos del mes', 'Beneficio': 'Beneficio',
      'Ventas vs Gastos': 'Ventas vs Gastos', 'Últimos 7 días': 'Últimos 7 días',
      'Composición del inventario': 'Composición del inventario',
      'Productos más vendidos (mes)': 'Productos más vendidos (mes)',
      'Clientes principales': 'Clientes principales', 'Últimos pedidos': 'Últimos pedidos',
      'Últimas compras': 'Últimas compras', 'Producción reciente': 'Producción reciente',
      'Ver todos': 'Ver todos', 'Ver todas': 'Ver todas',
      'En vivo': 'En vivo', 'Actualizado': 'Actualizado',
      'Sin datos este mes': 'Sin datos este mes', 'Sin pedidos': 'Sin pedidos',
      'Sin compras': 'Sin compras', 'Sin producción': 'Sin producción',
      'General': 'General', 'Comercial': 'Comercial', 'Operaciones': 'Operaciones',
      'Nuevo pedido': 'Nuevo pedido', 'Ver pedido': 'Ver pedido', 'Editar pedido': 'Editar pedido',
      'Entregar pedido': 'Entregar pedido',
      'Items': 'Items', 'Líneas': 'Líneas',
      'Forma de pago': 'Forma de pago', 'Efectivo': 'Efectivo', 'Tarjeta': 'Tarjeta',
      'Transferencia': 'Transferencia', 'Crédito': 'Crédito',
      'Al contado': 'Al contado', 'A 15 días': 'A 15 días', 'A 30 días': 'A 30 días', 'A 60 días': 'A 60 días',
      'Generar documento': 'Generar documento', 'Ver': 'Ver',
      'Tarjeta': 'Tarjeta', 'Escanear cliente': 'Escanear cliente',
      'Receta': 'Receta', 'Ingredientes': 'Ingredientes',
      'Tamaño del batch': 'Tamaño del batch', 'Botellas por caja': 'Botellas por caja',
      'Cajas por palé': 'Cajas por palé', 'Rendimiento': 'Rendimiento',
      'Cantidad de la receta': 'Cantidad de la receta', 'Materias necesarias': 'Materias necesarias',
      'Producción rápida': 'Producción rápida',
      'Iniciar producción': 'Iniciar producción', 'Completar producción': 'Completar producción',
      'Materias primas necesarias': 'Materias primas necesarias',
      'Disponible': 'Disponible', 'Necesario': 'Necesario',
      'Hay stock suficiente': 'Hay stock suficiente', 'Falta stock': 'Falta stock',
      'Lote': 'Lote', 'Materias primas utilizadas': 'Materias primas utilizadas',
      'Fecha de fabricación': 'Fecha de fabricación', 'Fecha de caducidad': 'Fecha de caducidad',
      'Operario': 'Operario', 'Máquina': 'Máquina',
      'Notificaciones': 'Notificaciones', 'Marcar todo leído': 'Marcar todo leído',
      'No hay notificaciones': 'No hay notificaciones', 'Crítico': 'Crítico',
      'Stock bajo en': 'Stock bajo en', 'Próximo a caducar': 'Próximo a caducar',
      'Caducado': 'Caducado', 'Caduca en': 'Caduca en',
      'Datos de la empresa': 'Datos de la empresa', 'Nombre de la empresa': 'Nombre de la empresa',
      'Sitio web': 'Sitio web', 'CIF/NIF': 'CIF/NIF',
      'Moneda': 'Moneda', 'Idioma': 'Idioma', 'IVA por defecto': 'IVA por defecto',
      'Seguridad': 'Seguridad', 'Máx. intentos fallidos': 'Máx. intentos fallidos',
      'Tema': 'Tema', 'Claro': 'Claro', 'Oscuro': 'Oscuro',
      'Copia de seguridad': 'Copia de seguridad', 'Restaurar': 'Restaurar',
      'Importar datos': 'Importar datos', 'Exportar datos': 'Exportar datos',
      'Respaldo': 'Respaldo', 'Idioma y moneda': 'Idioma y moneda',
      'Cerrar sesión': 'Cerrar sesión', 'Mi perfil': 'Mi perfil',
      'Buscar clientes, productos, pedidos, lotes...': 'Buscar clientes, productos, pedidos, lotes...',
    
      'articulos con stock bajo': 'artículos con stock bajo',
    },
    fr: {
      'Dashboard': 'Tableau de bord', 'Alertas': 'Alertes', 'Búsqueda': 'Recherche', 'Escáner': 'Scanner',
      'Materias Primas': 'Matières Premières', 'Lotes de MP': 'Lots de MP', 'Embalaje': 'Emballage',
      'Recetas': 'Recettes', 'Producción': 'Production', 'Lotes': 'Lots', 'Generar lote': 'Générer lot',
      'Retiradas': 'Rappels', 'Productos': 'Produits', 'Clientes': 'Clients', 'Pedidos': 'Commandes',
      'Ventas': 'Ventes', 'Compras': 'Achats', 'Gastos': 'Dépenses', 'Informes': 'Rapports',
      'Historial': 'Historique', 'Usuarios': 'Utilisateurs', 'Configuración': 'Paramètres',
      'Reportes': 'Rapports', 'Inventario': 'Inventaire', 'Trazabilidad': 'Traçabilité',
      'Cancelar': 'Annuler', 'Guardar': 'Enregistrer', 'Eliminar': 'Supprimer', 'Editar': 'Modifier',
      'Crear': 'Créer', 'Buscar': 'Rechercher', 'Confirmar': 'Confirmer', 'Cerrar': 'Fermer',
      'Volver': 'Retour', 'Siguiente': 'Suivant', 'Anterior': 'Précédent',
      'Sí': 'Oui', 'No': 'Non', 'Cargando...': 'Chargement...', 'Error': 'Erreur',
      'Éxito': 'Succès', 'Advertencia': 'Attention', 'Información': 'Information',
      'Nuevo': 'Nouveau', 'Nueva': 'Nouvelle', 'Agregar': 'Ajouter', 'Añadir': 'Ajouter',
      'Quitar': 'Retirer', 'Borrar': 'Effacer', 'Actualizar': 'Mettre à jour', 'Refrescar': 'Rafraîchir',
      'Recargar': 'Recharger', 'Exportar': 'Exporter', 'Importar': 'Importer',
      'Imprimir': 'Imprimer', 'Descargar': 'Télécharger', 'Subir': 'Téléverser',
      'Activo': 'Actif', 'Inactivo': 'Inactif', 'Pendiente': 'En attente',
      'Confirmado': 'Confirmé', 'En proceso': 'En cours', 'Completado': 'Terminé',
      'Cancelado': 'Annulé', 'Entregado': 'Livré', 'Acabada': 'Terminée',
      'Nombre': 'Nom', 'Descripción': 'Description', 'Código': 'Code',
      'Categoría': 'Catégorie', 'Unidad': 'Unité', 'Stock': 'Stock', 'Stock mínimo': 'Stock minimum',
      'Stock máximo': 'Stock maximum', 'Precio': 'Prix', 'Coste': 'Coût', 'Costo': 'Coût',
      'Cantidad': 'Quantité', 'Total': 'Total', 'Subtotal': 'Sous-total',
      'Fecha': 'Date', 'Estado': 'Statut', 'Notas': 'Notes', 'Dirección': 'Adresse',
      'Ciudad': 'Ville', 'País': 'Pays', 'Teléfono': 'Téléphone', 'Email': 'Email',
      'Contacto': 'Contact', 'CIF': 'CIF', 'NIF': 'NIF', 'IVA': 'TVA',
      'Proveedor': 'Fournisseur', 'Cliente': 'Client', 'Usuario': 'Utilisateur',
      'Contraseña': 'Mot de passe', 'Permisos': 'Permissions', 'Rol': 'Rôle', 'Acciones': 'Actions',
      'Buenos días': 'Bonjour', 'Buenas tardes': 'Bon après-midi', 'Buenas noches': 'Bonsoir',
      'Aquí tienes el estado actual de tu fábrica en tiempo real.': 'Voici l\'état actuel de votre usine en temps réel.',
      'Valor del inventario': 'Valeur de l\'inventaire', 'Materias primas': 'Matières premières',
      'Envases y embalajes': 'Emballages', 'Productos terminados': 'Produits finis',
      'Stock bajo': 'Stock bas', 'Producción hoy': 'Production aujourd\'hui',
      'Producción semanal': 'Production hebdomadaire', 'Producción mensual': 'Production mensuelle',
      'Ventas hoy': 'Ventes aujourd\'hui', 'Ventas del mes': 'Ventes du mois',
      'Gastos del mes': 'Dépenses du mois', 'Beneficio': 'Bénéfice',
      'Ventas vs Gastos': 'Ventes vs Dépenses', 'Últimos 7 días': '7 derniers jours',
      'Composición del inventario': 'Composition de l\'inventaire',
      'Productos más vendidos (mes)': 'Produits les plus vendus (mois)',
      'Clientes principales': 'Meilleurs clients', 'Últimos pedidos': 'Dernières commandes',
      'Últimas compras': 'Derniers achats', 'Producción reciente': 'Production récente',
      'Ver todos': 'Voir tout', 'Ver todas': 'Voir tout',
      'En vivo': 'En direct', 'Actualizado': 'Mis à jour',
      'Sin datos este mes': 'Aucune donnée ce mois-ci', 'Sin pedidos': 'Aucune commande',
      'Sin compras': 'Aucun achat', 'Sin producción': 'Aucune production',
      'General': 'Général', 'Comercial': 'Commercial', 'Operaciones': 'Opérations',
      'Nuevo pedido': 'Nouvelle commande', 'Ver pedido': 'Voir commande', 'Editar pedido': 'Modifier commande',
      'Entregar pedido': 'Livrer commande',
      'Items': 'Articles', 'Líneas': 'Lignes',
      'Forma de pago': 'Mode de paiement', 'Efectivo': 'Espèces', 'Tarjeta': 'Carte',
      'Transferencia': 'Virement', 'Crédito': 'Crédit',
      'Al contado': 'Comptant', 'A 15 días': 'À 15 jours', 'A 30 días': 'À 30 jours', 'A 60 días': 'À 60 jours',
      'Generar documento': 'Générer document', 'Ver': 'Voir',
      'Tarjeta': 'Carte', 'Escanear cliente': 'Scanner client',
      'Receta': 'Recette', 'Ingredientes': 'Ingrédients',
      'Tamaño del batch': 'Taille du lot', 'Botellas por caja': 'Bouteilles par carton',
      'Cajas por palé': 'Cartons par palette', 'Rendimiento': 'Rendement',
      'Cantidad de la receta': 'Quantité de la recette', 'Materias necesarias': 'Matières nécessaires',
      'Producción rápida': 'Production rapide',
      'Iniciar producción': 'Démarrer production', 'Completar producción': 'Terminer production',
      'Materias primas necesarias': 'Matières premières nécessaires',
      'Disponible': 'Disponible', 'Necesario': 'Nécessaire',
      'Hay stock suficiente': 'Stock suffisant', 'Falta stock': 'Stock insuffisant',
      'Lote': 'Lot', 'Materias primas utilizadas': 'Matières premières utilisées',
      'Fecha de fabricación': 'Date de fabrication', 'Fecha de caducidad': 'Date d\'expiration',
      'Operario': 'Opérateur', 'Máquina': 'Machine',
      'Notificaciones': 'Notifications', 'Marcar todo leído': 'Tout marquer comme lu',
      'No hay notificaciones': 'Aucune notification', 'Crítico': 'Critique',
      'Stock bajo en': 'Stock bas pour', 'Próximo a caducar': 'Bientôt expiré',
      'Caducado': 'Expiré', 'Caduca en': 'Expire dans',
      'Datos de la empresa': 'Données de l\'entreprise', 'Nombre de la empresa': 'Nom de l\'entreprise',
      'Sitio web': 'Site web', 'CIF/NIF': 'CIF/NIF',
      'Moneda': 'Monnaie', 'Idioma': 'Langue', 'IVA por defecto': 'TVA par défaut',
      'Seguridad': 'Sécurité', 'Máx. intentos fallidos': 'Max. tentatives échouées',
      'Tema': 'Thème', 'Claro': 'Clair', 'Oscuro': 'Sombre',
      'Copia de seguridad': 'Sauvegarde', 'Restaurar': 'Restaurer',
      'Importar datos': 'Importer données', 'Exportar datos': 'Exporter données',
      'Respaldo': 'Sauvegarde', 'Idioma y moneda': 'Langue et monnaie',
      'Cerrar sesión': 'Déconnexion', 'Mi perfil': 'Mon profil',
      'Buscar clientes, productos, pedidos, lotes...': 'Rechercher clients, produits, commandes, lots...',
    
      'articulos con stock bajo': 'articles en stock bas',
    },
    en: {
      'Dashboard': 'Dashboard', 'Alertas': 'Alerts', 'Búsqueda': 'Search', 'Escáner': 'Scanner',
      'Materias Primas': 'Raw Materials', 'Lotes de MP': 'RM Lots', 'Embalaje': 'Packaging',
      'Recetas': 'Recipes', 'Producción': 'Production', 'Lotes': 'Lots', 'Generar lote': 'Generate Lot',
      'Retiradas': 'Recalls', 'Productos': 'Products', 'Clientes': 'Customers', 'Pedidos': 'Orders',
      'Ventas': 'Sales', 'Compras': 'Purchases', 'Gastos': 'Expenses', 'Informes': 'Reports',
      'Historial': 'History', 'Usuarios': 'Users', 'Configuración': 'Settings',
      'Reportes': 'Reports', 'Inventario': 'Inventory', 'Trazabilidad': 'Traceability',
      'Cancelar': 'Cancel', 'Guardar': 'Save', 'Eliminar': 'Delete', 'Editar': 'Edit',
      'Crear': 'Create', 'Buscar': 'Search', 'Confirmar': 'Confirm', 'Cerrar': 'Close',
      'Volver': 'Back', 'Siguiente': 'Next', 'Anterior': 'Previous',
      'Sí': 'Yes', 'No': 'No', 'Cargando...': 'Loading...', 'Error': 'Error',
      'Éxito': 'Success', 'Advertencia': 'Warning', 'Información': 'Information',
      'Nuevo': 'New', 'Nueva': 'New', 'Agregar': 'Add', 'Añadir': 'Add',
      'Quitar': 'Remove', 'Borrar': 'Delete', 'Actualizar': 'Update', 'Refrescar': 'Refresh',
      'Recargar': 'Reload', 'Exportar': 'Export', 'Importar': 'Import',
      'Imprimir': 'Print', 'Descargar': 'Download', 'Subir': 'Upload',
      'Activo': 'Active', 'Inactivo': 'Inactive', 'Pendiente': 'Pending',
      'Confirmado': 'Confirmed', 'En proceso': 'In progress', 'Completado': 'Completed',
      'Cancelado': 'Cancelled', 'Entregado': 'Delivered', 'Acabada': 'Finished',
      'Nombre': 'Name', 'Descripción': 'Description', 'Código': 'Code',
      'Categoría': 'Category', 'Unidad': 'Unit', 'Stock': 'Stock', 'Stock mínimo': 'Min stock',
      'Stock máximo': 'Max stock', 'Precio': 'Price', 'Coste': 'Cost', 'Costo': 'Cost',
      'Cantidad': 'Quantity', 'Total': 'Total', 'Subtotal': 'Subtotal',
      'Fecha': 'Date', 'Estado': 'Status', 'Notas': 'Notes', 'Dirección': 'Address',
      'Ciudad': 'City', 'País': 'Country', 'Teléfono': 'Phone', 'Email': 'Email',
      'Contacto': 'Contact', 'CIF': 'CIF', 'NIF': 'NIF', 'IVA': 'VAT',
      'Proveedor': 'Supplier', 'Cliente': 'Customer', 'Usuario': 'User',
      'Contraseña': 'Password', 'Permisos': 'Permissions', 'Rol': 'Role', 'Acciones': 'Actions',
      'Buenos días': 'Good morning', 'Buenas tardes': 'Good afternoon', 'Buenas noches': 'Good evening',
      'Aquí tienes el estado actual de tu fábrica en tiempo real.': 'Here is the current state of your factory in real time.',
      'Valor del inventario': 'Inventory value', 'Materias primas': 'Raw materials',
      'Envases y embalajes': 'Packaging', 'Productos terminados': 'Finished products',
      'Stock bajo': 'Low stock', 'Producción hoy': 'Production today',
      'Producción semanal': 'Weekly production', 'Producción mensual': 'Monthly production',
      'Ventas hoy': 'Sales today', 'Ventas del mes': 'Monthly sales',
      'Gastos del mes': 'Monthly expenses', 'Beneficio': 'Profit',
      'Ventas vs Gastos': 'Sales vs Expenses', 'Últimos 7 días': 'Last 7 days',
      'Composición del inventario': 'Inventory composition',
      'Productos más vendidos (mes)': 'Top products (month)',
      'Clientes principales': 'Top customers', 'Últimos pedidos': 'Recent orders',
      'Últimas compras': 'Recent purchases', 'Producción reciente': 'Recent production',
      'Ver todos': 'View all', 'Ver todas': 'View all',
      'En vivo': 'Live', 'Actualizado': 'Updated',
      'Sin datos este mes': 'No data this month', 'Sin pedidos': 'No orders',
      'Sin compras': 'No purchases', 'Sin producción': 'No production',
      'General': 'General', 'Comercial': 'Commercial', 'Operaciones': 'Operations',
      'Nuevo pedido': 'New order', 'Ver pedido': 'View order', 'Editar pedido': 'Edit order',
      'Entregar pedido': 'Deliver order',
      'Items': 'Items', 'Líneas': 'Lines',
      'Forma de pago': 'Payment method', 'Efectivo': 'Cash', 'Tarjeta': 'Card',
      'Transferencia': 'Transfer', 'Crédito': 'Credit',
      'Al contado': 'Cash on delivery', 'A 15 días': '15 days', 'A 30 días': '30 days', 'A 60 días': '60 days',
      'Generar documento': 'Generate document', 'Ver': 'View',
      'Tarjeta': 'Card', 'Escanear cliente': 'Scan customer',
      'Receta': 'Recipe', 'Ingredientes': 'Ingredients',
      'Tamaño del batch': 'Batch size', 'Botellas por caja': 'Bottles per box',
      'Cajas por palé': 'Boxes per pallet', 'Rendimiento': 'Yield',
      'Cantidad de la receta': 'Recipe quantity', 'Materias necesarias': 'Materials needed',
      'Producción rápida': 'Quick production',
      'Iniciar producción': 'Start production', 'Completar producción': 'Complete production',
      'Materias primas necesarias': 'Raw materials needed',
      'Disponible': 'Available', 'Necesario': 'Needed',
      'Hay stock suficiente': 'Stock sufficient', 'Falta stock': 'Insufficient stock',
      'Lote': 'Lot', 'Materias primas utilizadas': 'Raw materials used',
      'Fecha de fabricación': 'Production date', 'Fecha de caducidad': 'Expiry date',
      'Operario': 'Operator', 'Máquina': 'Machine',
      'Notificaciones': 'Notifications', 'Marcar todo leído': 'Mark all as read',
      'No hay notificaciones': 'No notifications', 'Crítico': 'Critical',
      'Stock bajo en': 'Low stock in', 'Próximo a caducar': 'Near expiry',
      'Caducado': 'Expired', 'Caduca en': 'Expires in',
      'Datos de la empresa': 'Company data', 'Nombre de la empresa': 'Company name',
      'Sitio web': 'Website', 'CIF/NIF': 'Tax ID',
      'Moneda': 'Currency', 'Idioma': 'Language', 'IVA por defecto': 'Default VAT',
      'Seguridad': 'Security', 'Máx. intentos fallidos': 'Max failed attempts',
      'Tema': 'Theme', 'Claro': 'Light', 'Oscuro': 'Dark',
      'Copia de seguridad': 'Backup', 'Restaurar': 'Restore',
      'Importar datos': 'Import data', 'Exportar datos': 'Export data',
      'Respaldo': 'Backup', 'Idioma y moneda': 'Language and currency',
      'Cerrar sesión': 'Logout', 'Mi perfil': 'My profile',
      'Buscar clientes, productos, pedidos, lotes...': 'Search customers, products, orders, lots...',
    
      'articulos con stock bajo': 'items with low stock',
    },
    pt: {
      'Dashboard': 'Painel', 'Alertas': 'Alertas', 'Búsqueda': 'Pesquisa', 'Escáner': 'Scanner',
      'Materias Primas': 'Matérias-Primas', 'Lotes de MP': 'Lotes de MP', 'Embalaje': 'Embalagem',
      'Recetas': 'Receitas', 'Producción': 'Produção', 'Lotes': 'Lotes', 'Generar lote': 'Gerar Lote',
      'Retiradas': 'Recalls', 'Productos': 'Produtos', 'Clientes': 'Clientes', 'Pedidos': 'Pedidos',
      'Ventas': 'Vendas', 'Compras': 'Compras', 'Gastos': 'Despesas', 'Informes': 'Relatórios',
      'Historial': 'Histórico', 'Usuarios': 'Utilizadores', 'Configuración': 'Configurações',
      'Reportes': 'Relatórios', 'Inventario': 'Inventário', 'Trazabilidad': 'Rastreabilidade',
      'Cancelar': 'Cancelar', 'Guardar': 'Salvar', 'Eliminar': 'Excluir', 'Editar': 'Editar',
      'Crear': 'Criar', 'Buscar': 'Pesquisar', 'Confirmar': 'Confirmar', 'Cerrar': 'Fechar',
      'Volver': 'Voltar', 'Siguiente': 'Próximo', 'Anterior': 'Anterior',
      'Sí': 'Sim', 'No': 'Não', 'Cargando...': 'Carregando...', 'Error': 'Erro',
      'Éxito': 'Sucesso', 'Advertencia': 'Aviso', 'Información': 'Informação',
      'Nuevo': 'Novo', 'Nueva': 'Nova', 'Agregar': 'Adicionar', 'Añadir': 'Adicionar',
      'Quitar': 'Remover', 'Borrar': 'Apagar', 'Actualizar': 'Atualizar', 'Refrescar': 'Atualizar',
      'Recargar': 'Recarregar', 'Exportar': 'Exportar', 'Importar': 'Importar',
      'Imprimir': 'Imprimir', 'Descargar': 'Baixar', 'Subir': 'Enviar',
      'Activo': 'Ativo', 'Inactivo': 'Inativo', 'Pendiente': 'Pendente',
      'Confirmado': 'Confirmado', 'En proceso': 'Em curso', 'Completado': 'Concluído',
      'Cancelado': 'Cancelado', 'Entregado': 'Entregue', 'Acabada': 'Concluída',
      'Nombre': 'Nome', 'Descripción': 'Descrição', 'Código': 'Código',
      'Categoría': 'Categoria', 'Unidad': 'Unidade', 'Stock': 'Stock', 'Stock mínimo': 'Stock mínimo',
      'Stock máximo': 'Stock máximo', 'Precio': 'Preço', 'Coste': 'Custo', 'Costo': 'Custo',
      'Cantidad': 'Quantidade', 'Total': 'Total', 'Subtotal': 'Subtotal',
      'Fecha': 'Data', 'Estado': 'Estado', 'Notas': 'Notas', 'Dirección': 'Endereço',
      'Ciudad': 'Cidade', 'País': 'País', 'Teléfono': 'Telefone', 'Email': 'Email',
      'Contacto': 'Contacto', 'CIF': 'CIF', 'NIF': 'NIF', 'IVA': 'IVA',
      'Proveedor': 'Fornecedor', 'Cliente': 'Cliente', 'Usuario': 'Utilizador',
      'Contraseña': 'Palavra-passe', 'Permisos': 'Permissões', 'Rol': 'Função', 'Acciones': 'Ações',
      'Buenos días': 'Bom dia', 'Buenas tardes': 'Boa tarde', 'Buenas noches': 'Boa noite',
      'Aquí tienes el estado actual de tu fábrica en tiempo real.': 'Aqui está o estado atual da sua fábrica em tempo real.',
      'Valor del inventario': 'Valor do inventário', 'Materias primas': 'Matérias-primas',
      'Envases y embalajes': 'Embalagens', 'Productos terminados': 'Produtos acabados',
      'Stock bajo': 'Stock baixo', 'Producción hoy': 'Produção hoje',
      'Producción semanal': 'Produção semanal', 'Producción mensual': 'Produção mensal',
      'Ventas hoy': 'Vendas hoje', 'Ventas del mes': 'Vendas do mês',
      'Gastos del mes': 'Despesas do mês', 'Beneficio': 'Lucro',
      'Ventas vs Gastos': 'Vendas vs Despesas', 'Últimos 7 días': 'Últimos 7 dias',
      'Composición del inventario': 'Composição do inventário',
      'Productos más vendidos (mes)': 'Produtos mais vendidos (mês)',
      'Clientes principales': 'Principais clientes', 'Últimos pedidos': 'Últimos pedidos',
      'Últimas compras': 'Últimas compras', 'Producción reciente': 'Produção recente',
      'Ver todos': 'Ver todos', 'Ver todas': 'Ver todos',
      'En vivo': 'Em direto', 'Actualizado': 'Atualizado',
      'Sin datos este mes': 'Sem dados este mês', 'Sin pedidos': 'Sem pedidos',
      'Sin compras': 'Sem compras', 'Sin producción': 'Sem produção',
      'General': 'Geral', 'Comercial': 'Comercial', 'Operaciones': 'Operações',
      'Nuevo pedido': 'Novo pedido', 'Ver pedido': 'Ver pedido', 'Editar pedido': 'Editar pedido',
      'Entregar pedido': 'Entregar pedido',
      'Items': 'Itens', 'Líneas': 'Linhas',
      'Forma de pago': 'Forma de pagamento', 'Efectivo': 'Dinheiro', 'Tarjeta': 'Cartão',
      'Transferencia': 'Transferência', 'Crédito': 'Crédito',
      'Al contado': 'A pronto', 'A 15 días': 'A 15 dias', 'A 30 días': 'A 30 dias', 'A 60 días': 'A 60 dias',
      'Generar documento': 'Gerar documento', 'Ver': 'Ver',
      'Tarjeta': 'Cartão', 'Escanear cliente': 'Pesquisar cliente',
      'Receta': 'Receita', 'Ingredientes': 'Ingredientes',
      'Tamaño del batch': 'Tamanho do lote', 'Botellas por caja': 'Garrafas por caixa',
      'Cajas por palé': 'Caixas por palete', 'Rendimiento': 'Rendimento',
      'Cantidad de la receta': 'Quantidade da receita', 'Materias necesarias': 'Matérias necessárias',
      'Producción rápida': 'Produção rápida',
      'Iniciar producción': 'Iniciar produção', 'Completar producción': 'Concluir produção',
      'Materias primas necesarias': 'Matérias-primas necessárias',
      'Disponible': 'Disponível', 'Necesario': 'Necessário',
      'Hay stock suficiente': 'Stock suficiente', 'Falta stock': 'Stock insuficiente',
      'Lote': 'Lote', 'Materias primas utilizadas': 'Matérias-primas utilizadas',
      'Fecha de fabricación': 'Data de fabrico', 'Fecha de caducidad': 'Data de validade',
      'Operario': 'Operador', 'Máquina': 'Máquina',
      'Notificaciones': 'Notificações', 'Marcar todo leído': 'Marcar tudo como lido',
      'No hay notificaciones': 'Sem notificações', 'Crítico': 'Crítico',
      'Stock bajo en': 'Stock baixo em', 'Próximo a caducar': 'Próximo do vencimento',
      'Caducado': 'Vencido', 'Caduca en': 'Vence em',
      'Datos de la empresa': 'Dados da empresa', 'Nombre de la empresa': 'Nome da empresa',
      'Sitio web': 'Website', 'CIF/NIF': 'NIPC/NIF',
      'Moneda': 'Moeda', 'Idioma': 'Idioma', 'IVA por defecto': 'IVA predefinido',
      'Seguridad': 'Segurança', 'Máx. intentos fallidos': 'Máx. tentativas falhadas',
      'Tema': 'Tema', 'Claro': 'Claro', 'Oscuro': 'Escuro',
      'Copia de seguridad': 'Cópia de segurança', 'Restaurar': 'Restaurar',
      'Importar datos': 'Importar dados', 'Exportar datos': 'Exportar dados',
      'Respaldo': 'Backup', 'Idioma y moneda': 'Idioma e moeda',
      'Cerrar sesión': 'Terminar sessão', 'Mi perfil': 'O meu perfil',
      'Buscar clientes, productos, pedidos, lotes...': 'Pesquisar clientes, produtos, pedidos, lotes...',
    
      'articulos con stock bajo': 'artigos com stock baixo',
    }
  };

  // Helper para normalizar (sin acentos)
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Construir mapa ES normalizado -> clave
  const esToKey = {};
  for (const k in dict.es) {
    esToKey[k] = k;
    esToKey[norm(k)] = k;
  }

  // Detectar idioma
  const lang = (localStorage.getItem('cleanerp-lang') || 'es').toLowerCase();
  if (!dict[lang]) lang = 'es';

  function tr(key) {
    return (dict[lang] && dict[lang][key]) || dict.es[key] || key;
  }

  // Traducir un text node
  function translateTextNode(node, currentLang) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const raw = node.nodeValue || '';
    if (!raw.trim()) return;
    const txt = raw.trim();
    if (txt.length < 2 || txt.length > 80) return;
    const key = esToKey[txt] || esToKey[norm(txt)];
    if (key) {
      const newText = (dict[currentLang] && dict[currentLang][key]) || dict.es[key] || key;
      if (newText !== txt) {
        node.nodeValue = raw.replace(txt, newText);
      }
    }
  }

  // Recorrer todos los nodos
  function translateElement(el, currentLang) {
    if (!el) return;
    if (el.nodeType === Node.ELEMENT_NODE) {
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || tag === 'PATH') return;
      const trLocal = (key) => {
        if (!currentLang || !dict[currentLang]) return dict.es[key] || key;
        return dict[currentLang][key] || dict.es[key] || key;
      };
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (el.placeholder) {
          const k = esToKey[el.placeholder] || esToKey[norm(el.placeholder)];
          if (k) el.placeholder = trLocal(k);
        }
        if (el.title) {
          const k = esToKey[el.title] || esToKey[norm(el.title)];
          if (k) el.title = trLocal(k);
        }
        if (el.getAttribute('aria-label')) {
          const al = el.getAttribute('aria-label');
          const k = esToKey[al] || esToKey[norm(al)];
          if (k) el.setAttribute('aria-label', trLocal(k));
        }
        return;
      }
      if (el.title) {
        const k = esToKey[el.title] || esToKey[norm(el.title)];
        if (k) el.title = trLocal(k);
      }
      const al = el.getAttribute('aria-label');
      if (al) {
        const k = esToKey[al] || esToKey[norm(al)];
        if (k) el.setAttribute('aria-label', trLocal(k));
      }
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          translateTextNode(child, currentLang);
        } else {
          translateElement(child, currentLang);
        }
      }
    } else if (el.nodeType === Node.TEXT_NODE) {
      translateTextNode(el, currentLang);
    }
  }

  let lastLang = null;
  function applyAll() {
    // Re-leer el idioma cada vez (puede cambiar)
    const currentLang = (localStorage.getItem('cleanerp-lang') || 'es').toLowerCase();
    if (currentLang !== lastLang) {
      lastLang = currentLang;
      window.__currentLang = currentLang;
    }
    translateElement(document.body, currentLang);
    document.documentElement.lang = currentLang;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else {
    applyAll();
  }

  let timeout = null;
  const obs = new MutationObserver(() => {
    clearTimeout(timeout);
    timeout = setTimeout(applyAll, 100);
  });
  setTimeout(() => {
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }, 500);

  setInterval(applyAll, 800);

  window.addEventListener('i18n-change', (e) => {
    // Disparado por el selector de idioma en la app
    setTimeout(() => { applyAll(); }, 50);
  });
window.addEventListener('storage', (e) => {
    if (e.key === 'cleanerp-lang') {
      window.location.reload();
    }
  });

  // Detectar cambios en el selector de idioma (botón con texto ES/FR/EN/PT)
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const text = (target.textContent || '').trim().toUpperCase();
    // Si hace click en un botón que parece un selector de idioma
    if (['ES', 'FR', 'EN', 'PT'].includes(text) || 
        (target.tagName === 'BUTTON' && /^[A-Z]{2}$/.test(text))) {
      // Esperar a que el localStorage se actualice y recargar
      setTimeout(() => {
        const newLang = localStorage.getItem('cleanerp-lang');
        if (newLang && newLang !== lastLang) {
          window.location.reload();
        }
      }, 200);
    }
  }, true);  // capture phase para interceptar antes

  window.__tr = tr;
  window.__i18nDict = dict;
  window.__currentLang = lang;
  console.log(`[i18n-patch] Idioma: ${lang}, ${Object.keys(dict.es).length} claves cargadas`);
})();
