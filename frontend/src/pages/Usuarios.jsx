import { useEffect, useState } from 'react'
import { Plus, Shield, UserCheck, UserX, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { suscribirUsuarios, crearUsuario, actualizarUsuario, ROLES } from '../services/usuarios'
import { registrarAccion } from '../services/auditoria'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { useForm } from 'react-hook-form'

const PERMISOS_POR_ROL = {
  administrador:  ['inventario','ingresos','salidas','consultas','ordenSalida','ordenEntrada','lista','reportes','usuarios'],
  gerencia:       ['inventario','salidas','consultas','reportes','usuarios'],
  almacenero:     ['inventario','ingresos','salidas','consultas','ordenSalida','ordenEntrada','lista'],
  ventas:         ['consultas','salidas','reportes'],
  taller:         ['consultas','salidas'],
  personalChino:  ['consultas','reportes'],
  contabilidad:   ['consultas','reportes'],
}

const MODULOS_LABELS = {
  inventario:   'Inventario',
  ingresos:     'Ingresos',
  salidas:      'Salidas',
  consultas:    'Consultas',
  ordenSalida:  'Orden de Salida',
  ordenEntrada: 'Orden de Entrada',
  lista:        'Lista Maestra',
  reportes:     'Reportes',
  usuarios:     'Usuarios',
}

function FormUsuario({ onGuardar, onCancelar }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const [showPass, setShow] = useState(false)
  const rolSel = watch('rol')

  return (
    <form onSubmit={handleSubmit(onGuardar)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre completo *</label>
          <input className="input" {...register('nombre', { required: 'Requerido' })} />
          {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
        </div>
        <div>
          <label className="label">Rol *</label>
          <select className="input" {...register('rol', { required: 'Requerido' })}>
            <option value="">Seleccionar...</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {errors.rol && <p className="text-red-500 text-xs mt-1">{errors.rol.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Correo electrónico *</label>
        <input className="input" type="email" {...register('email', { required: 'Requerido' })} placeholder="usuario@sajama.com" />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="label">Contraseña inicial *</label>
        <div className="relative">
          <input className="input pr-10" type={showPass ? 'text' : 'password'}
            {...register('password', { required: 'Requerido', minLength: { value: 6, message: 'Mín. 6 caracteres' } })}
            placeholder="Mín. 6 caracteres" />
          <button type="button" onClick={() => setShow(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>
        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
      </div>

      {/* Preview permisos del rol */}
      {rolSel && PERMISOS_POR_ROL[rolSel] && (
        <div className="bg-primary-pale rounded-lg p-3">
          <p className="text-xs font-semibold text-primary mb-2">
            Módulos que tendrá acceso con el rol <b>{rolSel}</b>:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PERMISOS_POR_ROL[rolSel].map(m => (
              <span key={m} className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                {MODULOS_LABELS[m]}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.keys(MODULOS_LABELS).filter(m => !PERMISOS_POR_ROL[rolSel].includes(m)).map(m => (
              <span key={m} className="bg-gray-200 text-gray-500 text-xs px-2 py-0.5 rounded-full line-through">
                {MODULOS_LABELS[m]}
              </span>
            ))}
          </div>
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

export default function Usuarios() {
  const { perfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [verRol,   setVerRol]   = useState(null)

  // Solo admin y gerencia pueden ver este módulo
  const soloLectura = perfil?.rol === 'gerencia'

  useEffect(() => {
    const unsub = suscribirUsuarios(data => { setUsuarios(data); setLoading(false) })
    return unsub
  }, [])

  const handleCrear = async ({ email, password, nombre, rol }) => {
    try {
      await crearUsuario(email, password, { nombre, rol })
      await registrarAccion({
        usuario: perfil.nombre, rol: perfil.rol,
        modulo: 'Usuarios', accion: 'CREAR',
        detalle: `Creó usuario ${nombre} con rol ${rol} (${email})`
      })
      toast.success(`Usuario ${nombre} creado correctamente`)
      setModal(false)
    } catch (e) { toast.error('Error: ' + e.message) }
  }

  const toggleActivo = async (u) => {
    if (soloLectura) return
    try {
      await actualizarUsuario(u.id, { activo: !u.activo })
      await registrarAccion({
        usuario: perfil.nombre, rol: perfil.rol,
        modulo: 'Usuarios', accion: 'EDITAR',
        detalle: `${u.activo ? 'Desactivó' : 'Activó'} el usuario ${u.nombre} (${u.email})`
      })
      toast.success(`Usuario ${u.activo ? 'desactivado' : 'activado'}`)
    } catch (e) { toast.error('Error al actualizar') }
  }

  const rolLabel = (r) => ROLES.find(x => x.value === r)?.label || r

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {usuarios.length} usuarios registrados
            {soloLectura && <span className="ml-2 text-yellow-600 font-medium">— Solo lectura</span>}
          </p>
        </div>
        {!soloLectura && (
          <button onClick={() => setModal(true)} className="btn-primary btn-sm">
            <Plus size={14}/> Nuevo usuario
          </button>
        )}
      </div>

      {/* Tabla de usuarios */}
      <div className="card p-0 overflow-hidden">
        {usuarios.length === 0 ? <EmptyState mensaje="No hay usuarios registrados" /> : (
          <table className="table-auto w-full">
            <thead><tr>
              {['Usuario','Rol','Módulos con acceso','Correo','Estado','Acciones'].map(h => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {usuarios.map(u => (
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
                    <div className="flex flex-wrap gap-1">
                      {(PERMISOS_POR_ROL[u.rol] || []).slice(0,4).map(m => (
                        <span key={m} className="bg-primary-pale text-primary text-xs px-1.5 py-0.5 rounded">
                          {MODULOS_LABELS[m]}
                        </span>
                      ))}
                      {(PERMISOS_POR_ROL[u.rol] || []).length > 4 && (
                        <button onClick={() => setVerRol(u)}
                          className="text-xs text-primary-light hover:underline">
                          +{(PERMISOS_POR_ROL[u.rol] || []).length - 4} más
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="td text-sm text-gray-500">{u.email}</td>
                  <td className="td">
                    <Badge tipo={u.activo ? 'green' : 'red'}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="td">
                    {!soloLectura && (
                      <button onClick={() => toggleActivo(u)}
                        className={`btn-sm flex items-center gap-1 ${u.activo ? 'btn-secondary' : 'btn-success'}`}>
                        {u.activo ? <><UserX size={13}/> Desactivar</> : <><UserCheck size={13}/> Activar</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalle permisos del rol */}
      <Modal open={!!verRol} onClose={() => setVerRol(null)}
        title={`Permisos de ${verRol?.nombre} — ${rolLabel(verRol?.rol)}`} size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Módulos con acceso:</p>
          <div className="space-y-2">
            {Object.entries(MODULOS_LABELS).map(([key, label]) => {
              const tiene = (PERMISOS_POR_ROL[verRol?.rol] || []).includes(key)
              return (
                <div key={key} className={`flex items-center gap-3 p-2 rounded-lg ${tiene ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${tiene ? 'bg-success' : 'bg-gray-300'}`}>
                    {tiene && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className={`text-sm ${tiene ? 'text-green-800 font-medium' : 'text-gray-400 line-through'}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>

      {/* Modal crear usuario */}
      <Modal open={modal} onClose={() => setModal(false)} title="Crear nuevo usuario" size="md">
        <FormUsuario onGuardar={handleCrear} onCancelar={() => setModal(false)} />
      </Modal>
    </div>
  )
}
