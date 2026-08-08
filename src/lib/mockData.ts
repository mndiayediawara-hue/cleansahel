import type { AppData, User } from '@/types'

const now = new Date()
const today = now.toISOString()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString()
const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000).toISOString()
const monthsAgo = (n: number) => {
  const d = new Date(now)
  d.setMonth(d.getMonth() - n)
  return d.toISOString()
}

export const initialData: AppData = {
  config: {
    company: {
      name: 'CleanSahel S.A.',
      cif: 'B-12345678',
      address: 'Polígono Industrial Las Marismas, Nave 14, 41020 Sevilla',
      phone: '+34 954 123 456',
      email: 'info@cleanpro.es',
    },
    defaults: {
      bottlesPerBox: 12,
      boxesPerPallet: 60,
      tax: 21,
      currency: 'EUR',
      language: 'es',
      minStockDefault: 100,
      maxStockDefault: 5000,
      bottleSizes: [250, 500, 750, 1000],
    },
    security: {
      sessionTimeoutMin: 30,
      maxFailedAttempts: 5,
      autoBackupHours: 24,
    },
    lotFormat: {
      template: '{PREFIX}-{YYYY}{MM}{DD}-{####}',
      prefix: 'SAH',
      counterPadding: 4,
      counterStart: 1,
      resetCounterYearly: false,
    },
    aromas: ['Limón', 'Pino', 'Lavanda', 'Manzana', 'Floral', 'Marsella', 'Cítricos', 'Sin aroma', 'Menta', 'Vainilla'],
    colors: ['Transparente', 'Azul', 'Verde', 'Amarillo', 'Rosa', 'Rojo', 'Naranja', 'Incoloro'],
  },

  users: [
    { id: 'u1', username: 'admin', fullName: 'Carlos Rodríguez', email: 'carlos@cleanpro.es', role: 'admin', active: true, createdAt: monthsAgo(24), lastLogin: daysAgo(0) },
    { id: 'u2', username: 'produccion', fullName: 'María García', email: 'maria@cleanpro.es', role: 'produccion', active: true, createdAt: monthsAgo(18), lastLogin: daysAgo(0) },
    { id: 'u3', username: 'almacen', fullName: 'Javier López', email: 'javier@cleanpro.es', role: 'almacen', active: true, createdAt: monthsAgo(15), lastLogin: daysAgo(1) },
    { id: 'u4', username: 'comercial', fullName: 'Laura Martínez', email: 'laura@cleanpro.es', role: 'comercial', active: true, createdAt: monthsAgo(12), lastLogin: daysAgo(0) },
    { id: 'u5', username: 'contabilidad', fullName: 'Antonio Sánchez', email: 'antonio@cleanpro.es', role: 'contabilidad', active: true, createdAt: monthsAgo(10), lastLogin: daysAgo(2) },
  ],

  suppliers: [
    { id: 's1', name: 'Química Industrial del Sur', cif: 'A-41111222', email: 'ventas@quimicasur.es', phone: '+34 955 111 222', contact: 'Pedro Ramírez', address: 'Av. de la Industria 45', city: 'Sevilla', country: 'España' },
    { id: 's2', name: 'Envases Mediterráneo', cif: 'B-43222333', email: 'pedidos@envasesmed.com', phone: '+34 961 222 333', contact: 'Sofía Martín', address: 'C/ del Plástico 12', city: 'Valencia', country: 'España' },
    { id: 's3', name: 'Aromas & Fragancias S.A.', cif: 'A-08333444', email: 'info@aromass.com', phone: '+34 932 333 444', contact: 'Joan Puig', address: 'Polígono Zona Franca 8', city: 'Barcelona', country: 'España' },
    { id: 's4', name: 'Colorantes Técnicos', cif: 'B-25444555', email: 'comercial@coltec.es', phone: '+34 983 444 555', contact: 'Ana Belén', address: 'C/ Mayor 67', city: 'Valladolid', country: 'España' },
  ],

  rawMaterials: [
    { id: 'rm1', code: 'RM-001', name: 'Concentrado Japonés Premium', category: 'concentrado', unit: 'L', stock: 1850, minStock: 500, maxStock: 5000, price: 4.50, supplierId: 's1', location: 'A-01-03', expiryDate: daysAhead(180), lot: 'CJ-2025-0842', lastUpdated: daysAgo(2) },
    { id: 'rm2', code: 'RM-002', name: 'Agua Desionizada', category: 'agua', unit: 'L', stock: 12400, minStock: 2000, maxStock: 20000, price: 0.05, supplierId: 's1', location: 'A-01-04', lastUpdated: daysAgo(1) },
    { id: 'rm3', code: 'RM-003', name: 'Colorante Azul Brillante', category: 'colorante', unit: 'ml', stock: 18500, minStock: 5000, maxStock: 50000, price: 0.08, supplierId: 's4', location: 'A-02-01', expiryDate: daysAhead(420), lot: 'AZ-24-1138', lastUpdated: daysAgo(5) },
    { id: 'rm4', code: 'RM-004', name: 'Aroma Limón Natural', category: 'aroma', unit: 'ml', stock: 9200, minStock: 3000, maxStock: 30000, price: 0.12, supplierId: 's3', location: 'A-02-02', expiryDate: daysAhead(28), lot: 'LM-25-0244', lastUpdated: daysAgo(3) },
    { id: 'rm5', code: 'RM-005', name: 'Aroma Pino Fresco', category: 'aroma', unit: 'ml', stock: 450, minStock: 1000, maxStock: 20000, price: 0.14, supplierId: 's3', location: 'A-02-03', expiryDate: daysAhead(90), lot: 'PN-25-0091', lastUpdated: daysAgo(7) },
    { id: 'rm6', code: 'RM-006', name: 'Conservante Kathon CG', category: 'conservante', unit: 'ml', stock: 6800, minStock: 2000, maxStock: 15000, price: 0.22, supplierId: 's1', location: 'A-03-01', expiryDate: daysAhead(540), lot: 'KT-24-0512', lastUpdated: daysAgo(10) },
    { id: 'rm7', code: 'RM-007', name: 'Espesante Xantana', category: 'espesante', unit: 'kg', stock: 320, minStock: 100, maxStock: 2000, price: 8.20, supplierId: 's1', location: 'A-03-02', expiryDate: daysAhead(720), lot: 'XT-24-0088', lastUpdated: daysAgo(15) },
    { id: 'rm8', code: 'RM-008', name: 'Sal Industrial', category: 'sal', unit: 'kg', stock: 1500, minStock: 200, maxStock: 5000, price: 0.30, supplierId: 's1', location: 'A-04-01', lastUpdated: daysAgo(20) },
    { id: 'rm9', code: 'RM-009', name: 'Hipoclorito Sódico 12%', category: 'otro', unit: 'L', stock: 3200, minStock: 1000, maxStock: 8000, price: 1.20, supplierId: 's1', location: 'B-01-01', expiryDate: daysAhead(45), lot: 'HC-25-0301', lastUpdated: daysAgo(4) },
    { id: 'rm10', code: 'RM-010', name: 'Tensoactivo No Iónico', category: 'concentrado', unit: 'L', stock: 2400, minStock: 800, maxStock: 6000, price: 3.80, supplierId: 's1', location: 'A-01-05', expiryDate: daysAhead(300), lot: 'TN-24-0712', lastUpdated: daysAgo(6) },
  ],

  packaging: [
    { id: 'pk1', code: 'PK-250', name: 'Botella PET 250 ml', type: 'botella', size: '250ml', stock: 8400, minStock: 2000, maxStock: 30000, price: 0.18, supplierId: 's2', location: 'C-01-01', lastUpdated: daysAgo(3) },
    { id: 'pk2', code: 'PK-500', name: 'Botella PET 500 ml', type: 'botella', size: '500ml', stock: 6200, minStock: 2000, maxStock: 30000, price: 0.26, supplierId: 's2', location: 'C-01-02', lastUpdated: daysAgo(3) },
    { id: 'pk3', code: 'PK-750', name: 'Botella PET 750 ml', type: 'botella', size: '750ml', stock: 1180, minStock: 2000, maxStock: 25000, price: 0.34, supplierId: 's2', location: 'C-01-03', lastUpdated: daysAgo(2) },
    { id: 'pk4', code: 'PK-1000', name: 'Botella PET 1 L', type: 'botella', size: '1000ml', stock: 4100, minStock: 1500, maxStock: 20000, price: 0.42, supplierId: 's2', location: 'C-01-04', lastUpdated: daysAgo(3) },
    { id: 'pk5', code: 'PK-TAP', name: 'Tapón Rosca 28/400', type: 'tapon', stock: 22500, minStock: 5000, maxStock: 80000, price: 0.04, supplierId: 's2', location: 'C-02-01', lastUpdated: daysAgo(4) },
    { id: 'pk6', code: 'PK-PUL', name: 'Pulverizador Trigger', type: 'pulverizador', stock: 3400, minStock: 1000, maxStock: 15000, price: 0.85, supplierId: 's2', location: 'C-02-02', lastUpdated: daysAgo(5) },
    { id: 'pk7', code: 'PK-ETQ', name: 'Etiqueta Adhesiva', type: 'etiqueta', stock: 18000, minStock: 5000, maxStock: 100000, price: 0.03, supplierId: 's2', location: 'C-03-01', lastUpdated: daysAgo(2) },
    { id: 'pk8', code: 'PK-CJA', name: 'Caja Cartón 12 ud', type: 'caja', stock: 1450, minStock: 500, maxStock: 10000, price: 0.55, supplierId: 's2', location: 'D-01-01', lastUpdated: daysAgo(1) },
    { id: 'pk9', code: 'PK-PAL', name: 'Palet EUR 1200x800', type: 'palet', stock: 85, minStock: 20, maxStock: 200, price: 12.00, supplierId: 's2', location: 'D-02-01', lastUpdated: daysAgo(30) },
    { id: 'pk10', code: 'PK-FLM', name: 'Film Estirable 23µ', type: 'film', stock: 32, minStock: 10, maxStock: 100, price: 18.50, supplierId: 's2', location: 'D-02-02', lastUpdated: daysAgo(20) },
    { id: 'pk11', code: 'PK-PRI', name: 'Precinto Seguridad', type: 'precinto', stock: 1200, minStock: 500, maxStock: 10000, price: 0.06, supplierId: 's2', location: 'D-02-03', lastUpdated: daysAgo(15) },
  ],

  products: [
    { id: 'pr1', code: 'P-LIM-750', name: 'Limpiador Multiusos 750 ml', description: 'Limpiador multiusos aroma limón', category: 'Multiusos', bottleSize: 750, stock: 480, minStock: 500, maxStock: 5000, price: 3.95, cost: 1.80, recipeId: 'rc1', active: true },
    { id: 'pr2', code: 'P-LIM-1L', name: 'Limpiador Multiusos 1 L', description: 'Limpiador multiusos aroma limón', category: 'Multiusos', bottleSize: 1000, stock: 1240, minStock: 400, maxStock: 4000, price: 4.50, cost: 2.10, recipeId: 'rc2', active: true },
    { id: 'pr3', code: 'P-DES-1L', name: 'Desinfectante Pino 1 L', description: 'Desinfectante aroma pino fresco', category: 'Desinfectantes', bottleSize: 1000, stock: 320, minStock: 300, maxStock: 3000, price: 5.20, cost: 2.30, recipeId: 'rc3', active: true },
    { id: 'pr4', code: 'P-FREG-2L', name: 'Fregasuelos Concentrado 2 L', description: 'Fregasuelos alta concentración', category: 'Suelos', bottleSize: 2000, stock: 180, minStock: 200, maxStock: 2000, price: 7.80, cost: 3.40, recipeId: 'rc4', active: true },
    { id: 'pr5', code: 'P-VIT-500', name: 'Limpiacristales 500 ml', description: 'Limpiacristales con pulverizador', category: 'Cristales', bottleSize: 500, stock: 890, minStock: 300, maxStock: 3000, price: 3.20, cost: 1.45, recipeId: 'rc5', active: true },
    { id: 'pr6', code: 'P-BAN-750', name: 'Limpiador Baños 750 ml', description: 'Limpiador específico para baños', category: 'Baño', bottleSize: 750, stock: 560, minStock: 300, maxStock: 3000, price: 4.20, cost: 1.95, recipeId: 'rc6', active: true },
  ],

  recipes: [
    { id: 'rc1', productId: 'pr1', bottleSize: 750, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.3, updatedAt: daysAgo(10), items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.15, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.80, unit: 'L' },
      { materialId: 'rm3', materialType: 'raw', quantity: 0.5, unit: 'ml' },
      { materialId: 'rm4', materialType: 'raw', quantity: 2.5, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'pk3', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1 / 12, unit: 'ud' },
    ]},
    { id: 'rc2', productId: 'pr2', bottleSize: 1000, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.0, updatedAt: daysAgo(10), items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.18, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.78, unit: 'L' },
      { materialId: 'rm3', materialType: 'raw', quantity: 0.6, unit: 'ml' },
      { materialId: 'rm4', materialType: 'raw', quantity: 3.0, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.4, unit: 'ml' },
      { materialId: 'pk4', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1 / 12, unit: 'ud' },
    ]},
    { id: 'rc3', productId: 'pr3', bottleSize: 1000, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.0, updatedAt: daysAgo(8), items: [
      { materialId: 'rm9', materialType: 'raw', quantity: 0.20, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.75, unit: 'L' },
      { materialId: 'rm5', materialType: 'raw', quantity: 3.0, unit: 'ml' },
      { materialId: 'rm10', materialType: 'raw', quantity: 0.05, unit: 'L' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'pk4', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1 / 12, unit: 'ud' },
    ]},
    { id: 'rc4', productId: 'pr4', bottleSize: 2000, bottlesPerBox: 6, boxesPerPallet: 48, yieldPerLiter: 0.5, updatedAt: daysAgo(6), items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.30, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.65, unit: 'L' },
      { materialId: 'rm7', materialType: 'raw', quantity: 5, unit: 'g' },
      { materialId: 'rm4', materialType: 'raw', quantity: 4, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.5, unit: 'ml' },
      { materialId: 'pk4', materialType: 'packaging', quantity: 2, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 2, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 2, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1 / 6, unit: 'ud' },
    ]},
    { id: 'rc5', productId: 'pr5', bottleSize: 500, bottlesPerBox: 12, boxesPerPallet: 80, yieldPerLiter: 2.0, updatedAt: daysAgo(4), items: [
      { materialId: 'rm1', materialType: 'raw', quantity: 0.05, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.42, unit: 'L' },
      { materialId: 'rm3', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'rm10', materialType: 'raw', quantity: 0.03, unit: 'L' },
      { materialId: 'pk2', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk6', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1 / 12, unit: 'ud' },
    ]},
    { id: 'rc6', productId: 'pr6', bottleSize: 750, bottlesPerBox: 12, boxesPerPallet: 60, yieldPerLiter: 1.3, updatedAt: daysAgo(5), items: [
      { materialId: 'rm9', materialType: 'raw', quantity: 0.10, unit: 'L' },
      { materialId: 'rm1', materialType: 'raw', quantity: 0.10, unit: 'L' },
      { materialId: 'rm2', materialType: 'raw', quantity: 0.75, unit: 'L' },
      { materialId: 'rm7', materialType: 'raw', quantity: 2, unit: 'g' },
      { materialId: 'rm3', materialType: 'packaging', quantity: 0.4, unit: 'ml' },
      { materialId: 'rm6', materialType: 'raw', quantity: 0.3, unit: 'ml' },
      { materialId: 'pk3', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 1, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 1 / 12, unit: 'ud' },
    ]},
  ],

  customers: [
    { id: 'c1', code: 'C-001', name: 'Distribuciones del Sur', company: 'Distribuciones del Sur S.L.', cif: 'B-41111222', address: 'C/ Asunción 23', city: 'Sevilla', country: 'España', phone: '+34 954 555 111', email: 'pedidos@dissur.es', contact: 'Manuel Sánchez', notes: 'Cliente VIP. Pago a 30 días.', totalPurchases: 48250, createdAt: monthsAgo(18) },
    { id: 'c2', code: 'C-002', name: 'Hiperlimpieza Madrid', company: 'Hiperlimpieza S.A.', cif: 'A-28111222', address: 'Av. Andalucía 89', city: 'Madrid', country: 'España', phone: '+34 911 222 333', email: 'compras@hiperlimpieza.com', contact: 'Cristina Vega', notes: 'Volumen alto', totalPurchases: 92400, createdAt: monthsAgo(15) },
    { id: 'c3', code: 'C-003', name: 'Limpiezas BCN', company: 'Limpiezas BCN S.L.', cif: 'B-08222333', address: 'C/ Mallorca 234', city: 'Barcelona', country: 'España', phone: '+34 932 444 555', email: 'info@limpiezasbcn.es', contact: 'Jordi Roca', notes: '', totalPurchases: 31800, createdAt: monthsAgo(12) },
    { id: 'c4', code: 'C-004', name: 'Hostelería del Levante', company: 'Hostelería Levante S.L.', cif: 'B-46222333', address: 'Av. del Mar 45', city: 'Valencia', country: 'España', phone: '+34 963 555 666', email: 'admin@hosteleva.es', contact: 'Patricia Mora', notes: 'Pedidos semanales', totalPurchases: 24650, createdAt: monthsAgo(10) },
    { id: 'c5', code: 'C-005', name: 'EcoClean Portugal', company: 'EcoClean Lda.', cif: 'PT-501234567', address: 'Rua das Indústrias 12', city: 'Lisboa', country: 'Portugal', phone: '+351 21 555 777', email: 'geral@ecoclean.pt', contact: 'Rui Santos', notes: 'Export UE', totalPurchases: 15800, createdAt: monthsAgo(6) },
    { id: 'c6', code: 'C-006', name: 'Limpiezas Málaga', company: 'Limpiezas Costa del Sol', cif: 'B-29222333', address: 'C/ Larios 78', city: 'Málaga', country: 'España', phone: '+34 952 666 777', email: 'contacto@limmalaga.es', contact: 'Sara Díaz', notes: '', totalPurchases: 9200, createdAt: monthsAgo(3) },
  ],

  orders: [
    { id: 'o1', number: 'PED-2025-0142', customerId: 'c1', items: [{ productId: 'pr1', quantity: 200, unitPrice: 3.95, discount: 5 }], subtotal: 790, tax: 165.90, discount: 39.50, total: 916.40, status: 'entregado', createdAt: daysAgo(2), deliveryDate: daysAgo(1), createdBy: 'u4' },
    { id: 'o2', number: 'PED-2025-0143', customerId: 'c2', items: [{ productId: 'pr2', quantity: 500, unitPrice: 4.50, discount: 8 }, { productId: 'pr5', quantity: 300, unitPrice: 3.20, discount: 5 }], subtotal: 3210, tax: 674.10, discount: 304.80, total: 3579.30, status: 'preparando', createdAt: daysAgo(1), createdBy: 'u4' },
    { id: 'o3', number: 'PED-2025-0144', customerId: 'c3', items: [{ productId: 'pr3', quantity: 150, unitPrice: 5.20, discount: 0 }], subtotal: 780, tax: 163.80, discount: 0, total: 943.80, status: 'confirmado', createdAt: daysAgo(0), createdBy: 'u4' },
    { id: 'o4', number: 'PED-2025-0145', customerId: 'c4', items: [{ productId: 'pr4', quantity: 80, unitPrice: 7.80, discount: 10 }, { productId: 'pr6', quantity: 120, unitPrice: 4.20, discount: 5 }], subtotal: 1128, tax: 236.88, discount: 138, total: 1226.88, status: 'pendiente', createdAt: daysAgo(0), createdBy: 'u4' },
    { id: 'o5', number: 'PED-2025-0146', customerId: 'c5', items: [{ productId: 'pr1', quantity: 300, unitPrice: 3.95, discount: 12 }], subtotal: 1185, tax: 248.85, discount: 142.20, total: 1291.65, status: 'pendiente', createdAt: daysAgo(0), createdBy: 'u4' },
  ],

  purchases: [
    { id: 'pu1', number: 'C-2025-0089', supplierId: 's1', invoice: 'F-2025/1234', items: [{ materialId: 'rm1', materialType: 'raw', quantity: 1000, unitPrice: 4.50 }], subtotal: 4500, tax: 945, total: 5445, status: 'recibida', date: daysAgo(2) },
    { id: 'pu2', number: 'C-2025-0090', supplierId: 's2', invoice: 'F-2025/5678', items: [{ materialId: 'pk3', materialType: 'packaging', quantity: 5000, unitPrice: 0.34 }], subtotal: 1700, tax: 357, total: 2057, status: 'recibida', date: daysAgo(5) },
    { id: 'pu3', number: 'C-2025-0091', supplierId: 's3', invoice: 'F-2025/9012', items: [{ materialId: 'rm4', materialType: 'raw', quantity: 5000, unitPrice: 0.12 }], subtotal: 600, tax: 126, total: 726, status: 'recibida', date: daysAgo(3) },
  ],

  expenses: [
    { id: 'e1', date: daysAgo(1), category: 'electricidad', amount: 1245.50, description: 'Factura luz nave producción', createdBy: 'u5' },
    { id: 'e2', date: daysAgo(2), category: 'agua', amount: 320.00, description: 'Consumo agua industrial', createdBy: 'u5' },
    { id: 'e3', date: daysAgo(3), category: 'gas', amount: 480.30, description: 'Gas natural calefacción', createdBy: 'u5' },
    { id: 'e4', date: daysAgo(5), category: 'internet', amount: 89.90, description: 'Fibra óptica oficina', createdBy: 'u5' },
    { id: 'e5', date: daysAgo(7), category: 'combustible', amount: 215.40, description: 'Gasolina furgoneta reparto', createdBy: 'u5' },
    { id: 'e6', date: daysAgo(10), category: 'alquiler', amount: 3200.00, description: 'Alquiler nave industrial', createdBy: 'u5' },
    { id: 'e7', date: daysAgo(15), category: 'sueldos', amount: 18500.00, description: 'Nóminas mes', createdBy: 'u5' },
    { id: 'e8', date: daysAgo(20), category: 'publicidad', amount: 450.00, description: 'Campaña Google Ads', createdBy: 'u5' },
    { id: 'e9', date: daysAgo(25), category: 'mantenimiento', amount: 380.00, description: 'Revisión maquinaria', createdBy: 'u5' },
    { id: 'e10', date: daysAgo(28), category: 'impuestos', amount: 2150.00, description: 'IVA trimestral', createdBy: 'u5' },
  ],

  lots: [
    { id: 'l1', lotNumber: 'LOT-2025-0842', productionOrderNumber: 'OF-2025-0245', productId: 'pr1', recipeId: 'rc1', quantity: 500, rawMaterialsUsed: [
      { materialId: 'rm1', materialType: 'raw', quantity: 57.69, unit: 'L', rawMaterialLotId: 'rml-1' },
      { materialId: 'rm2', materialType: 'raw', quantity: 307.69, unit: 'L', rawMaterialLotId: 'rml-2' },
      { materialId: 'rm3', materialType: 'raw', quantity: 192.31, unit: 'ml', rawMaterialLotId: 'rml-3' },
      { materialId: 'rm4', materialType: 'raw', quantity: 961.54, unit: 'ml', rawMaterialLotId: 'rml-4' },
      { materialId: 'rm6', materialType: 'raw', quantity: 115.38, unit: 'ml', rawMaterialLotId: 'rml-5' },
      { materialId: 'pk3', materialType: 'packaging', quantity: 500, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 500, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 500, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 41.67, unit: 'ud' },
    ], producedBy: 'u2', machineId: 'm1', producedAt: daysAgo(2), status: 'completado', expiryDate: daysAhead(730) },
    { id: 'l2', lotNumber: 'LOT-2025-0843', productionOrderNumber: 'OF-2025-0246', productId: 'pr2', recipeId: 'rc2', quantity: 800, rawMaterialsUsed: [
      { materialId: 'rm1', materialType: 'raw', quantity: 144, unit: 'L', rawMaterialLotId: 'rml-1' },
      { materialId: 'rm2', materialType: 'raw', quantity: 624, unit: 'L', rawMaterialLotId: 'rml-2' },
      { materialId: 'rm3', materialType: 'raw', quantity: 480, unit: 'ml', rawMaterialLotId: 'rml-3' },
      { materialId: 'rm4', materialType: 'raw', quantity: 2400, unit: 'ml', rawMaterialLotId: 'rml-4' },
      { materialId: 'rm6', materialType: 'raw', quantity: 320, unit: 'ml', rawMaterialLotId: 'rml-5' },
      { materialId: 'pk4', materialType: 'packaging', quantity: 800, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 800, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 800, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 66.67, unit: 'ud' },
    ], producedBy: 'u2', machineId: 'm2', producedAt: daysAgo(1), status: 'completado', expiryDate: daysAhead(730) },
    { id: 'l3', lotNumber: 'LOT-2025-0844', productionOrderNumber: 'OF-2025-0247', productId: 'pr5', recipeId: 'rc5', quantity: 300, rawMaterialsUsed: [
      { materialId: 'rm1', materialType: 'raw', quantity: 7.5, unit: 'L', rawMaterialLotId: 'rml-1' },
      { materialId: 'rm2', materialType: 'raw', quantity: 63, unit: 'L', rawMaterialLotId: 'rml-2' },
      { materialId: 'rm3', materialType: 'raw', quantity: 45, unit: 'ml', rawMaterialLotId: 'rml-3' },
      { materialId: 'rm10', materialType: 'raw', quantity: 4.5, unit: 'L', rawMaterialLotId: 'rml-6' },
      { materialId: 'pk2', materialType: 'packaging', quantity: 300, unit: 'ud' },
      { materialId: 'pk6', materialType: 'packaging', quantity: 300, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 300, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 25, unit: 'ud' },
    ], producedBy: 'u2', machineId: 'm2', producedAt: daysAgo(0), status: 'completado', expiryDate: daysAhead(730) },
    { id: 'l4', lotNumber: 'LOT-2025-0845', productionOrderNumber: 'OF-2025-0248', productId: 'pr6', recipeId: 'rc6', quantity: 400, rawMaterialsUsed: [
      { materialId: 'rm9', materialType: 'raw', quantity: 30.77, unit: 'L', rawMaterialLotId: 'rml-7' },
      { materialId: 'rm1', materialType: 'raw', quantity: 30.77, unit: 'L', rawMaterialLotId: 'rml-1' },
      { materialId: 'rm2', materialType: 'raw', quantity: 230.77, unit: 'L', rawMaterialLotId: 'rml-2' },
      { materialId: 'rm7', materialType: 'raw', quantity: 615.38, unit: 'g', rawMaterialLotId: 'rml-8' },
      { materialId: 'rm3', materialType: 'raw', quantity: 123.08, unit: 'ml', rawMaterialLotId: 'rml-3' },
      { materialId: 'rm6', materialType: 'raw', quantity: 92.31, unit: 'ml', rawMaterialLotId: 'rml-5' },
      { materialId: 'pk3', materialType: 'packaging', quantity: 400, unit: 'ud' },
      { materialId: 'pk5', materialType: 'packaging', quantity: 400, unit: 'ud' },
      { materialId: 'pk7', materialType: 'packaging', quantity: 400, unit: 'ud' },
      { materialId: 'pk8', materialType: 'packaging', quantity: 33.33, unit: 'ud' },
    ], producedBy: 'u2', machineId: 'm1', producedAt: daysAgo(0), status: 'en-proceso' },
    { id: 'l5', lotNumber: 'LOT-2025-0846', productionOrderNumber: 'OF-2025-0249', productId: 'pr3', recipeId: 'rc3', quantity: 250, rawMaterialsUsed: [], producedBy: 'u2', machineId: 'm2', producedAt: daysAgo(7), status: 'completado', expiryDate: daysAhead(540) },
  ],

  // === LOTES DE MATERIAS PRIMAS ===
  rawMaterialLots: [
    { id: 'rml-1', internalLotNumber: 'INT-2025-0001', supplierLotNumber: 'CJ-2025-0842', rawMaterialId: 'rm1', supplierId: 's1', receivedDate: daysAgo(15), manufactureDate: daysAgo(20), expiryDate: daysAhead(165), quantityReceived: 2000, quantityRemaining: 1759.27, unit: 'L', status: 'activo', receivedBy: 'u3', certificates: [
      { id: 'cert-1', name: 'Certificado de Análisis (COA)', type: 'COA', reference: 'COA-CJ-0842', issueDate: daysAgo(20) },
      { id: 'cert-2', name: 'Hoja de Seguridad (MSDS)', type: 'MSDS', reference: 'MSDS-CJ-2025', issueDate: daysAgo(120) },
    ] },
    { id: 'rml-2', internalLotNumber: 'INT-2025-0002', supplierLotNumber: 'AG-2025-0411', rawMaterialId: 'rm2', supplierId: 's1', receivedDate: daysAgo(10), expiryDate: daysAhead(355), quantityReceived: 15000, quantityRemaining: 11774.04, unit: 'L', status: 'activo', receivedBy: 'u3', certificates: [
      { id: 'cert-3', name: 'Certificado de Análisis', type: 'COA', reference: 'COA-AG-0411' },
    ] },
    { id: 'rml-3', internalLotNumber: 'INT-2025-0003', supplierLotNumber: 'AZ-24-1138', rawMaterialId: 'rm3', supplierId: 's4', receivedDate: daysAgo(30), manufactureDate: daysAgo(45), expiryDate: daysAhead(390), quantityReceived: 25000, quantityRemaining: 24158.92, unit: 'ml', status: 'activo', receivedBy: 'u3', certificates: [
      { id: 'cert-4', name: 'COA Colorante Azul', type: 'COA', reference: 'COA-AZ-1138' },
    ] },
    { id: 'rml-4', internalLotNumber: 'INT-2025-0004', supplierLotNumber: 'LM-25-0244', rawMaterialId: 'rm4', supplierId: 's3', receivedDate: daysAgo(7), manufactureDate: daysAgo(15), expiryDate: daysAhead(21), quantityReceived: 12000, quantityRemaining: 8638.46, unit: 'ml', status: 'activo', receivedBy: 'u3', notes: 'Próximo a caducar - priorizar uso', certificates: [
      { id: 'cert-5', name: 'COA Aroma Limón', type: 'COA', reference: 'COA-LM-0244' },
    ] },
    { id: 'rml-5', internalLotNumber: 'INT-2025-0005', supplierLotNumber: 'KT-24-0512', rawMaterialId: 'rm6', supplierId: 's1', receivedDate: daysAgo(20), manufactureDate: daysAgo(40), expiryDate: daysAhead(520), quantityReceived: 8000, quantityRemaining: 7271.31, unit: 'ml', status: 'activo', receivedBy: 'u3', certificates: [
      { id: 'cert-6', name: 'COA Conservante', type: 'COA' },
    ] },
    { id: 'rml-6', internalLotNumber: 'INT-2025-0006', supplierLotNumber: 'TN-24-0712', rawMaterialId: 'rm10', supplierId: 's1', receivedDate: daysAgo(25), expiryDate: daysAhead(275), quantityReceived: 3000, quantityRemaining: 2995.50, unit: 'L', status: 'activo', receivedBy: 'u3' },
    { id: 'rml-7', internalLotNumber: 'INT-2025-0007', supplierLotNumber: 'HC-25-0301', rawMaterialId: 'rm9', supplierId: 's1', receivedDate: daysAgo(8), expiryDate: daysAhead(37), quantityReceived: 4000, quantityRemaining: 3969.23, unit: 'L', status: 'activo', receivedBy: 'u3', certificates: [
      { id: 'cert-7', name: 'COA Hipoclorito', type: 'COA' },
      { id: 'cert-8', name: 'MSDS Hipoclorito', type: 'MSDS' },
    ] },
    { id: 'rml-8', internalLotNumber: 'INT-2025-0008', supplierLotNumber: 'XT-24-0088', rawMaterialId: 'rm7', supplierId: 's1', receivedDate: daysAgo(35), expiryDate: daysAhead(685), quantityReceived: 500, quantityRemaining: 498.85, unit: 'kg', status: 'activo', receivedBy: 'u3' },
    { id: 'rml-9', internalLotNumber: 'INT-2024-0089', supplierLotNumber: 'PN-24-0091', rawMaterialId: 'rm5', supplierId: 's3', receivedDate: daysAgo(120), expiryDate: daysAgo(2), quantityReceived: 5000, quantityRemaining: 5000, unit: 'ml', status: 'caducado', receivedBy: 'u3', blockedReason: 'Caducidad superada' },
  ],

  // === MÁQUINAS ===
  machines: [
    { id: 'm1', code: 'MZC-01', name: 'Mezcladora Central 1', type: 'mezcladora', status: 'operativa', lastMaintenance: daysAgo(45) },
    { id: 'm2', code: 'ENV-01', name: 'Envasadora Industrial 1', type: 'envasadora', status: 'operativa', lastMaintenance: daysAgo(20) },
    { id: 'm3', code: 'ENV-02', name: 'Envasadora Industrial 2', type: 'envasadora', status: 'mantenimiento', lastMaintenance: daysAgo(0) },
    { id: 'm4', code: 'ETQ-01', name: 'Etiquetadora Automática', type: 'etiquetadora', status: 'operativa', lastMaintenance: daysAgo(60) },
    { id: 'm5', code: 'EMP-01', name: 'Empacadora de Cajas', type: 'empacadora', status: 'operativa', lastMaintenance: daysAgo(30) },
    { id: 'm6', code: 'PAL-01', name: 'Paletizadora', type: 'paletizadora', status: 'operativa', lastMaintenance: daysAgo(90) },
  ],

  // === RECALLS (RETIRADAS) ===
  recalls: [],

  notifications: [
    { id: 'n1', type: 'stock-bajo', title: 'Stock bajo', message: 'Botellas PET 750 ml por debajo del mínimo (1.180 / 2.000)', severity: 'critical', read: false, createdAt: daysAgo(0) },
    { id: 'n2', type: 'stock-bajo', title: 'Stock bajo', message: 'Aroma Pino Fresco por debajo del mínimo (450 ml / 1.000 ml)', severity: 'warning', read: false, createdAt: daysAgo(0) },
    { id: 'n3', type: 'caducidad', title: 'Próxima caducidad', message: 'Aroma Limón Natural caduca en 28 días', severity: 'warning', read: false, createdAt: daysAgo(1) },
    { id: 'n4', type: 'stock-bajo', title: 'Stock bajo', message: 'Limpiador Multiusos 750 ml por debajo del mínimo (480 / 500)', severity: 'warning', read: false, createdAt: daysAgo(0) },
    { id: 'n5', type: 'produccion', title: 'Orden de fabricación', message: 'Orden automática generada: fabricar 800 ud de Limpiador Multiusos 750 ml', severity: 'info', read: true, createdAt: daysAgo(0) },
    { id: 'n6', type: 'pedido', title: 'Nuevo pedido', message: 'PED-2025-0144 de Limpiezas BCN por 943,80 €', severity: 'info', read: false, createdAt: daysAgo(0) },
    { id: 'n7', type: 'stock-bajo', title: 'Stock bajo', message: 'Fregasuelos Concentrado 2 L por debajo del mínimo (180 / 200)', severity: 'warning', read: false, createdAt: daysAgo(0) },
  ],

  history: [
    { id: 'h1', userId: 'u2', userName: 'María García', action: 'produccion', module: 'Producción', description: 'Fabricadas 500 ud de Limpiador Multiusos 750 ml — Lote LOT-2025-0842', timestamp: daysAgo(2) },
    { id: 'h2', userId: 'u4', userName: 'Laura Martínez', action: 'crear', module: 'Pedidos', description: 'Creado pedido PED-2025-0146 para EcoClean Portugal', timestamp: daysAgo(0) },
    { id: 'h3', userId: 'u3', userName: 'Javier López', action: 'modificar', module: 'Almacén', description: 'Entrada de 1.000 ud de Botella PET 750 ml — Factura F-2025/5678', timestamp: daysAgo(5) },
    { id: 'h4', userId: 'u1', userName: 'Carlos Rodríguez', action: 'modificar', module: 'Configuración', description: 'Modificado IVA por defecto a 21%', timestamp: daysAgo(7) },
    { id: 'h5', userId: 'u2', userName: 'María García', action: 'produccion', module: 'Producción', description: 'Fabricadas 800 ud de Limpiador Multiusos 1 L — Lote LOT-2025-0843', timestamp: daysAgo(1) },
    { id: 'h6', userId: 'u5', userName: 'Antonio Sánchez', action: 'crear', module: 'Gastos', description: 'Registrado gasto de electricidad: 1.245,50 €', timestamp: daysAgo(1) },
  ],
}
