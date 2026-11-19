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
const ENGANOSOS = {computador: ["computariz"], auto: ["automat","autor","autoclav","autonom"], curso: ["cursor"]};
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
  if(t.includes(" ") && indice.has(t)) conceptos = [alternativas(t)];   // la frase entera es un sinónimo conocido
  else {
    const ws = t.split(" ").filter(w => w && !VACIAS.has(w) && !VACIAS.has(ABREV[w])); // "serv", "adq" son tan genéricas como "servicio"
    conceptos = (ws.length ? ws : [t]).map(alternativas);
  }
  const a = conceptos[0][0];
  return {t, frase: conceptos.length > 1, conceptos, raiz: a.raiz || a.w, exacto: !!a.exacto};
}
function calzaAlt(a, texto, palabras){
  if(a.multi) return (" " + texto + " ").includes(" " + a.w + " ");
  if(a.exacto) return palabras.includes(a.raiz);
  const malos = ENGANOSOS[a.raiz] || [];
  return palabras.some(p => p.startsWith(a.raiz) && !malos.some(m => p.startsWith(m)));
}
function calza(term, texto, palabras){ return term.conceptos.every(alts => alts.some(a => calzaAlt(a, texto, palabras))); }
g.Buscar = {norm, armar, calza, calzaAlt, raiz, sumarSinonimos, SIN, ABREV, expandir, expandirPalabras, vocabulario, corregir, correcciones};
})(typeof window !== "undefined" ? window : globalThis);
