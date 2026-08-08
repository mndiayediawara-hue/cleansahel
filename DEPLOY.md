# 🚀 Guía de despliegue en Render.com

Tiempo total: **10 minutos**. Coste: **7€/mes** (plan Starter) o **gratis** para pruebas.

## 1️⃣ Crear cuenta en GitHub (2 min)

1. Ve a https://github.com y crea cuenta gratis
2. Verifica tu email

## 2️⃣ Subir el código (3 min)

Opción A — desde la web (fácil):
1. Crea un repositorio nuevo: https://github.com/new
   - Nombre: `cleanerp`
   - Privado (recomendado)
   - **No marques** "Add README"
2. Sube la carpeta del proyecto: arrastra todos los archivos a la web

Opción B — con git (si lo tienes instalado):
```bash
cd cleanerp
git init
git add .
git commit -m "CleanERP inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cleanerp.git
git push -u origin main
```

## 3️⃣ Crear cuenta en Render (2 min)

1. Ve a https://render.com y regístrate con tu GitHub
2. Autoriza a Render a ver tus repositorios

## 4️⃣ Desplegar con 1 click (3 min)

1. En Render, click **"New +"** → **"Blueprint"**
2. Selecciona el repo `cleanerp`
3. Render detecta `render.yaml` automáticamente
4. Click **"Apply"**
5. Espera 3-5 minutos mientras compila

¡Listo! Tu app estará en `https://cleanerp.onrender.com`

## 5️⃣ (Opcional) Dominio propio

Si quieres `erp.tufabrica.com`:
1. Compra el dominio donde prefieras (Namecheap, OVH, etc. ~10€/año)
2. En Render: Settings → Custom Domain → añade `erp.tufabrica.com`
3. En tu proveedor de dominio: configura CNAME apuntando a Render

## ⚠️ Importante

- **El plan Free de Render se duerme** si no hay tráfico (tarda 30s en despertar). Para uso en fábrica, plan Starter 7$/mes
- **Los datos se guardan en disco** persistente (1GB incluido)
- **HTTPS viene gratis** con Let's Encrypt
- **Copia de seguridad**: los datos están en el disco, considera descargar un backup periódicamente

## 🔑 Primer acceso

Una vez desplegado:
- Usuario: `admin`
- Contraseña: `admin123`

**Cámbiala inmediatamente** desde Configuración → Usuarios.

## 🆘 Problemas comunes

**"Build failed"** → Revisa los logs en Render. Suele ser dependencias.

**"Cannot find module"** → Asegúrate de que `package.json` tiene todas las dependencias.

**"Port already in use"** → Render asigna el puerto por la variable `PORT`. El backend ya la usa.

**Los datos no se guardan** → Verifica que el disco está montado en `/opt/render/project/src/data` (el `render.yaml` ya lo configura).

## 💬 ¿Necesitas ayuda?

Si te atascas en algún paso, dime exactamente qué error te aparece y te lo resuelvo.
