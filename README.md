# SAJAMA 4x4 — Sistema de Inventario y Control Operativo

Sistema web integral de gestión de inventario, maquinaria pesada, equipos industriales, trámites aduaneros, abastecimiento de combustibles y kardex contable. Cuenta con soporte bilingüe (**Español / 中文 - Chino**), control de acceso por roles (RBAC) y sincronización en tiempo real sobre la plataforma **Firebase**.

---

## 🚀 Módulos y Funcionalidades del Sistema

### 1. 📦 Inventario General (`/inventario`)
- Catálogo de repuestos e insumos con control de stock en tiempo real.
- **Traducción automática al Chino (ES ↔ 中文)** para descripciones de repuestos.
- Alertas visuales por stock mínimo y stock agotado.
- Subida de imágenes del producto y especificaciones de modelo / N° de serie.
- Historial completo de movimientos por cada producto.

### 2. 📥 Ingresos y Recepción (`/ingresos`)
- Registro de entradas por compras locales, importaciones o devoluciones.
- Incremento automático en el stock del inventario.
- Generación e impresión de la **Orden de Entrada de Mercadería (PDF)**.

### 3. 📤 Salidas y Despachos (`/salidas`)
- Solicitudes de salida de almacén vinculadas a un responsable, máquina o destino.
- Flujo de aprobación (*Aprobado*, *Pendiente*, *Rechazado*).
- Descuento automático del stock disponible.
- Generación de **Orden de Salida de Mercadería bilingüe (ES/ZH)** para impresión.

### 4. 🚛 Maquinaria Pesada (`/maquinaria`)
- Control de maquinaria (Volquetas, Excavadoras, Palas, Retroexcavadoras, etc.).
- Gestión de estado: *A la venta*, *En operación*, *En mantenimiento*, *Vendido*, *Despachado*, *Entregado*, *Existente*.
- Carga de fotos de la máquina y fotos de serie / placa.
- **Póliza PDF**: Adjunto de documento de Póliza en formato PDF + N° de Póliza.
- **Formulario de Transporte**: Generación e impresión de la guía de transporte para unidades seleccionadas.
- **Planilla de Control (A4 Horizontal)**: Impresión de planillas **exclusivamente de las máquinas tikeadas / seleccionadas**.

### 5. 🦺 Módulo de Equipos (`/equipos`)
- Control de equipos pesados e industriales con fotos, serie, modelo y precio.
- Adjunto de **Póliza PDF** y gestión de número de póliza.
- Navegación por pestañas (*A la venta*, *Vendidos/Entregados/Existentes*, *Todos*).
- **Planilla de Control (A4 Horizontal)**: Impresión de planillas **exclusivamente de los equipos tikeados / seleccionados**.

### 6. 🛢️ Abastecimiento y Despacho de Combustibles (`/abastecimiento`)
- Control de volumen para **Gasolina** y **Diésel**.
- **Entradas / Compras**: Registro de compras indicando responsable, volumen en litros (L), precio unitario, precio total, proveedor y observaciones.
- **Salidas / Despachos**: Registro de cargas indicando combustible, volumen (L), Placa / Chasis, N° Móvil, precio unitario, precio total, destino y receptor.
- **Saldos en Tiempo Real**: Cálculo automatizado acumulando compras y descontando despachos.
- **Impresión de Planillas y Vales**:
  - Planilla General de Compras / Entradas de Combustible (A4 Horizontal).
  - Planilla General de Despachos / Salidas (A4 Horizontal).
  - **Vale de Despacho Individual**: Comprobante de carga con firmas de quien entrega y quien recibe.

### 7. 🛃 Módulo de Aduana (`/aduana`)
- Gestión de trámites de importación.
- Almacenamiento seguro de documentos PDF adjuntos para:
  - **BL** (Bill of Lading / Conocimiento de Embarque)
  - **Factura Comercial**
  - **Lista de empaque** (Packing List)
  - **DIM** (Declaración de Importación de Mercancías)
- Apertura directa de PDFs adjuntos en el navegador.

### 8. 📊 Kardex Contable (`/kardex`)
- Kardex financiero y valoración contable de inventarios.
- Registro de movimientos, cierres mensuales y conciliaciones de saldo.

### 9. 📂 Importar Excel (`/importar`)
- Carga masiva de ítems de inventario desde archivos Excel (`.xlsx` / `.xls`).
- Mapeo inteligente de columnas y detección de errores de datos.

### 10. 🔍 Consultas Rápidas (`/consultas`)
- Buscador optimizado para personal de almacén / taller por código, descripción (ES/ZH), serie o modelo.

### 11. 📋 Lista Maestra (`/lista`)
- Configuración de listas de destinos, proyectos, categorías y autorizadores.

### 12. 📈 Reportes y Analytics (`/reportes`)
- Dashboard interactivo con métricas clave de consumo, gráficos de rotación y exportación de datos a Excel.

### 13. 🛡️ Auditoría del Sistema (`/auditoria`)
- Registro inmutable de actividad (creaciones, modificaciones, eliminaciones) especificando usuario, rol, módulo, fecha y detalle exacto de la acción.

### 14. 👥 Gestión de Usuarios y Permisos (`/usuarios`)
- Administración de usuarios, contraseñas y estado de acceso (*Activo / Inactivo*).
- **Matriz Granular de Permisos (RBAC)**: Configuración de permisos por módulo (Ver, Crear, Editar, Eliminar).
- Permisos personalizados individuales por usuario.

---

## 👥 Matriz de Roles del Sistema

| Rol | Descripción de Permisos y Accesos |
|---|---|
| **`administrador`** | Control total sobre todos los módulos del sistema, usuarios, reglas de seguridad y eliminación de registros. |
| **`gerencia`** | Acceso ejecutivo a Inventario, Salidas (Aprobación), Maquinaria, Equipos, Abastecimiento, Aduana y Reportes. |
| **`almacenero`** | Control operativo de Inventario, Ingresos, Salidas, Maquinaria, Equipos y Abastecimiento de combustibles. |
| **`aduanas`** | Permisos completos sobre el módulo de **Aduana** (creación, edición y eliminación de trámites con BL, Factura, Lista de empaque y DIM), más lectura de inventario, maquinaria y equipos. |
| **`contabilidad`** | Acceso a Kardex Contable, inventario, reportes financieros y costos de abastecimiento. |
| **`ventas`** | Consultas de stock, maquinaria/equipos a la venta y solicitudes de salida. |
| **`taller`** | Consultas de repuestos, solicitudes de salida para mantenimiento y registro de abastecimiento. |
| **`personalChino`** | Interfaz adaptada en Chino (**中文**) para consulta de inventario, reportes y listas maestras. |

---

## 🗂️ Estructura del Proyecto

```text
sajama-inventario/
├── frontend/               # Aplicación Single Page (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── pages/          # Vistas (Inventario, Maquinaria, Equipos, Aduana, Abastecimiento, Kardex...)
│   │   ├── components/     # UI Reutilizable, Modales, Tablas, Layout, Bar de Navegación
│   │   ├── context/        # AuthContext (Sesión de Firebase Auth y permisos)
│   │   ├── services/       # Conexión Firebase Firestore, Storage y Auditoría
│   │   ├── utils/          # Exportadores Excel / Generación de PDFs
│   │   └── i18n/           # Traducciones Español / 中文
│   └── .env.local          # Variables de entorno Firebase en producción
├── firebase/
│   ├── firebase.json       # Configuración de Hosting y Emuladores
│   ├── firestore.rules     # Reglas de seguridad de Firestore Database
│   ├── storage.rules       # Reglas de seguridad de Firebase Storage
│   └── seed.js             # Script de inicialización de datos de prueba
└── package.json            # Configuración raíz de scripts
```

---

## 🚀 Instalación y Ejecución Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/cramosarismendi-prog/sajama-inventario.git
cd sajama-inventario
```

### 2. Instalar dependencias
```bash
cd frontend
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `frontend/.env.local` con la configuración de tu proyecto en Firebase:
```env
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=sajama-inventario-b5b17.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sajama-inventario-b5b17
VITE_FIREBASE_STORAGE_BUCKET=sajama-inventario-b5b17.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
VITE_USE_EMULATOR=false
```

### 4. Iniciar servidor de desarrollo
```bash
npm run dev
```
Abre en tu navegador: **http://localhost:3000**

---

## ☁️ Despliegue a Producción (Firebase Hosting)

Para desplegar cambios a producción en Firebase:

```bash
# 1. Compilar la aplicación React
cd frontend
npm run build

# 2. Publicar Hosting y Reglas en Firebase
cd ..
npx -y firebase-tools@latest deploy --only hosting,firestore:rules,storage --project sajama-inventario-b5b17
```

📌 **URL en Producción**: [https://sajama-inventario-b5b17.web.app](https://sajama-inventario-b5b17.web.app)

---

## 📄 Licencia
Este proyecto es propiedad privada de **SAJAMA S.R.L.** — Todos los derechos reservados.