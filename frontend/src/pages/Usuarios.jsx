import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Shield, UserCheck, UserX, Eye, EyeOff, Settings, Trash2, ShieldOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { suscribirUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, ROLES } from '../services/usuarios'
import { registrarAccion } from '../services/auditoria'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Confirm } from '../components/ui/Confirm'
import { useForm } from 'react-hook-form'
import { MODULOS, ACCIONES, PERMISOS_ROL, getPermisosEfectivos } from '../services/permisos'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'

function MatrizPermisos({ permisos, onChange, soloLectura = false }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const ON = {
    ver:      'bg-[#16241F] text-white border-[#16241F]',
    crear:    'bg-[#15803D] text-white border-[#15803D]',
    editar:   'bg-[#B45309] text-white border-[#B45309]',
    eliminar: 'bg-[#DC2626] text-white border-[#DC2626]',
  }
  return (
    <div className="overflow-x-auto">
      <table className="table-auto w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="th text-left font-semibold">{isZh ? '模块' : 'Módulo'}</th>
            {ACCIONES.map(a => (
              <th key={a.key} className="th text-center font-semibold capitalize w-20">
                {isZh ? (a.labelZh || a.label) : a.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {MODULOS.map(m => {
            const modPerm = permisos[m.key] || {}
            return (
              <tr key={m.key} className="hover:bg-gray-50/50">
                <td className="td font-medium text-gray-700">
                  {isZh ? (m.labelZh || m.label) : m.label}
                </td>
                {ACCIONES.map(a => {
                  const val = modPerm[a.key] ?? false
                  return (
                    <td key={a.key} className="td text-center">
                      <button
                        type="button"
                        disabled={soloLectura}
                        onClick={() => onChange(m.key, a.key, !val)}
                        className={`w-6 h-6 rounded-md border text-[10px] font-bold inline-flex items-center justify-center transition-all ${
                          val ? ON[a.key] : 'bg-gray-100 text-gray-300 border-gray-200 hover:border-gray-300'
                        } ${soloLectura ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {val ? '✓' : ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FormUsuario({ onGuardar, onCancelar }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { rol: 'almacenero' }
  })
  const [mostrarMat, setMostrarMat] = useState(false)
  const rolSel = watch('rol')
  const permsCustom = watch('permisosPersonalizados') || JSON.parse(JSON.stringify(PERMISOS_ROL['almacenero'] || {}))

  useEffect(() => {
    if (!mostrarMat) {
      setValue('permisosPersonalizados', null)
    } else {
      setValue('permisosPersonalizados', JSON.parse(JSON.stringify(PERMISOS_ROL[rolSel] || {})))
    }
  }, [rolSel, mostrarMat, setValue])

  const handlePerm = (modulo, accion, valor) => {
    const act = watch('permisosPersonalizados') || {}
    setValue('permisosPersonalizados', {
      ...act,
      [modulo]: { ...(act[modulo] || {}), [accion]: valor }
    })
  }

  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div>
        <label className="label">{isZh ? '全名 *' : 'Nombre completo *'}</label>
        <input className="input" placeholder={isZh ? '例如：张三 / Juan Pérez' : 'Ej: Juan Pérez'}
          {...register('nombre', { required: isZh ? '必须填写全名' : 'El nombre es requerido' })} />
        {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
      </div>

      <div>
        <label className="label">{isZh ? '电子邮箱 *' : 'Correo electrónico *'}</label>
        <input type="email" className="input" placeholder="usuario@sajama.com"
          {...register('email', { required: isZh ? '必须填写电子邮箱' : 'El correo es requerido' })} />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="label">{isZh ? '初始密码 *' : 'Contraseña inicial *'}</label>
        <input type="password" className="input" placeholder={isZh ? '至少6位字符' : 'Mínimo 6 caracteres'}
          {...register('password', { required: isZh ? '必须填写密码' : 'La contraseña es requerida', minLength: { value: 6, message: isZh ? '至少6位字符' : 'Mínimo 6 caracteres' } })} />
        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
      </div>

      <div>
        <label className="label">{isZh ? '用户角色 *' : 'Rol del usuario *'}</label>
        <select className="select" {...register('rol')}>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{isZh ? r.labelZh : r.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2.5 p-3 bg-[#EEF2F0] border border-[#CBD4CF] rounded-xl">
        <input
          type="checkbox"
          id="chkEncargadoIT"
          className="w-4 h-4 text-[#16241F] accent-[#16241F] rounded cursor-pointer"
          {...register('esEncargadoIT')}
        />
        <label htmlFor="chkEncargadoIT" className="text-xs font-semibold text-[#16241F] cursor-pointer select-none">
          {isZh ? '💻 设为IT负责人 (允许配置角色与双因素2FA)' : '💻 Asignar como Encargado de IT (Permiso para gestionar roles y 2FA)'}
        </label>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
          <div>
            <p className="text-xs font-semibold text-gray-700">{isZh ? '自定义权限' : 'Permisos personalizados'}</p>
            <p className="text-[11px] text-gray-400">
              {isZh ? '默认继承所选角色的基础权限' : 'Por defecto hereda los permisos del rol seleccionado'}
            </p>
          </div>
          <button type="button" onClick={() => setMostrarMat(!mostrarMat)} className="btn-secondary btn-sm text-xs">
            {mostrarMat ? (isZh ? '使用基础角色' : 'Usar rol base') : (isZh ? '自定义权限' : 'Personalizar permisos')}
          </button>
        </div>
        {mostrarMat && (
          <div className="p-4">
            <MatrizPermisos permisos={permsCustom} onChange={handlePerm}/>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">
          {isZh ? '取消' : 'Cancelar'}
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting
            ? (isZh ? '正在创建用户...' : 'Creando usuario...')
            : (isZh ? '创建用户' : 'Crear usuario')}
        </button>
      </div>
    </form>
  )
}

function EditarPermisos({ usuario, onCerrar }) {
  const { perfil: miPerfil } = useAuth()
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const [permisos,      setPermisos]      = useState(
    usuario.permisosPersonalizados || JSON.parse(JSON.stringify(PERMISOS_ROL[usuario.rol] || {}))
  )
  const [esEncargadoIT, setEsEncargadoIT] = useState(usuario.esEncargadoIT || false)
  const [guardando,     setGuardando]     = useState(false)

  const rolLabel = (r) => {
    const item = ROLES.find(x => x.value === r)
    if (!item) return r
    return isZh ? (item.labelZh || item.label) : item.label
  }

  const handlePerm = (modulo, accion, valor) => {
    setPermisos(prev => ({ ...prev, [modulo]: { ...(prev[modulo] || {}), [accion]: valor } }))
  }

  const resetear = () => {
    setPermisos(JSON.parse(JSON.stringify(PERMISOS_ROL[usuario.rol] || {})))
    toast.success(isZh ? '权限已重置为基础角色' : 'Permisos reseteados al rol base')
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        permisosPersonalizados: permisos,
        esEncargadoIT: esEncargadoIT,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: miPerfil?.nombre,
      })
      await registrarAccion({
        usuario: miPerfil?.nombre, rol: miPerfil?.rol,
        modulo: 'Usuarios', accion: 'EDITAR',
        detalle: 'Actualizó permisos e IT de ' + usuario.nombre,
      })
      toast.success(isZh ? '权限更新成功' : 'Permisos actualizados correctamente')
      onCerrar()
    } catch(e) { toast.error((isZh ? '错误: ' : 'Error: ') + e.message) }
    finally { setGuardando(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-pale rounded-full flex items-center justify-center text-primary font-bold">
            {usuario.nombre?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{usuario.nombre}</p>
            <p className="text-xs text-gray-500">
              {isZh ? '基础角色' : 'Rol base'}: <b className="capitalize">{rolLabel(usuario.rol)}</b>
            </p>
          </div>
        </div>
        <button onClick={resetear} className="btn-secondary btn-sm">
          {isZh ? '重置为基础角色' : 'Resetear al rol base'}
        </button>
      </div>

      <div className="flex items-center gap-2.5 p-3 bg-[#EEF2F0] border border-[#CBD4CF] rounded-xl">
        <input
          type="checkbox"
          id="chkEditEncargadoIT"
          checked={esEncargadoIT}
          onChange={e => setEsEncargadoIT(e.target.checked)}
          className="w-4 h-4 text-[#16241F] accent-[#16241F] rounded cursor-pointer"
        />
        <label htmlFor="chkEditEncargadoIT" className="text-xs font-semibold text-[#16241F] cursor-pointer select-none">
          {isZh ? '💻 设为IT负责人 (允许配置角色与双因素2FA)' : '💻 Asignar como Encargado de IT (Permiso para gestionar roles y 2FA)'}
        </label>
      </div>

      <div className="bg-[#EEF2F0] border border-[#DCE3DF] rounded-lg p-3 text-xs text-[#16241F]">
        <b>{isZh ? '查看' : 'Ver'}</b> = {isZh ? '访问模块' : 'acceder al módulo'} &nbsp;·&nbsp;
        <b>{isZh ? '新建' : 'Crear'}</b> = {isZh ? '添加记录' : 'agregar registros'} &nbsp;·&nbsp;
        <b>{isZh ? '编辑' : 'Editar'}</b> = {isZh ? '修改内容' : 'modificar'} &nbsp;·&nbsp;
        <b>{isZh ? '删除' : 'Eliminar'}</b> = {isZh ? '删除记录' : 'borrar'}
      </div>
      <MatrizPermisos permisos={permisos} onChange={handlePerm}/>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button onClick={onCerrar} className="btn-secondary">
          {isZh ? '取消' : 'Cancelar'}
        </button>
        <button onClick={guardar} disabled={guardando} className="btn-primary">
          {guardando ? (isZh ? '正在保存...' : 'Guardando...') : (isZh ? '保存权限' : 'Guardar permisos')}
        </button>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language === 'zh'
  const { perfil, resetearMfaUsuario, esAdminIT, esSuperAdmin, cerrarTodasLasSesiones, tienePermiso } = useAuth()
  const [usuarios,      setUsuarios]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modalCrear,    setModalCrear]    = useState(false)
  const [modalPermisos, setModalPermisos] = useState(null)
  const [delUsuario,    setDelUsuario]    = useState(null)

  const puedeEditarUsuarios = tienePermiso('usuarios', 'editar') || perfil?.rol === 'administrador' || esSuperAdmin
  const soloLectura = !puedeEditarUsuarios

  useEffect(() => {
    const unsub = suscribirUsuarios(data => { setUsuarios(data); setLoading(false) })
    return unsub
  }, [])

  const handleCrear = async ({ email, password, nombre, rol, permisosPersonalizados, esEncargadoIT }) => {
    try {
      await crearUsuario(email, password, { nombre, rol, permisosPersonalizados, esEncargadoIT: !!esEncargadoIT })
      await registrarAccion({
        usuario: perfil.nombre, rol: perfil.rol,
        modulo: 'Usuarios', accion: 'CREAR',
        detalle: 'Creó usuario ' + nombre + ' (' + email + ') con rol ' + rol + (esEncargadoIT ? ' (Encargado IT)' : ''),
      })
      toast.success((isZh ? '用户创建成功: ' : 'Usuario creado correctamente: ') + nombre)
      setModalCrear(false)
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') {
        toast.error(isZh ? '该邮箱已被注册，请使用其他邮箱。' : 'Ese correo ya está registrado. Usa uno diferente.')
      } else {
        toast.error((isZh ? '错误: ' : 'Error: ') + e.message)
      }
    }
  }

  const toggleActivo = async (u) => {
    if (soloLectura) return
    try {
      await actualizarUsuario(u.id, { activo: !u.activo })
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Usuarios',
        accion: u.activo ? 'RECHAZAR' : 'APROBAR',
        detalle: (u.activo ? 'Desactivó' : 'Activó') + ' al usuario ' + u.nombre,
      })
      toast.success(isZh ? (u.activo ? '用户已停用' : '用户已启用') : ('Usuario ' + (u.activo ? 'desactivado' : 'activado')))
    } catch(e) { toast.error(isZh ? '操作失败' : 'Error') }
  }

  const handleEliminar = async () => {
    try {
      await eliminarUsuario(delUsuario.id)
      await registrarAccion({
        usuario: perfil.nombre, rol: perfil.rol,
        modulo: 'Usuarios', accion: 'ELIMINAR',
        detalle: 'Eliminó usuario ' + delUsuario.nombre + ' (' + delUsuario.email + ')',
      })
      toast.success((isZh ? '用户已删除: ' : 'Usuario eliminado: ') + delUsuario.nombre)
      setDelUsuario(null)
    } catch(e) { toast.error((isZh ? '删除失败: ' : 'Error al eliminar: ') + e.message) }
  }

  const handleResetMfa = async (u) => {
    if (!esSuperAdmin) {
      toast.error(isZh ? '仅超级管理员 (admin@sajama.com) 有权重置2FA。' : 'Solo el Super Administrador (admin@sajama.com) puede resetear el 2FA.')
      return
    }
    const msgConfirm = isZh
      ? `是否重置用户 "${u.nombre}" 的双因素身份验证 (2FA)？该用户需要重新绑定设备。`
      : `¿Resetear la Autenticación de Doble Factor (2FA) para el usuario "${u.nombre}"? Tendrá que enrolar su dispositivo nuevamente.`
    if (!window.confirm(msgConfirm)) return
    try {
      await resetearMfaUsuario(u.id)
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Usuarios',
        accion: 'EDITAR',
        detalle: 'Reseteó el 2FA del usuario ' + u.nombre,
      })
      toast.success((isZh ? '已为用户禁用2FA: ' : '2FA deshabilitado para ') + u.nombre)
    } catch(e) {
      toast.error((isZh ? '重置2FA失败: ' : 'Error al resetear 2FA: ') + e.message)
    }
  }

  const handleCerrarSesionesGlobales = async () => {
    if (!esSuperAdmin) return
    const msg = isZh
      ? '🚨 确定要执行此操作吗？这将立即关闭所有已登录用户的会话。他们需要重新登录并绑定2FA。'
      : '🚨 ¿ESTÁS SEGURO? Esta acción cerrará inmediatamente las sesiones de TODOS los usuarios conectados al sistema. Tendrán que volver a iniciar sesión y configurar 2FA si aún no lo han hecho.'
    if (!window.confirm(msg)) return

    try {
      await cerrarTodasLasSesiones()
      await registrarAccion({
        usuario: perfil?.nombre, rol: perfil?.rol, modulo: 'Usuarios',
        accion: 'EDITAR',
        detalle: 'Ejecutó cierre global de sesiones para obligar la activación de 2FA',
      })
      toast.success(isZh ? '已成功下发所有活动会话的强制关闭指令。' : 'Se ha ordenado el cierre de todas las sesiones activas.')
    } catch(e) {
      toast.error((isZh ? '关闭会话失败: ' : 'Error al cerrar sesiones: ') + e.message)
    }
  }

  const rolLabel = (r) => {
    const item = ROLES.find(x => x.value === r)
    if (!item) return r
    return isZh ? (item.labelZh || item.label) : item.label
  }

  const resumen = (u) => ({
    modulosConAcceso: MODULOS.filter(m => getPermisosEfectivos(u)[m.key]?.ver).length,
    tienePersonalizados: !!u.permisosPersonalizados,
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>{isZh ? '用户管理与角色权限控制' : 'Gestión de Usuarios y Control de Roles'}</h1>
          <p className="text-sm text-gray-500 mt-1">{usuarios.length} {isZh ? '位已注册用户' : 'usuarios registrados'}</p>
        </div>
        {puedeEditarUsuarios && (
          <button onClick={() => setModalCrear(true)} className="btn-primary btn-sm">
            <Plus size={14}/> {isZh ? '新建用户' : 'Nuevo usuario'}
          </button>
        )}
      </div>

      {esSuperAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 shrink-0 font-bold text-lg">
              🚨
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                {isZh ? '在线会话控制与强制2FA双因素认证' : 'Control de Sesiones Activas y 2FA Obligatorio'}
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                {isZh
                  ? '实时关闭所有在线用户的会话。重新登录时，管理员或IT负责人必须强制绑定其2FA身份验证器。'
                  : 'Cierra la sesión de todos los usuarios conectados en tiempo real. Al volver a ingresar, aquellos con rol de Administrador o Encargado IT deberán enrolar obligatoriamente su 2FA.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCerrarSesionesGlobales}
            className="btn-secondary text-xs border-amber-300 text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
          >
            {isZh ? '🚪 强制退出所有用户会话' : '🚪 Cerrar Sesiones de Todos los Usuarios'}
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {usuarios.length === 0 ? <EmptyState mensaje={isZh ? '暂无注册用户' : 'No hay usuarios registrados'}/> : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full min-w-[750px]">
              <thead><tr>
                {[
                  isZh ? '用户' : 'Usuario',
                  isZh ? '角色 / IT' : 'Rol / IT',
                  isZh ? '模块数' : 'Módulos',
                  isZh ? '权限' : 'Permisos',
                  esSuperAdmin ? (isZh ? '双因素2FA' : '2FA (TOTP)') : null,
                  isZh ? '状态' : 'Estado',
                  isZh ? '操作' : 'Acciones'
                ].filter(Boolean).map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr></thead>
            <tbody>
              {usuarios.map(u => {
                const { modulosConAcceso, tienePersonalizados } = resumen(u)
                const esUsuarioAdmin = u.email?.toLowerCase() === 'admin@sajama.com'
                return (
                  <tr key={u.id} className="tr-hover">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-primary-pale rounded-full flex items-center justify-center text-primary text-sm font-bold shrink-0">
                          {u.nombre?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{u.nombre}</p>
                            {esUsuarioAdmin && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">SUPER ADMIN</span>}
                          </div>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Shield size={13} className="text-primary-light shrink-0"/>
                          <span className="text-sm font-medium">{rolLabel(u.rol)}</span>
                        </div>
                        {u.esEncargadoIT && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E4D825] bg-[#16241F] border border-[#233830] px-1.5 py-0.5 rounded w-max">
                            💻 {isZh ? 'IT负责人' : 'Encargado IT'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td">
                      <span className="text-sm font-bold text-primary">{modulosConAcceso}</span>
                      <span className="text-xs text-gray-400"> / {MODULOS.length}</span>
                    </td>
                    <td className="td">
                      {tienePersonalizados
                        ? <Badge tipo="yellow">{isZh ? '自定义' : 'Personalizados'}</Badge>
                        : <Badge tipo="blue">{isZh ? '基础角色' : 'Rol base'}</Badge>}
                    </td>
                    {esSuperAdmin && (
                      <td className="td">
                        {u.mfaHabilitado ? (
                          <Badge tipo="green">🔒 {isZh ? '已开启' : 'Activo'}</Badge>
                        ) : (
                          <Badge tipo="gray">🔓 {isZh ? '未开启' : 'Inactivo'}</Badge>
                        )}
                      </td>
                    )}
                    <td className="td">
                      <Badge tipo={u.activo ? 'green' : 'red'}>
                        {u.activo ? (isZh ? '已启用' : 'Activo') : (isZh ? '已停用' : 'Inactivo')}
                      </Badge>
                    </td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        {puedeEditarUsuarios && (
                          <>
                            <button onClick={() => setModalPermisos(u)}
                              className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors"
                              title={isZh ? '配置权限与IT负责人' : 'Editar permisos y asignación IT'}>
                              <Settings size={14}/>
                            </button>
                            {u.mfaHabilitado && esSuperAdmin && (
                              <button onClick={() => handleResetMfa(u)}
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                                title={isZh ? '重置此用户的2FA (仅限超级管理员)' : 'Resetear 2FA de este usuario (Solo Super Admin)'}>
                                <ShieldOff size={14}/>
                              </button>
                            )}
                            {perfil?.uid !== u.id && !esUsuarioAdmin && (
                              <button onClick={() => setDelUsuario(u)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                title={isZh ? '删除用户' : 'Eliminar usuario'}>
                                <Trash2 size={14}/>
                              </button>
                            )}
                          </>
                        )}
                        {puedeEditarUsuarios && !esUsuarioAdmin && (
                          <button onClick={() => toggleActivo(u)}
                            className={"btn-sm " + (u.activo ? 'btn-secondary' : 'btn-success')}>
                            {u.activo
                              ? <><UserX size={13}/> {isZh ? '停用' : 'Desactivar'}</>
                              : <><UserCheck size={13}/> {isZh ? '启用' : 'Activar'}</>}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <Modal open={modalCrear} onClose={() => setModalCrear(false)}
        title={isZh ? '创建新用户' : 'Crear nuevo usuario'} size="lg">
        <FormUsuario onGuardar={handleCrear} onCancelar={() => setModalCrear(false)}/>
      </Modal>

      <Confirm
        open={!!delUsuario}
        mensaje={isZh
          ? `确定要删除用户 "${delUsuario?.nombre || ''}" 吗？此操作不可撤销。`
          : ('¿Eliminar al usuario "' + (delUsuario?.nombre || '') + '"? Esta acción no se puede deshacer.')}
        onConfirm={handleEliminar}
        onCancel={() => setDelUsuario(null)}
      />

      <Modal open={!!modalPermisos} onClose={() => setModalPermisos(null)}
        title={(isZh ? '用户权限：' : 'Permisos de ') + (modalPermisos?.nombre || '')} size="lg">
        {modalPermisos && (
          <EditarPermisos usuario={modalPermisos} onCerrar={() => setModalPermisos(null)}/>
        )}
      </Modal>
    </div>
  )
}