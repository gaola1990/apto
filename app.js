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
let datos = [], resultados = [], mostrar = 40, origen = "";
let RES = {}, PRE = {}, DET = {}, CATMAP = {}, motorLocal = false;         // resumenes nocturnos (n8n + IA local) y motor ¿Cumplo? local
const MOTOR = "http://127.0.0.1:8787";
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
  perfil.extra.split(",").map(norm).filter(Boolean).forEach(t => lista.push(t));
  return [...new Set(lista.map(norm))].map(armar);
}
// Por palabras, con variantes y sinónimos de compras públicas (ver buscar.js).
const armar = t => Buscar.armar(t);
const calza = (term, texto, palabras) => Buscar.calza(term, texto, palabras);
function calcular(){
  const ts = terminos();
  const no = perfil.excluir.split(",").map(norm).filter(Boolean).map(armar);
  const tope = +perfil.tamano;
  const cats = misCategorias(ts);
  resultados = [];
  for(const d of datos){
    const dias = diasPara(d.cierre);
    if(dias !== null && dias < 0) continue;
    if(d.tipo.n > tope) continue;
    if(perfil.vistaGuardadas){ if(guardadas[d.codigo]) resultados.push({...d, dias, pts:0, hits:[]}); continue; }
    if(!ts.length) continue;
    if(no.some(t => calza(t, d.texto, d.palabras))) continue;
    const hits = ts.filter(t => calza(t, d.texto, d.palabras));   // B: nombre + descripción + productos
    const ia = RES[d.codigo], porRubro = !!(ia && perfil.rubros.includes(ia.rubro)); // la IA nocturna clasifico el rubro
    const det = DET[d.codigo], porCat = !!(det && det.c && det.c.some(c => cats.has(c))); // C: categoría de producto
    if(!hits.length && !porRubro && !porCat) continue;
    const pts = hits.reduce((a, h) => a + (h.frase ? 3 : 2), 0) + (d.tipo.n <= 2 ? 1 : 0) + (porRubro ? 3 : 0) + (porCat ? 4 : 0);
    resultados.push({...d, dias, pts, hits, porCat});
  }
  const porCierre = (a, b) => (a.dias ?? 999) - (b.dias ?? 999);
  resultados.sort($("orden").value === "cierre" || perfil.vistaGuardadas ? porCierre : (a, b) => b.pts - a.pts || porCierre(a, b));
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
function pintar(){
  calcular();
  const semana = resultados.filter(r => r.dias !== null && r.dias <= 7).length;
  const chicas = resultados.filter(r => r.tipo.n <= 2).length;
  $("cifras").innerHTML =
    cifra(datos.length.toLocaleString("es-CL"), "licitaciones abiertas hoy") +
    cifra(resultados.length.toLocaleString("es-CL"), "calzan con tu negocio") +
    cifra(semana, "cierran en 7 días") +
    cifra(chicas, "de tamaño pyme (hasta 1.000 UTM)");
  const L = $("lista");
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
      '<div class="meta"><span class="et gr">' + esc(r.codigo) + '</span><span class="et">' + esc(r.tipo.t) + "</span>" + (RES[r.codigo] ? '<span class="et">En simple</span>' : "") + (r.porCat ? '<span class="et">Calza por categoría</span>' : "") + "</div></div>" +
      '<div class="cierre"><b>' + (r.cierre ? new Date(r.cierre).toLocaleDateString("es-CL",{day:"numeric",month:"short"}) : "—") + '</b><span class="et ' + cl + '">' + tx + "</span></div></article>";
  }).join("");
  $("mas").hidden = resultados.length <= mostrar;
  $("mas").textContent = "Ver más (" + (resultados.length - mostrar) + " restantes)";
}
const cifra = (n, t) => '<div class="cifra"><b>' + n + "</b><span>" + t + "</span></div>";

// ---------- Detalle y plan de oferta ----------
async function pedirDetalle(codigo){
  if(cacheDet[codigo]) return cacheDet[codigo];
  const url = API + "?codigo=" + encodeURIComponent(codigo) + "&ticket=" + encodeURIComponent(perfil.ticket.trim() || TICKET_PRUEBA);
  for(let i = 0; i < 3; i++){
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if(j.Listado && j.Listado[0]) return (cacheDet[codigo] = j.Listado[0]);
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
    "<dt>Adjudicación estimada</dt><dd>" + fechaCorta((d.Fechas || {}).FechaAdjudicacion) + "</dd>" +
    "<dt>Qué piden</dt><dd>" + esc((d.Descripcion || "").slice(0, 420)) + ((d.Descripcion || "").length > 420 ? "…" : "") + "</dd>" +
    "<dt>Productos (" + items.length + ")</dt><dd>" + (items.slice(0, 8).map(i => esc(i.NombreProducto) + " <span class='nota'>× " + esc(i.Cantidad) + " " + esc(i.UnidadMedida || "") + "</span>").join("<br>") || "—") + (items.length > 8 ? "<br><span class='nota'>y " + (items.length - 8) + " más</span>" : "") + "</dd>" +
    precioRef(items) +
    "</dl>" + enSimple(codigo) + tengo(items) + bloqueCumplo() + "<h2>Mi plan para ofertar</h2>" + plan(d, base) +
    '<div class="acciones"><button class="principal" id="bg">' + (guardadas[codigo] ? "★ Guardada" : "☆ Guardar") + '</button>' +
    '<button class="sec" id="bcal">Agregar todos los plazos a mi calendario</button>' +
    '<a class="sec" style="text-decoration:none;display:inline-block;border:1px solid var(--linea);border-radius:8px;padding:8px 12px" target="_blank" rel="noopener" href="' + FICHA + encodeURIComponent(codigo) + '">Abrir ficha oficial ↗</a></div>' +
    '<p class="nota" style="margin-bottom:0">El plan es una guía general. Las bases de cada licitación mandan: revisa siempre sus requisitos.</p>';
  activarCumplo(D);
  D.querySelectorAll(".pasos input").forEach(ch => ch.onchange = () => { (hechos[codigo] = hechos[codigo] || {})[ch.dataset.i] = ch.checked; guardar("rp_pasos", hechos); });
  $("bg").onclick = () => { if(guardadas[codigo]) delete guardadas[codigo]; else guardadas[codigo] = 1; guardar("rp_guardadas", guardadas); $("bg").textContent = guardadas[codigo] ? "★ Guardada" : "☆ Guardar"; pintar(); };
  $("bcal").onclick = () => calendario(codigo, d.Nombre || base.nombre, (d.Fechas || {}).FechaCierre || base.cierre, d.Fechas || {});
}
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
    do{ await new Promise(s => setTimeout(s, 2500)); e = await (await fetch(MOTOR + "/trabajo/" + j.id)).json(); if(!e.listo) out.innerHTML = '<p class="nota">' + esc(e.paso || "Procesando…") + " Puede tardar unos minutos.</p>"; }while(!e.listo);
    if(e.error) throw new Error(e.error);
    const R = e.resultado, nuevos = R.productos.filter(p => !catalogo.some(c => norm(c.nombre) === norm(p)));
    nuevos.forEach(p => catalogo.push({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nombre: p, caract: "Agregado desde tus ventas al Estado. Completa medidas, garantía y entrega.", garantia: "", entrega: ""}));
    guardar("rp_catalogo", catalogo); pintarCatalogo();
    const ya = perfil.extra.split(",").map(norm).filter(Boolean);
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
  datos = filas.map(f => { const t = norm(f[1]); return {codigo:f[0], nombre:f[1] || "", cierre:f[2], texto:t, palabras:t.split(" "), tipo:tipoDe(f[0])}; });
  enriquecer();
}
// Forma B del radar: además del nombre, calza con la descripción y los productos de la compra (detalles.json, nocturno)
// y con el resumen de la IA. Medido con 999 licitaciones adjudicadas: el nombre solo encuentra 25 %, B 67 %, B o C 72 %.
function enriquecer(){
  for(const d of datos){
    const x = DET[d.codigo], r = RES[d.codigo];
    if(!x && !r) continue;
    const t = norm(d.nombre + " " + (x ? x.t : "") + " " + (r ? (r.resumen || "") + " " + (r.piden || []).join(" ") : ""));
    d.texto = t; d.palabras = t.split(" ");
  }
}
// Forma C: categorías de producto de Mercado Público (código ONU) que calzan con lo que vende el usuario.
// Salen de las palabras de su perfil (comparadas con los productos adjudicados de cada categoría) y de su catálogo por RUT.
function misCategorias(ts){
  const s = new Set(perfil.cats || []);
  if(!ts.length) return s;
  // cada concepto del vendedor (con sus sinónimos) se compara con los productos de cada categoría;
  // las palabras genéricas ("insumos", "equipos") no definen una categoría por sí solas
  const GENERICAS = /^(insumo|material|equipo|articulo|producto|servicio|vario|otro|general|elemento)/;
  const alts = ts.flatMap(t => t.conceptos.flat()).filter(a => !a.exacto && !GENERICAS.test(a.raiz || a.w));
  for(const [c, pal] of Object.entries(CATMAP)){
    const txt = pal.slice(0, 6).join(" "), ps = pal.slice(0, 6);
    if(alts.some(a => Buscar.calzaAlt(a, txt, ps))) s.add(c);
  }
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
  return '<div class="cumplo"><label>Ficha técnica de la compra (PDF, Word o imagen)</label><input type="file" class="c-eett" accept="' + ac + '">' +
    '<label>Producto que quieres ofrecer</label><select class="c-prod"><option value="">Ninguno: solo ver los requisitos</option>' +
    catalogo.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nombre) + "</option>").join("") + "</select>" +
    '<label>Ficha de tu producto (opcional)</label><input type="file" class="c-of" accept="' + ac + '">' +
    '<button class="principal c-ir" style="margin-top:12px">Revisar con IA</button><div class="c-out" aria-live="polite"></div>' +
    '<p class="nota">Los archivos se procesan en el motor de Apto con IA local y se borran al terminar. No se envían a servicios en la nube.</p></div>';
}
function resultadoIA(r){
  const reqs = r.requisitos || [];
  if(!r.veredicto) return '<div class="veredicto al"><b>Requisitos que encontró Apto en la ficha</b><br>Elige un producto o sube su ficha para revisar si cumples.</div><ul class="req">' +
    reqs.map(q => '<li><span class="et ' + (q.critico ? "" : "gr") + '">' + (q.critico ? "Esencial" : "Detalle") + "</span><div>" + esc(q.texto) + "</div></li>").join("") + "</ul>";
  const M = {cumple: "ok", no_cumple: "no", no_indica: "duda"};
  const esen = reqs.filter(q => q.critico), sec = reqs.filter(q => !q.critico);
  const okE = esen.filter(q => q.estado === "cumple").length, falt = esen.filter(q => q.estado === "no_indica").length;
  const T = {CUMPLE: ["ok", "Puedes ofertar: cumples lo esencial"], NO_CUMPLE: ["ro", "Con este producto no cumples lo esencial"],
    TE_FALTA: ["al", "Antes de ofertar, te falta" + (falt === 1 ? " 1 cosa esencial" : "n " + falt + " cosas esenciales")]}[r.veredicto];
  const fila = (q, tab) => '<li><span class="et ' + tab[M[q.estado] || "duda"][0] + '">' + tab[M[q.estado] || "duda"][1] + "</span><div>" + esc(q.texto) + "<small>" + esc(q.motivo || "") + "</small></div></li>";
  return '<div class="veredicto ' + T[0] + '"><b>' + T[1] + "</b><br>Cumples " + okE + " de " + esen.length + " requisitos esenciales. Revisión hecha con IA: confírmala con las bases.</div>" +
    '<h2 style="margin-top:16px">Lo esencial</h2><ul class="req">' + esen.map(q => fila(q, ET)).join("") + "</ul>" +
    (sec.length ? '<h2 style="margin-top:16px">Detalles recomendados</h2><ul class="req">' + sec.map(q => fila(q, ETS)).join("") + "</ul>" : "");
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
    b.disabled = true; out.innerHTML = '<p class="nota">Enviando a la IA de Apto…</p>';
    try{
      const r = await fetch(MOTOR + "/cumplo", {method: "POST", body: fd}); const j = await r.json();
      if(!r.ok) throw new Error(j.error || "Error del motor");
      let e;
      do{
        await new Promise(ok => setTimeout(ok, 2500));
        e = await (await fetch(MOTOR + "/cumplo/" + j.id)).json();
        if(!e.listo) out.innerHTML = '<p class="nota">' + esc(e.paso || "Procesando…") + " Puede tardar unos minutos.</p>";
      } while(!e.listo);
      out.innerHTML = e.error ? '<p class="nota" style="color:var(--rojo)">' + esc(e.error) + "</p>" : resultadoIA(e.resultado);
    }catch(err){ out.innerHTML = '<p class="nota" style="color:var(--rojo)">No se pudo conectar con el motor de Apto. ' + esc(err.message) + "</p>"; }
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
  fetch("categorias.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.categorias){ CATMAP = j.categorias; pintar(); } }).catch(() => {});
  fetch("precios.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { if(j && j.productos) PRE = j.productos; }).catch(() => {});
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500);
  fetch(MOTOR + "/estado", {signal: ctl.signal}).then(r => r.json()).then(j => {
    if(!j.ok) return;
    motorLocal = true;
    $("ejemplos").insertAdjacentHTML("beforeend", '<button class="principal" id="bficha">Revisar una ficha técnica real</button>');
    $("bficha").onclick = abrirFichaReal;
  }).catch(() => {});
}

async function cargar(){
  conectarIA();
  const copia = window.SNAPSHOT;
  if(copia && copia.listado){ preparar(copia.listado); origen = "Copia guardada del " + new Date(copia.fecha).toLocaleString("es-CL",{dateStyle:"medium",timeStyle:"short"}); avisar(); pintar(); }
  try{
    const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), 45000);
    const r = await fetch(API + "?estado=activas&ticket=" + encodeURIComponent(perfil.ticket.trim() || TICKET_PRUEBA), {signal: ctl.signal});
    clearTimeout(reloj);
    const j = await r.json();
    if(j.Listado && j.Listado.length){ preparar(j.Listado.map(x => [x.CodigoExterno, x.Nombre, x.FechaCierre])); origen = "Datos en vivo de Mercado Público, " + new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"}); }
  }catch(e){ if(!datos.length) origen = "Sin conexión con Mercado Público"; }
  avisar(); pintar();
}
function avisar(){
  $("fuente").textContent = origen + ". Fuente: API pública de ChileCompra.";
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
  $("rubros").onclick = e => { const b = e.target.closest(".chip"); if(!b) return; const r = b.textContent; const i = perfil.rubros.indexOf(r); if(i >= 0) perfil.rubros.splice(i, 1); else perfil.rubros.push(r); b.setAttribute("aria-pressed", i < 0); cambio(); };
  $("region").innerHTML = '<option value="">Todo Chile</option>' + REGIONES.map(r => "<option>" + esc(r) + "</option>").join("");
  ["extra","excluir","region","tamano","ticket"].forEach(k => { $(k).value = perfil[k] || (k === "tamano" ? "5" : ""); $(k).oninput = () => { perfil[k] = $(k).value; cambio(); }; });
  $("orden").onchange = pintar;
  $("vista").onchange = () => { perfil.vistaGuardadas = $("vista").value === "guardadas"; mostrar = 40; pintar(); };
  $("mas").onclick = () => { mostrar += 40; pintar(); };
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
function cambio(){ const {vistaGuardadas, ...p} = perfil; guardar("rp_perfil", p); mostrar = 40; clearTimeout(espera); espera = setTimeout(pintar, 180); }

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
  const filas = await sb("/rest/v1/cuentas?select=perfil,catalogo,guardadas,pasos");
  if(filas && filas.length){
    const c = filas[0];
    const ticket = perfil.ticket; perfil = {...perfil, ...c.perfil, ticket}; catalogo = c.catalogo || []; guardadas = c.guardadas || {}; hechos = c.pasos || {};
    try{ localStorage.setItem("rp_perfil", JSON.stringify(perfil)); localStorage.setItem("rp_catalogo", JSON.stringify(catalogo)); localStorage.setItem("rp_guardadas", JSON.stringify(guardadas)); localStorage.setItem("rp_pasos", JSON.stringify(hechos)); }catch(e){}
    ["extra","excluir","region","tamano"].forEach(k => $(k).value = perfil[k] || (k === "tamano" ? "5" : ""));
    document.querySelectorAll("#rubros .chip").forEach(b => b.setAttribute("aria-pressed", perfil.rubros.includes(b.textContent)));
    pintarCatalogo(); pintar();
    nota("Recuperamos tus datos guardados.");
  } else { subirCuenta(); nota("Tu catálogo y tus compras guardadas ahora quedan en tu cuenta."); }
}
const nota = t => { const n = $("cuentaNota"); if(n) n.textContent = t; };
function pintarCuenta(){
  const C = $("cuenta"); if(!C) return;
  if(sesion){
    C.innerHTML = '<div class="nota">Conectado como <b>' + esc(sesion.correo || "") + '</b>. Tus datos se guardan en tu cuenta y los ves en cualquier dispositivo.</div>' +
      '<div class="acciones" style="margin-top:8px"><button class="sec" id="salir">Salir</button></div><p class="nota" id="cuentaNota"></p>';
    $("salir").onclick = async () => { try{ await sb("/auth/v1/logout", {method: "POST"}); }catch(e){} guardarSesion(null); pintarCuenta(); };
    return;
  }
  C.innerHTML = '<div class="nota">Entra con tu correo para guardar tu catálogo y tus compras en tu cuenta. Sin contraseña: te enviamos un código.</div>' +
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
