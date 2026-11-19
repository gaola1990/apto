// Avisos por correo de Apto (retención). Lo corre GitHub Actions cada mañana; el cliente no configura nada.
//  - Cliente activo: compras NUEVAS que calzan con lo que vende, con lo que guardó y con lo que ya ganó (categorías).
//  - Cliente inactivo (sin entrar hace más de 60 días o con el plan vencido): una vez al mes, "si hubieras seguido con
//    Apto habrías visto N compras", con un código de descuento para volver.
// Usa el mismo buscador de la página (buscar.js). Escribe la lista de correos a enviar en un archivo temporal
// (contiene correos: NUNCA se publica) que luego envía herramientas/enviar_avisos.py.
//   node herramientas/avisos.js [--demo]   (--demo: arma correos de ejemplo con un perfil ficticio, sin conectarse)
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
require(path.join(RAIZ, "buscar.js"));
const B = globalThis.Buscar;
const SITIO = "https://gaola1990.github.io/apto/";
const DESCUENTO = process.env.DESCUENTO || "10";
const CODIGO = process.env.CODIGO_DESCUENTO || "VUELVE" + DESCUENTO;
const SALIDA = process.env.AVISOS_SALIDA || path.join(require("os").tmpdir(), "apto-avisos.json");
const DEMO = process.argv.includes("--demo");

const leerJSON = f => { try{ return JSON.parse(fs.readFileSync(path.join(RAIZ, f), "utf8")); }catch(e){ return null; } };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const dj = fs.readFileSync(path.join(RAIZ, "datos.js"), "utf8");
const LISTA = JSON.parse(dj.slice(dj.indexOf("{"), dj.lastIndexOf("}") + 1)).listado;
const DET = (leerJSON("detalles.json") || {}).items || {};
const RES = (leerJSON("resumenes.json") || {}).items || {};
const COMP = leerJSON("competencia.json");
const CA = leerJSON("compra_agil.json");
const DIC = leerJSON("diccionario.json");
if(DIC) B.cargarDiccionario(DIC.clases);
B.cargarAprendido(leerJSON("aprendido.json") || {});
// rubros: la misma lista que usa la página (se lee de app.js para no duplicarla)
const appjs = fs.readFileSync(path.join(RAIZ, "app.js"), "utf8");
const RUBROS = (() => { try{ return Function("return " + appjs.slice(appjs.indexOf("const RUBROS = ") + 15, appjs.indexOf("};", appjs.indexOf("const RUBROS = ")) + 1))(); }catch(e){ return {}; } })();

const ahora = Date.now(), DIA = 864e5;
const datos = LISTA.map(([codigo, nombre, cierre]) => {
  const x = DET[codigo], r = RES[codigo];
  const t = B.expandir(B.norm(nombre + " " + (x ? x.t : "") + " " + (r ? (r.resumen || "") : "")));
  return {codigo, nombre, cierre, texto: t, palabras: t.split(" "), clases: x ? x.c || [] : []};
}).filter(d => !d.cierre || new Date(d.cierre).getTime() > ahora + 12 * 36e5); // con al menos medio día para ofertar
B.vocabulario(datos.map(d => d.palabras));

function competencia(clases){
  if(!COMP) return null;
  let n = 0, s = 0; for(const c of clases){ const x = COMP.clases[c]; if(x){ n += x.n; s += x.med * x.n; } }
  return n >= 5 ? s / n : null;
}
// Compras que calzan con un cliente: sus palabras, sus rubros, sus categorías (catálogo por RUT y diccionario)
// y las categorías de las compras que ya guardó ("en función de lo que ya ha postulado").
function paraCliente(perfil, guardadas){
  const extra = String(perfil.extra || "").split(",").map(B.norm).filter(Boolean);
  const ts = [...new Set([...extra, ...(perfil.rubros || []).flatMap(r => RUBROS[r] || []).map(B.norm)])].map(B.armar);
  const no = String(perfil.excluir || "").split(",").map(B.norm).filter(Boolean).map(B.armar);
  const cats = new Set(perfil.cats || []);
  extra.forEach(t => B.clasesDe(B.armar(t)).forEach(r => cats.add(r.c)));
  Object.keys(guardadas || {}).forEach(c => (DET[c] && DET[c].c || []).forEach(x => cats.add(x)));
  const out = [];
  for(const d of datos){
    if(guardadas && guardadas[d.codigo]) continue;
    if(no.some(t => B.calza(t, d.texto, d.palabras))) continue;
    const hits = ts.filter(t => B.calza(t, d.texto, d.palabras));
    const porCat = d.clases.some(c => cats.has(c));
    if(!hits.length && !porCat) continue;
    const comp = competencia(d.clases);
    out.push({...d, pts: hits.length * 2 + (porCat ? 4 : 0) + (comp !== null && comp <= 2 ? 1 : 0), comp});
  }
  return {lista: out.sort((a, b) => b.pts - a.pts || new Date(a.cierre) - new Date(b.cierre)), cats};
}
const fecha = f => f ? new Date(f).toLocaleDateString("es-CL", {day: "numeric", month: "short"}) : "sin fecha";
function filaHTML(d){
  return '<tr><td style="padding:10px 0;border-bottom:1px solid #e6eaf0">' +
    '<a href="' + SITIO + "?c=" + encodeURIComponent(d.codigo) + '" style="color:#1D4E9E;font-weight:700;text-decoration:none">' + esc(d.nombre.trim().slice(0, 140)) + "</a>" +
    '<div style="color:#5b6573;font-size:13px">Cierra el ' + fecha(d.cierre) + " · " + esc(d.codigo) +
    (d.comp !== null && d.comp <= 2 ? ' · <b style="color:#1D4E9E">Poca competencia</b>' : "") + "</div></td></tr>";
}
function marco(titulo, cuerpo, token){
  return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1B2430">' +
    '<div style="font-size:22px;font-weight:700;color:#1D4E9E;margin-bottom:6px">Apto</div>' +
    '<h2 style="font-size:20px;margin:0 0 12px">' + titulo + "</h2>" + cuerpo +
    '<p style="margin:22px 0"><a href="' + SITIO + '" style="background:#1D4E9E;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Ver todas en Apto</a></p>' +
    '<p style="color:#8a93a0;font-size:12px;margin-top:26px">Recibes este correo porque tienes una cuenta en Apto. ' +
    '<a href="' + SITIO + "baja.html?t=" + token + '" style="color:#8a93a0">Dejar de recibir avisos</a> · Puedes cambiar la frecuencia en Mi cuenta.</p></div>';
}
function correoActivo(c, nuevas){
  const top = nuevas.slice(0, 10);
  const asunto = nuevas.length === 1 ? "1 compra nueva para ti en Mercado Público" : nuevas.length + " compras nuevas para ti en Mercado Público";
  const cuerpo = '<p style="margin:0 0 10px">Según lo que vendes y lo que has guardado, estas compras del Estado calzan contigo:</p>' +
    '<table style="width:100%;border-collapse:collapse">' + top.map(filaHTML).join("") + "</table>" +
    (nuevas.length > 10 ? '<p style="color:#5b6573">y ' + (nuevas.length - 10) + " más en Apto.</p>" : "");
  return {asunto, html: marco(asunto, cuerpo, c.baja_token),
          texto: asunto + "\n\n" + top.map(d => "- " + d.nombre.trim() + " (cierra " + fecha(d.cierre) + ")\n  " + SITIO + "?c=" + d.codigo).join("\n") + "\n\nDejar de recibir avisos: " + SITIO + "baja.html?t=" + c.baja_token};
}
function correoRecuerdo(c, lista, cats){
  let ca = 0; if(CA) cats.forEach(k => { if(CA.clases[k]) ca += CA.clases[k].s; });
  const asunto = "Si hubieras seguido con Apto, hoy verías " + lista.length + " compras abiertas para ti";
  const cuerpo = "<p>Hoy el Estado tiene <b>" + lista.length + " licitaciones abiertas</b> que calzan con lo que vendes" +
    (ca ? ", y el mes pasado se pidieron <b>" + ca.toLocaleString("es-CL") + " Compras Ágiles</b> en tus productos" : "") + ". Estas son algunas:</p>" +
    '<table style="width:100%;border-collapse:collapse">' + lista.slice(0, 5).map(filaHTML).join("") + "</table>" +
    '<p style="background:#eef2f8;border-radius:12px;padding:14px 16px;margin-top:18px">Vuelve con <b>' + DESCUENTO + " % de descuento</b> en tu primer mes. Usa el código <b>" + CODIGO + "</b>.</p>";
  return {asunto, html: marco(asunto, cuerpo, c.baja_token),
          texto: asunto + ".\n\nVuelve con " + DESCUENTO + " % de descuento en tu primer mes: código " + CODIGO + "\n" + SITIO + "\n\nDejar de recibir avisos: " + SITIO + "baja.html?t=" + c.baja_token};
}

async function clientes(){
  if(DEMO) return [{user_id: "demo", email: "cliente@ejemplo.cl", perfil: {extra: "notebook, toner, mant. de pc", rubros: []}, guardadas: {}, avisos: "diario",
                    avisados: [], baja_token: "demo-token-1", last_sign_in_at: new Date().toISOString()},
                   {user_id: "demo2", email: "antiguo@ejemplo.cl", perfil: {extra: "aseo, limpieza", rubros: []}, guardadas: {}, avisos: "semanal",
                    avisados: [], baja_token: "demo-token-2", last_sign_in_at: new Date(ahora - 90 * DIA).toISOString()}];
  const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
  if(!URL || !KEY) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY (secretos de GitHub)");
  const h = {apikey: KEY, Authorization: "Bearer " + KEY};
  const cuentas = await (await fetch(URL + "/rest/v1/cuentas?select=user_id,perfil,guardadas,avisos,plan,plan_hasta,ultimo_aviso,ultimo_recuerdo,avisados,baja_token&avisos=neq.no", {headers: h})).json();
  const usuarios = (await (await fetch(URL + "/auth/v1/admin/users?per_page=1000", {headers: h})).json()).users || [];
  const porId = Object.fromEntries(usuarios.map(u => [u.id, u]));
  return cuentas.filter(c => porId[c.user_id] && porId[c.user_id].email).map(c => ({...c, email: porId[c.user_id].email, last_sign_in_at: porId[c.user_id].last_sign_in_at}));
}

(async () => {
  const lista = [];
  for(const c of await clientes()){
    const ultimoIngreso = c.last_sign_in_at ? new Date(c.last_sign_in_at).getTime() : 0;
    const planVencido = c.plan_hasta && new Date(c.plan_hasta).getTime() < ahora;
    const inactivo = ahora - ultimoIngreso > 60 * DIA || planVencido;
    const {lista: calzan, cats} = paraCliente(c.perfil || {}, c.guardadas || {});
    if(inactivo){
      if(c.ultimo_recuerdo && ahora - new Date(c.ultimo_recuerdo).getTime() < 30 * DIA) continue;
      if(calzan.length < 3) continue; // sin suficientes compras no vale la pena escribirle
      lista.push({user_id: c.user_id, email: c.email, tipo: "recuerdo", codigos: [], ...correoRecuerdo(c, calzan, cats)});
    } else {
      const cada = c.avisos === "diario" ? 20 * 36e5 : 6.5 * DIA;
      if(c.ultimo_aviso && ahora - new Date(c.ultimo_aviso).getTime() < cada) continue;
      const ya = new Set(c.avisados || []);
      const nuevas = calzan.filter(d => !ya.has(d.codigo));
      if(!nuevas.length) continue;
      const codigos = nuevas.slice(0, 50).map(d => d.codigo);
      lista.push({user_id: c.user_id, email: c.email, tipo: "novedades", codigos, avisados_nuevo: [...(c.avisados || []), ...codigos].slice(-500), ...correoActivo(c, nuevas)});
    }
  }
  fs.writeFileSync(SALIDA, JSON.stringify(lista));
  console.log(`Avisos: ${lista.filter(x => x.tipo === "novedades").length} de novedades y ${lista.filter(x => x.tipo === "recuerdo").length} de "si hubieras seguido" (archivo temporal, no se publica).`);
  if(DEMO){ lista.forEach((x, i) => fs.writeFileSync(path.join(require("os").tmpdir(), `apto-aviso-ejemplo-${i + 1}.html`), x.html)); console.log("Ejemplos en " + require("os").tmpdir()); }
})().catch(e => { console.error("Avisos: " + e.message); process.exit(1); });
