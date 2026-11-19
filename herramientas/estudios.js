// Notificaciones públicas de Apto (notificaciones.json): estudios y reportes del mercado que se generan solos con los
// datos abiertos, más las promociones y novedades que publicamos nosotros (herramientas/promos.json).
// Lo corre GitHub Actions junto con la actualización de datos.   node herramientas/estudios.js
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
const leer = f => { try{ return JSON.parse(fs.readFileSync(path.join(RAIZ, f), "utf8")); }catch(e){ return null; } };
const dj = fs.readFileSync(path.join(RAIZ, "datos.js"), "utf8");
const LISTA = JSON.parse(dj.slice(dj.indexOf("{"), dj.lastIndexOf("}") + 1)).listado;
const DET = (leer("detalles.json") || {}).items || {};
const DIC = (leer("diccionario.json") || {}).clases || {};
const COMP = leer("competencia.json"), CA = leer("compra_agil.json");
const nombre = c => (DIC[c] && DIC[c][0]) || "Clase " + c;
const ahora = new Date(), semana = (() => { const d = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())); const dia = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dia); return d.getUTCFullYear() + "-s" + Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); })();
const fmt = n => Math.round(n).toLocaleString("es-CL");
const mill = n => n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-CL", {maximumFractionDigits: 1}) + " millones" : "$" + fmt(n);
const items = [];

// 1) Estudio semanal: qué está comprando el Estado (categorías con más licitaciones abiertas)
const abiertas = LISTA.filter(([, , c]) => !c || new Date(c) > ahora);
const porClase = {};
abiertas.forEach(([cod]) => (DET[cod] && DET[cod].c || []).forEach(c => porClase[c] = (porClase[c] || 0) + 1));
const top = Object.entries(porClase).sort((a, b) => b[1] - a[1]).slice(0, 5);
if(top.length) items.push({id: "estudio-demanda-" + semana, tipo: "estudio", icono: "📊", titulo: "Lo que más compra el Estado esta semana",
  texto: top.map(([c, n], i) => (i + 1) + ". " + nombre(c) + " (" + fmt(n) + ")").join(" · "), detalle: fmt(abiertas.length) + " licitaciones abiertas en total.", fecha: ahora.toISOString()});

// 2) Estudio: dónde hay menos competencia (categorías con mediana de 2 ofertas o menos y al menos 5 casos)
if(COMP){
  const pocas = Object.entries(COMP.clases).filter(([, x]) => x.n >= 5 && x.med <= 2).sort((a, b) => a[1].med - b[1].med || b[1].n - a[1].n).slice(0, 5);
  if(pocas.length) items.push({id: "estudio-competencia-" + semana, tipo: "estudio", icono: "🎯", titulo: "Categorías con poca competencia",
    texto: pocas.map(([c, x]) => nombre(c) + " (~" + x.med.toLocaleString("es-CL") + " ofertas)").join(" · "),
    detalle: "Según " + fmt(COMP.licitaciones) + " licitaciones adjudicadas. Con pocas ofertas, tus probabilidades de ganar son mayores.", fecha: ahora.toISOString()});
}

// 3) Reporte mensual de Compra Ágil
if(CA && CA.clases){
  const topCA = Object.entries(CA.clases).sort((a, b) => b[1].s - a[1].s).slice(0, 5);
  const mes = new Date(CA.mes + "-15").toLocaleDateString("es-CL", {month: "long", year: "numeric"});
  items.push({id: "reporte-ca-" + CA.mes, tipo: "reporte", icono: "⚡", titulo: "Compra Ágil en " + mes,
    texto: fmt(CA.solicitudes) + " solicitudes y " + fmt(CA.cotizaciones) + " cotizaciones. Lo más pedido: " + topCA.map(([c, x]) => nombre(c) + " (" + fmt(x.s) + ")").join(" · "),
    detalle: "Para recibir invitaciones de Compra Ágil, declara tus rubros en tu registro de proveedor.", fecha: new Date(CA.mes + "-28T12:00:00").toISOString()});
}

// 4) Reporte: las licitaciones más grandes abiertas (con presupuesto informado)
const grandes = abiertas.map(([cod, nom]) => ({cod, nom, m: (DET[cod] && DET[cod].m) || 0})).filter(x => x.m > 0).sort((a, b) => b.m - a.m).slice(0, 3);
if(grandes.length >= 3) items.push({id: "reporte-grandes-" + semana, tipo: "reporte", icono: "💰", titulo: "Las licitaciones más grandes abiertas",
  texto: grandes.map(x => x.nom.trim().slice(0, 60) + " (" + mill(x.m) + ")").join(" · "), detalle: "Presupuestos informados por los compradores en Mercado Público.", fecha: ahora.toISOString(), enlace: "?c=" + grandes[0].cod});

// 5) Promociones y novedades publicadas por el equipo de Apto (vigentes)
const promos = leer("herramientas/promos.json") || [];
promos.filter(p => !p.hasta || new Date(p.hasta) > ahora).forEach(p => items.push(p));

items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
fs.writeFileSync(path.join(RAIZ, "notificaciones.json"), JSON.stringify({fecha: ahora.toISOString(), items}, null, 0));
console.log("notificaciones.json: " + items.length + " notificaciones (" + items.map(i => i.tipo).join(", ") + ")");
