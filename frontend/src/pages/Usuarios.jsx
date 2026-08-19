import { useEffect, useState } from 'react'
import { Plus, Shield, UserCheck, UserX, Eye, EyeOff, Settings, Trash2 } from 'lucide-react'
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
  const ON = {
    ver:      'bg-blue-500 text-white border-blue-500',
    crear:    'bg-green-500 text-white border-green-500',
    editar:   'bg-yellow-500 text-white border-yellow-500',
    eliminar: 'bg-red-500 text-white border-red-500',
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="th text-left w-36">Módulo</th>
            {ACCIONES.map(a => <th key={a.key} className="th text-center w-20">{a.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {MODULOS.map(modulo => (
            <tr key={modulo.key} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="td font-medium text-gray-700 py-2">{modulo.label}</td>
              {ACCIONES.map(accion => {
                const activo = permisos[modulo.key]?.[accion.key] ?? false
                return (
                  <td key={accion.key} className="td text-center py-2">
                    <button type="button" disabled={soloLectura}
                      onClick={() => !soloLectura && onChange(modulo.key, accion.key, !activo)}
                      className={"w-8 h-8 rounded-lg border-2 font-bold transition-all mx-auto flex items-center justify-center " +
                        (activo ? ON[accion.key] : "bg-gray-50 text-gray-300 border-gray-200 " + (soloLectura ? '' : 'hover:border-gray-400'))
                      }>
                      {activo ? '✓' : '×'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FormUsuario({ onGuardar, onCancelar }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const [showPass,    setShow]    = useState(false)
  const [permsCustom, setPerms]   = useState(null)
  const [mostrarMat,  setMostrar] = useState(false)
  const rolSel = watch('rol')

  useEffect(() => {
    if (rolSel && PERMISOS_ROL[rolSel]) {
      setPerms(JSON.parse(JSON.stringify(PERMISOS_ROL[rolSel])))
    }
  }, [rolSel])

  const handlePerm = (modulo, accion, valor) => {
    setPerms(prev => ({ ...prev, [modulo]: { ...(prev[modulo] || {}), [accion]: valor } }))
  }

  const onSubmit = async (data) => {
    await onGuardar({ ...data, permisosPersonalizados: permsCustom })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre completo *</label>
          <input className="input" {...register('nombre', { required: 'Requerido' })}/>
          {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="label">Rol base *</label>
          <select className="input" {...register('rol', { required: 'Requerido' })}>
            <option value="">Seleccionar...</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {errors.rol && <p className="text-red-500 text-xs mt-1">{errors.rol.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Correo electrónico *</label>
        <input className="input" type="email" placeholder="usuario@sajama.com"
          {...register('email', { required: 'Requerido' })}/>
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        <p className="text-xs text-gray-400 mt-1">Puede ser un correo inventado. Ej: nombre@sajama.com</p>
      </div>

      <div>
        <label className="label">Contraseña inicial *</label>
        <div className="relative">
          <input className="input pr-10" type={showPass ? 'text' : 'password'}
            placeholder="Mín. 6 caracteres"
            {...register('password', { required: 'Requerido', minLength: { value: 6, message: 'Mín. 6 caracteres' } })}/>
          <button type="button" onClick={() => setShow(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>
        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
      </div>

      {rolSel && permsCustom && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setMostrar(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-primary"/>
              <span className="text-sm font-medium text-gray-700">Personalizar permisos (opcional)</span>
            </div>
            <span className="text-xs text-gray-400">{mostrarMat ? 'Ocultar ▲' : 'Mostrar ▼'}</span>
          </button>
          {mostrarMat && (
            <div className="p-4">
              <MatrizPermisos permisos={permsCustom} onChange={handlePerm}/>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Creando usuario...' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}

function EditarPermisos({ usuario, onCerrar }) {
  const { perfil: miPerfil } = useAuth()
  const [permisos,  setPermisos]  = useState(
    usuario.permisosPersonalizados || JSON.parse(JSON.stringify(PERMISOS_ROL[usuario.rol] || {}))
  )
  const [guardando, setGuardando] = useState(false)

  const handlePerm = (modulo, accion, valor) => {
    setPermisos(prev => ({ ...prev, [modulo]: { ...(prev[modulo] || {}), [accion]: valor } }))
  }

  const resetear = () => {
    setPermisos(JSON.parse(JSON.stringify(PERMISOS_ROL[usuario.rol] || {})))
    toast.success('Permisos reseteados al rol base')
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        permisosPersonalizados: permisos,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: miPerfil?.nombre,
      })
      await registrarAccion({
        usuario: miPerfil?.nombre, rol: miPerfil?.rol,
        modulo: 'Usuarios', accion: 'EDITAR',
        detalle: 'Actualizó permisos de ' + usuario.nombre,
      })
      toast.success('Permisos actualizados correctamente')
      onCerrar()
    } catch(e) { toast.error('Error: ' + e.message) }
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
            <p className="text-xs text-gray-500">Rol base: <b className="capitalize">{usuario.rol}</b></p>
          </div>
        </div>
        <button onClick={resetear} className="btn-secondary btn-sm">Resetear al rol base</button>
      </div>
      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
        <b>Ver</b> = acceder al módulo &nbsp;·&nbsp;
        <b>Crear</b> = agregar registros &nbsp;·&nbsp;
        <b>Editar</b> = modificar &nbsp;·&nbsp;
        <b>Eliminar</b> = borrar
      </div>
      <MatrizPermisos permisos={permisos} onChange={handlePerm}/>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button onClick={onCerrar} className="btn-secondary">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="btn-primary">
          {guardando ? 'Guardando...' : 'Guardar permisos'}
        </button>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { perfil } = useAuth()
  const [usuarios,      setUsuarios]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modalCrear,    setModalCrear]    = useState(false)
  const [modalPermisos, setModalPermisos] = useState(null)
  const [delUsuario,    setDelUsuario]    = useState(null)

  const soloLectura = perfil?.rol === 'gerencia'

  useEffect(() => {
    const unsub = suscribirUsuarios(data => { setUsuarios(data); setLoading(false) })
    return unsub
  }, [])

  const handleCrear = async ({ email, password, nombre, rol, permisosPersonalizados }) => {
    try {
      await crearUsuario(email, password, { nombre, rol, permisosPersonalizados })
      await registrarAccion({
        usuario: perfil.nombre, rol: perfil.rol,
        modulo: 'Usuarios', accion: 'CREAR',
        detalle: 'Creó usuario ' + nombre + ' (' + email + ') con rol ' + rol,
      })
      toast.success('Usuario ' + nombre + ' creado correctamente')
      setModalCrear(false)
    } catch(e) {
      if (e.code === 'auth/email-already-in-use') {
        toast.error('Ese correo ya está registrado. Usa uno diferente.')
      } else {
        toast.error('Error: ' + e.message)
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
      toast.success('Usuario ' + (u.activo ? 'desactivado' : 'activado'))
    } catch(e) { toast.error('Error') }
  }

  const handleEliminar = async () => {
    try {
      await eliminarUsuario(delUsuario.id)
      await registrarAccion({
        usuario: perfil.nombre, rol: perfil.rol,
        modulo: 'Usuarios', accion: 'ELIMINAR',
        detalle: 'Eliminó usuario ' + delUsuario.nombre + ' (' + delUsuario.email + ')',
      })
      toast.success('Usuario ' + delUsuario.nombre + ' eliminado')
      setDelUsuario(null)
    } catch(e) { toast.error('Error al eliminar: ' + e.message) }
  }

  const rolLabel = (r) => ROLES.find(x => x.value === r)?.label || r

  const resumen = (u) => ({
    modulosConAcceso: MODULOS.filter(m => getPermisosEfectivos(u)[m.key]?.ver).length,
    tienePersonalizados: !!u.permisosPersonalizados,
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">{usuarios.length} usuarios registrados</p>
        </div>
        {!soloLectura && (
          <button onClick={() => setModalCrear(true)} className="btn-primary btn-sm">
            <Plus size={14}/> Nuevo usuario
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {usuarios.length === 0 ? <EmptyState mensaje="No hay usuarios registrados"/> : (
          <div className="overflow-x-auto">
            <table className="table-auto w-full min-w-[650px]">
              <thead><tr>
                {['Usuario','Rol','Módulos','Permisos','Estado','Acciones'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr></thead>
            <tbody>
              {usuarios.map(u => {
                const { modulosConAcceso, tienePersonalizados } = resumen(u)
                return (
                  <tr key={u.id} className="tr-hover">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-primary-pale rounded-full flex items-center justify-center text-primary text-sm font-bold shrink-0">
                          {u.nombre?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.nombre}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-1.5">
                        <Shield size={13} className="text-primary-light shrink-0"/>
                        <span className="text-sm font-medium">{rolLabel(u.rol)}</span>
                      </div>
                    </td>
                    <td className="td">
                      <span className="text-sm font-bold text-primary">{modulosConAcceso}</span>
                      <span className="text-xs text-gray-400"> / {MODULOS.length}</span>
                    </td>
                    <td className="td">
                      {tienePersonalizados
                        ? <Badge tipo="yellow">Personalizados</Badge>
                        : <Badge tipo="blue">Rol base</Badge>}
                    </td>
                    <td className="td">
                      <Badge tipo={u.activo ? 'green' : 'red'}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="td">
                      <div className="flex gap-1.5">
                        {!soloLectura && (
                          <>
                            <button onClick={() => setModalPermisos(u)}
                              className="p-1.5 rounded-lg hover:bg-primary-pale text-primary transition-colors"
                              title="Editar permisos">
                              <Settings size={14}/>
                            </button>
                            {perfil?.uid !== u.id && (
                              <button onClick={() => setDelUsuario(u)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                title="Eliminar usuario">
                                <Trash2 size={14}/>
                              </button>
                            )}
                          </>
                        )}
                        <button onClick={() => toggleActivo(u)}
                          className={"btn-sm " + (u.activo ? 'btn-secondary' : 'btn-success')}>
                          {u.activo
                            ? <><UserX size={13}/> Desactivar</>
                            : <><UserCheck size={13}/> Activar</>}
                        </button>
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
        title="Crear nuevo usuario" size="lg">
        <FormUsuario onGuardar={handleCrear} onCancelar={() => setModalCrear(false)}/>
      </Modal>

      <Confirm
        open={!!delUsuario}
        mensaje={'¿Eliminar al usuario "' + (delUsuario?.nombre || '') + '"? Esta acción no se puede deshacer.'}
        onConfirm={handleEliminar}
        onCancel={() => setDelUsuario(null)}
      />

      <Modal open={!!modalPermisos} onClose={() => setModalPermisos(null)}
        title={"Permisos de " + (modalPermisos?.nombre || '')} size="lg">
        {modalPermisos && (
          <EditarPermisos usuario={modalPermisos} onCerrar={() => setModalPermisos(null)}/>
        )}
      </Modal>
    </div>
  )
}