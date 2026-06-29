# SAJAMA 4x4 — Sistema de Inventario

Sistema web completo de gestión de inventario con roles, módulos bilingüe (ES/ZH) y sincronización en Firebase.

---

## 🗂️ Estructura del proyecto

```
sajama-inventario/
├── frontend/               # Aplicación React (Vite + Tailwind)
│   ├── src/
│   │   ├── pages/          # Módulos principales (Inventario, Ingresos, Salidas…)
│   │   ├── components/     # UI reutilizable + Layout
│   │   ├── services/       # Conexión con Firebase (Firestore)
│   │   ├── context/        # AuthContext (sesión + roles)
│   │   ├── i18n/           # Traducciones ES / ZH
│   │   └── utils/          # Exportar Excel/PDF
│   └── .env.local          # Variables de Firebase (producción)
├── firebase/
│   ├── firebase.json       # Config emuladores + hosting
│   ├── firestore.rules     # Reglas de seguridad
│   ├── firestore.indexes.json
│   ├── storage.rules
│   └── seed.js             # Datos iniciales (ítems + usuario admin)
└── package.json            # Scripts raíz
```

---

## 🚀 Primeros pasos (LOCAL)

### 1. Clonar / copiar el proyecto

Copia la carpeta `sajama-inventario` a `C:\proyectos\sajama-inventario`

### 2. Instalar dependencias

Abre PowerShell en la carpeta del proyecto:

```powershell
cd C:\proyectos\sajama-inventario
npm install
cd frontend
npm install
cd ..
```

### 3. Iniciar los emuladores de Firebase

```powershell
cd firebase
firebase emulators:start --project sajama-inventario
```

> Deja esta ventana abierta. Los emuladores corren en:
> - Firestore:   http://localhost:8080
> - Auth:        http://localhost:9099
> - Storage:     http://localhost:9199
> - UI Emulator: http://localhost:4000  ← puedes ver los datos aquí

### 4. Cargar datos iniciales (solo la primera vez)

Abre OTRA ventana de PowerShell:

```powershell
cd C:\proyectos\sajama-inventario/firebase
node seed.js
```

Esto crea:
- ✅ 15 ítems de inventario (basados en el Excel real)
- ✅ Usuario administrador: `admin@sajama.com` / `admin123`

### 5. Iniciar el frontend

```powershell
cd C:\proyectos\sajama-inventario\frontend
npm run dev
```

Abre **http://localhost:3000** en tu navegador.

---

## 🔑 Credenciales de prueba (emulador local)

| Email                  | Contraseña | Rol           |
|------------------------|-----------|---------------|
| admin@sajama.com       | admin123  | Administrador |

El administrador puede crear más usuarios desde el módulo **Usuarios**.

---

## 📦 Módulos disponibles

| Módulo         | Ruta              | Descripción                                      |
|----------------|-------------------|--------------------------------------------------|
| Inventario     | `/inventario`     | Catálogo completo con stock en tiempo real       |
| Ingresos       | `/ingresos`       | Registro de entradas (importación/compra/devolución) |
| Salidas        | `/salidas`        | Solicitudes con flujo de aprobación              |
| Consultas      | `/consultas`      | Búsqueda rápida por código o descripción         |
| Orden Salida   | `/orden-salida`   | PDF bilingüe ES/ZH para salidas                  |
| Orden Entrada  | `/orden-entrada`  | PDF de recepción de mercadería                   |
| Lista Maestra  | `/lista`          | Autorizaciones, categorías y destinos            |
| Reportes       | `/reportes`       | Dashboard con gráficos y exportación Excel       |
| Usuarios       | `/usuarios`       | Gestión de usuarios y roles                      |

---

## 👥 Roles del sistema

| Rol            | Acceso                                                      |
|----------------|-------------------------------------------------------------|
| administrador  | Todo                                                        |
| gerencia       | Inventario, Salidas (aprobar), Consultas, Reportes          |
| almacenero     | Inventario, Ingresos, Salidas, Consultas, Órdenes, Lista    |
| ventas         | Consultas, Salidas (solicitar), Reportes                    |
| taller         | Consultas, Salidas (solicitar)                              |
| personalChino  | Consultas, Reportes (interfaz en chino 中文)                |
| contabilidad   | Consultas, Reportes                                         |

---

## ☁️ Subir a producción (Firebase real)

### 1. Crear proyecto en Firebase Console
- Ve a https://firebase.google.com → Nuevo proyecto → `sajama-inventario`
- Activa: Authentication (Email/Password), Firestore, Storage, Hosting

### 2. Obtener credenciales
- Configuración del proyecto → Agregar app Web → Copiar el objeto `firebaseConfig`

### 3. Actualizar `.env.local`
```
VITE_FIREBASE_API_KEY=tu-api-key-real
VITE_FIREBASE_AUTH_DOMAIN=sajama-inventario.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sajama-inventario
VITE_FIREBASE_STORAGE_BUCKET=sajama-inventario.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
```

### 4. Deploy
```powershell
cd frontend
npm run build
cd ../firebase
firebase deploy --project sajama-inventario
```

¡Listo! Tu sistema estará en `https://sajama-inventario.web.app`

---

## 🛠️ Comandos útiles

```powershell
# Ver datos en el emulador (UI visual)
# Abre http://localhost:4000

# Resetear datos del emulador
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data

# Exportar datos del emulador para compartir
firebase emulators:export ./emulator-data
```