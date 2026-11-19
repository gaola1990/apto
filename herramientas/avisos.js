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
  return {codigo, nombre, cierre, texto: t, palabras: t.split(" "), clases: x ? x.c || [] : [], monto: (x && x.m) || (r && r.monto) || 0};
}).filter(d => !d.cierre || new Date(d.cierre).getTime() > ahora + 12 * 36e5); // con al menos medio día para ofertar
// solo en --demo: montos de ejemplo donde aún no hay presupuesto, para ver cómo luce el correo (nunca en envíos reales)
if(DEMO) datos.forEach((d, i) => { if(!d.monto) d.monto = [850000, 2400000, 5600000, 1200000, 12800000, 3300000][i % 6]; });
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
    out.push({...d, pts: hits.length * 2 + (porCat ? 4 : 0) + (comp !== null && comp <= 2 ? 1 : 0), comp, porque: hits.length ? hits[0].t : ""});
  }
  return {lista: out.sort((a, b) => b.pts - a.pts || new Date(a.cierre) - new Date(b.cierre)), cats};
}
const R = require(path.join(__dirname, "repertorio.js"));
// valor de la UF del día (mindicador.cl, gratis); si no responde, un valor de referencia
async function valorUF(){
  try{ const j = await (await fetch("https://mindicador.cl/api/uf", {signal: AbortSignal.timeout(15000)})).json(); const v = j.serie && j.serie[0] && j.serie[0].valor; if(v > 10000) return v; }catch(e){}
  return Number(process.env.UF_CLP || 39800);
}

async function clientes(){
  if(DEMO) return [{user_id: "demo", email: "cliente@ejemplo.cl", perfil: {extra: "notebook, toner, mant. de pc", rubros: []}, guardadas: {}, avisos: "diario",
                    avisados: [], baja_token: cs[0].baja_token, last_sign_in_at: new Date().toISOString()},
                   {user_id: "demo2", email: "antiguo@ejemplo.cl", perfil: {extra: "aseo, limpieza", rubros: []}, guardadas: {}, avisos: "semanal",
                    avisados: [], baja_token: cs[1].baja_token, last_sign_in_at: new Date(ahora - 90 * DIA).toISOString()}];
  const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
  if(!URL || !KEY) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY (secretos de GitHub)");
  const h = {apikey: KEY, Authorization: "Bearer " + KEY};
  const cuentas = await (await fetch(URL + "/rest/v1/cuentas?select=user_id,perfil,guardadas,avisos,plantillas,plan,plan_hasta,ultimo_aviso,ultimo_recuerdo,avisados,baja_token&avisos=neq.no", {headers: h})).json();
  const usuarios = (await (await fetch(URL + "/auth/v1/admin/users?per_page=1000", {headers: h})).json()).users || [];
  const porId = Object.fromEntries(usuarios.map(u => [u.id, u]));
  return cuentas.filter(c => porId[c.user_id] && porId[c.user_id].email).map(c => ({...c, email: porId[c.user_id].email, last_sign_in_at: porId[c.user_id].last_sign_in_at}));
}

(async () => {
  const lista = [], ufClp = await valorUF();
  for(const c of await clientes()){
    const ultimoIngreso = c.last_sign_in_at ? new Date(c.last_sign_in_at).getTime() : 0;
    const planVencido = c.plan_hasta && new Date(c.plan_hasta).getTime() < ahora;
    const inactivo = ahora - ultimoIngreso > 60 * DIA || planVencido;
    const {lista: calzan, cats} = paraCliente(c.perfil || {}, c.guardadas || {});
    if(inactivo){
      if(c.ultimo_recuerdo && ahora - new Date(c.ultimo_recuerdo).getTime() < 30 * DIA) continue;
      if(calzan.length < 3) continue; // sin suficientes compras no vale la pena escribirle
      lista.push({user_id: c.user_id, email: c.email, tipo: "recuerdo", codigos: [], ...R.elegir("recuerdo", c.plantillas, {lista: calzan, ca: [...cats].reduce((a, k) => a + ((CA && CA.clases[k] && CA.clases[k].s) || 0), 0), token: c.baja_token, sitio: SITIO, ufClp,
        descuento: Number(DESCUENTO), codigo: CODIGO, vence: new Date(ahora + 7 * DIA)})});
      lista[lista.length - 1].plantillas_nuevo = [...(c.plantillas || []), lista[lista.length - 1].plantilla].slice(-10);
    } else {
      const cada = c.avisos === "diario" ? 20 * 36e5 : 6.5 * DIA;
      if(c.ultimo_aviso && ahora - new Date(c.ultimo_aviso).getTime() < cada) continue;
      const ya = new Set(c.avisados || []);
      const nuevas = calzan.filter(d => !ya.has(d.codigo));
      if(!nuevas.length) continue;
      const codigos = nuevas.slice(0, 50).map(d => d.codigo);
      lista.push({user_id: c.user_id, email: c.email, tipo: "novedades", codigos, avisados_nuevo: [...(c.avisados || []), ...codigos].slice(-500), ...R.elegir("activo", c.plantillas, {nuevas, token: c.baja_token, sitio: SITIO, plan: c.plan || "apto", ufClp})});
      lista[lista.length - 1].plantillas_nuevo = [...(c.plantillas || []), lista[lista.length - 1].plantilla].slice(-10);
    }
  }
  fs.writeFileSync(SALIDA, JSON.stringify(lista));
  console.log(`Avisos: ${lista.filter(x => x.tipo === "novedades").length} de novedades y ${lista.filter(x => x.tipo === "recuerdo").length} de "si hubieras seguido" (archivo temporal, no se publica).`);
  if(DEMO){
    const dir = process.env.AVISOS_EJEMPLOS || require("os").tmpdir();
    const cs = await clientes(), uf = await valorUF();
    const act = paraCliente(cs[0].perfil, {}), rec = paraCliente(cs[1].perfil, {});
    const caRec = [...rec.cats].reduce((a, k) => a + ((CA && CA.clases[k] && CA.clases[k].s) || 0), 0);
    for(const [n, t] of Object.entries(R.ACTIVO)) if(t.sirve({nuevas: act.lista})) fs.writeFileSync(path.join(dir, "activo-" + n + ".html"), t.armar({nuevas: act.lista, token: cs[0].baja_token, sitio: SITIO, plan: "apto", ufClp: uf}).html);
    for(const [n, t] of Object.entries(R.RECUERDO)) if(t.sirve({lista: rec.lista})) fs.writeFileSync(path.join(dir, "antiguo-" + n + ".html"), t.armar({lista: rec.lista, ca: caRec, token: cs[1].baja_token, sitio: SITIO, ufClp: uf, descuento: Number(DESCUENTO), codigo: CODIGO, vence: new Date(ahora + 7 * DIA)}).html);
    console.log("Ejemplos del repertorio en " + dir);
  }
})().catch(e => { console.error("Avisos: " + e.message); process.exit(1); });
