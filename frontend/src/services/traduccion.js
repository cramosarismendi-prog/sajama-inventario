/**
 * Servicio de traducción ES → Chino Simplificado
 * 1° Diccionario local de términos técnicos (offline, rápido, preciso)
 * 2° Respaldo con MyMemory API (online) para términos que el diccionario no conoce
 */

// Si agregás tu correo aquí, MyMemory sube el límite gratuito de
// 5,000 a 50,000 caracteres por día. Dejalo vacío '' si no querés usarlo.
const MYMEMORY_EMAIL = ''

// ── Diccionario principal de términos técnicos ────────────────────────
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

  // ── Categorías ────────────────────────────────────────────────────────
  'repuesto':                  '备件',
  'repuestos':                 '备件',
  'maquinaria':                '机械',
  'equipo':                    '设备',
  'material':                  '材料',
  'insumo':                    '耗材',
  'herramienta':               '工具',
  'accesorio':                 '配件',

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

// Conectores en español que se omiten al traducir, para no dejar
// palabras sueltas en español mezcladas con el resultado en chino.
const CONECTORES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'para', 'por', 'y', 'a', 'al'])

// Detecta si una palabra es un código/modelo técnico (contiene al menos un dígito),
// en cuyo caso se mantiene tal cual en el resultado (ej: "15W-40", "GL-5", "8PK1340").
const esCodigoTecnico = (palabraOriginal) => /\d/.test(palabraOriginal)

// Claves del diccionario ordenadas por cantidad de palabras (de más a menos),
// para intentar siempre la coincidencia de frase más larga primero.
const CLAVES_ORDENADAS = Object.keys(DICCIONARIO)
  .map(clave => ({ clave, partes: clave.split(/\s+/) }))
  .sort((a, b) => b.partes.length - a.partes.length)

// ── Respaldo online: MyMemory API ───────────────────────────────────
// Se usa SOLO cuando el diccionario local no reconoce nada del texto.
// Gratuita, sin necesidad de API key. Límite: 5,000 caracteres/día sin
// email configurado, o 50,000/día si se define MYMEMORY_EMAIL arriba.
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
    // Si devolvió el mismo texto sin traducir, o confianza muy baja, descartar
    if (traduccion.trim().toLowerCase() === texto.trim().toLowerCase()) return ''
    if (typeof confianza === 'number' && confianza < 0.3) return ''
    // Verificación básica de que el resultado contenga caracteres chinos
    if (!/[\u4e00-\u9fff]/.test(traduccion)) return ''

    return traduccion.trim()
  } catch (e) {
    // Sin internet, API caída, o límite diario alcanzado: seguimos sin traducción online
    return ''
  }
}

// ── Función principal de traducción ─────────────────────────────────
const CACHE = new Map()

export const traducirAlChino = async (texto) => {
  if (!texto || texto.trim().length < 2) return ''

  const original = texto.trim()
  const textoBajo = original.toLowerCase()
  if (CACHE.has(textoBajo)) return CACHE.get(textoBajo)

  // 1. Búsqueda exacta de la frase completa en el diccionario local
  if (DICCIONARIO[textoBajo]) {
    CACHE.set(textoBajo, DICCIONARIO[textoBajo])
    return DICCIONARIO[textoBajo]
  }

  // 2. Segmentación palabra por palabra: recorre todo el texto de
  //    izquierda a derecha, buscando en cada posición la frase más
  //    larga posible del diccionario, para traducir el texto completo
  //    (no solo la primera coincidencia).
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
      // Conector español — se omite, no se mezcla idioma.
    } else if (esCodigoTecnico(palabraOriginal)) {
      // Código/modelo técnico — se mantiene tal cual.
      resultado.push(palabraOriginal)
    }
    // Palabra en español sin traducción conocida: se omite por ahora,
    // se intentará resolver todo el texto con la API en el paso 3.

    i += 1
  }

  if (huboTraduccion && resultado.length > 0) {
    const final = resultado.join('')
    CACHE.set(textoBajo, final)
    return final
  }

  // 3. El diccionario no reconoció nada — intentar con MyMemory (online)
  const resultadoAPI = await traducirConMyMemory(original)
  if (resultadoAPI) {
    CACHE.set(textoBajo, resultadoAPI)
    return resultadoAPI
  }

  // 4. No se encontró ninguna traducción — devolver vacío
  //    (el usuario puede completar manualmente).
  return ''
}

/**
 * Traduce múltiples textos en lote (para importación Excel)
 */
export const traducirLote = async (textos, onProgreso) => {
  const resultados = []
  for (let i = 0; i < textos.length; i++) {
    resultados.push(await traducirAlChino(textos[i]))
    if (onProgreso) onProgreso(Math.round(((i + 1) / textos.length) * 100))
  }
  return resultados
}

/**
 * Devuelve cuántos términos tiene el diccionario
 */
export const totalTerminos = () => Object.keys(DICCIONARIO).length