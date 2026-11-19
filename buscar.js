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
  const i = indice.get(w.includes(" ") ? w : raiz(w));
  return (i === undefined ? [w] : [...new Set([w, ...SIN[i]])]).map(alternativa);
}
// Un término del vendedor se convierte en conceptos; la licitación calza si tiene todos los conceptos.
function armar(t){
  t = norm(t);
  if(!indice) indexar();
  let conceptos;
  if(t.includes(" ") && indice.has(t)) conceptos = [alternativas(t)];   // la frase entera es un sinónimo conocido
  else {
    const ws = t.split(" ").filter(w => w && !VACIAS.has(w));
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
g.Buscar = {norm, armar, calza, calzaAlt, raiz, sumarSinonimos, SIN};
})(typeof window !== "undefined" ? window : globalThis);
