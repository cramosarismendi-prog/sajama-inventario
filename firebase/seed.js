const { initializeApp } = require('firebase/app')
const {
  getFirestore, connectFirestoreEmulator,
  collection, doc, setDoc, addDoc, getDocs, deleteDoc, query
} = require('firebase/firestore')
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth')

const app  = initializeApp({ projectId: 'sajama-inventario', apiKey: 'demo-key' })
const db   = getFirestore(app)
const auth = getAuth(app)
connectFirestoreEmulator(db,   'localhost', 8090)
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })

const INVENTARIO = [
  { codigo:1,  descripcion:'Filtro de combustible',     descripcionZh:'燃油滤清器',   modelo:'11214484',      serie:'',           categoria:'Repuestos', unidad:'pieza', stock:0,   stockMin:5,  precio:0    },
  { codigo:2,  descripcion:'Electrovalvula cuadruple',  descripcionZh:'四连电磁阀',   modelo:'',              serie:'4120713692', categoria:'Repuestos', unidad:'pieza', stock:0,   stockMin:1,  precio:0    },
  { codigo:3,  descripcion:'Valvula de freno',          descripcionZh:'制动阀',               modelo:'',              serie:'4120000133', categoria:'Repuestos', unidad:'pieza', stock:0,   stockMin:1,  precio:0    },
  { codigo:4,  descripcion:'Aceite 85W-140 GL-5',       descripcionZh:'85W-140机油',              modelo:'GL-5',          serie:'85W-140',    categoria:'Insumos',   unidad:'balde', stock:215, stockMin:20, precio:780  },
  { codigo:5,  descripcion:'Liquido hidraulico HM 68',  descripcionZh:'液压油',               modelo:'PD HM',         serie:'68#',        categoria:'Insumos',   unidad:'balde', stock:433, stockMin:20, precio:850  },
  { codigo:6,  descripcion:'Aceite 15W-40 CI-4/E7',     descripcionZh:'15W-40机油',              modelo:'15W-40',        serie:'CI-4/E7',    categoria:'Insumos',   unidad:'balde', stock:599, stockMin:30, precio:850  },
  { codigo:7,  descripcion:'Correa YC',                 descripcionZh:'皮带',                    modelo:'YC80-10PK1350', serie:'',           categoria:'Repuestos', unidad:'unidad',stock:1,   stockMin:2,  precio:0    },
  { codigo:8,  descripcion:'Correa EPDM',               descripcionZh:'皮带',                    modelo:'8PK1340',       serie:'',           categoria:'Repuestos', unidad:'unidad',stock:2,   stockMin:2,  precio:0    },
  { codigo:9,  descripcion:'Correa 8PK1815',            descripcionZh:'皮带',                    modelo:'8PK1815',       serie:'',           categoria:'Repuestos', unidad:'unidad',stock:2,   stockMin:2,  precio:0    },
  { codigo:10, descripcion:'Correa 8PK1580',            descripcionZh:'皮带',                    modelo:'8PK1580',       serie:'',           categoria:'Repuestos', unidad:'unidad',stock:1,   stockMin:2,  precio:0    },
  { codigo:11, descripcion:'Correa 8PK950',             descripcionZh:'皮带',                    modelo:'8PK950',        serie:'',           categoria:'Repuestos', unidad:'unidad',stock:1,   stockMin:2,  precio:0    },
  { codigo:12, descripcion:'Correa 6PK2120',            descripcionZh:'皮带',                    modelo:'6PK2120',       serie:'',           categoria:'Repuestos', unidad:'unidad',stock:14,  stockMin:5,  precio:0    },
  { codigo:13, descripcion:'Correa 6PK1630',            descripcionZh:'皮带',                    modelo:'6PK1630',       serie:'',           categoria:'Repuestos', unidad:'unidad',stock:10,  stockMin:5,  precio:0    },
  { codigo:14, descripcion:'Correa 8PK1068',            descripcionZh:'皮带',                    modelo:'8PK1068',       serie:'',           categoria:'Repuestos', unidad:'unidad',stock:20,  stockMin:5,  precio:0    },
  { codigo:15, descripcion:'Filtro de aceite',          descripcionZh:'机油滤清器',  modelo:'2640',          serie:'',           categoria:'Repuestos', unidad:'unidad',stock:45,  stockMin:10, precio:0    },
  { codigo:16, descripcion:'Filtro de aire primario',   descripcionZh:'空气滤清器',  modelo:'AF25557',       serie:'',           categoria:'Repuestos', unidad:'unidad',stock:32,  stockMin:5,  precio:0    },
  { codigo:17, descripcion:'Soporte de ventilado',      descripcionZh:'散热器支架',  modelo:'SV-200',        serie:'',           categoria:'Repuestos', unidad:'unidad',stock:2,   stockMin:1,  precio:2270 },
  { codigo:18, descripcion:'Aspa de motor',             descripcionZh:'发动机风扇',  modelo:'AM-450',        serie:'',           categoria:'Repuestos', unidad:'unidad',stock:2,   stockMin:1,  precio:2094 },
  { codigo:19, descripcion:'Polea tensora',             descripcionZh:'张紧轮',              modelo:'PT-88',         serie:'',           categoria:'Repuestos', unidad:'unidad',stock:3,   stockMin:2,  precio:386  },
  { codigo:20, descripcion:'Una 9W8452RC',              descripcionZh:'斗齿',                    modelo:'9W8452RC',      serie:'',           categoria:'Repuestos', unidad:'unidad',stock:301, stockMin:30, precio:0    },
]

async function seed() {
  console.log('\n Cargando datos iniciales SAJAMA 4x4...')

  // Usuario admin
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'admin@sajama.com', 'admin123')
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre:'Administrador', email:'admin@sajama.com', rol:'administrador', activo:true,
    })
    console.log('OK Usuario admin creado: admin@sajama.com / admin123')
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') console.log('Usuario admin ya existe')
    else console.error('Error creando admin:', e.message)
  }

  // Limpiar inventario anterior
  console.log('Limpiando inventario anterior...')
  const snap = await getDocs(query(collection(db, 'inventario')))
  for (const d of snap.docs) await deleteDoc(doc(db, 'inventario', d.id))
  console.log('Eliminados ' + snap.docs.length + ' items anteriores')

  // Cargar inventario real
  for (const item of INVENTARIO) {
    await addDoc(collection(db, 'inventario'), {
      ...item, totalSalidas:0, fotoUrl:null, notas:'', ubicacion:'',
      creadoPor:'seed', actualizadoEn:new Date(), creadoEn:new Date(),
    })
  }
  console.log('OK ' + INVENTARIO.length + ' items cargados con descripcion en chino y serie')
  console.log('\nListo! Abre http://localhost:3000')
  console.log('   Email:    admin@sajama.com')
  console.log('   Password: admin123')
  process.exit(0)
}

seed().catch(e => { console.error('Error:', e); process.exit(1) })
