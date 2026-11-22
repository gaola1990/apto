// Búsqueda de Apto: cómo se comparan las palabras del vendedor con el texto de una licitación.
// 1) Por palabras, no por frase exacta: "mantención de computadores" calza con "mantención y reparación de computadores".
// 2) Con variantes de la misma palabra: mantención, mantenimiento, mantener.
// 3) Con sinónimos de compras públicas: pc = computador = equipo computacional.
// 4) Sin falsos calces: las siglas cortas (pc, tv, ups) solo calzan como palabra suelta, y hay prefijos engañosos bloqueados.
// Archivo sin dependencias: lo usa la página y también las pruebas (node).
(function(g){
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
const VACIAS = new Set("de del la las el los y e o u para con en por a al un una sus su servicio servicios adquisicion suministro compra contratacion".split(" "));
// Grupos de sinónimos (todas las palabras de un grupo valen lo mismo). Se pueden sumar más con sinonimos.json.
const SIN = [
  ["computador","pc","computadora","equipo computacional","estacion de trabajo","desktop"],
  ["notebook","laptop","computador portatil"],
  ["tablet","tableta"],
  ["computacion","informatica"],
  ["mantencion","mantenimiento"],
  ["impresora","multifuncional","fotocopiadora"],
  ["toner","cartucho","tinta"],
  ["impresion","imprenta"],
  ["software","programa computacional"],
  ["mouse","raton"],
  ["proyector","datashow","data show"],
  ["televisor","tv","television","smart tv"],
  ["celular","smartphone","telefono movil"],
  ["parlante","altavoz"],
  ["ups","respaldo de energia"],
  ["cableado","red de datos"],
  ["aseo","limpieza"],
  ["fumigacion","control de plagas","desratizacion","desinsectacion"],
  ["banqueteria","catering"],
  ["colacion","almuerzo"],
  ["cesped","pasto"],
  ["jardineria","areas verdes","paisajismo"],
  ["capacitacion","curso","formacion"],
  ["pendon","roller","banner"],
  ["medicamento","farmaco"],
  ["insumo medico","insumo clinico"],
  ["kinesiologia","rehabilitacion","fisioterapia"],
  ["camioneta","pickup","pick up"],
  ["automovil","auto","vehiculo liviano"],
  ["uniforme","ropa de trabajo","vestuario corporativo"],
  ["zapato","calzado"],
  ["mueble","mobiliario"],
  ["guardia","vigilante","seguridad privada"],
  ["cctv","camara de seguridad","videovigilancia","televigilancia"],
  ["aire acondicionado","climatizacion"],
  ["generador","grupo electrogeno"],
  ["extintor","extinguidor"],
  ["arriendo","arrendamiento","alquiler"],
  ["carpa","toldo"],
  ["arreglo floral","flores","corona de flores"],
  ["gasfiteria","fontaneria","plomeria"],
  ["electricidad","instalacion electrica"],
  // revisados a partir de licitaciones reales (2026-11-18): solo equivalentes, no términos más amplios ni más específicos
  ["vencimiento","caducidad"],
  ["dental","odontologico"],
  ["bolsa","saco"],
  ["canaleta","canalon"],
  ["lapiz pasta","boligrafo"],
  ["corchetera","engrapadora"],
  ["corchete","grapa"],
  ["scotch","cinta adhesiva"],
  ["plumon","marcador"],
  ["guardapolvo","delantal"],
  ["mascarilla","cubrebocas","tapaboca"],
  ["alcohol gel","gel desinfectante"],
  ["cloro","hipoclorito"],
  ["confort","papel higienico"],
  ["basurero","papelero","contenedor de basura"],
  ["escoba","escobillon"],
  ["trapero","mopa"],
  ["polera","camiseta"],
  ["poleron","sudadera"],
  ["esfigmomanometro","tomador de presion","tensiometro"],
  ["oximetro","saturometro"],
  ["memoria usb","pendrive","pen drive"],
  ["router","enrutador"],
  ["access point","punto de acceso"],
  ["escaner","scanner"],
  ["plotter","trazador"],
  ["furgon","van"],
  ["petroleo","diesel"],
  ["parafina","kerosene"],
  ["calefont","calentador de agua"],
  ["estufa","calefactor"],
  ["fierro","hierro"],
  ["agua purificada","agua envasada","bidon de agua"],
  ["escenario","tarima"],
  ["relator","facilitador","capacitador"],
  ["consultoria","asesoria"],
  ["sanitizacion","desinfeccion"],
  ["basura","residuos","desechos"],
  ["retiro de basura","recoleccion de residuos","retiro de residuos"],
  ["ascensor","elevador"],
  ["portero","conserje"],
  ["lavanderia","lavado de ropa"],
  ["ropa de cama","lenceria"],
  ["corona de caridad","ofrenda floral"],
  ["afiche","poster","cartel"],
  ["flyer","folleto"],
  ["timbre","sello"],
  ["lienzo","pasacalle"],
  ["gigantografia","impresion gran formato"],
  ["epp","proteccion personal"],
  ["desfibrilador","dea"],
  ["estante","estanteria","repisa"],
  ["locker","casillero"],
  ["pizarra","pizarron"],
  ["kardex","mueble archivador"]
];
// Abreviaturas que usan compradores y vendedores (sacadas de los nombres reales de licitaciones).
// Se expanden en los dos lados: en el texto de la licitación y en lo que escribe el vendedor.
const ABREV = {
  serv: "servicio", adq: "adquisicion", adqui: "adquisicion", sum: "suministro", mant: "mantencion", mantenc: "mantencion",
  mej: "mejoramiento", const: "construccion", constr: "construccion", conserv: "conservacion", rep: "reparacion",
  repar: "reparacion", repos: "reposicion", eq: "equipo", equip: "equipo", equipam: "equipamiento", inst: "instalacion",
  prod: "producto", sist: "sistema", pav: "pavimentacion", disp: "dispositivo", iny: "inyectable", liof: "liofilizado",
  prev: "preventiva", proy: "proyecto", prog: "programa", pgma: "programa", hosp: "hospital", esc: "escuela",
  mun: "municipal", insum: "insumo", ins: "insumo", comput: "computador", computac: "computacion", elec: "electrico",
  electr: "electrico", aliment: "alimentacion", capac: "capacitacion", mobil: "mobiliario", vehic: "vehiculo",
  impr: "impresion", mat: "material", mater: "material", herram: "herramienta", ilum: "iluminacion",
  climat: "climatizacion", calef: "calefaccion", ascens: "ascensor", artic: "articulo", art: "articulo",
  med: "medico", medic: "medicamento", odont: "odontologico", kine: "kinesiologia", rehab: "rehabilitacion",
  lab: "laboratorio", inform: "informatica", tecnol: "tecnologia", ofic: "oficina", unid: "unidad", und: "unidad",
  uds: "unidades", cap: "capacitacion", transp: "transporte", arr: "arriendo", arrend: "arriendo", segur: "seguridad",
  vig: "vigilancia", limp: "limpieza", jard: "jardineria", fum: "fumigacion", desr: "desratizacion"
};
const expandirPalabras = ps => ps.flatMap(p => ABREV[p] ? [p, ABREV[p]] : [p]);
const expandir = texto => expandirPalabras(texto.split(" ")).join(" ");

// Errores de escritura: si una palabra del vendedor no existe en ninguna licitación, se busca la más parecida
// del vocabulario real (1 letra de diferencia en palabras cortas, 2 en largas): "computadres" -> "computadores".
let VOCAB = null, PORLARGO = null;
const correcciones = new Map();
function vocabulario(listaPalabras){
  VOCAB = new Map(); PORLARGO = new Map();
  for(const ps of listaPalabras) for(const p of ps) if(p.length >= 4 && !/\d/.test(p)) VOCAB.set(p, (VOCAB.get(p) || 0) + 1);
  for(const [p] of VOCAB){ if(!PORLARGO.has(p.length)) PORLARGO.set(p.length, []); PORLARGO.get(p.length).push(p); }
}
function distancia(a, b, tope){ // Damerau-Levenshtein con corte temprano
  if(Math.abs(a.length - b.length) > tope) return tope + 1;
  let prev2 = null, prev = Array.from({length: b.length + 1}, (_, j) => j);
  for(let i = 1; i <= a.length; i++){
    const cur = [i]; let min = i;
    for(let j = 1; j <= b.length; j++){
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if(prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v); if(v < min) min = v;
    }
    if(min > tope) return tope + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
function existe(w){
  if(!VOCAB) return true;
  const r = raiz(w);
  // una palabra del catálogo de productos (galletas, ensaladas) está bien escrita aunque hoy ninguna compra la nombre
  if(DVOC && (DVOC.has(w) || DVOC.has(r))) return true;
  if(VOCAB.has(w)) return true;
  for(const [p] of VOCAB) if(p.startsWith(r)) return true;
  return false;
}
function corregir(w){
  if(!VOCAB || w.length < 5 || /\d/.test(w) || existe(w)) return null;
  const tope = w.length <= 7 ? 1 : 2;
  let mejor = null, md = tope + 1, mf = 0;
  for(let L = w.length - tope; L <= w.length + tope; L++){
    for(const p of PORLARGO.get(L) || []){
      const d = distancia(w, p, tope);
      const f = VOCAB.get(p);
      if(d < md || (d === md && f > mf)){ mejor = p; md = d; mf = f; }
    }
  }
  return md <= tope ? mejor : null;
}

// Prefijos que parecen la palabra pero son otra cosa ("computarizado" no es un computador).
const ENGANOSOS = {computador: ["computariz"], auto: ["automat","autor","autoclav","autonom"], curso: ["cursor"], flor: ["florid", "florest"]};
function raiz(w){
  if(w.length <= 3) return w;
  for(const s of ["mientos","miento","ciones","cion","es","s"]){
    if(w.endsWith(s) && w.length - s.length >= 4) return w.slice(0, -s.length);
  }
  return w;
}
function alternativa(w){ return w.includes(" ") ? {w, multi:true} : {w, raiz: raiz(w), exacto: w.length <= 3}; }
let indice = null;
function indexar(){ indice = new Map(); SIN.forEach((grupo, i) => grupo.forEach(t => indice.set(t.includes(" ") ? t : raiz(t), i))); }
function sumarSinonimos(grupos){ (grupos || []).forEach(gr => { const n = gr.map(norm).filter(Boolean); if(n.length > 1) SIN.push(n); }); indexar(); }
function alternativas(w){
  if(!indice) indexar();
  const base = [w];
  if(!w.includes(" ") && ABREV[w]) base.push(ABREV[w]);                  // "mant" -> mantencion
  if(!w.includes(" ") && !ABREV[w]){ const c = corregir(w); if(c){ base.push(c); correcciones.set(w, c); } } // error de escritura
  const todas = new Set();
  for(const b of base){
    todas.add(b);
    const i = indice.get(b.includes(" ") ? b : raiz(b));
    if(i !== undefined) SIN[i].forEach(t => todas.add(t));
  }
  // una abreviatura corta sola ("mant") no busca por prefijo: calzaría con "mantel" o "manteca"
  return [...todas].map(t => ABREV[t] && t !== w ? null : (ABREV[t] ? {w: t, raiz: t, exacto: true} : alternativa(t))).filter(Boolean);
}
// Un término del vendedor se convierte en conceptos; la licitación calza si tiene todos los conceptos.
function armar(t){
  t = norm(t);
  if(!indice) indexar();
  let conceptos;
  const tr = t.split(" ").map(raiz).join(" ");                         // "arreglos florales" -> "arreglo floral"
  if(t.includes(" ") && indice.has(t)) conceptos = [alternativas(t)];   // la frase entera es un sinónimo conocido
  else if(t.includes(" ") && indice.has(tr)) conceptos = [alternativas(tr)];
  else {
    const ws = t.split(" ").filter(w => w && !VACIAS.has(w) && !VACIAS.has(ABREV[w])); // "serv", "adq" son tan genéricas como "servicio"
    conceptos = (ws.length ? ws : [t]).map(alternativas);
  }
  const a = conceptos[0][0];
  return {t, frase: conceptos.length > 1, conceptos, raiz: a.raiz || a.w, exacto: !!a.exacto};
}
const TERMINACION = /^(s|es|a|as|o|os|e|en|ar|ara|aran|er|ir|ado|ada|ados|adas|ido|ida|idos|idas|cion|ciones|miento|mientos|ito|ita|itos|itas|illo|illa|illos|illas|al|ales|ero|era|eros|eras|eria|erias|ura|uras|ante|antes|ente|entes|or|ora|ores|oras|ivo|iva|ivos|ivas|ico|ica|icos|icas|mente|dor|dora|dores|doras|aje|ajes|ista|istas|izado|izada|izacion)?$/;
function calzaAlt(a, texto, palabras){
  if(a.multi){
    if((" " + texto + " ").includes(" " + a.w + " ")) return true;
    // misma frase con plural o variante ("insumo medico" calza con "insumos medicos"): cada palabra por su raíz y una terminación corta
    if(!a.rx){ const pp = a.w.split(" ").map(w => w.length <= 3 ? w : raiz(w)); a.rx = pp.every(p => /^[a-z0-9]+$/.test(p)) ? new RegExp("(^| )" + pp.map((p, i) => p + (a.w.split(" ")[i].length <= 3 ? "" : "[a-z]{0,3}")).join(" ") + "( |$)") : false; }
    return !!a.rx && a.rx.test(texto);
  }
  if(a.exacto) return palabras.includes(a.raiz);
  const malos = ENGANOSOS[a.raiz] || [];
  // con raíces cortas, lo que sigue debe ser una terminación del español ("flor" calza con floral o florería, no con
  // floresta; "cono" con conos, no con conocimiento). Las raíces largas ya son específicas.
  const corta = a.raiz.length <= 5;
  return palabras.some(p => p.startsWith(a.raiz) && !malos.some(m => p.startsWith(m)) && (!corta || TERMINACION.test(p.slice(a.raiz.length))));
}
// Usos que parecen el producto pero son otra cosa ("balón con droga" es un insumo clínico, no un balón de fútbol)
const CONTEXTO_MALO = {balon: /\b(stent|cateter|coronari|vascular|angio|dilatacion|procedimiento|oxigeno|droga|medicad|intragastric|traque|urinari|foley|trombe|congenit|hemodinami|cardiolog|balon de contrapulsacion)/,
  flor: /\bflores de bach|\bazucar flor|\bflor de sal\b/, cono: /\bcono (cervical|de papel)|\bconos? de (luz|sombra)\b/};
function calza(term, texto, palabras){
  const malo = CONTEXTO_MALO[term.raiz];
  if(malo && malo.test(texto)) return false;
  return term.conceptos.every(alts => alts.some(a => calzaAlt(a, texto, palabras)));
}
// Separa lo que escribió el vendedor en productos: comas, punto y coma, paréntesis, barras y saltos de línea.
// "Coffee break para empresas (pasteles, galletas)" -> coffee break, pasteles, galletas: lo que va después de "para" o
// "con" dice a quién o cómo vende, no qué vende.
function separar(texto){
  // el punto separa solo si empieza otra oración ("mant. de pc" se queda junto)
  return String(texto || "").split(/[,;()\[\]\/\n·•|]+|\.\s+(?=[A-ZÁÉÍÓÚÑ¿¡])|[¿?¡!]+/).map(norm).filter(Boolean)
    .map(t => t.replace(/^(y|e|o|tambien|ademas|venta de|servicio de|servicios de)\s+/, "").split(/\s+(para|con)\s+/)[0].trim())
    .filter(t => t.length >= 2 && t.split(" ").length <= 6 && !/^(no|si|ok|ya|saben|cierto|verdad|etc|a ver\b.*|que sepa.*)$/.test(t));
}
// Diccionario de productos de Mercado Público (diccionario.json): clase ONU -> nombre, palabras oficiales y palabras reales.
// Un término del vendedor apunta a las clases donde aparecen TODOS sus conceptos (con sinónimos y correcciones).
let DICC = null, DVOC = null;
function cargarDiccionario(clases){
  DICC = Object.entries(clases || {}).map(([c, [nombre, oficiales, reales]]) => {
    const n = norm(nombre).split(" "), o = oficiales.split(" ").filter(Boolean), r = reales.split(" ").filter(Boolean);
    return {c, nombre, n, nt: n.join(" "), o, ot: o.join(" "), r, rt: r.join(" ")};
  });
  DVOC = new Set(); DICC.forEach(k => k.n.concat(k.o, k.r).forEach(w => { if(w.length >= 4){ DVOC.add(w); DVOC.add(raiz(w)); } }));
}
// Puntaje de una clase para un concepto: la palabra tal cual vale más que un sinónimo, y aparecer en el NOMBRE de la
// clase vale más que en la lista de productos oficiales, que a su vez vale más que en las palabras reales.
function puntajeConcepto(alts, k){
  let mejor = 0;
  alts.forEach((a, i) => {
    const peso = i === 0 ? 1 : 0.6;                     // alts[0] es la palabra que escribió el vendedor
    const p = calzaAlt(a, k.nt, k.n) ? 5 : calzaAlt(a, k.ot, k.o) ? 3 : calzaAlt(a, k.rt, k.r) ? 1.5 : 0;
    if(p * peso > mejor) mejor = p * peso;
  });
  return mejor;
}
// Lo aprendido con el uso (aprendido.json, lo arma cada noche motor/aprender.py) y lo bloqueado por revisión humana.
let APR = new Map(), BLOQ = new Set();
function cargarAprendido(j){
  APR = new Map(); BLOQ = new Set();
  for(const [t, c, fuente, ev] of (j && j.relaciones) || []){ if(!APR.has(t)) APR.set(t, []); APR.get(t).push({c, fuente, ev}); }
  for(const [t, c] of (j && j.bloqueadas) || []) BLOQ.add(t + "|" + c);
}
function clasesDe(term, maximo = 5){
  const aprendidas = (APR.get(term.t) || []).filter(a => !BLOQ.has(term.t + "|" + a.c));
  let base = clasesDeDiccionario(term, maximo).filter(r => !BLOQ.has(term.t + "|" + r.c));
  // si el uso ya enseñó qué significa la palabra, las coincidencias débiles del catálogo ("carpas" = peces) se descartan
  if(aprendidas.length) base = base.filter(r => r.puntos > 3 && !aprendidas.some(a => a.c === r.c));
  const extra = aprendidas.map(a => ({c: a.c, nombre: (DICC && (DICC.find(k => k.c === a.c) || {}).nombre) || a.c, puntos: 6, aprendido: true}));
  return extra.concat(base).slice(0, maximo + extra.length);
}
// Categorías de un perfil completo. Cada término propone categorías y el resto de lo que escribió el vendedor desempata:
// "mantenimiento" junto a "poda" y "riego" es mantención de terrenos, no de vehículos; "transporte de pasajeros" junto a
// "buses" y "escolar" es por carretera, no aéreo. Una palabra suelta que apunta a rubros muy distintos y sin contexto
// que la respalde se queda solo con su mejor opción.
function segmento(c){ return String(c).slice(0, 2); }
function clasesDePerfil(terms, maximo = 5){
  if(!DICC) return [];
  const porC = new Map(DICC.map(k => [k.c, k]));
  const salida = new Map();
  terms.forEach((t, i) => {
    const otros = terms.filter((_, j) => j !== i);
    const cands = clasesDe(t, 12).map(r => {
      const k = porC.get(r.c);
      // qué otros términos del vendedor también aparecen en esta categoría (nombre, productos oficiales o palabras reales)
      const apoyos = k ? otros.map((o, j) => o.conceptos.some(alts => !alts[0].exacto && alts.some(a => calzaAlt(a, k.nt + " " + k.ot + " " + k.rt, k.n.concat(k.o, k.r)))) ? j : -1).filter(j => j >= 0) : [];
      return {...r, apoyos, ctx: apoyos.length};
    });
    // solo cuenta el contexto que DISTINGUE: si "pasajeros" aparece en aéreo, marítimo y carretera, no desempata;
    // "buses" o "escolar", que solo aparecen en carretera, sí
    const veces = new Map(); cands.forEach(r => r.apoyos.forEach(j => veces.set(j, (veces.get(j) || 0) + 1)));
    cands.forEach(r => { r.dist = r.apoyos.filter(j => veces.get(j) < cands.length).length; r.final = r.puntos + 1.5 * Math.min(r.ctx, 3); });
    if(!cands.length) return;
    cands.sort((a, b) => b.final - a.final);
    let quedan = cands.filter(r => r.final >= cands[0].final * 0.8 && (r.aprendido || r.final >= 3));
    // palabra ambigua: apunta a 3 o más rubros distintos. Quedan las respaldadas por el contexto, o solo la mejor.
    const segs = new Set(quedan.map(r => segmento(r.c)));
    if(segs.size >= 3 && !t.frase){ const con = quedan.filter(r => r.ctx > 0); quedan = con.length ? con : quedan.slice(0, 1); }
    // empate dentro de un mismo rubro (aéreo, ferroviario, marítimo, carretera): si el contexto distingue, gana el contexto
    const maxDist = Math.max(...quedan.map(r => r.dist));
    if(maxDist > 0 && quedan.length > 1) quedan = quedan.filter(r => r.dist >= maxDist || r.aprendido);
    quedan.slice(0, maximo).forEach(r => { const y = salida.get(r.c); if(!y || r.final > y.final) salida.set(r.c, {...r, termino: t.t}); });
  });
  // coherencia: con 3 o más términos, una categoría de un rubro (segmento) que ningún otro término respalda y sin
  // contexto es casi siempre una lectura equivocada ("servicios municipales" -> "impuesto a la renta")
  const res = [...salida.values()];
  if(terms.length >= 3){
    const porSeg = new Map(); res.forEach(r => { if(!porSeg.has(segmento(r.c))) porSeg.set(segmento(r.c), new Set()); porSeg.get(segmento(r.c)).add(r.termino); });
    return res.filter(r => r.aprendido || r.ctx > 0 || porSeg.get(segmento(r.c)).size >= 2).sort((a, b) => b.final - a.final);
  }
  return res.sort((a, b) => b.final - a.final);
}
function clasesDeDiccionario(term, maximo){
  if(!DICC) return [];
  let res = [];
  for(const k of DICC){
    const ps = term.conceptos.map(alts => puntajeConcepto(alts, k));
    const hechos = ps.filter(p => p > 0).length;
    if(!hechos) continue;
    // todos los conceptos suman completo; si falta alguno (p. ej. "arriendo" de "arriendo de carpas") la clase vale menos.
    // A medias vale solo si calzan al menos 2 conceptos y la mitad (una frase conversada no calza con nada).
    if(hechos < ps.length && (hechos < 2 || hechos * 2 < ps.length)) continue;
    const total = ps.reduce((a, b) => a + b, 0) * (hechos === ps.length ? 1 : 0.5);
    res.push({c: k.c, nombre: k.nombre, puntos: total});
  }
  if(!res.length) return [];
  res.sort((x, y) => y.puntos - x.puntos);
  const tope = res[0].puntos;
  if(tope < 3) return [];                              // solo coincidencias débiles: mejor no adivinar
  return res.filter(r => r.puntos >= tope * 0.7).slice(0, maximo);
}

const nombreDe = c => { const k = DICC && DICC.find(x => x.c === c); return k ? k.nombre : ""; }; // nombre de una categoría (código ONU)
g.Buscar = {nombreDe, clasesDePerfil, separar, cargarDiccionario, cargarAprendido, clasesDe, norm, armar, calza, calzaAlt, raiz, sumarSinonimos, SIN, ABREV, expandir, expandirPalabras, vocabulario, corregir, correcciones};
})(typeof window !== "undefined" ? window : globalThis);
