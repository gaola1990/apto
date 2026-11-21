"use strict";
const TICKET_PRUEBA = "F8537A18-6766-4DEF-9E59-426B4FEE2844"; // ticket de ejemplo publicado por ChileCompra
const API = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json";
const FICHA = "https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=";

const RUBROS = {
  "Aseo y limpieza": ["aseo","limpieza","sanitizacion","desinfeccion","higiene","utiles de aseo"],
  "Control de plagas": ["control de plagas","desratizacion","desinsectacion","fumigacion"],
  "Alimentación": ["alimentacion","colaciones","coffee","coctel","banqueteria","abarrotes","viveres","almuerzos","cenas"],
  "Construcción y mantención": ["reparacion","mantencion","construccion","mejoramiento","pintura","techumbre","obras menores","habilitacion","conservacion"],
  "Ferretería y materiales": ["materiales","ferreteria","herramientas","electricos","gasfiteria","maderas"],
  "Computación": ["computadores","notebook","software","licencias","impresoras","toner","informatico","computacionales","tablet"],
  "Transporte": ["transporte","traslado","arriendo de vehiculos","buses","flete","camioneta"],
  "Imprenta y publicidad": ["impresion","imprenta","merchandising","publicidad","pendones","diseño grafico","señaletica","difusion"],
  "Insumos médicos": ["insumos medicos","insumos clinicos","medicamentos","dental","laboratorio","farmacos","curacion"],
  "Seguridad": ["vigilancia","guardias","seguridad","camaras","alarmas","televigilancia"],
  "Vestuario": ["uniformes","vestuario","calzado","ropa de trabajo","proteccion personal"],
  "Eventos y flores": ["evento","produccion","amplificacion","carpas","flores","arreglos florales","coronas","decoracion"],
  "Capacitación": ["capacitacion","curso","taller","relator","diplomado"],
  "Áreas verdes": ["areas verdes","poda","jardines","riego","paisajismo","corte de pasto"],
  "Mobiliario": ["mobiliario","muebles","sillas","escritorios","estanterias"],
  "Equipamiento clínico": ["equipamiento clinico","equipo medico","equipos medicos","camilla","monitor multiparametro","esfigmomanometro","rehabilitacion"]
};
const REGIONES = ["Arica y Parinacota","Tarapacá","Antofagasta","Atacama","Coquimbo","Valparaíso","Metropolitana","O'Higgins","Maule","Ñuble","Biobío","Araucanía","Los Ríos","Los Lagos","Aysén","Magallanes"];
// Tramos segun el tipo de licitacion (sale del codigo). nivel 1 = mas chica.
const TIPOS = {
  L1:{n:1,t:"Hasta 100 UTM"}, LE:{n:2,t:"100 a 1.000 UTM"}, LP:{n:3,t:"1.000 a 2.000 UTM"},
  LQ:{n:4,t:"2.000 a 5.000 UTM"}, LR:{n:5,t:"Más de 5.000 UTM"},
  E2:{n:1,t:"Privada, hasta 100 UTM"}, CO:{n:2,t:"Privada, 100 a 1.000 UTM"}, B2:{n:3,t:"Privada, 1.000 a 2.000 UTM"},
  H2:{n:4,t:"Privada, 2.000 a 5.000 UTM"}, I2:{n:5,t:"Privada, más de 5.000 UTM"},
  LS:{n:3,t:"Servicios especializados"}, O1:{n:4,t:"Obra pública"}, O2:{n:4,t:"Obra privada"}
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
function leer(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
function guardar(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} try{ subirCuenta(); }catch(e){} }

let perfil = leer("rp_perfil", {rubros:[], extra:"", excluir:"", region:"", tamano:"5", ticket:""});
let guardadas = leer("rp_guardadas", {});
let hechos = leer("rp_pasos", {});
const INI = 12;   // la lista parte corta: las mejores compras primero, el resto con "Ver más"
let datos = [], resultados = [], mostrar = INI, origen = "", ocultas = 0;
let RES = {}, PRE = {}, DET = {}, CATMAP = {}, DICC_OK = false, motorLocal = false;        // resumenes nocturnos (n8n + IA local) y motor ¿Cumplo? local
const MOTOR_PC = "http://127.0.0.1:8787";
let MOTOR = MOTOR_PC, motorNube = false;
const esperaMotor = () => motorNube ? " En la nube una revisión tarda entre 3 y 8 minutos: puedes seguir navegando y volver." : " Puede tardar unos minutos.";
const cacheDet = {};

function tipoDe(codigo){
  const m = /-([A-Z]{1,2}\d?)\d{2}$/.exec(codigo || "");
  const k = m ? m[1] : "";
  return {clave:k, ...(TIPOS[k] || {n:3, t:"Otro tipo"})};
}
function diasPara(fecha){ return fecha ? (new Date(fecha) - Date.now()) / 864e5 : null; }
function fechaCorta(f){ if(!f) return "—"; const d = new Date(f); return d.toLocaleDateString("es-CL",{day:"numeric",month:"short"}) + " " + d.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}); }
function plata(n){ return n ? "$" + Math.round(n).toLocaleString("es-CL") : "No informado"; }

// ---------- Calce ----------
function terminos(){
  const lista = [];
  perfil.rubros.forEach(r => (RUBROS[r] || []).forEach(t => lista.push(t)));
  Buscar.separar(perfil.extra).filter(Boolean).forEach(t => lista.push(t));
  const ts = [...new Set(lista.map(norm))].map(armar);
  // "balones de fútbol" que no aparece en ninguna compra: se busca también por su palabra principal ("balones"),
  // con menos puntaje. Las compras rara vez detallan tanto como escribe el vendedor.
  const extra = [];
  ts.forEach(t => {
    if(t.conceptos.length < 2 || generico(t) || datos.some(d => calza(t, d.texto, d.palabras))) return;
    const cabeza = armar(t.t.split(" ")[0]);
    if(cabeza.t.length >= 4 && !generico(cabeza) && !ts.some(x => x.t === cabeza.t) && !extra.some(x => x.t === cabeza.t)) extra.push({...cabeza, respaldo: true});
  });
  return ts.concat(extra);
}
// ---------- Aprendizaje: señales de uso (solo con cuenta; se guardan como conteos, sin datos de la empresa) ----------
// Guardar una compra = "mis palabras calzan con estos productos"; 👎 = "no calzan"; palabra sin resultados = "no la conozco".
// El diccionario aprende una relación solo cuando la confirman varios vendedores distintos (ver motor/aprender.py).
let noSirve = leer("rp_nosirve", {});
const enviadas = new Set();
function enviarSenales(filas){
  if(!sesion || !filas.length || perfil.aprender === false) return;   // el usuario puede desactivarlo en Mi cuenta
  const nuevas = filas.filter(f => { const k = f.tipo + "|" + f.termino + "|" + (f.clase || ""); if(enviadas.has(k)) return false; enviadas.add(k); return true; });
  if(nuevas.length) sb("/rest/v1/senales", {method: "POST", headers: {"Prefer": "resolution=ignore-duplicates,return=minimal"}, body: JSON.stringify(nuevas)}).catch(() => {});
}
const terminoValido = t => t.length >= 2 && t.length <= 60 && /^[a-z0-9ñ ]+$/.test(t);
function senal(tipo, codigo){
  const d = datos.find(x => x.codigo === codigo), det = DET[codigo];
  if(!d || !det || !det.c || !det.c.length) return;
  const propios = Buscar.separar(perfil.extra).filter(terminoValido);
  const calzan = propios.filter(t => calza(armar(t), d.texto, d.palabras));
  enviarSenales(calzan.flatMap(t => det.c.slice(0, 4).map(clase => ({termino: t, clase, tipo}))));
}
function senalDesconocidas(propios){
  const filas = propios.filter(t => terminoValido(t.t) && !Buscar.clasesDe(t, 1).length && !datos.some(d => calza(t, d.texto, d.palabras)))
    .map(t => ({termino: t.t, clase: null, tipo: "desconocido"}));
  enviarSenales(filas);
}

// ---------- Competencia esperada (competencia.json: ofertas que recibieron licitaciones parecidas ya adjudicadas) ----------
let COMP = null;
function competencia(codigo){
  const det = DET[codigo];
  if(!COMP || !det || !det.c) return null;
  let n = 0, suma = 0, pocas = 0;
  for(const c of det.c){ const x = COMP.clases[c]; if(x){ n += x.n; suma += x.med * x.n; pocas += x.pocas * x.n; } }
  return n >= 5 ? {med: Math.round(10 * suma / n) / 10, n, pocas: Math.round(pocas / n)} : null;
}
function competenciaFicha(codigo, organismo){
  const k = competencia(codigo), o = COMP && organismo ? COMP.organismos[organismo] : null;
  if(!k && !o) return "";
  const partes = [];
  if(k) partes.push("En licitaciones parecidas se presentaron en promedio <b>" + k.med.toLocaleString("es-CL") + " ofertas</b> (" + k.n + " licitaciones; " + k.pocas + " % tuvo 2 o menos).");
  if(o) partes.push("Este comprador recibe en promedio " + o.med.toLocaleString("es-CL") + " ofertas (" + o.n + " licitaciones).");
  return "<dt>Competencia esperada</dt><dd>" + partes.join("<br>") + "<br><span class='nota'>Con pocas ofertas, tus probabilidades de ganar son mayores. Datos públicos de licitaciones adjudicadas.</span></dd>";
}

// ---------- Compra Ágil (datos abiertos mensuales de ChileCompra, solo cifras agregadas) ----------
// No hay Compras Ágiles abiertas en la API pública: se muestra cuánto se pidió el mes pasado en lo que vende el usuario,
// quién compra y los códigos que debe declarar para que los compradores lo inviten a cotizar.
let CA = null;
function pintarCompraAgil(clases){
  const el = $("compraAgil"); if(!el) return;
  const filas = CA ? clases.map(c => [c, CA.clases[c]]).filter(([, x]) => x) : [];
  if(!filas.length){ el.hidden = true; return; }
  const sol = filas.reduce((a, [, x]) => a + x.s, 0);
  const cot = filas.reduce((a, [, x]) => a + x.s * x.cot, 0) / sol;
  const org = new Map(), reg = new Map();
  filas.forEach(([, x]) => { x.org.forEach(([o, n]) => org.set(o, (org.get(o) || 0) + n)); x.reg.forEach(([r, n]) => reg.set(r, (reg.get(r) || 0) + n)); });
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => esc(k.replace(/^Región (de |del |de la )?/, "")) + " (" + n + ")").join(", ");
  const mes = new Date(CA.mes + "-15").toLocaleDateString("es-CL", {month: "long", year: "numeric"});
  el.hidden = false;
  el.innerHTML = '<h2>Compra Ágil en lo que vendes</h2>' +
    '<div class="nota">Compras menores que los organismos piden directo a proveedores inscritos. Datos de ' + esc(mes) + ' (ChileCompra, datos abiertos).</div>' +
    '<div class="cifras" style="margin-top:10px">' +
    '<div class="cifra"><b>' + sol.toLocaleString("es-CL") + '</b><span>solicitudes en el mes</span></div>' +
    '<div class="cifra"><b>' + cot.toLocaleString("es-CL", {maximumFractionDigits: 1}) + '</b><span>cotizaciones por solicitud (competencia)</span></div>' +
    '<div class="cifra"><b>' + plata(filas.sort((a, b) => b[1].s - a[1].s)[0][1].monto) + '</b><span>monto típico adjudicado</span></div></div>' +
    '<p class="nota" style="margin:10px 0 4px"><b>Quiénes más piden:</b> ' + top(org) + '<br><b>Dónde:</b> ' + top(reg) + '</p>' +
    '<p class="nota" style="margin:6px 0 0"><b>Para que te inviten a cotizar</b>, declara estos rubros en tu registro de proveedor de Mercado Público: ' +
    filas.slice(0, 5).map(([c]) => "<b>" + esc(c) + "</b>").join(", ") + '. Los compradores envían las Compras Ágiles a quienes tienen esos rubros.</p>';
}

// Si el vendedor escribió mal una palabra, se le dice cómo la entendimos (y puede corregirla él).
function avisarCorrecciones(){
  const el = $("corregido"); if(!el) return;
  const c = [...Buscar.correcciones].filter(([w]) => norm(perfil.extra).split(" ").includes(w));
  el.textContent = c.length ? "Entendimos " + c.map(([w, x]) => "«" + w + "» como «" + x + "»").join(", ") + "." : "";
}
// Qué productos de Mercado Público entendió Apto (sirve también para saber qué códigos ONU declarar como proveedor).
function avisarClases(){
  const el = $("clases"); if(!el) return;
  const propios = Buscar.separar(perfil.extra).filter(Boolean).map(armar); // solo lo que escribió el vendedor, no las listas de rubros
  const vistos = new Map();
  const quitadas = new Set(perfil.noCats || []);
  for(const r of Buscar.clasesDePerfil(propios, 3)) if(!quitadas.has(r.c)) vistos.set(r.c, r.nombre);
  clasesVistas = [...vistos.values()];
  pintarCompraAgil([...vistos.keys()]);
  clearTimeout(avisarClases.t); avisarClases.t = setTimeout(() => senalDesconocidas(propios), 4000); // cuando deja de escribir
  // cada categoría con una ✕: si Apto entendió mal ("transporte aéreo" para un dueño de buses), el vendedor la quita
  const lista = [...vistos].slice(0, 10);
  el.innerHTML = lista.length ? "Según el catálogo de Mercado Público, vendes: " + lista.map(([c, n]) => '<span class="catq">' + esc(n) +
    ' <button type="button" data-quitar="' + esc(c) + '" aria-label="Quitar ' + esc(n) + '" title="No vendo esto">✕</button></span>').join(" ") +
    (vistos.size > 10 ? " y " + (vistos.size - 10) + " más." : "") +
    (quitadas.size ? ' <button type="button" class="enlace" data-reponer="1">Volver a mostrar las ' + quitadas.size + " que quité</button>" : "") : "";
}
// Por palabras, con variantes, abreviaturas, errores de escritura y sinónimos de compras públicas (ver buscar.js).
const armar = t => Buscar.armar(t);
const calza = (term, texto, palabras) => Buscar.calza(term, texto, palabras);
function calcular(){
  Buscar.correcciones.clear();
  const ts = terminos();
  avisarCorrecciones();
  const no = Buscar.separar(perfil.excluir).filter(Boolean).map(armar);
  const tope = +perfil.tamano;
  const cats = misCategorias(ts), segsMios = new Set([...cats].map(c => String(c).slice(0, 2)));
  avisarClases();
  resultados = [];
  for(const d of datos){
    const dias = diasPara(d.cierre);
    if(dias !== null && dias < 0) continue;
    if(d.tipo.n > tope) continue;
    if(perfil.vistaGuardadas){ if(guardadas[d.codigo]) resultados.push({...d, dias, pts:0, hits:[]}); continue; }
    if(noSirve[d.codigo]) continue;   // el vendedor dijo que no le sirve
    if(+perfil.plazo && dias !== null && dias > +perfil.plazo) continue; // filtro "cierra en"
    if(!ts.length) continue;
    if(no.some(t => calza(t, d.texto, d.palabras))) continue;
    const ia = RES[d.codigo], porRubro = !!(ia && perfil.rubros.includes(ia.rubro)); // la IA nocturna clasifico el rubro
    const det = DET[d.codigo], porCat = !!(det && det.c && det.c.some(c => cats.has(c))); // C: categoría de producto
    // B: nombre + descripción + productos. Una palabra genérica sola ("mantenimiento") cuenta solo si la compra es de su rubro
    const enMiSector = !!(det && det.c && det.c.some(c => segsMios.has(String(c).slice(0, 2))));
    // la búsqueda por palabra principal ("uniformes" de "uniformes deportivos") solo vale dentro de su sector
    const hits = ts.filter(t => calza(t, d.texto, d.palabras) && (porCat || porRubro || !generico(t)) && (!t.respaldo || porCat || enMiSector));
    // una compra claramente de otro sector (sus categorías no tocan ningún rubro del vendedor) no entra por una palabra
    // suelta: "balones" de un deportista no es "balón para procedimiento" de un hospital
    if(!porCat && !porRubro && hits.length && segsMios.size && det && det.c && det.c.length && !det.c.some(c => segsMios.has(String(c).slice(0, 2))) && !hits.some(h => h.frase)) continue;
    if(!hits.length && !porRubro && !porCat) continue;
    // región del comprador (la guarda el proceso automático de detalles): las de su región van primero
    const reg = det && det.r ? det.r : "", enRegion = !!(perfil.region && reg && norm(reg) === norm(perfil.region));
    if(perfil.soloRegion && perfil.region && reg && !enRegion) continue;
    const comp = competencia(d.codigo);
    // Lo que el vendedor escribió pesa más que cualquier extra: la región, el tamaño y la poca competencia solo desempatan entre compras
    // que ya calzan por su nombre (antes una compra "de tu región" sin ninguna palabra tuya podía quedar sobre una que sí las tenía).
    const hay = hits.length > 0;
    const pts = hits.reduce((a, h) => a + (h.respaldo ? 1 : h.frase ? 3 : 2), 0) + (hay ? 3 : 0) + (porRubro ? 3 : 0) + (porCat ? (hay ? 4 : 2) : 0) +
      (hay ? (d.tipo.n <= 2 ? 1 : 0) + (comp && comp.med <= 2 ? 1 : 0) + (enRegion ? 3 : 0) : (enRegion ? 1 : 0));
    // calidad del calce: 3 = coincide el nombre/descripción Y la categoría o el rubro; 2 = solo las palabras; 1 = solo categoría o rubro (sin ninguna palabra tuya)
    const calidad = hay && (porCat || porRubro) ? 3 : hay ? 2 : 1;
    resultados.push({...d, dias, pts, hits, porCat, comp, reg, enRegion, calidad});
  }
  const porCierre = (a, b) => (a.dias ?? 999) - (b.dias ?? 999);
  const porCompetencia = (a, b) => ((a.comp ? a.comp.med : 99) - (b.comp ? b.comp.med : 99)) || b.pts - a.pts;
  const orden = $("orden").value;
  ocultas = 0;
  if(!perfil.vistaGuardadas && !perfil.todas){   // por defecto solo lo que calza bien (si hay al menos 5); "Ver también" muestra el resto
    for(const nivel of [3, 2]){ const buenas = resultados.filter(r => r.calidad >= nivel); if(buenas.length >= 5){ ocultas = resultados.length - buenas.length; resultados = buenas; break; } }
  }
  resultados.sort(perfil.vistaGuardadas || orden === "cierre" ? porCierre : orden === "competencia" ? porCompetencia : (a, b) => b.pts - a.pts || porCierre(a, b));
}

// ---------- Pintar ----------
function resaltar(nombre, hits){
  let h = esc(nombre);
  hits.flatMap(t => t.conceptos.flat()).forEach(a => {
    const base = a.multi ? a.w : a.raiz;
    const patron = base.replace(/[aeiounñ]/g, c => ({a:"[aá]",e:"[eé]",i:"[ií]",o:"[oó]",u:"[uúü]",n:"[nñ]","ñ":"[nñ]"}[c])).replace(/ /g, "\\s+");
    try{ h = h.replace(new RegExp("(^|[^\\p{L}])(" + patron + "[\\p{L}]*)", "giu"), "$1<mark>$2</mark>"); }catch(e){}
  });
  return h;
}
function etiquetaCierre(dias){
  if(dias === null) return ["gr", "sin fecha"];
  if(dias < 1) return ["ro", "cierra hoy"];
  if(dias < 3) return ["al", "quedan " + Math.floor(dias) + " d"];
  return ["ok", "quedan " + Math.floor(dias) + " días"];
}
// En el celular la lista queda debajo del formulario: un botón flotante avisa que hay compras y lleva a ellas.
function botonResultados(){
  const b = $("irResultados"); if(!b) return;
  const lista = $("lista"), visible = lista && lista.getBoundingClientRect().top < innerHeight * 0.8;
  const n = perfil.vistaGuardadas ? 0 : resultados.length;
  b.hidden = !n || visible || innerWidth > 860;
  b.textContent = "Ver " + n.toLocaleString("es-CL") + (n === 1 ? " compra para ti ↓" : " compras para ti ↓");
}
addEventListener("scroll", () => botonResultados(), {passive: true});
document.addEventListener("click", e => { const t = e.target.closest && e.target.closest("[data-todas]"); if(t){ perfil.todas = t.dataset.todas === "1"; cambio(); return; } if(e.target.id === "irResultados") $("lista").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"}); });
addEventListener("resize", () => botonResultados());
function pintar(){
  calcular();
  setTimeout(botonResultados, 0);
  const semana = resultados.filter(r => r.dias !== null && r.dias <= 7).length;
  const chicas = resultados.filter(r => r.tipo.n <= 2).length;
  $("cifras").innerHTML =
    cifra(datos.length.toLocaleString("es-CL"), "licitaciones abiertas hoy") +
    cifra(resultados.length.toLocaleString("es-CL"), "calzan con tu negocio") +
    cifra(semana, "cierran en 7 días") +
    cifra(chicas, "de tamaño pyme (hasta 1.000 UTM)");
  pintarNegocio();
  const L = $("lista");
  const info = $("calceInfo");
  if(info) info.innerHTML = perfil.vistaGuardadas ? "" : ocultas ? 'Te mostramos las <b>' + resultados.length + '</b> que mejor calzan con lo que vendes. <button type="button" class="enlace" data-todas="1">Ver también las ' + ocultas + " que calzan menos</button>" :
    perfil.todas && resultados.length ? 'Mostrando todas las que calzan, de mejor a peor. <button type="button" class="enlace" data-todas="0">Ver solo las que calzan mejor</button>' : "";
  if(!datos.length){ L.innerHTML = '<div class="vacio">No se pudieron cargar licitaciones. Revisa tu conexión y recarga.</div>'; return; }
  if(!resultados.length){
    L.innerHTML = '<div class="vacio">' + (perfil.vistaGuardadas ? "Aún no guardas ninguna oportunidad." :
      (perfil.rubros.length || perfil.extra.trim() ? "Hoy no hay licitaciones abiertas que calcen. Prueba agregando otro rubro o producto." : "Elige un rubro o escribe lo que vendes para empezar.")) + "</div>";
    $("mas").hidden = true; return;
  }
  L.innerHTML = resultados.slice(0, mostrar).map(r => {
    const [cl, tx] = etiquetaCierre(r.dias);
    return '<article class="op" tabindex="0" role="button" data-c="' + esc(r.codigo) + '">' +
      "<div><h3>" + (guardadas[r.codigo] ? "★ " : "") + resaltar(r.nombre, r.hits) + "</h3>" +
      '<div class="meta"><span class="et gr">' + esc(r.codigo) + '</span><span class="et">' + esc(r.tipo.t) + "</span>" + (RES[r.codigo] ? '<span class="et">En simple</span>' : "") + (r.enRegion ? '<span class="et region">En tu región</span>' : r.reg ? '<span class="et">' + esc(r.reg) + "</span>" : "") + (r.hits.length ? '<span class="et calza">Calza: «' + esc(r.hits.slice(0, 2).map(h => h.t || h.w || "").filter(Boolean).join("», «")) + '»</span>' : "") + (r.porCat ? '<span class="et">Calza por categoría</span>' : "") + (r.comp && r.comp.med <= 2 ? '<span class="et poca">Poca competencia</span>' : "") + "</div></div>" +
      '<div class="cierre"><b>' + (r.cierre ? new Date(r.cierre).toLocaleDateString("es-CL",{day:"numeric",month:"short"}) : "—") + '</b><span class="et ' + cl + '">' + tx + "</span></div></article>";
  }).join("");
  $("mas").hidden = resultados.length <= mostrar;
  $("mas").textContent = "Ver más (" + (resultados.length - mostrar) + " restantes)";
}
// ---------- A. El negocio en plata y B. lo que Apto hace por ti ----------
// Monto de cada compra: el informado por el comprador; si no hay, el mínimo de su tramo (cálculo conservador).
const UTM_CLP = 69000, UF_CLP = 41378; // UF del 21-11-2026 (SII); la UTM es aproximada; el precio real se calcula al momento de cobrar
const MINIMO_TRAMO = {1: 20, 2: 100, 3: 1000, 4: 2000, 5: 5000}; // UTM
function montoDe(r){ const det = DET[r.codigo]; return (det && det.m) || (MINIMO_TRAMO[r.tipo.n] || 100) * UTM_CLP; }
function millones(n){ return n >= 1e9 ? "$" + (n / 1e9).toLocaleString("es-CL", {maximumFractionDigits: 1}) + " mil millones" : n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-CL", {maximumFractionDigits: 1}) + " millones" : "$" + Math.round(n).toLocaleString("es-CL"); }
function pintarNegocio(){
  const el = $("negocio"); if(!el) return;
  if(perfil.vistaGuardadas || !resultados.length){ el.innerHTML = ""; return; }
  const montos = resultados.map(montoDe).sort((a, b) => a - b);
  const total = montos.reduce((a, b) => a + b, 0), tipico = montos[Math.floor(montos.length / 2)];
  const planApto = 1 * UF_CLP;   // Plan Apto: 1 UF al mes (10 UF al año)
  let logueado = false; try{ logueado = !!sesion; }catch(e){} // sesion se declara más abajo
  el.innerHTML = '<div class="negocio"><p class="grande">💰 Hoy hay ' + resultados.length.toLocaleString("es-CL") + (resultados.length === 1 ? " compra abierta" : " compras abiertas") + " para ti, por al menos " + millones(total) + ".</p>" +
    "<p>Una compra de tamaño típico para ti vale unos <b>" + millones(tipico) + "</b>. El Plan Apto cuesta 1 UF al mes (unos " + millones(planApto) + "): " +
      (planApto / tipico < 0.01 ? "<b>menos del 1 % de una sola compra</b>." : "<b>el " + Math.ceil(100 * planApto / tipico) + " % de una sola compra</b>.") + "</p>" +
    '<p class="nota" style="margin-top:6px">Montos informados por los compradores o, si no los publican, el mínimo de cada tramo de tamaño (cálculo conservador).</p></div>' +
    '<details class="porti"' + (leer("rp_porti_visto", false) ? "" : " open") + '><summary>Lo que Apto hace por ti</summary><ul>' +
    '<li><span class="ic">📩</span><div><b>Te avisa cada mañana por correo</b> de las compras nuevas que calzan contigo. No tienes que entrar a buscar.<br>' +
      (logueado ? '<span class="nota">Tus avisos se configuran en "Mi cuenta".</span>' : '<button type="button" class="sec" id="activarAvisos">Activar avisos por correo</button>') + "</div></li>" +
    '<li><span class="ic">📅</span><div><b>Te recuerda los plazos.</b> Guarda una compra (☆) y toca "Agregar todos los plazos a mi calendario": tu teléfono te avisa antes de cada fecha.</div></li>' +
    '<li><span class="ic">💲</span><div><b>Te dice cuánto cobrar.</b> En cada compra ves a cuánto se adjudicó ese mismo producto antes, y en la campana 🔔 cuánto bajo el presupuesto ofertan los que ganan.</div></li>' +
    '<li><span class="ic">✅</span><div><b>Te dice si cumples</b> con ¿Cumplo?: subes la ficha técnica y te muestra qué te falta escribir para que no te rechacen.</div></li>' +
    '<li><span class="ic">🧭</span><div><b>¿Es tu primera vez?</b> <a href="guia.html">Lee cómo hacer tu primera oferta, paso a paso</a>.</div></li></ul></details>';
  const det = el.querySelector(".porti"); if(det) det.ontoggle = () => { if(!det.open) guardar("rp_porti_visto", true); };
  const b = $("activarAvisos");
  if(b) b.onclick = () => { const c = $("correo") || $("cuenta"); if(c){ c.scrollIntoView({behavior: "smooth", block: "center"}); if(c.focus) setTimeout(() => c.focus(), 400); } };
}
const cifra = (n, t) => '<div class="cifra"><b>' + n + "</b><span>" + t + "</span></div>";

// ---------- Detalle y plan de oferta ----------
// El detalle lo pide primero el motor de Apto (con nuestro ticket y memoria de 6 horas); si no está disponible,
// se consulta directo a Mercado Público con el ticket de ejemplo. El cliente nunca configura nada.
async function pedirDetalle(codigo){
  if(cacheDet[codigo]) return cacheDet[codigo];
  if(motorLocal){
    try{
      const r = await fetch(MOTOR + "/detalle/" + encodeURIComponent(codigo));
      const j = await r.json();
      if(j && j.Listado && j.Listado[0]) return (cacheDet[codigo] = j.Listado[0]);
    }catch(e){}
  }
  const url = API + "?codigo=" + encodeURIComponent(codigo) + "&ticket=" + TICKET_PRUEBA;
  for(let i = 0; i < 3; i++){
    try{
      const j = await (await fetch(url)).json();
      if(j.Listado && j.Listado[0]) return (cacheDet[codigo] = j.Listado[0]);
    }catch(e){}
    await new Promise(ok => setTimeout(ok, 2200)); // la API rechaza consultas simultaneas: se reintenta
  }
  throw new Error("sin respuesta");
}
function veredicto(d, base){
  const pros = [], contras = [];
  const dias = diasPara(d.Fechas && d.Fechas.FechaCierre || base.cierre);
  if(dias !== null){ if(dias >= 5) pros.push("Tienes " + Math.floor(dias) + " días para preparar la oferta."); else contras.push("Quedan menos de 5 días: solo conviene si ya tienes los documentos listos."); }
  const reg = norm(d.Comprador && d.Comprador.RegionUnidad);
  if(perfil.region){ const mia = norm(perfil.region).replace("o higgins", "higgins"); if(reg.includes(mia)) pros.push("El comprador está en tu región."); else if(reg) contras.push("El comprador está en otra región (" + (d.Comprador.RegionUnidad || "").trim() + "): suma el costo de despacho o traslado."); }
  if(base.tipo.n <= 2) pros.push("Es de tamaño chico o mediano, donde compiten sobre todo pymes."); else if(base.tipo.n >= 4) contras.push("Es una licitación grande: suele pedir garantías y experiencia comprobable.");
  const preg = d.Fechas && d.Fechas.FechaFinal; if(preg && diasPara(preg) > 0) pros.push("Aún puedes hacer preguntas al comprador (hasta el " + fechaCorta(preg) + ").");
  if(d.Items && d.Items.Cantidad > 15) contras.push("Pide " + d.Items.Cantidad + " productos distintos: revisa que puedas cotizarlos todos.");
  const cl = contras.length === 0 ? "ok" : (contras.length >= 2 && pros.length <= 1 ? "ro" : "al");
  const tit = cl === "ok" ? "Vale la pena revisarla" : cl === "ro" ? "Difícil para ti" : "Revísala con cuidado";
  return '<div class="veredicto ' + cl + '"><b>' + tit + "</b><ul>" + pros.map(p => "<li>" + esc(p) + "</li>").join("") + contras.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul></div>";
}
function plan(d, base){
  const F = d.Fechas || {};
  const pasos = [
    ["Leer las bases y los anexos completos", "Están en la ficha de Mercado Público."],
    ["Enviar mis dudas en el foro de preguntas", F.FechaFinal ? "Hasta el " + fechaCorta(F.FechaFinal) : "Revisa el plazo en la ficha."],
    ["Leer las respuestas del comprador", F.FechaPubRespuestas ? "Se publican el " + fechaCorta(F.FechaPubRespuestas) : ""],
    ["Verificar que estoy hábil en el Registro de Proveedores", "Sin deudas previsionales ni tributarias que inhabiliten."],
    ["Calcular costos y precio de la oferta", d.MontoEstimado ? "Presupuesto estimado del comprador: " + plata(d.MontoEstimado) : "El comprador no publicó presupuesto."],
    ["Completar anexos y declaración jurada", "Usa los formatos que entregan las bases."],
    ["Subir la oferta y confirmar el envío", "Cierre: " + fechaCorta(F.FechaCierre || base.cierre) + ". No lo dejes para la última hora."]
  ];
  if(F.FechaVisitaTerreno) pasos.splice(1, 0, ["Asistir a la visita a terreno", fechaCorta(F.FechaVisitaTerreno)]);
  const h = hechos[base.codigo] || {};
  return '<ul class="pasos">' + pasos.map((p, i) => '<li><input type="checkbox" id="p' + i + '" data-i="' + i + '"' + (h[i] ? " checked" : "") + '><label for="p' + i + '" style="margin:0;font-weight:400;font-size:inherit">' + esc(p[0]) + (p[1] ? "<small>" + esc(p[1]) + "</small>" : "") + "</label></li>").join("") + "</ul>";
}
async function abrir(codigo){
  const base = datos.find(x => x.codigo === codigo); if(!base) return;
  const D = $("det");
  D.innerHTML = '<h3 id="dtitulo">' + esc(base.nombre) + '</h3><div class="nota">' + esc(codigo) + " · " + esc(base.tipo.t) + '</div><p class="vacio">Consultando el detalle en Mercado Público…</p>';
  $("dlg").showModal();
  let d;
  try{ d = await pedirDetalle(codigo); }
  catch(e){ D.querySelector(".vacio").innerHTML = 'Mercado Público no respondió ahora. Puedes <a target="_blank" rel="noopener" href="' + FICHA + encodeURIComponent(codigo) + '">abrir la ficha oficial</a> o intentar de nuevo en un momento.'; return; }
  const c = d.Comprador || {}, items = (d.Items && d.Items.Listado) || [];
  D.innerHTML = '<h3 id="dtitulo">' + esc(d.Nombre || base.nombre) + '</h3><div class="nota">' + esc(codigo) + " · " + esc(base.tipo.t) + "</div>" +
    veredicto(d, base) +
    '<dl class="tabla">' +
    "<dt>Comprador</dt><dd>" + esc(c.NombreOrganismo) + (c.NombreUnidad ? "<br><span class='nota'>" + esc(c.NombreUnidad) + "</span>" : "") + "</dd>" +
    "<dt>Lugar</dt><dd>" + esc([c.ComunaUnidad, (c.RegionUnidad || "").trim()].filter(Boolean).join(", ") || "—") + "</dd>" +
    "<dt>Presupuesto estimado</dt><dd>" + plata(d.MontoEstimado) + (d.MontoEstimado && d.Moneda && d.Moneda !== "CLP" ? " " + esc(d.Moneda) : "") + "</dd>" +
    "<dt>Cierre</dt><dd>" + fechaCorta((d.Fechas || {}).FechaCierre || base.cierre) + "</dd>" +
    competenciaFicha(codigo, c.NombreOrganismo) +
    "<dt>Adjudicación estimada</dt><dd>" + fechaCorta((d.Fechas || {}).FechaAdjudicacion) + "</dd>" +
    "<dt>Qué piden</dt><dd>" + esc((d.Descripcion || "").slice(0, 420)) + ((d.Descripcion || "").length > 420 ? "…" : "") + "</dd>" +
    "<dt>Productos (" + items.length + ")</dt><dd>" + (items.slice(0, 8).map(i => esc(i.NombreProducto) + " <span class='nota'>× " + esc(i.Cantidad) + " " + esc(i.UnidadMedida || "") + "</span>").join("<br>") || "—") + (items.length > 8 ? "<br><span class='nota'>y " + (items.length - 8) + " más</span>" : "") + "</dd>" +
    precioRef(items) + cuantoCobrar(items, d) +
    "</dl>" + enSimple(codigo) + tengo(items) + bloqueCumplo() + "<h2>Mi plan para ofertar</h2>" + plan(d, base) +
    '<div class="acciones"><button class="principal" id="bg">' + (guardadas[codigo] ? "★ Guardada" : "☆ Guardar") + '</button>' +
    '<button class="sec" id="bno" title="Apto aprende de esto para mostrarte compras más parecidas a lo que vendes">👎 No me sirve</button>' +
    (c.NombreOrganismo ? '<button class="sec" id="bseg" title="Te avisamos en la campana cuando este comprador publique compras nuevas">' + (siguiendo(c.NombreOrganismo) ? "✓ Sigues a este comprador" : "🏛 Seguir a este comprador") + '</button>' : "") +
    '<button class="sec" id="bcal">Agregar todos los plazos a mi calendario</button>' +
    '<a class="sec" style="text-decoration:none;display:inline-block;border:1px solid var(--linea);border-radius:8px;padding:8px 12px" target="_blank" rel="noopener" href="' + FICHA + encodeURIComponent(codigo) + '">Abrir ficha oficial ↗</a></div>' +
    '<p class="nota" style="margin-bottom:0">El plan es una guía general. Las bases de cada licitación mandan: revisa siempre sus requisitos. ¿Primera vez? <a href="guia.html" target="_blank" rel="noopener">Cómo ofertar, paso a paso</a>.</p>';
  activarCumplo(D);
  D.querySelectorAll(".pasos input").forEach(ch => ch.onchange = () => { (hechos[codigo] = hechos[codigo] || {})[ch.dataset.i] = ch.checked; guardar("rp_pasos", hechos); });
  $("bg").onclick = () => { if(guardadas[codigo]) delete guardadas[codigo]; else { guardadas[codigo] = 1; senal("guardar", codigo); } guardar("rp_guardadas", guardadas); $("bg").textContent = guardadas[codigo] ? "★ Guardada" : "☆ Guardar"; pintar(); };
  $("bno").onclick = () => { noSirve[codigo] = 1; guardar("rp_nosirve", noSirve); senal("no_sirve", codigo); $("dlg").close(); pintar(); };
  if($("bseg")) $("bseg").onclick = () => {
    const n = (c.NombreOrganismo || "").trim(), s = new Set(perfil.compradores || []);
    if(s.has(n)) s.delete(n); else s.add(n);
    perfil.compradores = [...s]; cambio();
    $("bseg").textContent = s.has(n) ? "✓ Sigues a este comprador" : "🏛 Seguir a este comprador";
    if(window.Notif && Notif.pintar) try{ Notif.pintar(); }catch(e){}
  };
  $("bcal").onclick = () => calendario(codigo, d.Nombre || base.nombre, (d.Fechas || {}).FechaCierre || base.cierre, d.Fechas || {});
}
// Compradores que el vendedor sigue (perfil.compradores): se comparan por nombre exacto del organismo.
function siguiendo(nombre){ return (perfil.compradores || []).includes((nombre || "").trim()); }
// Precio de referencia: a cuánto se adjudicó el mismo producto en licitaciones anteriores (agregados públicos).
function precioRef(items){
  const filas = [];
  for(const i of items){
    const p = PRE[String(i.CodigoProducto || "")]; if(!p) continue;
    filas.push(esc(i.NombreProducto) + ": <b>" + plata(p.med) + "</b>" + (p.u ? " por " + esc(p.u) : "") +
      " <span class='nota'>(mediana de " + p.n + " adjudicaciones; entre " + plata(p.min) + " y " + plata(p.max) + ")</span>");
    if(filas.length >= 5) break;
  }
  return filas.length ? "<dt>Precio de referencia</dt><dd>" + filas.join("<br>") + "<br><span class='nota'>A cuánto se adjudicó este mismo producto en compras anteriores. Úsalo como guía, no como regla.</span></dd>" : "";
}

// Cuánto cobrar: precio de referencia × cantidad de lo que piden, contra el presupuesto del comprador (solo una guía).
function cuantoCobrar(items, d){
  let tot = 0, bajo = 0, n = 0;
  for(const i of items){
    const p = PRE[String(i.CodigoProducto || "")], q = Number(i.Cantidad) || 0;
    if(!p || !q || !p.med) continue;
    tot += p.med * q; bajo += (p.min || p.med) * q; n++;
  }
  if(!n) return "";
  const pres = Number(d.MontoEstimado) || 0;
  let h = "<dt>Cuánto cobrar (guía)</dt><dd>Con el precio de referencia, " + (n === 1 ? "este producto" : "los " + n + " productos con precio conocido") + " suma <b>" + plata(Math.round(tot)) +
    "</b> (lo más bajo que se ha visto: " + plata(Math.round(bajo)) + ").";
  if(pres) h += tot > pres ? " <b>Ojo:</b> supera el presupuesto del comprador (" + plata(pres) + "); con ese precio podrías quedar fuera." :
    " Es el " + Math.round(tot / pres * 100) + " % del presupuesto del comprador (" + plata(pres) + ").";
  return h + "<br><span class='nota'>Agrega tu costo, despacho y margen. Es una guía con compras anteriores, no una promesa de ganar.</span></dd>";
}
// Todos los plazos de la compra en un solo archivo de calendario, con avisos antes de cada uno.
function eventosPlazos(codigo, nombre, F, cierre){
  const f = x => { const p = n => String(n).padStart(2, "0"); return x.getFullYear() + p(x.getMonth() + 1) + p(x.getDate()) + "T" + p(x.getHours()) + p(x.getMinutes()) + "00"; };
  const desc = String(nombre || "").replace(/[,;\n]/g, " ") + " - " + FICHA + codigo;
  const hitos = [
    [F.FechaVisitaTerreno, "Visita a terreno", "-P1D"],
    [F.FechaFinal, "Último día para enviar preguntas", "-P1D"],
    [F.FechaPubRespuestas, "Se publican las respuestas del comprador", "PT0M"],
    [F.FechaCierre || cierre, "CIERRE: subir la oferta", "-P2D"],
    [F.FechaAdjudicacion, "Adjudicación estimada", "PT0M"]
  ].filter(h => h[0] && !isNaN(new Date(h[0])));
  return hitos.map((h, i) => {
    const fin = new Date(h[0]), ini = new Date(fin - 36e5);
    const ev = ["BEGIN:VEVENT","UID:" + codigo + "-" + i + "@apto","DTSTAMP:" + f(new Date()),"DTSTART:" + f(ini),"DTEND:" + f(fin),
      "SUMMARY:" + h[1] + " · " + codigo,"DESCRIPTION:" + desc,
      "BEGIN:VALARM","TRIGGER:" + h[2],"ACTION:DISPLAY","DESCRIPTION:" + h[1],"END:VALARM"];
    if(i === hitos.length - 1 || h[1].startsWith("CIERRE")) ev.push("BEGIN:VALARM","TRIGGER:-PT3H","ACTION:DISPLAY","DESCRIPTION:" + h[1],"END:VALARM");
    return ev.concat("END:VEVENT").join("\r\n");
  });
}
function descargarIcs(eventos, archivo){
  if(!eventos.length) return;
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Apto//ES"].concat(eventos, "END:VCALENDAR").join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], {type:"text/calendar"})); a.download = archivo; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function calendario(codigo, nombre, cierre, F){
  descargarIcs(eventosPlazos(codigo, nombre, F || {}, cierre), "plazos-" + codigo + ".ics");
}
// Calendario con los plazos de todas las compras guardadas (consulta el detalle de cada una).
async function calendarioGuardadas(){
  const cods = Object.keys(guardadas);
  if(!cods.length){ alert("Primero guarda alguna compra con ☆ Guardar."); return; }
  let ev = [];
  for(const c of cods){
    const base = datos.find(x => x.codigo === c) || {nombre:c};
    try{ const d = await pedirDetalle(c); ev = ev.concat(eventosPlazos(c, d.Nombre || base.nombre, d.Fechas || {}, base.cierre)); }
    catch(e){ if(base.cierre) ev = ev.concat(eventosPlazos(c, base.nombre, {}, base.cierre)); }
  }
  descargarIcs(ev, "apto-mis-plazos.ics");
}

// Catalogo automatico: el motor local busca lo que la empresa ya le vendio al Estado (datos publicos).
async function catalogoPorRut(){
  const out = $("rutout"), rut = $("rutcat").value.trim();
  if(!motorLocal){ out.innerHTML = '<p class="nota">Esta función usa el motor de Apto, que en el prototipo funciona en el computador del equipo. Por ahora agrega tus productos a mano.</p>'; return; }
  if(!rut){ $("rutcat").focus(); return; }
  $("rutbtn").disabled = true; out.innerHTML = '<p class="nota">Enviando…</p>';
  try{
    const r = await fetch(MOTOR + "/catalogo", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({rut})});
    const j = await r.json(); if(!r.ok) throw new Error(j.error || "No se pudo iniciar.");
    let e;
    do{ await new Promise(s => setTimeout(s, 2500)); e = await (await fetch(MOTOR + "/trabajo/" + j.id)).json(); if(!e.listo) out.innerHTML = '<p class="nota">' + esc(e.paso || "Procesando…") + esperaMotor() + "</p>"; }while(!e.listo);
    if(e.error) throw new Error(e.error);
    const R = e.resultado, nuevos = R.productos.filter(p => !catalogo.some(c => norm(c.nombre) === norm(p)));
    nuevos.forEach(p => catalogo.push({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nombre: p, caract: "Agregado desde tus ventas al Estado. Completa medidas, garantía y entrega.", garantia: "", entrega: ""}));
    guardar("rp_catalogo", catalogo); pintarCatalogo();
    const ya = Buscar.separar(perfil.extra).filter(Boolean);
    const pal = R.palabras.map(norm).filter(p => p && !ya.includes(p));
    if(pal.length){ perfil.extra = ya.concat(pal).join(", "); $("extra").value = perfil.extra; }
    perfil.cats = [...new Set((perfil.cats || []).concat(R.categorias || []))];
    cambio();
    out.innerHTML = '<p class="nota">Listo: revisamos ' + R.compras + " ventas al Estado. Agregamos " + nuevos.length + " productos a tu catálogo y " + pal.length + " palabras clave a tu búsqueda.</p>";
  }catch(err){ out.innerHTML = '<p class="nota">' + esc(err.message) + "</p>"; }
  $("rutbtn").disabled = false;
}

// ---------- Mis productos y revisión "¿Cumplo?" ----------
let catalogo = leer("rp_catalogo", []);
let docs = leer("rp_docs", {});
const UNI = {mm:["largo",1],cm:["largo",10],m:["largo",1000],mt:["largo",1000],mts:["largo",1000],metro:["largo",1000],metros:["largo",1000],
  g:["peso",1],gr:["peso",1],kg:["peso",1000],kilos:["peso",1000],ml:["volumen",1],cc:["volumen",1],l:["volumen",1000],lt:["volumen",1000],lts:["volumen",1000],litros:["volumen",1000],
  lm:["luz",1],lumen:["luz",1],lumenes:["luz",1],lumens:["luz",1],w:["potencia",1],watts:["potencia",1],pulgada:["pulgadas",1],pulgadas:["pulgadas",1],gb:["memoria",1],tb:["memoria",1024]};
const RX_MED = new RegExp("(\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(" + Object.keys(UNI).sort((a, b) => b.length - a.length).join("|") + ")(?![a-z])", "g");
const STOP = new Set(["para","con","por","los","las","del","una","uno","tipo","modelo","marca","color","tamaño"]);
function medidas(texto){
  const s = String(texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const out = []; let m; RX_MED.lastIndex = 0;
  while((m = RX_MED.exec(s))){
    const n = /^\d{1,3}(\.\d{3})+$/.test(m[1]) ? +m[1].replace(/\./g, "") : +m[1].replace(",", ".");
    const [fam, f] = UNI[m[2]];
    if(n > 0) out.push({fam, val: n * f, txt: m[0].replace(/\s+/g, " ")});
  }
  return out;
}
const fichaDe = p => p.nombre + " " + p.caract;
const parecido = (a, b) => Math.abs(a - b) / b <= 0.02;

// Compras de ejemplo: requisitos preparados a mano para mostrar la revision. No son compras reales.
const EJEMPLOS = [
  {codigo:"EJEMPLO-1b", nombre:"Adquisición de 2 bandas elásticas de resistencia para sala de rehabilitación",
   pide:"Dos rollos de banda elástica de resistencia, color negro, de 15 cm de ancho y al menos 45 m de largo, con garantía mínima de 6 meses y entrega en 10 días.",
   reqs:[
    {t:"palabra", e:"Es una banda elástica de resistencia", v:["banda elastica","bandas elasticas"], c:1},
    {t:"medida", e:"Ancho de 15 cm", n:15, u:"cm", modo:"igual", c:1},
    {t:"medida", e:"Largo de 45 m o más", n:45, u:"m", modo:"min", c:1},
    {t:"garantia", e:"Garantía de 6 meses o más", min:6, c:1},
    {t:"entrega", e:"Entrega en 10 días o menos", max:10, c:1},
    {t:"doc", e:"Ficha técnica del producto", c:1},
    {t:"doc", e:"Compromiso de garantía firmado", c:1},
    {t:"doc", e:"Cotización con impuestos incluidos", c:1},
    {t:"palabra", e:"Color negro (o equivalente)", v:["negro","negra"]},
    {t:"palabra", e:"El precio incluye el despacho", v:["despacho","envio incluido","flete incluido","incluye envio"]}],
   muestra:{nombre:"Banda elástica de resistencia en rollo", caract:"Rollo de 45,7 m de largo por 15 cm de ancho, color negro, resistencia extra fuerte, sin látex", garantia:"", entrega:"5"}},
  {codigo:"EJEMPLO-2b", nombre:"Adquisición de 1 proyector para sala de reuniones",
   pide:"Un proyector de al menos 4.000 lúmenes con entrada HDMI, garantía mínima de 12 meses y entrega en 15 días.",
   reqs:[
    {t:"palabra", e:"Es un proyector", v:["proyector"], c:1},
    {t:"medida", e:"Brillo de 4.000 lúmenes o más", n:4000, u:"lumenes", modo:"min", c:1},
    {t:"palabra", e:"Entrada HDMI", v:["hdmi"], c:1},
    {t:"garantia", e:"Garantía de 12 meses o más", min:12, c:1},
    {t:"entrega", e:"Entrega en 15 días o menos", max:15, c:1},
    {t:"doc", e:"Ficha técnica del producto", c:1},
    {t:"doc", e:"Compromiso de garantía firmado", c:1},
    {t:"palabra", e:"Incluye control remoto", v:["control remoto"]}],
   muestra:{nombre:"Proyector para sala", caract:"3.600 lúmenes, resolución SVGA, entradas HDMI y VGA, parlante integrado", garantia:"12", entrega:"7"}}
];

function evaluar(r, p, codigo, i){
  if(r.t === "palabra"){
    const t = " " + norm(fichaDe(p)) + " ";
    return r.v.some(v => t.includes(" " + v + " ") || t.includes(v)) ? {est:"ok", nota:"La ficha de tu producto lo indica."} : {est:"duda", nota:"No lo encontré en la ficha de tu producto. Si lo cumple, agrégalo a sus características."};
  }
  if(r.t === "medida"){
    const [fam, f] = UNI[r.u], meta = r.n * f;
    const ms = medidas(fichaDe(p)).filter(m => m.fam === fam);
    if(!ms.length) return {est:"duda", nota:"La ficha de tu producto no indica esta medida."};
    const sirve = ms.find(m => r.modo === "igual" ? parecido(m.val, meta) : r.modo === "min" ? m.val >= meta * 0.999 : m.val <= meta * 1.001);
    return sirve ? {est:"ok", nota:"Tu ficha indica " + sirve.txt + "."} : {est:"no", nota:"No encontré una medida que cumpla. Tu ficha indica: " + ms.map(m => m.txt).join(", ") + "."};
  }
  if(r.t === "garantia"){
    if(p.garantia === "" || p.garantia == null) return {est:"duda", nota:"No indicaste la garantía de tu producto."};
    return +p.garantia >= r.min ? {est:"ok", nota:"Tu producto tiene " + p.garantia + " meses de garantía."} : {est:"no", nota:"Tu producto tiene " + p.garantia + " meses y piden " + r.min + "."};
  }
  if(r.t === "entrega"){
    if(p.entrega === "" || p.entrega == null) return {est:"duda", nota:"No indicaste tu plazo de entrega."};
    return +p.entrega <= r.max ? {est:"ok", nota:"Entregas en " + p.entrega + " días."} : {est:"no", nota:"Entregas en " + p.entrega + " días y piden " + r.max + " o menos."};
  }
  return (docs[codigo] || {})[i] ? {est:"ok", nota:"Lo tienes listo."} : {est:"falta", nota:"Debes adjuntarlo a tu oferta. Márcalo cuando lo tengas."};
}
const ET = {ok:["ok","Cumple"], no:["ro","No cumple"], duda:["al","Te falta indicarlo"], falta:["al","Te falta adjuntarlo"]};
const ETS = {ok:["ok","Cumple"], no:["gr","No lo cumple"], duda:["gr","No lo indica"], falta:["gr","No lo adjunta"]}; // requisitos secundarios: no cambian el veredicto
function revision(ej){
  const caja = $("rev"); if(!caja) return;
  const yaMuestra = catalogo.some(p => p.nombre === ej.muestra.nombre);
  const boton = yaMuestra ? "" : '<button class="sec" id="bmuestra">Probar con un producto de muestra</button>';
  if(!catalogo.length){ caja.innerHTML = '<p class="nota">Agrega un producto en «Mis productos» para revisarlo contra estos requisitos, o usa uno de muestra.</p>' + boton; }
  else{
    const puntos = x => ej.reqs.filter((r, i) => evaluar(r, x, ej.codigo, i).est === "ok").length;
    const p = catalogo.find(x => x.id === caja.dataset.p) || catalogo.reduce((a, b) => puntos(b) > puntos(a) ? b : a); // parte por el producto que mas calza
    const res = ej.reqs.map((r, i) => evaluar(r, p, ej.codigo, i));
    // Lo esencial (c:1) decide el veredicto; lo secundario queda como recomendacion (aprendizaje de la prueba con ofertas reales).
    const esen = ej.reqs.map((r, i) => i).filter(i => ej.reqs[i].c), sec = ej.reqs.map((r, i) => i).filter(i => !ej.reqs[i].c);
    const okE = esen.filter(i => res[i].est === "ok").length, noE = esen.filter(i => res[i].est === "no").length;
    const faltan = esen.filter(i => res[i].est === "duda" || res[i].est === "falta").length, secPend = sec.filter(i => res[i].est !== "ok").length;
    const otro = res[0].est !== "ok"; // el primer requisito es el tipo de producto
    const cl = noE || otro ? "ro" : faltan ? "al" : "ok";
    const tit = otro ? "Este producto no parece ser lo que piden" : noE ? "Con este producto no cumples lo esencial" :
      faltan ? "Antes de ofertar, te falta" + (faltan === 1 ? " 1 cosa esencial" : "n " + faltan + " cosas esenciales") : "Puedes ofertar: cumples lo esencial";
    const sub = "Cumples " + okE + " de " + esen.length + " requisitos esenciales." + (secPend ? " Además, " + secPend + (secPend === 1 ? " detalle recomendado" : " detalles recomendados") + " por mejorar." : "");
    const fila = (i, tabla) => '<li><span class="et ' + tabla[res[i].est][0] + '">' + tabla[res[i].est][1] + "</span><div>" +
        (ej.reqs[i].t === "doc" ? '<label style="margin:0;font-weight:400;font-size:inherit"><input type="checkbox" data-i="' + i + '"' + (res[i].est === "ok" ? " checked" : "") + ">" + esc(ej.reqs[i].e) + "</label>" : esc(ej.reqs[i].e)) +
        "<small>" + esc(res[i].nota) + "</small></div></li>";
    caja.innerHTML = '<label for="revp">Producto que quiero ofrecer</label><select id="revp">' + catalogo.map(x => '<option value="' + esc(x.id) + '"' + (x.id === p.id ? " selected" : "") + ">" + esc(x.nombre) + "</option>").join("") + "</select>" +
      '<div class="veredicto ' + cl + '"><b>' + tit + "</b><br>" + sub + "</div>" +
      '<h2 style="margin-top:16px">Lo esencial</h2><ul class="req">' + esen.map(i => fila(i, ET)).join("") + "</ul>" +
      (sec.length ? '<h2 style="margin-top:16px">Detalles recomendados</h2><p class="nota" style="margin:0">No te dejan fuera, pero suman puntos o evitan consultas.</p><ul class="req">' + sec.map(i => fila(i, ETS)).join("") + "</ul>" : "") + boton;
    $("revp").onchange = () => { caja.dataset.p = $("revp").value; revision(ej); };
    caja.querySelectorAll(".req input").forEach(ch => ch.onchange = () => { (docs[ej.codigo] = docs[ej.codigo] || {})[ch.dataset.i] = ch.checked; guardar("rp_docs", docs); revision(ej); });
  }
  if($("bmuestra")) $("bmuestra").onclick = () => { const n = {id: Date.now().toString(36), ...ej.muestra}; catalogo.push(n); guardar("rp_catalogo", catalogo); pintarCatalogo(); caja.dataset.p = n.id; revision(ej); };
}
function abrirEjemplo(i){
  const ej = EJEMPLOS[i];
  $("det").innerHTML = '<h3 id="dtitulo">' + esc(ej.nombre) + '</h3><div class="nota"><span class="et al">Compra de ejemplo</span> Sirve para mostrar la revisión. No es una compra real.</div>' +
    '<dl class="tabla"><dt>Qué piden</dt><dd>' + esc(ej.pide) + "</dd></dl><h2>¿Cumplo lo que piden?</h2><div id=\"rev\"></div>" +
    '<p class="nota" style="margin-bottom:0">En esta versión los requisitos de los ejemplos se prepararon a mano. La meta del proyecto es leerlos automáticamente desde las bases y fichas técnicas de cada compra.</p>';
  $("dlg").showModal(); revision(ej);
}
// En compras reales: cruza los productos que pide la compra con el catalogo, por palabras y medidas.
function tengo(items){
  if(!items.length) return "";
  if(!catalogo.length) return '<h2>¿Tengo lo que piden?</h2><p class="nota">Agrega tus productos en «Mis productos» y aquí verás cuáles de los ' + items.length + " que piden tienes.</p>";
  let cuenta = 0;
  const filas = items.slice(0, 12).map(it => {
    const texto = norm([it.NombreProducto, it.Descripcion, it.Categoria].join(" ")), palabras = texto.split(" ");
    let mejor = null, nota = 0;
    for(const p of catalogo){
      const ws = norm(p.nombre).split(" ").filter(w => w.length > 3 && !STOP.has(w)).map(armar);
      if(!ws.length) continue;
      if(!calza(ws[0], texto, palabras)) continue; // la primera palabra del nombre (el tipo de producto) tiene que estar
      const r = ws.filter(w => calza(w, texto, palabras)).length / ws.length;
      if(r > nota){ nota = r; mejor = p; }
    }
    const linea = esc(it.NombreProducto) + " <span class='nota'>× " + esc(it.Cantidad) + " " + esc(it.UnidadMedida || "") + "</span>";
    if(!mejor || nota < 0.5) return '<li><span class="et gr">No lo veo</span><div>' + linea + "<small>No está en tu catálogo.</small></div></li>";
    cuenta++;
    const pide = medidas([it.NombreProducto, it.Descripcion].join(" ")), tuyas = medidas(fichaDe(mejor));
    const faltan = pide.filter(a => !tuyas.some(b => b.fam === a.fam && parecido(b.val, a.val))).map(a => a.txt);
    const extra = faltan.length ? " Pide estas medidas que no vi en tu ficha: " + [...new Set(faltan)].join(", ") + "." : pide.length ? " Las medidas que menciona coinciden con tu ficha." : "";
    return '<li><span class="et ' + (faltan.length ? "al" : "ok") + '">' + (faltan.length ? "Revisar" : "Lo tienes") + "</span><div>" + linea + "<small>Calza con tu producto «" + esc(mejor.nombre) + "»." + esc(extra) + "</small></div></li>";
  }).join("");
  return "<h2>¿Tengo lo que piden?</h2><p style='margin:0;font-size:14.5px'><b>De los " + Math.min(items.length, 12) + " productos revisados, tienes " + cuenta + " en tu catálogo.</b></p><ul class=\"req\">" + filas + "</ul>" +
    '<p class="nota">Revisión automática por palabras y medidas. La garantía, los plazos y los documentos exigidos están en las bases: léelas antes de ofertar.</p>';
}
function pintarCatalogo(){
  $("catalogo").innerHTML = catalogo.map(p => '<div class="prod"><div><b>' + esc(p.nombre) + "</b><small>" + esc(p.caract.slice(0, 110)) + (p.caract.length > 110 ? "…" : "") + "</small><small>" +
    (p.garantia !== "" ? "Garantía " + esc(p.garantia) + " meses" : "Sin garantía indicada") + " · " + (p.entrega !== "" ? "entrega en " + esc(p.entrega) + " días" : "sin plazo indicado") + '</small></div><button class="sec" data-id="' + esc(p.id) + '" aria-label="Quitar ' + esc(p.nombre) + '">Quitar</button></div>').join("");
}

// ---------- Carga ----------
function preparar(filas){
  datos = filas.map(f => { const t = Buscar.expandir(norm(f[1])); return {codigo:f[0], nombre:f[1] || "", cierre:f[2], texto:t, palabras:t.split(" "), tipo:tipoDe(f[0])}; });
  enriquecer();
}
// Forma B del radar: además del nombre, calza con la descripción y los productos de la compra (detalles.json, nocturno)
// y con el resumen de la IA. Medido con 999 licitaciones adjudicadas: el nombre solo encuentra 25 %, B 67 %, B o C 72 %.
function enriquecer(){
  for(const d of datos){
    const x = DET[d.codigo], r = RES[d.codigo];
    if(!x && !r) continue;
    const t = Buscar.expandir(norm(d.nombre + " " + (x ? x.t : "") + " " + (r ? (r.resumen || "") + " " + (r.piden || []).join(" ") : "")));
    d.texto = t; d.palabras = t.split(" ");
  }
  Buscar.vocabulario(datos.map(d => d.palabras)); // vocabulario real para corregir errores de escritura
}
// Palabras que por sí solas no dicen qué vende alguien ("mantenimiento", "servicios municipales", "venta")
const GENERICAS = /^(insum|materia|equip|articul|product|servici|vari|otro|general|element|venta|vend|arriend|alquil|manten|repar|disen|empres|ofici|person|event|municip|tecnic|soport)/; // por raíz
const generico = t => t.conceptos.every(alts => GENERICAS.test(alts[0].raiz || alts[0].w));
// Forma C: categorías de producto de Mercado Público (código ONU) que calzan con lo que vende el usuario.
// Salen de las palabras de su perfil (comparadas con los productos adjudicados de cada categoría) y de su catálogo por RUT.
let clasesVistas = [];
function misCategorias(ts){
  const s = new Set(perfil.cats || []);
  if(!ts.length) return s;
  if(DICC_OK){
    // Diccionario oficial de Mercado Público + palabras reales de compradores (diccionario.json)
    for(const r of Buscar.clasesDePerfil(ts)) s.add(r.c); // con el contexto de todo lo que escribió (ver buscar.js)
    // y además el mapa aprendido de compras adjudicadas (abajo): juntos encuentran más (medido: 52 % vs 26 % solo diccionario)
  }
  // cada concepto del vendedor (con sus sinónimos) se compara con los productos de cada categoría;
  // las palabras genéricas ("insumos", "equipos") no definen una categoría por sí solas
  // y cada término debe calzar ENTERO (todos sus conceptos): antes bastaba una palabra suelta y "eventos" o "personal"
  // traían categorías de otro rubro (medido con clientes simulados, 2026-11-20)
  const utiles = ts.map(t => t.conceptos.filter(alts => !alts[0].exacto && !GENERICAS.test(alts[0].raiz || alts[0].w))).filter(cs => cs.length && cs.length <= 3);
  // del mapa de adjudicadas solo entran categorías de un rubro que el diccionario ya reconoce para este vendedor
  const segs = new Set([...s].map(c => String(c).slice(0, 2)));
  for(const [c, pal] of Object.entries(CATMAP)){
    const txt = pal.slice(0, 6).join(" "), ps = pal.slice(0, 6);
    if((!segs.size || segs.has(c.slice(0, 2))) && utiles.some(cs => cs.every(alts => alts.some(a => Buscar.calzaAlt(a, txt, ps))))) s.add(c);
  }
  (perfil.noCats || []).forEach(c => s.delete(c)); // las que el vendedor quitó con la ✕
  return s;
}
// ---------- Resumenes nocturnos y motor ¿Cumplo? (IA local de Apto) ----------
function enSimple(c){
  const x = RES[c]; if(!x) return "";
  const lista = a => "<ul>" + a.slice(0, 8).map(t => "<li>" + esc(t) + "</li>").join("") + "</ul>";
  return '<h2>En simple</h2><div class="simple"><p style="margin:0 0 8px">' + esc(x.resumen) + "</p>" +
    (x.piden && x.piden.length ? "<b>Qué piden</b>" + lista(x.piden) : "") +
    (x.requisitos && x.requisitos.length ? "<b>Requisitos que se ven en la publicación</b>" + lista(x.requisitos)
      : '<p class="nota" style="margin:4px 0">El detalle está en las bases técnicas: descárgalas en la ficha oficial y revísalas aquí con Apto.</p>') +
    '<p class="nota" style="margin:6px 0 0">Resumen hecho por la IA de Apto con datos públicos de Mercado Público (' + esc(x.procesado || "") + "). Confírmalo siempre en las bases.</p></div>";
}
function bloqueCumplo(){
  return "<h2>¿Cumplo con la ficha técnica real?</h2>" + (motorLocal ? formCumplo()
    : '<p class="nota">Descarga la ficha técnica desde la ficha oficial y Apto la revisa contra tu producto, requisito por requisito. Esta función usa el motor de IA de Apto y por ahora está disponible solo en demostraciones.</p>');
}
function formCumplo(){
  const ac = ".pdf,.docx,.png,.jpg,.jpeg,.webp";
  return '<div class="cumplo"><label>Ficha técnica de la compra (PDF, Word o imagen) <a href="guia.html#ficha" target="_blank" rel="noopener" style="font-weight:400">¿Cómo la descargo?</a></label><input type="file" class="c-eett" accept="' + ac + '">' +
    '<label>Producto que quieres ofrecer</label><select class="c-prod"><option value="">Ninguno: solo ver los requisitos</option>' +
    catalogo.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nombre) + "</option>").join("") + "</select>" +
    '<label>Ficha de tu producto (opcional)</label><input type="file" class="c-of" accept="' + ac + '">' +
    '<button class="principal c-ir" style="margin-top:12px">Revisar con IA</button><div class="c-out" aria-live="polite"></div>' +
    '<p class="nota">Los archivos se procesan en el motor de Apto con IA propia y se borran al terminar. No se envían a servicios de IA de terceros. <a href="privacidad.html">Privacidad</a></p></div>';
}
function resultadoIA(r){
  const reqs = r.requisitos || [];
  if(!r.veredicto) return '<div class="veredicto al"><b>Requisitos que encontró Apto en la ficha</b><br>Elige un producto o sube su ficha para revisar si cumples.</div><ul class="req">' +
    reqs.map(q => '<li><span class="et ' + (q.critico ? "" : "gr") + '">' + (q.critico ? "Esencial" : "Recomendado") + "</span><div>" + esc(q.texto) + "</div></li>").join("") + "</ul>" + bloquePlantilla(r);
  const M = {cumple: "ok", no_cumple: "no", no_indica: "duda"};
  const esen = reqs.filter(q => q.critico && !q.alerta), sec = reqs.filter(q => !q.critico && !q.alerta), alr = reqs.filter(q => q.alerta);
  const okE = esen.filter(q => q.estado === "cumple").length, falt = esen.filter(q => q.estado === "no_indica").length;
  const T = {CUMPLE: ["ok", "Puedes ofertar: tu oferta declara todo lo que pide la ficha"], NO_CUMPLE: ["ro", "Con este producto no cumples lo que pide la ficha"],
    CUMPLE_CON_ALERTA: ["al", "Tu producto cumple la ficha técnica, pero antes de enviar agrega lo que falta abajo"],
    TE_FALTA: ["al", "Antes de ofertar, te falta" + (falt === 1 ? " declarar 1 cosa" : "n declarar " + falt + " cosas")]}[r.veredicto];
  const fila = (q, tab) => '<li><span class="et ' + tab[M[q.estado] || "duda"][0] + '">' + tab[M[q.estado] || "duda"][1] + "</span><div>" + esc(q.texto) +
    (q.frecuente && q.estado !== "cumple" ? ' <span class="et poca">Causa frecuente de rechazo</span>' : "") + "<small>" + esc(q.motivo || "") + "</small></div></li>";
  const pct = esen.length ? Math.round(100 * okE / esen.length) : 0;
  // en corto, qué falta o qué no calza (lo primero que necesita saber antes de ofertar)
  const pend = esen.filter(q => q.estado !== "cumple");
  const resumen = pend.length ? '<div class="pendientes"><b>Por qué todavía no puedes ofertar:</b><ul>' +
    pend.map(q => "<li>" + esc((q.motivo || ("Falta especificar: " + q.texto)).replace(/\s*\(la ficha pide:[^)]*\)\.?$/, "")) + "</li>").join("") + "</ul></div>" : "";
  return '<div class="veredicto ' + T[0] + '"><b>' + T[1] + "</b><br>Tu oferta declara " + okE + " de " + esen.length + " requisitos (" + pct + " %). " +
    (pct < 100 ? "Las comisiones rechazan ofertas que no escriben el 100 % de la ficha, con número y unidad: completa lo que falta. " : "") +
    "Revisión hecha con IA y reglas fijas: confírmala con las bases.</div>" + resumen +
    (alr.some(q => q.estado !== "cumple") ? '<div class="alerta-rechazo"><b>⚠️ Si no lo ingresas en tu oferta, te la van a rechazar:</b><ul>' +
      alr.filter(q => q.estado !== "cumple").map(q => "<li>" + esc(q.estado === "no_cumple" ? (q.motivo || q.texto) : "Falta indicar: " + q.texto.replace(/^Indicar (que )?/i, "")) + "</li>").join("") + "</ul></div>" : "") +
    '<h2 style="margin-top:16px">Ficha técnica</h2><ul class="req">' + esen.map(q => fila(q, ET)).join("") + "</ul>" +
    (alr.length ? '<h2 style="margin-top:16px">Plazo, garantía, envío y armado</h2><ul class="req">' + alr.map(q => fila(q, ET)).join("") + "</ul>" : "") +
    (sec.length ? '<h2 style="margin-top:16px">Detalles recomendados</h2><ul class="req">' + sec.map(q => fila(q, ETS)).join("") + "</ul>" : "") + bloquePlantilla(r);
}
// Texto para pegar en la oferta técnica: cada requisito de la ficha, con huecos [__] donde falta el valor exacto
function bloquePlantilla(r){
  if(!r.plantilla) return "";
  return '<h2 style="margin-top:16px">Texto para tu oferta técnica</h2><p class="nota">Cópialo, completa lo que está entre [corchetes] con el valor exacto de tu producto y pégalo en tu oferta. Así no se te queda nada afuera.</p>' +
    '<textarea class="c-plantilla" rows="10" style="width:100%;font-family:inherit">' + esc(r.plantilla) + '</textarea><button type="button" class="sec c-copiar" style="margin-top:6px">Copiar texto</button>';
}
function activarCumplo(raiz){
  const b = raiz.querySelector(".c-ir"); if(!b) return;
  b.onclick = async () => {
    const out = raiz.querySelector(".c-out"), f = raiz.querySelector(".c-eett").files[0];
    if(!f){ out.innerHTML = '<p class="nota" style="color:var(--rojo)">Elige primero la ficha técnica de la compra.</p>'; return; }
    const fd = new FormData(); fd.append("eett", f, f.name);
    const of = raiz.querySelector(".c-of").files[0]; if(of) fd.append("oferta", of, of.name);
    const p = catalogo.find(x => x.id === raiz.querySelector(".c-prod").value);
    if(p) fd.append("producto", p.nombre + ". " + p.caract + (p.garantia !== "" ? ". Garantía: " + p.garantia + " meses" : "") + (p.entrega !== "" ? ". Plazo de entrega: " + p.entrega + " días" : ""));
    if(!sesion){
      out.innerHTML = '<p class="nota">Para revisar si cumples crea tu cuenta gratis: incluye <b>5 revisiones ¿Cumplo?</b>, el radar y el calendario.</p><button type="button" class="principal" id="irCuenta">Crear mi cuenta gratis</button>';
      out.querySelector("#irCuenta").onclick = () => { try{ $("dlg").close(); }catch(e){} const c = $("cuenta"); if(c){ c.scrollIntoView({behavior: "smooth", block: "center"}); const k = $("correo"); if(k) k.focus(); } };
      return;
    }
    b.disabled = true; out.innerHTML = '<p class="nota">Enviando a la IA de Apto…</p>';
    try{
      if(Date.now() > sesion.vence - 60e3) await renovar();
      const r = await fetch(MOTOR + "/cumplo", {method: "POST", body: fd, headers: {"Authorization": "Bearer " + sesion.access_token}}); const j = await r.json();
      if(!r.ok){ const er = new Error(j.error || "Error del motor"); er.cuenta = r.status === 401 || r.status === 402; throw er; }
      let e;
      do{
        await new Promise(ok => setTimeout(ok, 2500));
        e = await (await fetch(MOTOR + "/cumplo/" + j.id)).json();
        if(!e.listo) out.innerHTML = '<p class="nota">' + esc(e.paso || "Procesando…") + esperaMotor() + "</p>";
      } while(!e.listo);
      out.innerHTML = e.error ? '<p class="nota" style="color:var(--rojo)">' + esc(e.error) + "</p>" : resultadoIA(e.resultado);
      if(!e.error && e.restante != null) out.insertAdjacentHTML("afterbegin", '<p class="nota">Plan gratis: te quedan <b>' + e.restante + " de 5</b> revisiones ¿Cumplo?.</p>");
      cargarPrueba();
      const cp = out.querySelector(".c-copiar");
      if(cp) cp.onclick = async () => { const t = out.querySelector(".c-plantilla"); try{ await navigator.clipboard.writeText(t.value); }catch(_){ t.select(); document.execCommand("copy"); } cp.textContent = "¡Copiado!"; setTimeout(() => cp.textContent = "Copiar texto", 1800); };
    }catch(err){ out.innerHTML = err.cuenta ? '<p class="nota" style="color:var(--rojo)">' + esc(err.message) + "</p>" : '<p class="nota" style="color:var(--rojo)">No se pudo conectar con el motor de Apto. ' + esc(err.message) + "</p>"; }
    b.disabled = false;
  };
}
function abrirFichaReal(){
  $("det").innerHTML = '<h3 id="dtitulo">Revisa una ficha técnica real</h3><p class="nota">Descarga la ficha técnica de cualquier compra desde Mercado Público, súbela aquí y elige tu producto. La IA de Apto lista los requisitos y te dice cuáles cumples.</p>' + formCumplo();
  $("dlg").showModal(); activarCumplo($("det"));
}
function conectarIA(){
  fetch("resumenes.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.items){ RES = j.items; enriquecer(); pintar(); } }).catch(() => {});
  fetch("sinonimos.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.grupos){ Buscar.sumarSinonimos(j.grupos); pintar(); } }).catch(() => {});
  fetch("detalles.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.items){ DET = j.items; enriquecer(); pintar(); } }).catch(() => {});
  fetch("diccionario.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.clases){ Buscar.cargarDiccionario(j.clases); DICC_OK = true; pintar(); } }).catch(() => {});
  fetch("aprendido.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j){ Buscar.cargarAprendido(j); pintar(); } }).catch(() => {});
  fetch("competencia.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.clases){ COMP = j; pintar(); } }).catch(() => {});
  fetch("compra_agil.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.clases){ CA = j; pintar(); } }).catch(() => {});
  fetch("categorias.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.categorias){ CATMAP = j.categorias; pintar(); } }).catch(() => {});
  fetch("precios.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.productos) PRE = j.productos; }).catch(() => {});
  // Motor ¿Cumplo?: primero el del PC de Apto (GPU, rápido); si no está encendido, el de la nube (Hugging Face, CPU, más lento)
  const probar = (url, ms) => { const ctl = new AbortController(); setTimeout(() => ctl.abort(), ms); return fetch(url + "/estado", {signal: ctl.signal}).then(r => r.json()).then(j => j && j.ok); };
  const activar = (url, nube) => {
    MOTOR = url; motorLocal = true; motorNube = nube;
    if(!$("bficha")){ $("ejemplos").insertAdjacentHTML("beforeend", '<button class="principal" id="bficha">Revisar una ficha técnica real</button>'); $("bficha").onclick = abrirFichaReal; }
  };
  // si no se está en el PC de Apto, se usa el mismo motor a través del túnel de Cloudflare (dirección en motor.json)
  const porTunel = () => fetch("motor.json", {cache: "no-store"}).then(r => r.json()).then(m => {
    if(!m || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(m.url)) throw 0;
    return probar(m.url, 12000).then(ok => { if(ok) activar(m.url, false); else throw 0; });
  });
  // al motor del PC solo se le habla directo en pruebas locales: en la página pública el navegador le pediría
  // al cliente un permiso de "red local", y el cliente no debe configurar nada
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  (local ? probar(MOTOR_PC, 1500) : Promise.resolve(false)).then(ok => { if(ok) return activar(MOTOR_PC, false); throw 0; })
    .catch(() => porTunel())
    .catch(() => setTimeout(() => porTunel().catch(() => {}), 30000)); // el túnel pudo cambiar de dirección: se reintenta
}

async function cargar(){
  conectarIA();
  const copia = window.SNAPSHOT;
  if(copia && copia.listado){ preparar(copia.listado); origen = "Copia guardada del " + new Date(copia.fecha).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"}); avisar(); pintar(); }
  // enlace directo a una compra (lo usan los correos de aviso): ?c=código
  const cDirecto = new URLSearchParams(location.search).get("c");
  if(cDirecto && datos.some(d => d.codigo === cDirecto)) setTimeout(() => abrir(cDirecto), 600);
  try{
    const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), 45000);
    const r = await fetch(API + "?estado=activas&ticket=" + TICKET_PRUEBA, {signal: ctl.signal});
    clearTimeout(reloj);
    const j = await r.json();
    if(j.Listado && j.Listado.length){ preparar(j.Listado.map(x => [x.CodigoExterno, x.Nombre, x.FechaCierre])); origen = "Datos en vivo de Mercado Público, " + new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}); }
  }catch(e){ if(!datos.length) origen = "Sin conexión con Mercado Público"; }
  avisar(); pintar();
}
function avisar(){
  // si la API en vivo no respondió y la copia guardada es vieja, se avisa (la copia la renueva GitHub cada 4 horas)
  const copia = window.SNAPSHOT, horas = copia && copia.fecha ? (Date.now() - new Date(copia.fecha)) / 36e5 : 0;
  const viejo = origen.startsWith("Copia") && horas > 12 ? " ⚠ Los datos tienen " + Math.round(horas) + " horas: pueden faltar compras nuevas." : "";
  $("fuente").textContent = origen + ". Fuente: API pública de ChileCompra." + viejo;
  $("fuente").style.color = viejo ? "var(--rojo, #B83A2B)" : "";
  const n = datos.filter(d => { const x = diasPara(d.cierre); return x === null || x >= 0; }).length;
  $("hnum").dataset.meta = n;
  if($("tnum").classList.contains("in") || !visto) contar($("hnum"), n);
}

// ---------- Portada: aparicion al hacer scroll y contador ----------
function contar(el, n){
  const ini = +(el.dataset.v || 0); el.dataset.v = n;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches || ini === n){ el.textContent = n.toLocaleString("es-CL"); return; }
  const t0 = performance.now(), dur = 1600;
  const paso = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(ini + (n - ini) * e).toLocaleString("es-CL"); if(p < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}
const visto = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if(!e.isIntersecting) return;
  e.target.classList.add("in"); visto.unobserve(e.target);
  if(e.target.id === "tnum" && $("hnum").dataset.meta) contar($("hnum"), +$("hnum").dataset.meta);
}), {threshold: .15, rootMargin: "0px 0px -40px 0px"}) : null;
document.querySelectorAll(".rv").forEach(el => visto ? visto.observe(el) : el.classList.add("in"));
// Respaldo: lo que ya esta en pantalla aparece al cargar, y si el navegador no avisa del scroll, se muestra todo.
requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll(".rv").forEach(el => { if(el.getBoundingClientRect().top < innerHeight) el.classList.add("in"); })));
function mostrarTodo(){ document.querySelectorAll(".rv:not(.in)").forEach(el => el.classList.add("in")); if($("hnum").dataset.meta) contar($("hnum"), +$("hnum").dataset.meta); }
let quietos = 0;
addEventListener("scroll", () => { clearTimeout(quietos); quietos = setTimeout(() => document.querySelectorAll(".rv:not(.in)").forEach(el => { if(el.getBoundingClientRect().top < innerHeight - 40){ el.classList.add("in"); if(el.id === "tnum" && $("hnum").dataset.meta) contar($("hnum"), +$("hnum").dataset.meta); } }), 120); }, {passive: true});
setTimeout(() => { if(!document.querySelector(".rv.in")) mostrarTodo(); }, 3000);

// ---------- Controles ----------
function iniciar(){
  $("rubros").innerHTML = Object.keys(RUBROS).map(r => '<button type="button" class="chip" aria-pressed="' + perfil.rubros.includes(r) + '">' + esc(r) + "</button>").join("");
  const resumenRubros = () => { const n = perfil.rubros.length; $("rubrosResumen").innerHTML = "<span>" + (n ? esc(perfil.rubros.slice(0, 2).join(", ")) + (n > 2 ? " y " + (n - 2) + " más" : "") : "Elegir rubros") + "</span>"; };
  $("rubros").onclick = e => { const b = e.target.closest(".chip"); if(!b) return; const r = b.textContent; const i = perfil.rubros.indexOf(r); if(i >= 0) perfil.rubros.splice(i, 1); else perfil.rubros.push(r); b.setAttribute("aria-pressed", i < 0); resumenRubros(); cambio(); };
  resumenRubros();
  document.addEventListener("click", e => { const m = $("menuRubros"); if(m && m.open && !m.contains(e.target)) m.open = false; });   // se cierra al tocar fuera
  $("region").innerHTML = '<option value="">Todo Chile</option>' + REGIONES.map(r => "<option>" + esc(r) + "</option>").join("");
  ["extra","excluir","region","tamano"].forEach(k => { $(k).value = perfil[k] || (k === "tamano" ? "5" : ""); $(k).oninput = () => { perfil[k] = $(k).value; cambio(); }; });
  $("plazo").value = perfil.plazo || ""; $("plazo").onchange = () => { perfil.plazo = $("plazo").value; cambio(); };
  $("soloRegion").checked = !!perfil.soloRegion; $("soloRegion").onchange = () => { perfil.soloRegion = $("soloRegion").checked; cambio(); };
  $("clases").onclick = e => {
    const q = e.target.closest("[data-quitar]"), rp = e.target.closest("[data-reponer]");
    if(q){ perfil.noCats = [...new Set((perfil.noCats || []).concat(q.dataset.quitar))]; cambio(); }
    if(rp){ perfil.noCats = []; cambio(); }
  };
  $("orden").onchange = pintar;
  $("vista").onchange = () => { perfil.vistaGuardadas = $("vista").value === "guardadas"; mostrar = INI; pintar(); };
  $("mas").onclick = () => { mostrar += 20; pintar(); };
  $("calguard").onclick = calendarioGuardadas;
  $("rutbtn").onclick = catalogoPorRut;
  $("lista").onclick = e => { const a = e.target.closest(".op"); if(a) abrir(a.dataset.c); };
  $("lista").onkeydown = e => { if(e.key === "Enter" || e.key === " "){ const a = e.target.closest(".op"); if(a){ e.preventDefault(); abrir(a.dataset.c); } } };
  $("dlg").onclick = e => { if(e.target === $("dlg")) $("dlg").close(); };
  $("cerrarDlg").onclick = () => $("dlg").close();
  perfil.vistaGuardadas = false;
  pintarCatalogo();
  $("catalogo").onclick = e => { const b = e.target.closest("button[data-id]"); if(!b) return; catalogo = catalogo.filter(p => p.id !== b.dataset.id); guardar("rp_catalogo", catalogo); pintarCatalogo(); };
  $("pguardar").onclick = () => {
    const nombre = $("pnombre").value.trim(); if(!nombre){ $("pnombre").focus(); return; }
    catalogo.push({id: Date.now().toString(36), nombre, caract: $("pcaract").value.trim(), garantia: $("pgar").value.trim(), entrega: $("pent").value.trim()});
    guardar("rp_catalogo", catalogo); pintarCatalogo();
    ["pnombre","pcaract","pgar","pent"].forEach(k => $(k).value = ""); $("nuevoProd").open = false;
  };
  $("ejemplos").innerHTML = EJEMPLOS.map((e, i) => '<button class="sec" data-i="' + i + '">' + esc(e.nombre.replace(/^Adquisición de \d+ /, "").replace(/ para .*/, "")) + "</button>").join("");
  $("ejemplos").onclick = e => { const b = e.target.closest("button[data-i]"); if(b) abrirEjemplo(+b.dataset.i); };
  cargar();
}
let espera;
function cambio(){ const {vistaGuardadas, ...p} = perfil; guardar("rp_perfil", p); mostrar = INI; clearTimeout(espera); espera = setTimeout(pintar, 180); }

// ---------- Mi cuenta: acceso con código de un solo uso por correo (Supabase Auth, sin contraseña) ----------
// El código llega al correo, vence en 10 minutos y sirve una vez. Cada empresa solo puede leer y escribir su propia
// fila (reglas RLS en la base de datos). La clave publicable es pública por diseño: no da acceso a datos de nadie.
const SB = "https://izxhfajflqmfhgligblu.supabase.co", SB_KEY = "sb_publishable_bhXkro91FvseczW7qIU0bw_W2psbU40";
let sesion = leer("apto_sesion", null), subida = 0;
async function sb(ruta, opciones = {}, conSesion = true){
  if(conSesion && sesion && Date.now() > sesion.vence - 60e3) await renovar();
  const h = {"apikey": SB_KEY, "Content-Type": "application/json", ...(opciones.headers || {})};
  if(conSesion && sesion) h.Authorization = "Bearer " + sesion.access_token;
  const r = await fetch(SB + ruta, {...opciones, headers: h});
  const txt = await r.text(); let j = null; try{ j = txt ? JSON.parse(txt) : null; }catch(e){}
  if(!r.ok) throw new Error((j && (j.msg || j.message || j.error_description)) || "Error " + r.status);
  return j;
}
function guardarSesion(j){
  sesion = j ? {access_token: j.access_token, refresh_token: j.refresh_token, vence: Date.now() + (j.expires_in || 3600) * 1000, correo: (j.user || {}).email || (sesion || {}).correo, id: (j.user || {}).id || (sesion || {}).id} : null;
  try{ sesion ? localStorage.setItem("apto_sesion", JSON.stringify(sesion)) : localStorage.removeItem("apto_sesion"); }catch(e){}
}
async function renovar(){
  try{ guardarSesion(await sb("/auth/v1/token?grant_type=refresh_token", {method: "POST", body: JSON.stringify({refresh_token: sesion.refresh_token})}, false)); }
  catch(e){ guardarSesion(null); pintarCuenta(); }
}
const datosCuenta = () => { const {vistaGuardadas, ticket, ...p} = perfil; return {perfil: p, catalogo, guardadas, pasos: hechos}; }; // el ticket de la API queda solo en este navegador
function subirCuenta(){
  if(!sesion) return;
  clearTimeout(subida);
  subida = setTimeout(() => sb("/rest/v1/cuentas", {method: "POST", headers: {"Prefer": "resolution=merge-duplicates,return=minimal"},
    body: JSON.stringify({user_id: sesion.id, ...datosCuenta()})}).then(() => nota("Guardado en tu cuenta.")).catch(e => nota("No se pudo guardar en tu cuenta: " + e.message)), 1500);
}
async function bajarCuenta(){
  const filas = await sb("/rest/v1/cuentas?select=perfil,catalogo,guardadas,pasos,avisos");
  if(filas && filas.length){
    const c = filas[0];
    avisosPref = c.avisos || "no"; if($("avisosOk")) $("avisosOk").checked = avisosPref === "diario";
    const ticket = perfil.ticket; perfil = {...perfil, ...c.perfil, ticket}; catalogo = c.catalogo || []; guardadas = c.guardadas || {}; hechos = c.pasos || {};
    try{ localStorage.setItem("rp_perfil", JSON.stringify(perfil)); localStorage.setItem("rp_catalogo", JSON.stringify(catalogo)); localStorage.setItem("rp_guardadas", JSON.stringify(guardadas)); localStorage.setItem("rp_pasos", JSON.stringify(hechos)); }catch(e){}
    ["extra","excluir","region","tamano"].forEach(k => $(k).value = perfil[k] || (k === "tamano" ? "5" : ""));
    document.querySelectorAll("#rubros .chip").forEach(b => b.setAttribute("aria-pressed", perfil.rubros.includes(b.textContent)));
    pintarCatalogo(); pintar();
    nota("Recuperamos tus datos guardados.");
  } else { subirCuenta(); nota("Tu catálogo y tus compras guardadas ahora quedan en tu cuenta."); }
}
const nota = t => { const n = $("cuentaNota"); if(n) n.textContent = t; };
let avisosPref = "no";   // los avisos por correo son opt-in: solo "diario" si la persona marca la casilla
// ---------- Entrada por plan: la herramienta se abre al elegir un plan e ingresar los datos ----------
// (Solo es la puerta de entrada de la página; el límite de revisiones ¿Cumplo? lo exige el servidor.)
const NOMBRES_PLAN = {gratis: "Plan Gratis", radar: "Plan Radar", apto: "Plan Apto"};
const entradaAbierta = () => $("entrada").classList.contains("abierta");
function cerrarEntrada(){ const E = $("entrada"); E.classList.remove("abierta"); E.inert = true; }
function desbloquear(conScroll){
  const H = $("herramienta"); if(!H || !H.hidden) return;
  H.hidden = false; cerrarEntrada();
  const lado = document.querySelector('main section.tarjeta[aria-label="Perfil de mi negocio"]'), titulo = lado && lado.querySelector("h2");
  if(titulo) titulo.insertAdjacentElement("afterend", $("cuenta"));   // "Mi cuenta" vuelve a su lugar en la columna
  pintar();
  if(conScroll) setTimeout(() => $("app").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"}), 60);
}
function pedirEntrada(plan, conScroll){
  const H = $("herramienta"); if(!H) return;
  if(!H.hidden){ $("app").scrollIntoView({behavior: "smooth", block: "start"}); return; }
  try{ localStorage.setItem("apto_plan_elegido", plan); }catch(e){}
  const E = $("entrada"); E.inert = false; E.classList.add("abierta");
  $("entradaPlan").textContent = NOMBRES_PLAN[plan] || NOMBRES_PLAN.gratis;
  $("entradaNota").textContent = plan === "gratis" ? "Crea tu cuenta con tu correo y registra el RUT de tu empresa. Tienes 5 revisiones ¿Cumplo? gratis, sin tarjeta."
    : "Los planes de pago aún no se cobran: empiezas con el plan gratis (5 revisiones ¿Cumplo?) y te avisamos cuando se active el " + NOMBRES_PLAN[plan] + ".";
  $("entradaCuenta").appendChild($("cuenta"));
  if(conScroll) setTimeout(() => E.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center"}), 200);   // espera a que empiece a desplegarse
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".plan-btn"); if(b) pedirEntrada(b.dataset.plan, true);
  const cc = e.target.closest && e.target.closest(".ciclo button"); if(cc){   // Mensual / Anual
    const g = document.querySelector(".planes"); if(g) g.dataset.ciclo = cc.dataset.ciclo;
    document.querySelectorAll(".ciclo button").forEach(x => { const on = x === cc; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    try{ localStorage.setItem("apto_ciclo", cc.dataset.ciclo); }catch(_){}
  } });
if(/[?&](demo|abierto)=/.test(location.search)) desbloquear(false);   // modo demostración y pruebas internas

// ---------- Plan gratis: 5 revisiones ¿Cumplo? por empresa (RUT) ----------
// El conteo vive en Supabase (funciones registrar_empresa / consumir_cumplo): una prueba por RUT, y el motor la descuenta con tu sesión.
const rutLimpio = t => String(t).toUpperCase().replace(/[^0-9K]/g, "");
function rutOk(t){
  const n = rutLimpio(t), cuerpo = n.slice(0, -1), dv = n.slice(-1);
  if(!/^\d{7,8}$/.test(cuerpo)) return false;
  let sum = 0, m = 2; for(let i = cuerpo.length - 1; i >= 0; i--){ sum += +cuerpo[i] * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (sum % 11); return (r === 11 ? "0" : r === 10 ? "K" : String(r)) === dv;
}
const rutBonito = t => { const n = rutLimpio(t); return n.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + n.slice(-1); };
let prueba = null;
async function cargarPrueba(){
  const D = $("prueba"); if(!D || !sesion) return;
  try{ prueba = await sb("/rest/v1/rpc/estado_prueba", {method: "POST", body: "{}"}); }catch(e){ D.innerHTML = ""; return; }
  const abre = prueba.registrada || prueba.plan === "apto";
  if(abre) desbloquear(entradaAbierta());
  // con sesión pero sin RUT no se abre nada solo: el panel se despliega únicamente cuando la persona aprieta un plan
  if(prueba.plan === "apto"){ D.innerHTML = '<div class="caja-prueba"><b>Plan Apto</b> · revisiones ¿Cumplo? sin límite.</div>'; return; }
  if(prueba.registrada){
    const r = prueba.restante;
    D.innerHTML = '<div class="caja-prueba"><b>Plan gratis</b> · ' + (r > 0 ? "te quedan <b>" + r + " de 5</b> revisiones ¿Cumplo?." : "usaste tus 5 revisiones ¿Cumplo?. Con el plan Apto las tienes sin límite.") + "</div>"; return;
  }
  D.innerHTML = '<div class="caja-prueba"><b>Plan gratis: 5 revisiones ¿Cumplo?</b><p class="nota" style="margin:4px 0 8px">Registra el RUT de tu empresa, el mismo con el que ofertas. Hay una prueba gratis por empresa.</p>' +
    '<label for="rutEmp">RUT de tu empresa</label><input id="rutEmp" autocomplete="off" placeholder="76.123.456-7">' +
    '<div class="acciones" style="margin-top:8px"><button class="principal" id="verRut">Verificar mi empresa</button></div><p class="nota" id="rutNota" aria-live="polite"></p></div>';
  const nota2 = t => { $("rutNota").innerHTML = t; };
  const registrar = async n => {
    try{
      const r = await sb("/rest/v1/rpc/registrar_empresa", {method: "POST", body: JSON.stringify({p_rut: n})});
      if(r.ok){ nota("Listo: tienes 5 revisiones ¿Cumplo? gratis."); return cargarPrueba(); }
      nota2({rut_invalido: "Ese RUT no es válido. Revisa el dígito verificador.", rut_en_uso: "Ese RUT ya usó su prueba gratis desde otra cuenta. Si es tu empresa, escríbenos y lo revisamos.",
        demasiadas_desde_esta_red: "Desde esta conexión ya se registraron varias empresas. Escríbenos y lo revisamos.", otro_rut: "Tu cuenta ya tiene otro RUT registrado."}[r.motivo] || "No se pudo registrar. Intenta de nuevo.");
    }catch(e){ nota2("No se pudo registrar: " + esc(e.message)); }
  };
  $("verRut").onclick = async () => {
    const v = $("rutEmp").value;
    if(!rutOk(v)){ nota2("Ese RUT no es válido. Revisa el dígito verificador."); return; }
    const n = rutBonito(v); nota2("Buscando tu empresa en Mercado Público…");
    let nombre = "";
    try{ const r = await fetch(MOTOR + "/proveedor/" + encodeURIComponent(rutLimpio(v)), {signal: AbortSignal.timeout(25000)}); if(r.ok) nombre = (await r.json()).nombre || ""; }catch(e){}
    if(nombre){
      nota2("¿<b>" + esc(nombre) + "</b> (" + esc(n) + ") es tu empresa? <button type=\"button\" class=\"principal\" id=\"siEmp\" style=\"margin-left:6px\">Sí, es mi empresa</button>");
    }else{
      nota2("No pudimos confirmar el nombre de <b>" + esc(n) + "</b> en Mercado Público ahora (o aún no está inscrita). Puedes registrarla igual: <button type=\"button\" class=\"principal\" id=\"siEmp\" style=\"margin-left:6px\">Registrar este RUT</button>");
    }
    $("siEmp").onclick = () => registrar(n);
  };
}
function pintarCuenta(){
  const C = $("cuenta"); if(!C) return;
  if(sesion){
    C.innerHTML = '<div class="nota">Conectado como <b>' + esc(sesion.correo || "") + '</b>. Tus datos se guardan en tu cuenta y los ves en cualquier dispositivo.</div><div id="prueba"></div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;margin-top:10px"><input type="checkbox" id="aprenderOk"' + (perfil.aprender !== false ? " checked" : "") + ' style="width:auto;margin-top:4px">' +
      '<span>Ayudar a mejorar Apto <span class="nota" style="display:block">Cuando guardas o descartas una compra, Apto registra de forma anónima qué palabras calzan con qué productos. <a href="privacidad.html">Más información</a></span></span></label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;margin-top:10px"><input type="checkbox" id="avisosOk"' + (avisosPref === "diario" ? " checked" : "") + ' style="width:auto;margin-top:4px">' +
      '<span>Recibir por correo los avisos de compras de Mercado Público <span class="nota" style="display:block">Si lo aceptas, te enviamos cada mañana las compras nuevas que calzan con lo que vendes. Puedes desactivarlo cuando quieras; cada correo trae un enlace para darte de baja.</span></span></label>' +
      '<div class="acciones" style="margin-top:8px"><button class="sec" id="salir">Salir</button><button class="sec" id="borrarDatos">Borrar mis datos</button></div><p class="nota" id="cuentaNota"></p>';
    cargarPrueba();
    $("avisosOk").onchange = async e => {
      const nuevo = e.target.checked ? "diario" : "no";
      try{ await sb("/rest/v1/cuentas?user_id=eq." + sesion.id, {method: "PATCH", headers: {"Prefer": "return=minimal"}, body: JSON.stringify({avisos: nuevo})});
        avisosPref = nuevo; nota(e.target.checked ? "Listo: te enviaremos cada mañana las compras nuevas que calzan contigo." : "Listo: no te enviaremos avisos por correo."); }
      catch(err){ e.target.checked = !e.target.checked; nota("No se pudo guardar: " + err.message); }
    };
    $("salir").onclick = async () => { try{ await sb("/auth/v1/logout", {method: "POST"}); }catch(e){} guardarSesion(null); pintarCuenta(); };
    $("aprenderOk").onchange = e => { perfil.aprender = e.target.checked; cambio(); nota(e.target.checked ? "Gracias: Apto aprenderá de forma anónima con tu uso." : "Listo: Apto ya no registrará tu uso."); };
    $("borrarDatos").onclick = async () => {
      if(!confirm("Se borrarán tu perfil, tu catálogo, tus compras guardadas y tus señales de aprendizaje de tu cuenta. ¿Continuar?")) return;
      try{
        await sb("/rest/v1/senales?user_id=eq." + sesion.id, {method: "DELETE"});
        await sb("/rest/v1/cuentas?user_id=eq." + sesion.id, {method: "DELETE"});
        nota("Listo: borramos tus datos de la cuenta. Para borrar también tu correo de acceso, escríbenos.");
      }catch(e){ nota("No se pudo borrar: " + e.message); }
    };
    return;
  }
  C.innerHTML = '<div class="nota">Entra con tu correo para guardar tu catálogo y tus compras en tu cuenta. Sin contraseña: te enviamos un código. <a href="privacidad.html">Privacidad</a></div>' +
    '<label for="correo">Correo</label><input type="email" id="correo" autocomplete="email" placeholder="tu@empresa.cl">' +
    '<div class="acciones" style="margin-top:8px"><button class="principal" id="pedirCodigo">Enviarme un código</button></div>' +
    '<div id="pasoCodigo" hidden><label for="codigo">Código que llegó a tu correo</label><input type="text" id="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456">' +
    '<div class="acciones" style="margin-top:8px"><button class="principal" id="entrar">Entrar</button></div></div><p class="nota" id="cuentaNota"></p>';
  $("pedirCodigo").onclick = async () => {
    const correo = $("correo").value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){ nota("Revisa el correo."); $("correo").focus(); return; }
    $("pedirCodigo").disabled = true;
    try{ await sb("/auth/v1/otp", {method: "POST", body: JSON.stringify({email: correo, create_user: true})}, false);
      $("pasoCodigo").hidden = false; $("codigo").focus(); nota("Si el correo es válido, te llegará un código en un minuto. Revisa también spam. Vence en 10 minutos."); }
    catch(e){ nota(/rate|seconds|limit/i.test(e.message) ? "Ya te enviamos un código hace poco. Espera un minuto antes de pedir otro." : "No se pudo enviar el código. Intenta de nuevo."); }
    setTimeout(() => { if($("pedirCodigo")) $("pedirCodigo").disabled = false; }, 60000);
  };
  $("entrar").onclick = async () => {
    const token = $("codigo").value.replace(/\D/g, "");
    if(token.length < 6){ nota("El código tiene 6 dígitos."); return; }
    try{ guardarSesion(await sb("/auth/v1/verify", {method: "POST", body: JSON.stringify({type: "email", email: $("correo").value.trim().toLowerCase(), token})}, false));
      pintarCuenta(); await bajarCuenta(); }
    catch(e){ nota("Código incorrecto o vencido. Pide uno nuevo si pasaron más de 10 minutos."); }
  };
}

iniciar();
pintarCuenta();
if(sesion) bajarCuenta().catch(() => {});


// Serpiente de "Cómo funciona": cuerpo y punta de flecha son UNA sola pieza (un polígono que se recalcula en cada cuadro siguiendo la curva
// de los aros). Usa el mismo reloj que las animaciones CSS de los medallones para que el resaltado coincida con la cabeza.
(function(){
  const svg = document.querySelector(".serp"), ruta = document.getElementById("rutaSerp"), forma = svg && svg.querySelector(".forma");
  if(!svg || !ruta || !forma || !ruta.getTotalLength) return;
  const Lt = ruta.getTotalLength(), CICLO = 9000, LCUERPO = Lt * 0.16, MITAD = 3.5, PUNTA = 24, ALA = 11;
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pt = s => ruta.getPointAtLength(Math.min(Math.max(s, 0), Lt));
  const tang = s => { const a = pt(s - 1.5), b = pt(s + 1.5), dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1; return [dx / m, dy / m]; };
  const f = n => n.toFixed(1);
  function dibujar(fase, op){
    const cabeza = Math.min(fase / 0.7, 1) * Lt, cola = Math.max(0, cabeza - LCUERPO);
    if(cabeza < 2 || op <= 0){ forma.setAttribute("d", ""); return; }
    forma.style.opacity = op;
    const n = Math.max(2, Math.ceil((cabeza - cola) / 6)), izq = [], der = [];
    for(let i = 0; i <= n; i++){
      const s = cola + (cabeza - cola) * i / n, p = pt(s), [tx, ty] = tang(s);
      izq.push([p.x - ty * MITAD, p.y + tx * MITAD]); der.push([p.x + ty * MITAD, p.y - tx * MITAD]);
    }
    const ph = pt(cabeza), [hx, hy] = tang(cabeza), nx = -hy, ny = hx;
    const puntos = [...izq, [ph.x + nx * ALA, ph.y + ny * ALA], [ph.x + hx * PUNTA, ph.y + hy * PUNTA], [ph.x - nx * ALA, ph.y - ny * ALA], ...der.reverse()];
    const p0 = pt(cola), [tx0, ty0] = tang(cola);   // punta trasera redondeada
    for(let k = 1; k < 6; k++){ const th = Math.PI * k / 6; puntos.push([p0.x + MITAD * (-(-ty0) * Math.cos(th) - tx0 * Math.sin(th)) * 1, p0.y + MITAD * (-(tx0) * Math.cos(th) - ty0 * Math.sin(th))]); }
    forma.setAttribute("d", "M" + puntos.map(q => f(q[0]) + " " + f(q[1])).join("L") + "Z");
  }
  if(reducido){ dibujar(0.7, 0.55); return; }
  let t0 = null, vivo = false;
  const inicio = () => { const a = document.getAnimations().find(x => x.animationName === "med1"); return a && a.startTime != null ? +a.startTime : 0; };
  function cuadro(){
    if(!vivo) return;
    if(t0 === null) t0 = inicio();
    const fase = ((((document.timeline.currentTime - t0) % CICLO) + CICLO) % CICLO) / CICLO;
    const op = fase < 0.02 ? fase / 0.02 : fase <= 0.76 ? 1 : fase < 0.88 ? 1 - (fase - 0.76) / 0.12 : 0;
    dibujar(fase, op);
    requestAnimationFrame(cuadro);
  }
  const visto = new IntersectionObserver(es => { const v = es.some(e => e.isIntersecting); if(v && !vivo){ vivo = true; requestAnimationFrame(cuadro); } else if(!v){ vivo = false; } });
  visto.observe(svg);
})();

// Modo demo para grabar el video: ?demo=1 (o ?demo=aseo, ?demo=computacion). Llena un perfil de ejemplo sin guardar nada del visitante.
(function(){
  const m = /[?&]demo=([\w-]*)/.exec(location.search); if(!m) return;
  const EJ = {"1": ["notebook, computadores, tóner", "Araucanía"], computacion: ["notebook, computadores, tóner", "Araucanía"], aseo: ["servicio de aseo, insumos de limpieza", "Araucanía"], jardines: ["mantención de áreas verdes", "Araucanía"]};
  const e = EJ[m[1] || "1"] || EJ["1"];
  try{ localStorage.removeItem("rp_perfil"); }catch(x){}
  setTimeout(() => {
    const t = $("extra"), r = $("region"); if(!t) return;
    t.value = e[0]; perfil.extra = e[0]; t.dispatchEvent(new Event("input", {bubbles: true}));
    if(r){ const o = [...r.options].find(x => x.textContent.includes(e[1])); if(o){ r.value = o.value; perfil.region = o.value; r.dispatchEvent(new Event("input", {bubbles: true})); } }
    const b = document.createElement("div"); b.textContent = "Modo demostración · datos de ejemplo"; b.style.cssText = "position:fixed;bottom:10px;left:10px;background:#1D4E9E;color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;z-index:50";
    document.body.appendChild(b);
  }, 2500);
})();
