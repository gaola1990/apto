// Plantillas de correo de Apto: diseño de marca, urgencia y valor, compatibles con Gmail, Outlook y celular.
// Reglas de correo HTML: tablas con role="presentation", estilos en línea en px, ancho máximo 600 px, sin flexbox,
// sin consultas de pantalla, sin SVG, bordes con tipo explícito, botón "a prueba de balas", texto de vista previa
// al inicio, contraste alto y versión en texto. Marca: azul #1D4E9E, ámbar #F2B630 (urgencia), verde #1E7F52.
const AZUL = "#1D4E9E", AZUL_OSC = "#163C7A", AMBAR = "#F2B630", VERDE = "#1E7F52", TINTA = "#1B2430", SUAVE = "#5B6573", FONDO = "#F6F8FB";
const FUENTE = "font-family:Arial,Helvetica,sans-serif;";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const pesos = n => "$" + Math.round(n).toLocaleString("es-CL");
const millones = n => n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-CL", {maximumFractionDigits: 1}) + " millones" : pesos(n);

// "Cierra hoy", "Cierra mañana", "Cierra en 3 días"
function cuentaRegresiva(cierre, ahora = Date.now()){
  if(!cierre) return null;
  const h = (new Date(cierre).getTime() - ahora) / 36e5;
  if(h < 24) return {texto: "⏰ ¡Cierra hoy! Quedan " + Math.max(1, Math.floor(h)) + " h", fondo: "#B83A2B", color: "#FFFFFF"};
  if(h < 48) return {texto: "⏰ Cierra mañana", fondo: AMBAR, color: TINTA};
  const d = Math.round(h / 24);
  return d <= 7 ? {texto: "⏰ Cierra en " + d + " días", fondo: AMBAR, color: TINTA} : {texto: "Cierra en " + d + " días", fondo: "#EEF2F8", color: SUAVE};
}
const etiqueta = (t, fondo, color) => '<span style="display:inline-block;' + FUENTE + 'font-size:12px;font-weight:bold;line-height:18px;padding:3px 9px;border-radius:999px;background:' + fondo + ';color:' + color + ';margin:0 6px 6px 0">' + esc(t) + "</span>";
const boton = (texto, url, fondo = AZUL) =>
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto"><tr><td align="center" bgcolor="' + fondo + '" style="border-radius:999px">' +
  '<a href="' + url + '" style="display:inline-block;box-sizing:border-box;' + FUENTE + 'font-size:17px;font-weight:bold;color:#FFFFFF;text-decoration:none;padding:15px 34px;border-radius:999px;border:1px solid ' + fondo + '">' + esc(texto) + "</a></td></tr></table>";

function tarjeta(d, sitio){
  const cr = cuentaRegresiva(d.cierre);
  const tags = (cr ? etiqueta(cr.texto, cr.fondo, cr.color) : "") +
    (d.comp !== null && d.comp !== undefined && d.comp <= 2 ? etiqueta("🎯 Poca competencia (~" + d.comp.toLocaleString("es-CL", {maximumFractionDigits: 1}) + " ofertas)", "#E7EEFA", AZUL) : "") +
    (d.monto ? etiqueta("💰 " + millones(d.monto), "#E6F4EC", VERDE) : "");
  return '<tr><td style="padding:0 0 12px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E1E6EE;border-radius:14px;background:#FFFFFF">' +
    '<tr><td style="padding:16px 18px">' + '<div>' + tags + "</div>" +
    '<a href="' + sitio + "?c=" + encodeURIComponent(d.codigo) + '" style="' + FUENTE + 'font-size:16px;line-height:22px;font-weight:bold;color:' + TINTA + ';text-decoration:none">' + esc(d.nombre.trim().slice(0, 130)) + "</a>" +
    '<div style="' + FUENTE + 'font-size:13px;color:' + SUAVE + ';margin-top:6px">' + esc(d.codigo) + ' · <a href="' + sitio + "?c=" + encodeURIComponent(d.codigo) + '" style="color:' + AZUL + ';font-weight:bold">Ver si cumplo →</a></div>' +
    "</td></tr></table></td></tr>";
}

function marco({preheader, cabecera, cuerpo, sitio, token}){
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Apto</title></head>' +
    '<body style="margin:0;padding:0;background:' + FONDO + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + FONDO + '">' + esc(preheader) + "&#8199;&#65279;&#847;".repeat(30) + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + FONDO + '"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">' +
    // cabecera azul con la marca
    '<tr><td bgcolor="' + AZUL + '" style="background:' + AZUL + ';border-radius:18px 18px 0 0;padding:26px 28px 30px 28px">' +
    '<div style="' + FUENTE + 'font-size:22px;font-weight:bold;color:#FFFFFF;letter-spacing:-0.5px">Apto</div>' + cabecera + "</td></tr>" +
    '<tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:0 0 18px 18px;padding:26px 24px 28px 24px">' + cuerpo + "</td></tr>" +
    '<tr><td style="padding:18px 10px;' + FUENTE + 'font-size:12px;line-height:18px;color:#8A93A0;text-align:center">' +
    "Recibes este correo porque tienes una cuenta en Apto. Puedes cambiar la frecuencia en Mi cuenta o " +
    '<a href="' + sitio + "baja.html?t=" + token + '" style="color:#8A93A0;text-decoration:underline">dejar de recibir avisos</a>.<br>Apto no es un sitio oficial del Estado de Chile.</td></tr>' +
    "</table></td></tr></table></body></html>";
}

// Cliente activo: urgencia (lo que cierra pronto primero), oportunidad (poca competencia) y valor (montos)
function correoActivo({nuevas, token, sitio, plan, ufClp}){
  const urgentes = nuevas.filter(d => d.cierre && new Date(d.cierre).getTime() - Date.now() < 3 * 864e5);
  const pocas = nuevas.filter(d => d.comp !== null && d.comp !== undefined && d.comp <= 2).length;
  const montos = nuevas.map(d => d.monto || 0).filter(Boolean), total = montos.reduce((a, b) => a + b, 0);
  const orden = [...urgentes, ...nuevas.filter(d => !urgentes.includes(d))].slice(0, 8);
  const asunto = urgentes.length ? "⏰ " + nuevas.length + " compras para ti: " + urgentes.length + " cierran en 3 días" : "🎯 " + nuevas.length + " compras nuevas que calzan contigo";
  const preheader = (total ? "Suman " + millones(total) + ". " : "") + (pocas ? pocas + " con poca competencia. " : "") + "Revisa si cumples antes de que cierren.";
  const cabecera = '<div style="' + FUENTE + 'font-size:46px;line-height:50px;font-weight:bold;color:#FFFFFF;margin-top:14px">' + nuevas.length + "</div>" +
    '<div style="' + FUENTE + 'font-size:19px;line-height:26px;color:#FFFFFF;font-weight:bold">compras nuevas del Estado calzan con lo que vendes</div>' +
    (urgentes.length ? '<div style="margin-top:14px">' + etiqueta("⏰ " + urgentes.length + (urgentes.length === 1 ? " cierra" : " cierran") + " en menos de 3 días: apúrate", AMBAR, TINTA) + "</div>" : "");
  const resumen = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0"><tr>' +
    [[nuevas.length, "oportunidades"], pocas ? [pocas, "con poca competencia"] : [urgentes.length, "cierran en 3 días"], [total ? millones(total) : "—", "en presupuesto"]].map(([n, t]) =>
      '<td width="33%" align="center" style="padding:12px 4px;background:' + FONDO + ';border-radius:12px;border:3px solid #FFFFFF"><div style="' + FUENTE + 'font-size:20px;font-weight:bold;color:' + AZUL + '">' + n + '</div><div style="' + FUENTE + 'font-size:12px;color:' + SUAVE + '">' + t + "</div></td>").join("") + "</tr></table>";
  const valor = total && plan ? '<p style="' + FUENTE + 'font-size:14px;line-height:21px;color:' + SUAVE + ';text-align:center;margin:6px 0 0 0">Tu plan cuesta ' + (plan === "apto" ? "1,5" : "0,5") + " UF al mes (~" + pesos((plan === "apto" ? 1.5 : 0.5) * ufClp) + "). Estas compras suman <b style=\"color:" + VERDE + '">' + millones(total) + "</b>.</p>" : "";
  const cuerpo = resumen + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + orden.map(d => tarjeta(d, sitio)).join("") + "</table>" +
    (nuevas.length > orden.length ? '<p style="' + FUENTE + 'font-size:14px;color:' + SUAVE + ';text-align:center;margin:4px 0 14px 0">y ' + (nuevas.length - orden.length) + " oportunidades más esperándote en Apto</p>" : "") +
    boton("Ver mis compras y si cumplo →", sitio) + valor;
  const texto = asunto + "\n" + preheader + "\n\n" + orden.map(d => { const cr = cuentaRegresiva(d.cierre); return "- " + d.nombre.trim() + (cr ? " (" + cr.texto.replace("⏰ ", "") + ")" : "") + "\n  " + sitio + "?c=" + d.codigo; }).join("\n") +
    "\n\nVer todas: " + sitio + "\nDejar de recibir avisos: " + sitio + "baja.html?t=" + token;
  return {asunto, html: marco({preheader, cabecera, cuerpo, sitio, token}), texto};
}

// Cliente que se fue: NO se le dice dónde postular; se le muestra cuánto se está perdiendo frente a lo que cuesta Apto
function correoRecuerdo({lista, ca, token, sitio, ufClp, descuento, codigo, vence}){
  const montos = lista.map(d => d.monto || 0).filter(Boolean).sort((a, b) => a - b);
  const total = montos.reduce((a, b) => a + b, 0), prom = montos.length ? total / montos.length : 0;
  const pronto = lista.filter(d => d.cierre && new Date(d.cierre).getTime() - Date.now() < 7 * 864e5).length;
  const costo = 0.5 * ufClp, costoDesc = costo * (1 - descuento / 100);
  const veces = prom && costo ? Math.floor(prom / costo) : 0;
  const venceTxt = vence.toLocaleDateString("es-CL", {weekday: "long", day: "numeric", month: "long"});
  const asunto = total ? "💸 Te estás perdiendo " + millones(total) + " en compras del Estado" : "💸 " + lista.length + " compras del Estado esperan a tu empresa";
  const preheader = "Vuelve con " + descuento + " % de descuento antes del " + venceTxt + ". " + (pronto ? pronto + " cierran esta semana." : "");
  const cabecera = '<div style="' + FUENTE + 'font-size:15px;color:#DCE6F7;margin-top:14px">Hoy el Estado tiene abiertas</div>' +
    '<div style="' + FUENTE + 'font-size:44px;line-height:50px;font-weight:bold;color:#FFFFFF">' + lista.length + " compras</div>" +
    '<div style="' + FUENTE + 'font-size:18px;line-height:25px;color:#FFFFFF;font-weight:bold">para lo que tu empresa vende' + (total ? ", por " + millones(total) : "") + ".</div>";
  const datos = [[lista.length, "licitaciones abiertas"], [ca ? ca.toLocaleString("es-CL") : "—", "Compras Ágiles el mes pasado"], [prom ? millones(prom) : "—", "monto promedio"]];
  const tabla = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0"><tr>' + datos.map(([n, t]) =>
    '<td width="33%" align="center" style="padding:12px 4px;background:' + FONDO + ';border-radius:12px;border:3px solid #FFFFFF"><div style="' + FUENTE + 'font-size:19px;font-weight:bold;color:' + AZUL + '">' + n + '</div><div style="' + FUENTE + 'font-size:12px;color:' + SUAVE + '">' + t + "</div></td>").join("") + "</tr></table>";
  const rango = montos.length >= 3 ? '<p style="' + FUENTE + 'font-size:15px;line-height:23px;color:' + TINTA + ';margin:0 0 14px 0">Los montos van desde <b>' + millones(montos[0]) + "</b> hasta <b>" + millones(montos[montos.length - 1]) + "</b>.</p>" : "";
  const comparacion = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0"><tr><td style="padding:16px 18px;background:#E6F4EC;border-radius:14px">' +
    '<div style="' + FUENTE + 'font-size:15px;line-height:23px;color:' + TINTA + '">Apto cuesta desde <b>0,5 UF al mes (~' + pesos(costo) + ")</b>." +
    (veces >= 2 ? " Una sola compra promedio vale <b style=\"color:" + VERDE + '">' + veces.toLocaleString("es-CL") + " veces</b> lo que pagas por Apto." : "") +
    (pronto ? "<br>⏰ <b>" + pronto + " de estas compras cierran esta semana.</b>" : "") + "</div></td></tr></table>";
  const oferta = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0"><tr><td align="center" style="padding:18px;border:2px dashed ' + AMBAR + ';border-radius:14px;background:#FFF8E6">' +
    '<div style="' + FUENTE + 'font-size:14px;color:' + SUAVE + '">Tu código de regreso</div>' +
    '<div style="' + FUENTE + 'font-size:28px;font-weight:bold;letter-spacing:3px;color:' + TINTA + ';margin:4px 0">' + esc(codigo) + "</div>" +
    '<div style="' + FUENTE + 'font-size:15px;color:' + TINTA + '"><b>' + descuento + " % de descuento</b> en tu primer mes (" + pesos(costoDesc) + ' en vez de ' + pesos(costo) + ")</div>" +
    '<div style="' + FUENTE + 'font-size:13px;color:#8A5B00;margin-top:6px;font-weight:bold">⏳ Vence el ' + esc(venceTxt) + "</div></td></tr></table>";
  const cuerpo = tabla + rango + comparacion + oferta + boton("Volver a Apto con " + descuento + " % de descuento →", sitio, VERDE) +
    '<p style="' + FUENTE + 'font-size:13px;line-height:20px;color:' + SUAVE + ';text-align:center;margin:10px 0 0 0">Con Apto ves cuáles son, si cumples lo que piden y qué te falta antes de postular.</p>';
  const texto = asunto + "\n" + preheader + "\n\nHoy hay " + lista.length + " licitaciones abiertas para lo que vendes" + (total ? ", por " + millones(total) : "") + ".\n" +
    "Apto cuesta desde 0,5 UF al mes. Tu código " + codigo + " te da " + descuento + " % de descuento en tu primer mes y vence el " + venceTxt + ".\n" + sitio +
    "\n\nDejar de recibir avisos: " + sitio + "baja.html?t=" + token;
  return {asunto, html: marco({preheader, cabecera, cuerpo, sitio, token}), texto};
}

module.exports = {correoActivo, correoRecuerdo, cuentaRegresiva};
