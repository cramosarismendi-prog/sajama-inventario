/**
 * Sistema de permisos granular SAJAMA 4x4
 * Cada módulo tiene 4 acciones: ver, crear, editar, eliminar
 * El rol define permisos base, el usuario puede tener ajustes adicionales
 */

export const MODULOS = [
  { key: 'inventario',   label: 'Inventario',       icon: 'Package'        },
  { key: 'compras',      label: 'Compras',           icon: 'ShoppingCart'   },
  { key: 'importar',     label: 'Importar Excel',    icon: 'FileSpreadsheet'},
  { key: 'consultas',    label: 'Consultas',         icon: 'Search'         },
  { key: 'ordenSalida',  label: 'Orden de Salida',   icon: 'FileText'       },
  { key: 'ordenEntrada', label: 'Orden de Entrada',  icon: 'FilePlus'       },
  { key: 'aduana',       label: 'Aduana',            icon: 'FileArchive'    },
  { key: 'lista',        label: 'Lista Maestra',     icon: 'List'           },
  { key: 'reportes',     label: 'Reportes',          icon: 'BarChart2'      },
  { key: 'usuarios',     label: 'Usuarios',          icon: 'Users'          },
  { key: 'auditoria',    label: 'Auditoría',         icon: 'ShieldAlert'    },
  { key: 'maquinaria',   label: 'Maquinaria',        icon: 'Truck'          },
  { key: 'equipos',      label: 'Equipos',           icon: 'HardHat'        },
  { key: 'kardex',       label: 'Kardex Contable',   icon: 'Calculator'     },
]

export const ACCIONES = [
  { key: 'ver',      label: 'Ver',      color: 'blue'  },
  { key: 'crear',    label: 'Crear',    color: 'green' },
  { key: 'editar',   label: 'Editar',   color: 'yellow'},
  { key: 'eliminar', label: 'Eliminar', color: 'red'   },
]

// Permisos base por rol
export const PERMISOS_ROL = {
  administrador: {
    inventario:   { ver:true, crear:true,  editar:true,  eliminar:true  },
    compras:      { ver:true, crear:true,  editar:true,  eliminar:true  },
    importar:     { ver:true, crear:true,  editar:true,  eliminar:true  },
    consultas:    { ver:true, crear:true,  editar:true,  eliminar:true  },
    ordenSalida:  { ver:true, crear:true,  editar:true,  eliminar:true  },
    ordenEntrada: { ver:true, crear:true,  editar:true,  eliminar:true  },
    aduana:       { ver:true, crear:true,  editar:true,  eliminar:true  },
    lista:        { ver:true, crear:true,  editar:true,  eliminar:true  },
    reportes:     { ver:true, crear:true,  editar:true,  eliminar:true  },
    usuarios:     { ver:true, crear:true,  editar:true,  eliminar:true  },
    auditoria:    { ver:true, crear:false, editar:false, eliminar:false },
    maquinaria:   { ver:true, crear:true,  editar:true,  eliminar:true  },
    equipos:      { ver:true, crear:true,  editar:true,  eliminar:true  },
    kardex:       { ver:true, crear:true,  editar:true,  eliminar:true  },
  },
  gerencia: {
    inventario:   { ver:true,  crear:false, editar:false, eliminar:false },
    compras:      { ver:true,  crear:false, editar:false, eliminar:false },
    importar:     { ver:false, crear:false, editar:false, eliminar:false },
    consultas:    { ver:true,  crear:false, editar:false, eliminar:false },
    ordenSalida:  { ver:true,  crear:true,  editar:false, eliminar:false },
    ordenEntrada: { ver:true,  crear:false, editar:false, eliminar:false },
    aduana:       { ver:true,  crear:true,  editar:true,  eliminar:false },
    lista:        { ver:true,  crear:false, editar:false, eliminar:false },
    reportes:     { ver:true,  crear:false, editar:false, eliminar:false },
    usuarios:     { ver:true,  crear:false, editar:false, eliminar:false },
    auditoria:    { ver:true,  crear:false, editar:false, eliminar:false },
    maquinaria:   { ver:true, crear:true,  editar:true,  eliminar:true  },
    equipos:      { ver:true, crear:true,  editar:true,  eliminar:true  },
    kardex:       { ver:true, crear:true,  editar:false, eliminar:false },
  },
  almacenero: {
    inventario:   { ver:true,  crear:true,  editar:true,  eliminar:false },
    compras:      { ver:true,  crear:true,  editar:true,  eliminar:false },
    importar:     { ver:true,  crear:true,  editar:false, eliminar:false },
    consultas:    { ver:true,  crear:false, editar:false, eliminar:false },
    ordenSalida:  { ver:true,  crear:true,  editar:true,  eliminar:false },
    ordenEntrada: { ver:true,  crear:true,  editar:true,  eliminar:false },
    aduana:       { ver:true,  crear:true,  editar:true,  eliminar:false },
    lista:        { ver:true,  crear:false, editar:false, eliminar:false },
    reportes:     { ver:true,  crear:false, editar:false, eliminar:false },
    usuarios:     { ver:false, crear:false, editar:false, eliminar:false },
    auditoria:    { ver:false, crear:false, editar:false, eliminar:false },
    maquinaria:   { ver:true, crear:true,  editar:true,  eliminar:true  },
    equipos:      { ver:true, crear:true,  editar:true,  eliminar:false },
    kardex:       { ver:true, crear:true,  editar:false, eliminar:false },
  },
  ventas: {
    inventario:   { ver:true,  crear:false, editar:false, eliminar:false },
    compras:      { ver:false, crear:false, editar:false, eliminar:false },
    importar:     { ver:false, crear:false, editar:false, eliminar:false },
    consultas:    { ver:true,  crear:false, editar:false, eliminar:false },
    ordenSalida:  { ver:true,  crear:true,  editar:false, eliminar:false },
    ordenEntrada: { ver:false, crear:false, editar:false, eliminar:false },
    aduana:       { ver:false, crear:false, editar:false, eliminar:false },
    lista:        { ver:false, crear:false, editar:false, eliminar:false },
    reportes:     { ver:true,  crear:false, editar:false, eliminar:false },
    usuarios:     { ver:false, crear:false, editar:false, eliminar:false },
    auditoria:    { ver:false, crear:false, editar:false, eliminar:false },
    equipos:      { ver:true,  crear:false, editar:false, eliminar:false },
    kardex:       { ver:false, crear:false, editar:false, eliminar:false },
  },
  taller: {
    inventario:   { ver:true,  crear:false, editar:false, eliminar:false },
    compras:      { ver:false, crear:false, editar:false, eliminar:false },
    importar:     { ver:false, crear:false, editar:false, eliminar:false },
    consultas:    { ver:true,  crear:false, editar:false, eliminar:false },
    ordenSalida:  { ver:true,  crear:true,  editar:false, eliminar:false },
    ordenEntrada: { ver:false, crear:false, editar:false, eliminar:false },
    aduana:       { ver:false, crear:false, editar:false, eliminar:false },
    lista:        { ver:false, crear:false, editar:false, eliminar:false },
    reportes:     { ver:false, crear:false, editar:false, eliminar:false },
    usuarios:     { ver:false, crear:false, editar:false, eliminar:false },
    auditoria:    { ver:false, crear:false, editar:false, eliminar:false },
    equipos:      { ver:true,  crear:false, editar:false, eliminar:false },
    kardex:       { ver:false, crear:false, editar:false, eliminar:false },
  },
  personalChino: {
    inventario:   { ver:true,  crear:false, editar:false, eliminar:false },
    compras:      { ver:false, crear:false, editar:false, eliminar:false },
    importar:     { ver:false, crear:false, editar:false, eliminar:false },
    consultas:    { ver:true,  crear:false, editar:false, eliminar:false },
    ordenSalida:  { ver:true,  crear:true,  editar:false, eliminar:false },
    ordenEntrada: { ver:true,  crear:false, editar:false, eliminar:false },
    aduana:       { ver:false, crear:false, editar:false, eliminar:false },
    lista:        { ver:false, crear:false, editar:false, eliminar:false },
    reportes:     { ver:true,  crear:false, editar:false, eliminar:false },
    usuarios:     { ver:false, crear:false, editar:false, eliminar:false },
    auditoria:    { ver:false, crear:false, editar:false, eliminar:false },
    kardex:       { ver:true,  crear:false, editar:false, eliminar:false },
  },
  contabilidad: {
    inventario:   { ver:true,  crear:false, editar:false, eliminar:false },
    compras:      { ver:true,  crear:false, editar:false, eliminar:false },
    importar:     { ver:false, crear:false, editar:false, eliminar:false },
    consultas:    { ver:true,  crear:false, editar:false, eliminar:false },
    ordenSalida:  { ver:false, crear:false, editar:false, eliminar:false },
    ordenEntrada: { ver:false, crear:false, editar:false, eliminar:false },
    aduana:       { ver:false, crear:false, editar:false, eliminar:false },
    lista:        { ver:false, crear:false, editar:false, eliminar:false },
    reportes:     { ver:true,  crear:false, editar:false, eliminar:false },
    usuarios:     { ver:false, crear:false, editar:false, eliminar:false },
    auditoria:    { ver:false, crear:false, editar:false, eliminar:false },
    kardex:       { ver:true,  crear:true,  editar:true,  eliminar:false },
  },
  aduanas: {
    inventario:   { ver:false, crear:false, editar:false, eliminar:false },
    compras:      { ver:false, crear:false, editar:false, eliminar:false },
    importar:     { ver:false, crear:false, editar:false, eliminar:false },
    consultas:    { ver:true,  crear:false, editar:false, eliminar:false },
    ordenSalida:  { ver:false, crear:false, editar:false, eliminar:false },
    ordenEntrada: { ver:false, crear:false, editar:false, eliminar:false },
    aduana:       { ver:true,  crear:true,  editar:true,  eliminar:false },
    lista:        { ver:false, crear:false, editar:false, eliminar:false },
    reportes:     { ver:false, crear:false, editar:false, eliminar:false },
    usuarios:     { ver:false, crear:false, editar:false, eliminar:false },
    auditoria:    { ver:false, crear:false, editar:false, eliminar:false },
    kardex:       { ver:false, crear:false, editar:false, eliminar:false },
  },
}

/**
 * Obtiene los permisos efectivos de un usuario
 * Combina permisos del rol base con ajustes individuales del usuario
 */
export const getPermisosEfectivos = (perfil) => {
  if (!perfil) return {}
  const base   = PERMISOS_ROL[perfil.rol] || {}
  const ajustes = perfil.permisosPersonalizados || {}

  const resultado = {}
  for (const modulo of MODULOS.map(m => m.key)) {
    resultado[modulo] = {
      ver:      ajustes[modulo]?.ver      ?? base[modulo]?.ver      ?? false,
      crear:    ajustes[modulo]?.crear    ?? base[modulo]?.crear    ?? false,
      editar:   ajustes[modulo]?.editar   ?? base[modulo]?.editar   ?? false,
      eliminar: ajustes[modulo]?.eliminar ?? base[modulo]?.eliminar ?? false,
    }
  }
  return resultado
}

/**
 * Verifica si un usuario puede realizar una acción en un módulo
 */
export const puedeDo = (perfil, modulo, accion = 'ver') => {
  const permisos = getPermisosEfectivos(perfil)
  return permisos[modulo]?.[accion] ?? false
}