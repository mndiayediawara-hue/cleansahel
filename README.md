# CleanERP — Gestión Industrial

ERP profesional para fábricas de productos de limpieza. **22 módulos completos**, base de datos real (SQLite), API REST, autenticación JWT y diseño moderno con modo claro/oscuro.

## 🏗️ Stack

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + Recharts + Lucide
- **Backend:** Node.js + Express + better-sqlite3 + JWT + bcrypt
- **Base de datos:** SQLite (archivo en `data/cleanerp.db`)
- **Despliegue:** un único proceso Node sirve API + frontend estático

## 🚀 Inicio rápido

```bash
npm install
npm run build         # Construye el frontend
npm start             # Inicia el servidor (puerto 3001)
```

Abre `http://localhost:3001` en el navegador.

## 🔐 Credenciales de prueba

| Usuario        | Contraseña         | Rol           |
|----------------|--------------------|---------------|
| `admin`        | `admin123`         | Administrador (acceso total) |
| `produccion`   | `produccion123`    | Producción (fabricar, recetas) |
| `almacen`      | `almacen123`       | Almacén (entradas, materiales) |
| `comercial`    | `comercial123`     | Comercial (clientes, pedidos) |
| `contabilidad` | `contabilidad123`  | Contabilidad (gastos, compras) |

## 📦 Módulos implementados

1. **Dashboard** — tiempo real, gráficos, ventas/gastos/producción/inventario
2. **Materias Primas** — concentrado, agua, colorantes, aromas, etc.
3. **Embalaje** — botellas, tapones, etiquetas, cajas, palets
4. **Recetas** — fórmulas con cálculo automático de consumo
5. **Producción** — fabricación con descuento automático de stock + lote
6. **Productos** — catálogo con margen y stock
7. **Clientes** — base de datos completa con historial
8. **Pedidos** — con descuento automático de stock al confirmar
9. **Compras** — registro con actualización de inventario
10. **Gastos** — 11 categorías, análisis por tipo
11. **Ventas** — análisis con gráficos y top productos/clientes
12. **Lotes** — trazabilidad completa
13. **Informes** — PDF, CSV (inventory, production, sales, expenses, consumption, profit)
14. **Usuarios y permisos** — 5 roles con permisos granulares
15. **Historial** — log inmutable de todos los movimientos
16. **Configuración** — empresa, IVA, moneda, seguridad
17. **Copias de seguridad** — backup/restore completo en JSON
18. **Alertas** — stock bajo, caducidades, producción
19. **Búsqueda global** — clientes, productos, pedidos, lotes
20. **Escáner** — códigos de barras/QR (cámara o manual)
21. **Login seguro** — JWT + bcrypt + bloqueo por intentos
22. **Diseño responsive** — modo claro/oscuro, mobile-first

## 🔌 API REST

Base: `/api`

- `POST /auth/login` — autenticación
- `GET/POST/PUT/DELETE /raw-materials` — CRUD
- `POST /raw-materials/:id/entry` — entrada de stock
- `GET/POST/PUT/DELETE /packaging`
- `POST /packaging/:id/entry` — entrada de stock
- `GET/POST/PUT/DELETE /products`
- `GET/POST/PUT/DELETE /recipes`
- `POST /produce` — fabricar producto
- `GET/POST/PUT/DELETE /customers`
- `GET/POST/PUT/DELETE /orders`
- `GET/POST/PUT/DELETE /purchases`
- `GET/POST/PUT/DELETE /expenses`
- `GET/POST/PUT/DELETE /lots`
- `GET /notifications` + `POST /notifications/:id/read`
- `GET /history`
- `GET /dashboard` — stats agregadas
- `GET /reports/{inventory|production|sales|expenses|consumption}`
- `GET /search?q=...`
- `GET /barcode/:code`
- `GET /backup` — backup completo
- `POST /restore` — restaurar backup

## 📂 Estructura

```
/workspace
├── server/
│   ├── db.js          # SQLite schema + connection
│   ├── seed.js        # Datos iniciales
│   ├── routes.js      # API REST completa
│   └── index.js       # Express + static
├── src/
│   ├── components/    # UI components
│   ├── contexts/      # Auth, Data, Theme
│   ├── pages/         # 20 páginas
│   ├── lib/           # api client, utils
│   ├── types/         # TypeScript types
│   └── App.tsx
├── data/
│   └── cleanerp.db    # SQLite database
├── dist/              # Built frontend
└── package.json
```

## 🔒 Seguridad

- Contraseñas cifradas con **bcrypt** (10 rounds)
- **JWT** con expiración de 8h
- **Bloqueo automático** tras N intentos fallidos (configurable)
- **Roles y permisos** granulares
- **Auditoría completa** — todo movimiento queda registrado con usuario, fecha, antes/después
- Confirmación obligatoria antes de borrar

## 💾 Backups

- **Automático** cada N horas (configurable)
- **Manual** desde Configuración → Copias de seguridad
- **Restauración** desde archivo JSON
