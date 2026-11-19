// Página de estado de Apto: qué tan frescos están los datos publicados.
(async function(){
  const H = 36e5, ahora = Date.now();
  const leer = async f => { try{ const r = await fetch(f, {cache: "no-store"}); return r.ok ? r : null; }catch(e){ return null; } };
  // las fechas que traen solo el día se cuentan desde el final de ese día
  const edad = f => f ? Math.max(0, (ahora - new Date(/^\d{4}-\d{2}-\d{2}$/.test(f) ? f + "T23:59" : f).getTime()) / H) : null;
  const texto = h => h === null ? "—" : h < 1 ? "hace menos de 1 hora" : h < 48 ? "hace " + Math.round(h) + " horas" : "hace " + Math.round(h / 24) + " días";
  const filas = [];
  const fila = (nombre, fecha, limiteHoras, detalle) => {
    const h = edad(fecha);
    const est = h === null ? ["ro", "Sin datos"] : h <= limiteHoras ? ["ok", "Al día"] : h <= limiteHoras * 2 ? ["al", "Atrasado"] : ["ro", "Muy atrasado"];
    filas.push({nombre, cuando: texto(h), est, detalle});
  };
  let r = await leer("datos.js"), lic = 0, fechaLic = null;
  if(r){ const t = await r.text(); try{ const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); lic = j.listado.length; fechaLic = j.fecha; }catch(e){} }
  fila("Licitaciones abiertas", fechaLic, 6, lic.toLocaleString("es-CL") + " licitaciones");
  const json = async f => { const x = await leer(f); try{ return x ? await x.json() : null; }catch(e){ return null; } };
  const det = await json("detalles.json");
  if(det){ const n = Object.keys(det.items || {}).length; fila("Detalle de licitaciones (radar)", det.fecha, 6, n.toLocaleString("es-CL") + " con detalle" + (lic ? " (" + Math.round(100 * n / lic) + " %)" : "")); }
  const res = await json("resumenes.json");
  if(res) fila("Resúmenes en simple (IA)", res.fecha, 30, Object.keys(res.items || {}).length + " resúmenes vigentes");
  const dic = await json("diccionario.json");
  if(dic) fila("Diccionario de productos", dic.fecha, 30, Object.keys(dic.clases || {}).length.toLocaleString("es-CL") + " clases de producto");
  const apr = await json("aprendido.json");
  if(apr) fila("Aprendizaje con el uso", apr.fecha, 30, (apr.relaciones || []).length + " relaciones aprendidas, " + (apr.bloqueadas || []).length + " bloqueadas");
  const comp = await json("competencia.json");
  if(comp) fila("Competencia (ofertas por licitación)", comp.fecha, 30, (comp.licitaciones || 0).toLocaleString("es-CL") + " licitaciones adjudicadas");
  const pre = await json("precios.json");
  if(pre) fila("Precios de referencia", pre.fecha, 30, Object.keys(pre.productos || {}).length + " productos");
  const ca = await json("compra_agil.json");
  if(ca) fila("Compra Ágil (mes anterior)", ca.mes ? ca.mes + "-28" : null, 24 * 40, (ca.solicitudes || 0).toLocaleString("es-CL") + " solicitudes de " + ca.mes);
  document.getElementById("filas").innerHTML = filas.map(f => "<tr><td>" + f.nombre + "</td><td>" + f.cuando + '</td><td class="' + f.est[0] + '">' + f.est[1] + "</td><td>" + f.detalle + "</td></tr>").join("");
  const malos = filas.filter(f => f.est[0] !== "ok").length;
  document.getElementById("resumen").textContent = malos ? malos + " de " + filas.length + " datos necesitan atención." : "Todo al día: " + filas.length + " de " + filas.length + " datos actualizados.";
})();
