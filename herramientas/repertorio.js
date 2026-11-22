// Repertorio de correos de Apto: varias plantillas por tipo que se van rotando para que el trato no sea monótono.
// Cada plantilla tiene su propio enfoque, asunto y orden; se elige una que el cliente no haya recibido en sus
// últimos envíos y que tenga sentido con sus datos (por ejemplo, "poca competencia" solo si hay compras así).
const P = require("./plantillas_correo.js");
const {AZUL, AMBAR, VERDE, TINTA, SUAVE, FONDO} = P.colores, F = P.FUENTE;
const tabla = filas => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + filas + "</table>";
const cifras = items => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0"><tr>' + items.map(([n, t]) =>
  '<td width="' + Math.floor(100 / items.length) + '%" align="center" style="padding:12px 4px;background:' + FONDO + ';border-radius:12px;border:3px solid #FFFFFF"><div style="' + F + 'font-size:20px;font-weight:bold;color:' + AZUL + '">' + n + '</div><div style="' + F + 'font-size:12px;color:' + SUAVE + '">' + t + "</div></td>").join("") + "</tr></table>";
const parrafo = (html, extra = "") => '<p style="' + F + 'font-size:15px;line-height:23px;color:' + TINTA + ';margin:0 0 14px 0;' + extra + '">' + html + "</p>";
const caja = (html, fondo) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0"><tr><td style="padding:16px 18px;background:' + fondo + ';border-radius:14px"><div style="' + F + 'font-size:15px;line-height:23px;color:' + TINTA + '">' + html + "</div></td></tr></table>";
const titular = (arriba, grande, abajo) => (arriba ? '<div style="' + F + 'font-size:15px;color:#DCE6F7;margin-top:14px">' + arriba + "</div>" : "") +
  '<div style="' + F + 'font-size:40px;line-height:46px;font-weight:bold;color:#FFFFFF;margin-top:' + (arriba ? 2 : 14) + 'px">' + grande + "</div>" +
  (abajo ? '<div style="' + F + 'font-size:18px;line-height:25px;color:#FFFFFF;font-weight:bold">' + abajo + "</div>" : "");
// asuntos alternativos: se elige uno según el día, así dos correos de la misma plantilla tampoco se ven iguales
const uno = opciones => opciones[new Date().getDate() % opciones.length];
const textoPlano = (asunto, preheader, lineas, sitio, token) => asunto + "\n" + preheader + "\n\n" + lineas.join("\n") + "\n\n" + sitio + "\nDejar de recibir avisos: " + sitio + "baja.html?t=" + token;
const cupon = (codigo, descuento, costo, venceTxt) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0"><tr><td align="center" style="padding:18px;border:2px dashed ' + AMBAR + ';border-radius:14px;background:#FFF8E6">' +
  '<div style="' + F + 'font-size:14px;color:' + SUAVE + '">Tu código de regreso</div><div style="' + F + 'font-size:28px;font-weight:bold;letter-spacing:3px;color:' + TINTA + ';margin:4px 0">' + P.esc(codigo) + "</div>" +
  '<div style="' + F + 'font-size:15px;color:' + TINTA + '"><b>' + descuento + " % de descuento</b> en tu primer mes (" + P.pesos(costo * (1 - descuento / 100)) + " en vez de " + P.pesos(costo) + ")</div>" +
  '<div style="' + F + 'font-size:13px;color:#8A5B00;margin-top:6px;font-weight:bold">⏳ Vence el ' + P.esc(venceTxt) + "</div></td></tr></table>";

const ACTIVO = {
  // 1) urgencia: lo que cierra pronto (la plantilla principal)
  urgencia: {sirve: () => true, armar: a => P.correoActivo(a)},
  // 2) oportunidad: compras donde casi nadie compite
  competencia: {
    sirve: a => a.nuevas.filter(d => d.comp != null && d.comp <= 2).length >= 2,
    armar: ({nuevas, token, sitio}) => {
      const pocas = nuevas.filter(d => d.comp != null && d.comp <= 2).sort((x, y) => x.comp - y.comp);
      const asunto = uno(["🎯 " + pocas.length + " compras donde casi nadie compite", "🎯 Aquí tienes ventaja: " + pocas.length + " compras con poca competencia", "Pocas empresas postulan a estas " + pocas.length + " compras"]);
      const preheader = "Con 2 ofertas o menos, tus probabilidades de ganar son mucho mayores.";
      const cabecera = titular("Esta semana encontramos", pocas.length + " compras", "donde casi nadie compite");
      const cuerpo = parrafo("En compras parecidas se presentaron <b>2 ofertas o menos</b>. Postular donde hay poca competencia es la forma más rápida de ganar tu primera (o próxima) compra.") +
        tabla(pocas.slice(0, 6).map(d => P.tarjeta(d, sitio)).join("")) + P.boton("Ver dónde tengo ventaja →", sitio);
      return {asunto, html: P.marco({preheader, cabecera, cuerpo, sitio, token}), texto: textoPlano(asunto, preheader, pocas.slice(0, 6).map(d => "- " + d.nombre.trim() + "\n  " + sitio + "app.html?c=" + d.codigo), sitio, token)};
    }},
  // 3) dinero: las más grandes primero
  dinero: {
    sirve: a => a.nuevas.filter(d => d.monto).length >= 3,
    armar: ({nuevas, token, sitio}) => {
      const con = nuevas.filter(d => d.monto).sort((x, y) => y.monto - x.monto), total = con.reduce((s, d) => s + d.monto, 0);
      const asunto = uno(["💰 " + P.millones(total) + " en compras para lo que vendes", "💰 La más grande de la semana: " + P.millones(con[0].monto), "Hay " + P.millones(total) + " esperando a tu empresa"]);
      const preheader = "Ordenamos tus oportunidades de mayor a menor monto.";
      const cabecera = titular("Compras abiertas para ti por", P.millones(total), "ordenadas de mayor a menor");
      const cuerpo = cifras([[con.length, "con presupuesto"], [P.millones(con[0].monto), "la más grande"], [P.millones(total / con.length), "promedio"]]) +
        tabla(con.slice(0, 6).map(d => P.tarjeta(d, sitio)).join("")) + P.boton("Ver las de mayor monto →", sitio);
      return {asunto, html: P.marco({preheader, cabecera, cuerpo, sitio, token}), texto: textoPlano(asunto, preheader, con.slice(0, 6).map(d => "- " + d.nombre.trim() + " (" + P.millones(d.monto) + ")\n  " + sitio + "app.html?c=" + d.codigo), sitio, token)};
    }},
  // 4) selección: solo 3, con el porqué (corto y personal)
  top3: {
    sirve: a => a.nuevas.length >= 3,
    armar: ({nuevas, token, sitio}) => {
      const tres = nuevas.slice(0, 3);
      const asunto = uno(["Tu top 3 de esta semana en Mercado Público", "Elegimos 3 compras pensando en ti", "Si solo miras 3 compras hoy, que sean estas"]);
      const preheader = "Las que mejor calzan con lo que vendes, sin ruido.";
      const cabecera = titular("", "Tu top 3", "las compras que mejor calzan contigo");
      const filas = tres.map((d, i) => '<tr><td style="padding:0 0 4px 0"><div style="' + F + 'font-size:13px;font-weight:bold;color:' + VERDE + '">#' + (i + 1) + (d.porque ? " · calza con «" + P.esc(d.porque) + "»" : " · calza con lo que vendes") + "</div></td></tr>" + P.tarjeta(d, sitio)).join("");
      const cuerpo = parrafo("Revisamos todas las compras abiertas y estas son las que más se parecen a lo que vendes. Ábrelas y Apto te dice si cumples lo que piden.") + tabla(filas) +
        (nuevas.length > 3 ? parrafo("Tienes otras <b>" + (nuevas.length - 3) + "</b> oportunidades en Apto.", "text-align:center;color:" + SUAVE) : "") + P.boton("Ver mi top 3 →", sitio);
      return {asunto, html: P.marco({preheader, cabecera, cuerpo, sitio, token}), texto: textoPlano(asunto, preheader, tres.map((d, i) => "#" + (i + 1) + " " + d.nombre.trim() + "\n  " + sitio + "app.html?c=" + d.codigo), sitio, token)};
    }}
};

const RECUERDO = {
  // 1) pérdida: cuánto dinero se está perdiendo (la plantilla principal)
  perdida: {sirve: () => true, armar: a => P.correoRecuerdo(a)},
  // 2) competidores: otras empresas sí están postulando (sin decir dónde)
  competidores: {
    sirve: a => a.lista.filter(d => d.comp != null).length >= 3,
    armar: ({lista, token, sitio, ufClp, descuento, codigo, vence}) => {
      const con = lista.filter(d => d.comp != null), prom = con.reduce((s, d) => s + d.comp, 0) / con.length;
      const ofertas = Math.round(prom * lista.length), venceTxt = vence.toLocaleDateString("es-CL", {weekday: "long", day: "numeric", month: "long"});
      const asunto = uno(["Tus competidores están postulando (y tú no)", "~" + ofertas.toLocaleString("es-CL") + " ofertas se esperan en compras para tu rubro", "¿Quién se queda con las compras de tu rubro?"]);
      const preheader = "Vuelve antes del " + venceTxt + " con " + descuento + " % de descuento.";
      const cabecera = titular("En las compras abiertas para tu rubro", "~" + ofertas.toLocaleString("es-CL") + " ofertas", "se presentarán este mes. ¿Una será la tuya?");
      const cuerpo = cifras([[lista.length, "compras abiertas"], [prom.toLocaleString("es-CL", {maximumFractionDigits: 1}), "ofertas por compra"], [ofertas.toLocaleString("es-CL"), "ofertas esperadas"]]) +
        caja("Otras empresas de tu rubro <b>sí están postulando</b>. Con Apto sabes en cuáles conviene competir, si cumples lo que piden y qué te falta, antes que ellas.", "#E7EEFA") +
        cupon(codigo, descuento, 0.25 * ufClp, venceTxt) + P.boton("Volver a competir →", sitio, VERDE);
      return {asunto, html: P.marco({preheader, cabecera, cuerpo, sitio, token}), texto: textoPlano(asunto, preheader, ["Se esperan ~" + ofertas + " ofertas en compras para tu rubro.", "Código " + codigo + ": " + descuento + " % de descuento, vence el " + venceTxt + "."], sitio, token)};
    }},
  // 3) oferta directa: corto, el cupón primero
  oferta: {
    sirve: () => true,
    armar: ({lista, token, sitio, ufClp, descuento, codigo, vence}) => {
      const venceTxt = vence.toLocaleDateString("es-CL", {weekday: "long", day: "numeric", month: "long"});
      const asunto = uno(["🎁 " + descuento + " % para que vuelvas a Apto", "Te guardamos un " + descuento + " % de descuento (vence pronto)", "Tu descuento para volver vence el " + venceTxt]);
      const preheader = lista.length + " compras abiertas esperan a tu empresa.";
      const cabecera = titular("Te extrañamos. Vuelve con", descuento + " % de descuento", "en tu primer mes");
      const cuerpo = cupon(codigo, descuento, 0.25 * ufClp, venceTxt) +
        parrafo("Hoy hay <b>" + lista.length + " compras abiertas</b> que calzan con lo que vende tu empresa. Con Apto las ves todas, sabes si cumples y no se te pasa ningún plazo.", "text-align:center") +
        P.boton("Usar mi " + descuento + " % de descuento →", sitio, VERDE);
      return {asunto, html: P.marco({preheader, cabecera, cuerpo, sitio, token}), texto: textoPlano(asunto, preheader, ["Código " + codigo + ": " + descuento + " % de descuento en tu primer mes. Vence el " + venceTxt + "."], sitio, token)};
    }},
  // 4) novedades: lo que mejoró desde que se fue
  novedades: {
    sirve: () => true,
    armar: ({lista, ca, token, sitio, ufClp, descuento, codigo, vence}) => {
      const venceTxt = vence.toLocaleDateString("es-CL", {weekday: "long", day: "numeric", month: "long"});
      const asunto = uno(["Apto cambió mucho desde que te fuiste", "Lo nuevo de Apto (y un regalo para que vuelvas)", "5 cosas nuevas que hace Apto por tu empresa"]);
      const preheader = "Ahora entiende cómo escribes, te avisa de Compra Ágil y te muestra dónde hay poca competencia.";
      const cabecera = titular("Desde que te fuiste,", "Apto mejoró", "para que ganes más compras");
      const lista5 = [["🗣️", "Entiende cómo escribes", "«pc», «mant.» o «computadres»: igual encuentra tus compras."],
        ["🎯", "Te muestra dónde hay poca competencia", "Compras donde se presentan 2 ofertas o menos."],
        ["⚡", "Compra Ágil", ca ? ca.toLocaleString("es-CL") + " solicitudes el mes pasado en tus productos." : "Cuánto se pide en tus productos y a quién."],
        ["✅", "¿Cumplo?", "Revisa la ficha técnica y te dice qué te falta antes de postular."],
        ["📅", "Todos los plazos en tu calendario", "Preguntas, respuestas y cierre, con avisos."]];
      const filas = lista5.map(([i, t, d]) => '<tr><td width="38" valign="top" style="' + F + 'font-size:22px;padding:6px 0">' + i + '</td><td style="padding:6px 0"><div style="' + F + 'font-size:15px;font-weight:bold;color:' + TINTA + '">' + t + '</div><div style="' + F + 'font-size:14px;color:' + SUAVE + '">' + P.esc(d) + "</div></td></tr>").join("");
      const cuerpo = tabla(filas) + '<div style="height:16px"></div>' + parrafo("Y hoy hay <b>" + lista.length + " compras abiertas</b> para lo que vendes.", "text-align:center") +
        cupon(codigo, descuento, 0.25 * ufClp, venceTxt) + P.boton("Probar lo nuevo con " + descuento + " % →", sitio, VERDE);
      return {asunto, html: P.marco({preheader, cabecera, cuerpo, sitio, token}), texto: textoPlano(asunto, preheader, lista5.map(([, t, d]) => "- " + t + ": " + d), sitio, token)};
    }}
};

// Elige la próxima plantilla: la siguiente en el orden que no esté entre las 2 últimas recibidas y que sirva con estos datos
function elegir(tipo, historial, datos){
  const repo = tipo === "recuerdo" ? RECUERDO : ACTIVO, nombres = Object.keys(repo);
  const ultimas = (historial || []).filter(h => h.startsWith(tipo + ":")).map(h => h.split(":")[1]);
  const inicio = ultimas.length ? (nombres.indexOf(ultimas[ultimas.length - 1]) + 1) % nombres.length : 0;
  const orden = nombres.slice(inicio).concat(nombres.slice(0, inicio));
  const elegido = orden.find(n => !ultimas.slice(-2).includes(n) && repo[n].sirve(datos)) || orden.find(n => repo[n].sirve(datos)) || nombres[0];
  return {plantilla: tipo + ":" + elegido, ...repo[elegido].armar(datos)};
}

module.exports = {elegir, ACTIVO, RECUERDO};
