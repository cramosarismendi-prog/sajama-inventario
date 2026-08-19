/**
 * Servicio de traducción ES → Chino Simplificado
 * 1° Diccionario local de términos técnicos (offline, rápido, preciso)
 * 2° Respaldo con MyMemory API (online) para términos que el diccionario no conoce
 */

const MYMEMORY_EMAIL = ''

const DICCIONARIO = {
  // ── Correas ──────────────────────────────────────────────────────────
  'correa':                    '皮带',
  'correa de transmisión':     '传动带',
  'correa dentada':            '齿形皮带',
  'correa trapezoidal':        '三角皮带',
  'correa poly v':             '多楔带',
  'correa acanalada':          '多槽皮带',
  'correa de distribución':    '正时皮带',
  'correa alternador':         '发电机皮带',
  'correa ventilador':         '风扇皮带',
  'banda transportadora':      '输送带',

  // ── Filtros ──────────────────────────────────────────────────────────
  'filtro':                    '滤清器',
  'filtro de aceite':          '机油滤清器',
  'filtro de aire':            '空气滤清器',
  'filtro de combustible':     '燃油滤清器',
  'filtro de gasoil':          '柴油滤清器',
  'filtro hidráulico':         '液压滤清器',
  'filtro de cabina':          '驾驶室滤清器',
  'filtro separador':          '分离器滤清器',
  'filtro primario':           '主滤清器',
  'filtro secundario':         '副滤清器',
  'prefiltro':                 '预过滤器',

  // ── Aceites y fluidos ─────────────────────────────────────────────────
  'aceite':                    '机油',
  'aceite de motor':           '发动机机油',
  'aceite hidráulico':         '液压油',
  'aceite de transmisión':     '变速箱油',
  'aceite de diferencial':     '差速器油',
  'aceite 15w-40':             '15W-40机油',
  'aceite 85w-140':            '85W-140齿轮油',
  'aceite 80w-90':             '80W-90齿轮油',
  'aceite 10w-30':             '10W-30机油',
  'líquido hidráulico':        '液压液',
  'líquido refrigerante':      '冷却液',
  'líquido de frenos':         '制动液',
  'grasa':                     '润滑脂',
  'grasa de litio':            '锂基润滑脂',
  'grasa de calcio':           '钙基润滑脂',
  'grasa sódica':              '钠基润滑脂',
  'grasa multiuso':            '多功能润滑脂',
  'grasa multiusos':           '多功能润滑脂',
  'grasa de grafito':          '石墨润滑脂',
  'grasa de silicona':         '硅基润滑脂',
  'lubricante':                '润滑剂',
  'refrigerante':              '防冻液',
  'anticongelante':            '防冻剂',
  'litio':                     '锂',
  'calcio':                    '钙',
  'sódico':                    '钠基',
  'sódica':                    '钠基',
  'grafito':                   '石墨',
  'silicona':                  '硅胶',
  'poliurea':                  '聚脲',

  // ── Uñas y dientes de excavadora ─────────────────────────────────────
  'uña':                       '斗齿',
  'uña de excavadora':         '挖掘机斗齿',
  'diente de balde':           '铲斗齿',
  'adaptador de uña':          '斗齿座',
  'pasador de uña':            '斗齿销',
  'lateral':                   '侧刃',
  'lateral de balde':          '铲斗侧刃',
  'cuchilla':                  '刀片',
  'cuchilla de bulldozer':     '推土机刀片',
  'balde':                     '铲斗',
  'cantonera':                 '角铁护板',

  // ── Motor y componentes ───────────────────────────────────────────────
  'motor':                     '发动机',
  'aspa de motor':             '发动机风扇叶',
  'aspa':                      '风扇叶',
  'ventilador':                '风扇',
  'soporte de ventilado':      '散热器支架',
  'soporte':                   '支架',
  'polea':                     '皮带轮',
  'polea tensora':             '张紧轮',
  'polea loca':                '惰轮',
  'polea cigüeñal':            '曲轴皮带轮',
  'cigüeñal':                  '曲轴',
  'árbol de levas':            '凸轮轴',
  'pistón':                    '活塞',
  'anillo de pistón':          '活塞环',
  'culata':                    '气缸盖',
  'junta de culata':           '气缸盖垫',
  'turbocompresor':            '涡轮增压器',
  'turbo':                     '涡轮',
  'intercooler':               '中冷器',
  'bomba de agua':             '水泵',
  'bomba de aceite':           '机油泵',
  'bomba de combustible':      '燃油泵',
  'bomba hidráulica':          '液压泵',
  'radiador':                  '散热器',
  'termostato':                '节温器',
  'tensor':                    '张紧器',
  'tensor de correa':          '皮带张紧器',

  // ── Sistema eléctrico ─────────────────────────────────────────────────
  'electroválvula':            '电磁阀',
  'electroválvula cuádruple':  '四联电磁阀',
  'electroválvula doble':      '双联电磁阀',
  'alternador':                '发电机',
  'motor de arranque':         '启动马达',
  'batería':                   '电池',
  'fusible':                   '保险丝',
  'relay':                     '继电器',
  'sensor':                    '传感器',
  'sensor de temperatura':     '温度传感器',
  'sensor de presión':         '压力传感器',

  // ── Frenos y suspensión ───────────────────────────────────────────────
  'válvula de freno':          '制动阀',
  'válvula':                   '阀门',
  'freno':                     '制动器',
  'pastilla de freno':         '刹车片',
  'disco de freno':            '制动盘',
  'amortiguador':              '减震器',
  'resorte':                   '弹簧',
  'rótula':                    '球头',
  'buje':                      '衬套',
  'rodamiento':                '轴承',
  'retén':                     '油封',
  'sello':                     '密封件',
  'junta':                     '垫片',
  'junta tórica':              'O型圈',
  'empaque':                   '衬垫',

  // ── Transmisión ───────────────────────────────────────────────────────
  'caja de cambios':           '变速箱',
  'transmisión':               '变速器',
  'convertidor de par':        '变矩器',
  'diferencial':               '差速器',
  'cardán':                    '传动轴',
  'cruceta':                   '万向节',
  'embrague':                  '离合器',
  'disco de embrague':         '离合器片',
  'plato de presión':          '压盘',

  // ── Tren de rodaje (excavadora/bulldozer) ─────────────────────────────
  'cadena':                    '履带链',
  'eslabón de cadena':         '链节',
  'zapata':                    '履带板',
  'rueda motriz':              '驱动轮',
  'rueda tensora':             '引导轮',
  'rodillo superior':          '上滚轮',
  'rodillo inferior':          '下滚轮',
  'sprocket':                  '链轮',
  'idler':                     '引导轮',
  'track':                     '履带',

  // ── Categorías generales ────────────────────────────────────────────
  'repuesto':                  '备件',
  'repuestos':                 '备件',
  'maquinaria':                '机械',
  'equipo':                    '设备',
  'material':                  '材料',
  'insumo':                    '耗材',
  'herramienta':                '工具',
  'accesorio':                 '配件',

  // ── PAPELERÍA Y ESCRITURA ──────────────────────────────────────────
  'papel':                     '纸',
  'papel bond':                '复印纸',
  'papel a4':                  'A4纸',
  'papel carta':                '信纸',
  'papel oficio':              '公文纸',
  'resma':                     '一令纸',
  'resma de papel':            '一令复印纸',
  'cuaderno':                  '笔记本',
  'libreta':                   '记事本',
  'agenda':                    '记事簿',
  'block de notas':            '便签本',
  'lapiz':                     '铅笔',
  'lápiz':                     '铅笔',
  'boligrafo':                 '圆珠笔',
  'bolígrafo':                 '圆珠笔',
  'lapicero':                  '圆珠笔',
  'marcador':                  '记号笔',
  'marcador permanente':       '记号笔',
  'resaltador':                '荧光笔',
  'plumón':                    '记号笔',
  'corrector':                 '修正液',
  'liquido corrector':         '修正液',
  'goma de borrar':            '橡皮擦',
  'borrador':                  '橡皮擦',
  'sacapuntas':                '卷笔刀',
  'regla':                     '尺子',
  'tijera':                    '剪刀',
  'tijeras':                   '剪刀',
  'cutter':                    '美工刀',
  'cinta adhesiva':            '胶带',
  'cinta scotch':              '透明胶带',
  'cinta de embalaje':         '包装胶带',
  'pegamento':                 '胶水',
  'goma':                      '胶水',
  'silicona liquida':          '硅胶胶水',

  // ── ARCHIVO Y OFICINA ────────────────────────────────────────────────
  'carpeta':                   '文件夹',
  'folder':                    '文件夹',
  'archivador':                '档案盒',
  'sobre':                     '信封',
  'sobre manila':              '牛皮纸信封',
  'clip':                      '回形针',
  'clips':                     '回形针',
  'clip mariposa':             '燕尾夹',
  'gancho mariposa':           '燕尾夹',
  'grapa':                     '订书钉',
  'grapas':                    '订书钉',
  'engrapadora':               '订书机',
  'grapadora':                 '订书机',
  'quitagrapas':               '起钉器',
  'perforadora':               '打孔机',
  'post it':                   '便利贴',
  'nota adhesiva':             '便利贴',
  'notas adhesivas':           '便利贴',
  'separador':                 '文件分隔页',
  'sello':                     '印章',
  'tinta para sello':          '印油',
  'almohadilla de tinta':      '印台',

  // ── IMPRESIÓN Y CÓMPUTO ─────────────────────────────────────────────
  'tinta':                     '墨水',
  'cartucho de tinta':         '墨盒',
  'toner':                     '碳粉',
  'tóner':                     '碳粉',
  'cartucho de toner':         '硒鼓',
  'impresora':                 '打印机',
  'fotocopiadora':             '复印机',
  'escaner':                   '扫描仪',
  'escáner':                   '扫描仪',
  'usb':                       'U盘',
  'memoria usb':               'U盘',
  'pila':                      '电池',
  'pilas':                     '电池',
  'pila aa':                   '5号电池',
  'pila aaa':                  '7号电池',
  'calculadora':               '计算器',
  'mouse':                     '鼠标',
  'teclado':                   '键盘',
  'cable':                     '电缆',
  'cable usb':                 'USB线',
  'extension electrica':       '电源延长线',

  // ── LIMPIEZA E HIGIENE ───────────────────────────────────────────────
  'detergente':                '洗涤剂',
  'jabon':                     '肥皂',
  'jabón':                     '肥皂',
  'jabon liquido':             '洗手液',
  'desinfectante':             '消毒剂',
  'lejia':                     '漂白水',
  'lejía':                     '漂白水',
  'cloro':                     '漂白水',
  'alcohol':                   '酒精',
  'alcohol en gel':            '酒精凝胶',
  'escoba':                    '扫帚',
  'trapeador':                 '拖把',
  'mopa':                      '拖把',
  'recogedor':                 '簸箕',
  'basurero':                  '垃圾桶',
  'tacho de basura':           '垃圾桶',
  'bolsa de basura':           '垃圾袋',
  'papel higienico':           '卫生纸',
  'papel higiénico':           '卫生纸',
  'papel toalla':              '纸巾',
  'servilleta':                '餐巾纸',
  'toalla de papel':           '纸巾',
  'guante':                    '手套',
  'guantes':                   '手套',
  'guantes de latex':          '乳胶手套',
  'mascarilla':                '口罩',
  'ambientador':                '空气清新剂',
  'desodorante ambiental':      '空气清新剂',
  'esponja':                   '海绵',
  'franela':                   '抹布',
  'trapo':                     '抹布',

  // ── Unidades ──────────────────────────────────────────────────────────
  'unidad':                    '个',
  'par':                       '对',
  'juego':                     '套',
  'litro':                     '升',
  'balde':                     '桶',
  'caja':                      '箱',
  'rollo':                     '卷',
  'metro':                     '米',
  'kilogramo':                 '千克',

  // ── Marcas comunes (no traducir, mantener igual) ──────────────────────
  'caterpillar':               'Caterpillar',
  'komatsu':                   'Komatsu',
  'volvo':                     'Volvo',
  'hitachi':                   'Hitachi',
  'doosan':                    'Doosan',
  'hyundai':                   'Hyundai',
  'cummins':                   'Cummins',
  'john deere':                'John Deere',
  'gates':                     'Gates',
  'dayco':                     'Dayco',
  'contitech':                 'Contitech',
  'fleetguard':                'Fleetguard',
  'baldwin':                   'Baldwin',
  'mann':                      'Mann',
  'wix':                       'WIX',
  'bosch':                     'Bosch',
  'mahle':                     'Mahle',

  // ── Posiciones y ubicaciones ──────────────────────────────────────────
  'delantero':                 '前',
  'trasero':                   '后',
  'izquierdo':                 '左',
  'derecho':                   '右',
  'superior':                  '上',
  'inferior':                  '下',
  'interno':                   '内',
  'externo':                   '外',
  'original':                  '原厂',
  'genérico':                  '通用',
}

const CONECTORES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'para', 'por', 'y', 'a', 'al'])

const esCodigoTecnico = (palabraOriginal) => /\d/.test(palabraOriginal)

const CLAVES_ORDENADAS = Object.keys(DICCIONARIO)
  .map(clave => ({ clave, partes: clave.split(/\s+/) }))
  .sort((a, b) => b.partes.length - a.partes.length)

async function traducirConMyMemory(texto) {
  try {
    const params = new URLSearchParams({
      q: texto,
      langpair: 'es|zh-CN',
    })
    if (MYMEMORY_EMAIL) params.set('de', MYMEMORY_EMAIL)

    const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`)
    if (!res.ok) return ''

    const data = await res.json()
    const traduccion = data?.responseData?.translatedText
    const confianza  = data?.responseData?.match

    if (!traduccion) return ''
    if (traduccion.trim().toLowerCase() === texto.trim().toLowerCase()) return ''
    if (typeof confianza === 'number' && confianza < 0.3) return ''
    if (!/[\u4e00-\u9fff]/.test(traduccion)) return ''

    return traduccion.trim()
  } catch (e) {
    return ''
  }
}

const CACHE = new Map()

export const traducirAlChino = async (texto) => {
  if (!texto || texto.trim().length < 2) return ''

  const original = texto.trim()
  const textoBajo = original.toLowerCase()
  if (CACHE.has(textoBajo)) return CACHE.get(textoBajo)

  if (DICCIONARIO[textoBajo]) {
    CACHE.set(textoBajo, DICCIONARIO[textoBajo])
    return DICCIONARIO[textoBajo]
  }

  const palabrasOriginales = original.split(/\s+/).filter(Boolean)
  const palabrasBajas = palabrasOriginales.map(p => p.toLowerCase())

  const resultado = []
  let i = 0
  let huboTraduccion = false

  while (i < palabrasBajas.length) {
    let coincidencia = null

    for (const { clave, partes } of CLAVES_ORDENADAS) {
      const n = partes.length
      if (i + n > palabrasBajas.length) continue
      const segmento = palabrasBajas.slice(i, i + n).join(' ')
      if (segmento === clave) { coincidencia = { n, zh: DICCIONARIO[clave] }; break }
    }

    if (coincidencia) {
      resultado.push(coincidencia.zh)
      i += coincidencia.n
      huboTraduccion = true
      continue
    }

    const palabraOriginal = palabrasOriginales[i]
    const palabraBaja = palabrasBajas[i]

    if (CONECTORES.has(palabraBaja)) {
      // se omite
    } else if (esCodigoTecnico(palabraOriginal)) {
      resultado.push(palabraOriginal)
    }

    i += 1
  }

  if (huboTraduccion && resultado.length > 0) {
    const final = resultado.join('')
    CACHE.set(textoBajo, final)
    return final
  }

  const resultadoAPI = await traducirConMyMemory(original)
  if (resultadoAPI) {
    CACHE.set(textoBajo, resultadoAPI)
    return resultadoAPI
  }

  return ''
}

export const traducirLote = async (textos, onProgreso) => {
  const resultados = []
  for (let i = 0; i < textos.length; i++) {
    resultados.push(await traducirAlChino(textos[i]))
    if (onProgreso) onProgreso(Math.round(((i + 1) / textos.length) * 100))
  }
  return resultados
}

export const totalTerminos = () => Object.keys(DICCIONARIO).length