/**
 * Servicio de traducción ES → Chino Simplificado
 * Diccionario local de términos técnicos de repuestos y maquinaria pesada
 * No requiere internet ni API Key — funciona completamente offline
 */

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
  'lubricante':                '润滑剂',
  'refrigerante':              '防冻液',
  'anticongelante':            '防冻剂',

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

// ── Función principal de traducción ─────────────────────────────────
const CACHE = new Map()

export const traducirAlChino = async (texto) => {
  if (!texto || texto.trim().length < 2) return ''

  const textoBajo = texto.trim().toLowerCase()
  if (CACHE.has(textoBajo)) return CACHE.get(textoBajo)

  // 1. Búsqueda exacta
  if (DICCIONARIO[textoBajo]) {
    CACHE.set(textoBajo, DICCIONARIO[textoBajo])
    return DICCIONARIO[textoBajo]
  }

  // 2. Buscar si el texto contiene alguna frase del diccionario (de más largo a más corto)
  const claves = Object.keys(DICCIONARIO).sort((a, b) => b.length - a.length)
  for (const clave of claves) {
    if (textoBajo.includes(clave)) {
      // Construir traducción reemplazando la parte conocida
      const zhParte = DICCIONARIO[clave]
      // Extraer el resto (modelo/código técnico)
      const resto = texto.trim().replace(new RegExp(clave, 'i'), '').trim()
      const resultado = resto ? `${zhParte} ${resto}` : zhParte
      CACHE.set(textoBajo, resultado)
      return resultado
    }
  }

  // 3. Traducción palabra por palabra
  const palabras = textoBajo.split(/[\s\/\-]+/).filter(Boolean)
  const traducidas = palabras.map(p => DICCIONARIO[p] || p)
  const resultado = traducidas.join(' ')

  // Si al menos una palabra fue traducida, devolver resultado
  const alguna = traducidas.some((t, i) => t !== palabras[i])
  if (alguna) {
    CACHE.set(textoBajo, resultado)
    return resultado
  }

  // 4. No encontrado — devolver vacío (el usuario puede llenar manualmente)
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
