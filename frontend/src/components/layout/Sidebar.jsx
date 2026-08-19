import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Package, Search, FileText, FilePlus, List,
  BarChart2, Users, LogOut, Globe, ChevronLeft,
  ChevronRight, ShieldAlert, FileSpreadsheet, ShoppingCart, FileArchive, X, KeyRound,
  Truck, HardHat, Calculator
} from 'lucide-react'
import i18n from '../../i18n'
import { ChangePasswordModal } from '../ui/ChangePasswordModal'

const MENU = [
  { key: 'inventario',   path: '/inventario',    icon: Package,         modulo: 'inventario'   },
  { key: 'kardex',       path: '/kardex-contable', icon: Calculator,    modulo: 'kardex'       },
  { key: 'compras',      path: '/compras',        icon: ShoppingCart,    modulo: 'compras'     },
  { key: 'importar',     path: '/importar',       icon: FileSpreadsheet, modulo: 'importar'     },
  { key: 'consultas',    path: '/consultas',      icon: Search,          modulo: 'consultas'    },
  { key: 'ordenSalida',  path: '/orden-salida',   icon: FileText,        modulo: 'ordenSalida'  },
  { key: 'ordenEntrada', path: '/orden-entrada',  icon: FilePlus,        modulo: 'ordenEntrada' },
  { key: 'aduana',       path: '/aduana',         icon: FileArchive,     modulo: 'aduana'       },
  { key: 'maquinaria',   path: '/maquinaria',     icon: Truck,           modulo: 'maquinaria'  },
  { key: 'equipos',      path: '/equipos',        icon: HardHat,         modulo: 'equipos'     },
  { key: 'lista',        path: '/lista',          icon: List,            modulo: 'lista'        },
  { key: 'reportes',     path: '/reportes',       icon: BarChart2,       modulo: 'reportes'     },
  { key: 'usuarios',     path: '/usuarios',       icon: Users,           modulo: 'usuarios'     },
  { key: 'auditoria',    path: '/auditoria',      icon: ShieldAlert,     modulo: 'usuarios'     },
]

const LABELS = {
  es: {
    inventario: 'Inventario', kardex: 'Kardex Contable', compras: 'Compras', importar: 'Importar Excel',
    consultas: 'Consultas', ordenSalida: 'Orden de Salida', ordenEntrada: 'Orden de Entrada',
    aduana: 'Aduana', maquinaria: 'Maquinaria', equipos: 'Equipos',
    lista: 'Lista Maestra', reportes: 'Reportes', usuarios: 'Usuarios', auditoria: 'Auditoría',
  },
  zh: {
    inventario: '库存目录', kardex: '财务卡片账', compras: '采购管理', importar: '导入Excel',
    consultas: '查询', ordenSalida: '出库单', ordenEntrada: '入库单',
    aduana: '海关', maquinaria: '机械设备', equipos: '设备',
    lista: '主列表', reportes: '报告', usuarios: '用户管理', auditoria: '审计日志',
  }
}

const ROL_ZH = {
  administrador: '管理员', gerencia: '管理层', almacenero: '仓库员',
  ventas: '销售', taller: '维修车间', personalChino: '中国员工', contabilidad: '会计', aduanas: '海关员',
}

const ADMIN_ITEMS = ['usuarios', 'auditoria']

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { perfil, logout, tienePermiso } = useAuth()
  const navigate = useNavigate()
  const isZh     = i18n.language === 'zh'
  const labels   = isZh ? LABELS.zh : LABELS.es
  const [modalPassword, setModalPassword] = useState(false)

  const handleLogout = async () => { await logout(); navigate('/login'); onMobileClose?.() }
  const toggleLang   = () => i18n.changeLanguage(isZh ? 'es' : 'zh')
  const handleNavClick = () => onMobileClose?.()

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        h-screen bg-primary flex flex-col transition-all duration-200
        w-64 ${collapsed ? 'md:w-16' : 'md:w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        shrink-0
      `}>

        <div className="flex items-center justify-between px-3 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Package size={16} className="text-white"/>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white font-bold text-sm leading-tight truncate">Sajama.SRL</p>
                <p className="text-white/60 text-xs">{isZh ? '库存管理系统' : 'Sistema de Inventario'}</p>
              </div>
            )}
          </div>

          <button onClick={onMobileClose}
            className="md:hidden p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0">
            <X size={18}/>
          </button>

          <button onClick={onToggle}
            className="hidden md:block p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0">
            {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {MENU.filter(m => tienePermiso(m.modulo)).map(({ key, path, icon: Icon }, idx, arr) => {
            const prevKey     = arr[idx - 1]?.key
            const showDivider = ADMIN_ITEMS.includes(key) && !ADMIN_ITEMS.includes(prevKey || '')
            return (
              <div key={key}>
                {showDivider && !collapsed && (
                  <div className="px-3 pt-3 pb-1">
                    <div className="border-t border-white/10"/>
                    <p className="text-white/30 text-xs mt-2 font-medium uppercase tracking-wider">
                      {isZh ? '管理' : 'Administración'}
                    </p>
                  </div>
                )}
                <NavLink to={path} onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
                     ${isActive ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
                  }>
                  <Icon size={18} className="shrink-0"/>
                  {!collapsed && <span className="truncate">{labels[key]}</span>}
                </NavLink>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-2 space-y-1">
          <button onClick={toggleLang}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full text-sm">
            <Globe size={18} className="shrink-0"/>
            {!collapsed && (
              <span className="flex items-center gap-2">
                {isZh
                  ? <><span className="text-white font-medium">中文</span><span className="text-white/40 text-xs">→ ES</span></>
                  : <><span className="text-white font-medium">ES</span><span className="text-white/40 text-xs">→ 中文</span></>
                }
              </span>
            )}
          </button>

          {!collapsed && perfil && (
            <div className="px-3 py-2 bg-white/5 rounded-lg">
              <p className="text-white text-xs font-semibold truncate">{perfil.nombre}</p>
              <p className="text-white/50 text-xs capitalize">
                {isZh ? (ROL_ZH[perfil.rol] || perfil.rol) : perfil.rol}
              </p>
            </div>
          )}

          <button onClick={() => setModalPassword(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full text-sm">
            <KeyRound size={18} className="shrink-0"/>
            {!collapsed && <span>{isZh ? '修改密码' : 'Cambiar contraseña'}</span>}
          </button>

          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 hover:bg-red-500/30 hover:text-white transition-colors w-full text-sm">
            <LogOut size={18} className="shrink-0"/>
            {!collapsed && <span>{isZh ? '退出登录' : 'Cerrar sesión'}</span>}
          </button>
        </div>
      </aside>

      <ChangePasswordModal open={modalPassword} onClose={() => setModalPassword(false)} />
    </>
  )
}