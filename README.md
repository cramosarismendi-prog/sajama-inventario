# SAJAMA 4x4 — Sistema de Inventario y Control Operativo

Sistema web integral de nivel empresarial para la gestión de inventario, maquinaria pesada, equipos industriales, trámites aduaneros, despacho de combustibles, kardex contable e importaciones. Desarrollado con **React (Vite)**, **Tailwind CSS** y **Firebase** (Firestore, Storage, Authentication y Hosting), con arquitectura reactiva bilingüe en tiempo real (**Español ↔ 简体中文 - Chino Simplificado**), seguridad reforzada con **MFA / 2FA (TOTP)** y control de acceso basado en roles granular (**RBAC**).

🌐 **URL de Producción**: [https://sajama-inventario-b5b17.web.app](https://sajama-inventario-b5b17.web.app)

---

## 🌟 Novedades y Últimas Actualizaciones

- 🌐 **Internacionalización Dinámica 100% Bilingüe (Español ↔ Chino Simplificado)**:
  - Selector global e instantáneo `🌐 ES ↔ 中文` en la barra lateral sin recarga de página ni pérdida de datos en formularios.
  - Sincronización automática y persistencia de preferencia en `localStorage` (`app_lang`).
  - Cobertura completa en los 17 módulos, modales, alertas, comprobantes imprimibles, estados técnicos, categorías y matriz de permisos.
- 🔐 **Autenticación en Dos Pasos (2FA / MFA con TOTP)**:
  - Desafío y enrolamiento obligatorio/opcional para roles administrativos con Google Authenticator, Microsoft Authenticator o Authy.
  - Códigos QR dinámicos, llaves secretas seguras y verificación criptográfica de tokens temporales de 6 dígitos.
- 💵 **Cotizador y Banner de Tipo de Cambio en Tiempo Real**:
  - Banner ticker superior con cotizaciones activas (USD, BOB, CNY).
  - Modal de ajuste de tasas de cambio con registro de última actualización y usuario responsable.
- 🔍 **Búsqueda Avanzada y Detección de Series en Inventario**:
  - Búsqueda predictiva multi-criterio por código, descripción, modelo y **número de serie**.
  - **Detección y Resaltado Automático de Números de Serie Duplicados** para prevenir inconsistencias en almacén.
  - Optimización de scroll con virtualización de filas para catálogos masivos.
- ⚡ **Autocompletado Inteligente en Orden de Salida**:
  - Llenado automático de datos (código, nombre, categoría, unidad) al ingresar el **Número de Serie** o el **Modelo**.
  - Filtro predictivo interactivo por **Nombre de Producto**.
  - Escáner QR integrado para cámara web / móvil.
- 🔄 **Sincronización Atómica de Devoluciones (Stock y Salidas)**:
  - Al ingresar devoluciones (en *Ingresos* o *Orden de Entrada*), el sistema incrementa el `stock` y descuenta automáticamente las `totalSalidas`.
  - Recálculo atómico e histórico sincronizado con el módulo de *Consultas*.
- 🚜 **Agrupamiento Dinámico en Módulo de Equipos**:
  - Selector entre vista plana tradicional y **Vista Agrupada por Tipo / Subtipo** con contadores y métricas resumidas por categoría.
- 🔎 **Visor de Fotos en Alta Resolución con Zoom**:
  - Modal especializado para inspección minuciosa de placas, seriales y fotografías de maquinaria y equipos.
- 📊 **Kardex Contable en 4 Capas**:
  - Capa 1: Catálogo Valorado.
  - Capa 2: Kardex Físico-Valorado (Entradas, Salidas, Saldos ponderados).
  - Capa 3: Cierres Mensuales y Bloqueo de Periodos Contables.
  - Capa 4: Auditoría de Diferencias e Inconsistencias de Valuación.
- 🛡️ **Auditoría Avanzada con Comparador Antes/Después**:
  - Registro inmutable de trazabilidad con visualizador interactivo de diferencias de atributos modificados (con etiquetas bilingües legibles).
  - Respaldo semanal automático con visualizador de backups.
- 🗑️ **Herramienta de Purga Masiva y Edición Atómica (Super Admin)**:
  - Posibilidad de editar órdenes desde *Consultas* con ajuste automático de stock en inventario.
  - Modal de depuración masiva de órdenes en rango de fechas con doble confirmación de seguridad.

---

## 🚀 Módulos y Funcionalidades del Sistema

### 1. 📦 Inventario General (`/inventario`)
- Catálogo de repuestos, herramientas e insumos con control de stock disponible y salidas acumuladas en tiempo real.
- **Buscador predictivo por Número de Serie**, modelo, código de barras y descripción.
- **Resaltado visual de Números de Serie Duplicados** para prevenir redundancias.
- Visualización de imágenes en miniatura con opción de zoom a pantalla completa.
- Alertas dinámicas por stock mínimo y stock agotado.
- Exportación directa de inventario filtrado a formato Excel (`.xlsx`).

### 2. 📤 Orden de Salida y Despachos (`/orden-salida` y `/salidas`)
- **Autocompletado predictivo**: Al ingresar el número de serie o modelo, el formulario completa automáticamente los campos del repuesto.
- **Búsqueda interactiva por Nombre**: Filtro desplegable para seleccionar productos rápidamente mientras se escribe.
- **Lector de Código QR**: Detección rápida mediante la cámara del dispositivo.
- Asignación de responsable receptor, máquina destino, centro de costos y proyecto.
- Descuento atómico del stock disponible y aumento de la columna de salidas.
- Generación de **Vales de Salida para Impresión** con formato bilingüe oficial (Español / 中文).

### 3. 📥 Orden de Entrada e Ingresos (`/orden-entrada` y `/ingresos`)
- Registro de recepciones por compras locales, importaciones o **Devoluciones**.
- Actualización atómica de existencias (las devoluciones reingresan al stock y reducen el total de salidas acumuladas).
- Compatibilidad con escáner QR.
- Impresión de **Orden de Entrada de Mercadería (PDF)**.

### 4. 🚛 Maquinaria Pesada (`/maquinaria`)
- Control de maquinaria pesada: Volquetas, Excavadoras, Palas, Retroexcavadoras, etc.
- Gestión de estados operativos bilingües: *Operativo*, *En Mantenimiento*, *Fuera de Servicio*, *Vendido*, *Despachado*.
- Registro de horómetros, kilometrajes, ubicación y proyecto asignado.
- Carga de fotos de la unidad, placa y número de serie con visor zoom.
- Documento de **Póliza de Importación (PDF)** adjunto con apertura directa.
- **Planilla de Control (A4 Horizontal)**: Impresión selectiva de las máquinas tildadas en pantalla.
- **Formulario de Transporte**: Guía de transporte de maquinaria para movilización entre campamentos.

### 5. 🦺 Módulo de Equipos (`/equipos`)
- Control de equipos livianos, herramientas mayores y generadores industriales.
- **Vista Agrupada por Tipo y Subtipo**: Navegación por tarjetas colapsables con totales acumulados y estado de cada grupo.
- Vista tabular con filtros por estado (*A la venta*, *Vendidos/Entregados*, *Todos*).
- Carga de fotos, números de serie, marcas, modelos y pólizas PDF.
- Impresión de planillas de control para equipos seleccionados.

### 6. 🛢️ Abastecimiento y Despacho de Combustibles (`/abastecimiento`)
- Control de volumen para **Gasolina** y **Diésel** en tanques y cisternas.
- **Compras / Ingresos**: Registro con volumen en litros, precio unitario, precio total, proveedor y factura.
- **Despachos / Salidas**: Registro indicando combustible, volumen (L), placa/chasis, número móvil, odómetro, destino y chofer receptor.
- Cálculo automatizado de saldos en tiempo real.
- Impresión de:
  - Planilla General de Compras de Combustible (A4 Horizontal).
  - Planilla General de Despachos (A4 Horizontal).
  - **Vale de Despacho Individual** con firmas de entrega y recepción.

### 7. 🛃 Módulo de Aduana (`/aduana`)
- Seguimiento integral de trámites y pólizas de importación.
- Almacenamiento y consulta directa de expedientes PDF:
  - **BL** (Bill of Lading / Conocimiento de Embarque)
  - **Factura Comercial**
  - **Lista de Empaque** (Packing List)
  - **DIM** (Declaración de Importación de Mercancías)
- Búsqueda por número de trámite, importador y estado aduanero.

### 8. 📊 Kardex Contable (`/kardex`)
- Sistema de valuación de inventario con método del costo promedio ponderado.
- Cuatro capas especializadas:
  1. **Catálogo Valorado**: Costo unitario, valor total de inventario y estado contable.
  2. **Kardex Físico-Valorado**: Registro cronológico de ingresos, salidas y saldos monetarios.
  3. **Cierres Mensuales**: Bloqueo y cierre definitivo de periodos contables para evitar modificaciones retroactivas.
  4. **Auditoría de Inconsistencias**: Detección de discrepancias de cálculo y saldos negativos.

### 9. 🔍 Consultas Rápidas (`/consultas`)
- Buscador centralizado para almacén y talleres.
- Consulta de fichas técnicas de ítems, historial de salidas e historial de entradas.
- **Edición y Reversión Atómica**: Los administradores pueden corregir o anular órdenes previas reajustando automáticamente el stock en inventario.
- **Purga de Órdenes en Rango (Super Admin)**: Herramienta de depuración por fechas para mantenimiento y auditoría anual.

### 10. 📂 Importación Masiva desde Excel (`/importar`)
- Carga de inventario masivo desde archivos `.xlsx` y `.xls`.
- Mapeo inteligente y bilingüe de nombres de columnas (Español y Chino).
- Previsualización previa a la inserción y validación de tipos de datos.

### 11. 📋 Lista Maestra (`/lista`)
- Parámetros del sistema: centros de costo, proyectos, destinos de salida, orígenes de entrada y personal autorizado para firmas.

### 12. 📈 Reportes y Analytics (`/reportes`)
- Dashboard con métricas ejecutivas en tiempo real.
- Gráficos interactivos de rotación de repuestos, consumo de combustibles y despachos mensuales.
- Exportación completa a hojas de cálculo Excel.

### 13. 🛡️ Auditoría del Sistema (`/auditoria`)
- Registro inmutable de cada acción (creación, edición, borrado, purga) con usuario, fecha, IP y módulo.
- **Visualizador Comparativo**: Vista amigable de cambios "Antes vs. Después" con traducción bilingüe de los campos modificados.
- **Respaldos Semanales**: Visualización y gestión de copias de seguridad de las colecciones de Firestore.

### 14. 👥 Usuarios, Roles y Matriz RBAC (`/usuarios`)
- Gestión de usuarios y contraseñas con Firebase Auth.
- **Matriz de Permisos Granular**: Configuración por rol y por usuario individual de permisos de Lectura, Creación, Modificación, Eliminación y Purga sobre cada módulo.
- **Purga de Sesiones**: Función para cerrar forzosamente sesiones concurrentes en casos de cambio de contraseña o revocación de acceso.

---

## 👥 Matriz de Roles del Sistema

| Rol | Descripción y Alcance de Accesos |
|---|---|
| **`super_admin`** | Acceso irrestricto absoluto. Configuración de 2FA, purga de órdenes en rango, reseteo de sesiones activas, eliminación definitiva y auditoría global. |
| **`administrador`** | Control operativo total sobre inventario, maquinaria, equipos, combustibles, kardex contable, compras, aduanas y gestión de usuarios. |
| **`gerencia`** | Acceso ejecutivo de consulta y aprobación: Inventario, Aprobación de Salidas, Maquinaria, Equipos, Abastecimiento, Aduana, Kardex y Reportes. |
| **`almacenero`** | Control operativo de almacén: Inventario, registro de Órdenes de Entrada y Salida, gestión de Maquinaria y Equipos, despacho de combustible. |
| **`aduanas`** | Gestión exclusiva del módulo de **Aduana** (subida y revisión de BL, Facturas, Packing List y DIM), más lectura de inventario y maquinaria. |
| **`contabilidad`** | Acceso especializado a **Kardex Contable**, cierres de periodo, valoración de existencias, costos de combustibles y reportes financieros. |
| **`ventas`** | Consulta de existencias, catálogo de maquinaria y equipos a la venta, generación de solicitudes de despacho. |
| **`taller`** | Solicitud de repuestos para mantenimiento mecánico y registro de consumo de combustibles por móvil/placa. |
| **`personalChino`** | Interfaz optimizada de lectura en Chino Simplificado (**中文**) para consulta técnica de catálogo, maquinaria y reportes. |

---

## 🏗️ Arquitectura Técnica

```text
sajama-inventario/
├── frontend/                   # Aplicación Web React (Single Page Application)
│   ├── src/
│   │   ├── pages/              # Módulos principales (Inventario, Salidas, Kardex, etc.)
│   │   ├── components/         # Componentes UI reutilizables
│   │   │   ├── layout/         # MainLayout, Sidebar (con toggle ES ↔ 中文)
│   │   │   ├── modules/        # Formularios especializados (FormItem, FormAduana...)
│   │   │   └── ui/             # Modales, BannerTipoCambio, MfaEnrollment, ModalVerFotoZoom...
│   │   ├── context/            # AuthContext (Sesión de Firebase, estado 2FA y permisos RBAC)
│   │   ├── hooks/              # useTipoCambio, custom hooks
│   │   ├── services/           # Conectores Firestore, Storage, Auditoría, Kardex, Usuarios
│   │   ├── utils/              # Generadores de PDF, exportadores Excel, TOTP 2FA
│   │   └── i18n/               # Motor reactivo i18next
│   │       ├── index.js        # Configuración y detector de idioma
│   │       └── locales/        # es.json y zh.json (diccionarios simétricos)
│   ├── index.html              # Entry point HTML5
│   ├── tailwind.config.js      # Configuración de diseño y estilos responsive
│   ├── vite.config.js          # Empaquetador y configurador de build
│   └── package.json            # Dependencias del cliente web
├── firebase/
│   ├── firestore.rules         # Reglas de seguridad declarativas de Firestore
│   ├── storage.rules           # Reglas de seguridad para subida de fotos y PDFs
│   ├── firebase.json           # Configuración de Hosting, headers y emuladores
│   └── seed.js                 # Scripts de inicialización
└── functions/                  # Cloud Functions para automatizaciones de backend
```

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: [React 18](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Iconografía e Interfaz**: [Lucide React](https://lucide.dev/), [Recharts](https://recharts.org/)
- **Internacionalización**: [i18next](https://www.i18next.com/), [react-i18next](https://react.i18next.com/)
- **Backend y Base de Datos**: [Google Cloud Firebase](https://firebase.google.com/)
  - **Firebase Authentication**: Autenticación segura de usuarios y sesiones.
  - **Cloud Firestore**: Base de datos NoSQL reactiva en tiempo real.
  - **Firebase Storage**: Almacenamiento en la nube de fotografías de alta resolución y documentos PDF.
  - **Firebase Hosting**: Distribución global mediante CDN con certificado SSL.
- **Documentos y Reportes**: [jsPDF](https://github.com/parallax/jsPDF), [xlsx (SheetJS)](https://sheetjs.com/)
- **Seguridad 2FA**: Criptografía TOTP basada en RFC 6238 con generación de QR en canvas.

---

## 💻 Instalación y Entorno Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/cramosarismendi-prog/sajama-inventario.git
cd sajama-inventario
```

### 2. Instalar dependencias del cliente
```bash
cd frontend
npm install
```

### 3. Configurar variables de entorno
Crear un archivo `.env.local` dentro del directorio `frontend/`:
```env
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=sajama-inventario-b5b17.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sajama-inventario-b5b17
VITE_FIREBASE_STORAGE_BUCKET=sajama-inventario-b5b17.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
VITE_USE_EMULATOR=false
```

### 4. Iniciar el servidor local
```bash
npm run dev
```
La aplicación estará disponible en: **http://localhost:3000** (o el puerto indicado por Vite).

---

## 🚀 Despliegue a Producción

Para compilar y publicar las últimas actualizaciones en Firebase:

```bash
# 1. Compilación del bundle de producción
cd frontend
npm run build

# 2. Despliegue de Hosting y Reglas de Seguridad
cd ..
firebase deploy --only hosting,firestore:rules,storage
```

📌 **URL en Producción**: [https://sajama-inventario-b5b17.web.app](https://sajama-inventario-b5b17.web.app)

---

## 📄 Licencia y Confidencialidad

Sistema desarrollado para **SAJAMA S.R.L.** — Todos los derechos reservados. Prohibida su copia, distribución o reproducción no autorizada.