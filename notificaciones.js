// Centro de notificaciones de Apto: avisos personales (calculados en la página), estudios y reportes del mercado,
// promociones y novedades (notificaciones.json). Lo leído se recuerda en el navegador y en la cuenta.
(function(){
  const LEIDAS = "rp_leidas", VISTAS = "rp_vistas";
  const get = (k, d) => { try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } };
  const set = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  let publicas = [], noticias = null, filtro = "todo";
  const MERCADO = {}; // estudio de mercado por segmento de producto (mercado/<segmento>.json), se pide solo lo del cliente
  const el = id => document.getElementById(id);
  const hace = f => { const m = (Date.now() - new Date(f)) / 6e4; return m < 60 ? "hace " + Math.max(1, Math.round(m)) + " min" : m < 1440 ? "hace " + Math.round(m / 60) + " h" : "hace " + Math.round(m / 1440) + " d"; };
  const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

  // avisos personales: compras nuevas desde la última visita, guardadas que cierran pronto y el reporte de la semana
  function personales(){
    const out = [];
    if(typeof resultados === "undefined" || typeof datos === "undefined") return out;
    const vistas = new Set(get(VISTAS, []));
    const r = resultados.filter(x => x.dias === null || x.dias >= 0);
    const nuevas = vistas.size ? r.filter(x => !vistas.has(x.codigo)) : [];
    if(nuevas.length) out.push({id: "nuevas-" + nuevas.length + "-" + new Date().toDateString(), tipo: "personal", icono: "🔔", titulo: nuevas.length + (nuevas.length === 1 ? " compra nueva" : " compras nuevas") + " para ti",
      texto: "Desde tu última visita aparecieron compras que calzan con lo que vendes.", fecha: new Date().toISOString(), accion: "lista"});
    const g = typeof guardadas !== "undefined" ? guardadas : {};
    datos.filter(d => g[d.codigo] && d.cierre).forEach(d => {
      const h = (new Date(d.cierre) - Date.now()) / 36e5;
      if(h > 0 && h < 72) out.push({id: "cierra-" + d.codigo + "-" + (h < 24 ? "hoy" : "pronto"), tipo: "personal", icono: "⏰", titulo: (h < 24 ? "¡Cierra hoy! " : "Cierra en " + Math.ceil(h / 24) + " días: ") + "una compra que guardaste",
        texto: d.nombre.trim().slice(0, 110), fecha: new Date().toISOString(), codigo: d.codigo});
    });
    if(r.length && typeof perfil !== "undefined" && (perfil.extra || "").trim()){
      const pocas = r.filter(x => x.comp && x.comp.med <= 2).length, semana = r.filter(x => x.dias !== null && x.dias <= 7).length;
      out.push({id: "reporte-personal-" + new Date().toISOString().slice(0, 10), tipo: "personal", icono: "📈", titulo: "Tu reporte de hoy",
        texto: r.length + " compras calzan contigo · " + semana + " cierran esta semana" + (pocas ? " · " + pocas + " con poca competencia" : "") + ".", fecha: new Date().toISOString(), accion: "lista"});
    }
    return out;
  }
  // Lo que vende el cliente, como categorías de Mercado Público: lo que escribió (y sus sinónimos), su catálogo por RUT
  // y las compras que guardó o en las que participa. Con esto los estudios y noticias son solo de su rubro.
  function misClases(){
    const s = new Set();
    try{ if(typeof misCategorias === "function" && typeof terminos === "function") misCategorias(terminos()).forEach(c => s.add(c)); }catch(e){}
    if(typeof perfil !== "undefined") (perfil.cats || []).forEach(c => s.add(c));
    if(typeof guardadas !== "undefined" && typeof DET !== "undefined") Object.keys(guardadas).forEach(k => ((DET[k] && DET[k].c) || []).forEach(c => s.add(c)));
    return s;
  }
  const nombre = c => (typeof Buscar !== "undefined" && Buscar.nombreDe && Buscar.nombreDe(c)) || "categoría " + c;
  const num = n => Math.round(n).toLocaleString("es-CL");
  const plata = n => { if(n < 1e6) return "$" + num(n); const m = (n / 1e6).toLocaleString("es-CL", {maximumFractionDigits: 1}); return "$" + m + (m === "1" ? " millón" : " millones"); };
  const titulo = t => t.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase());

  // Estudios, reportes y noticias del rubro del cliente (se arman aquí, con los datos que la página ya cargó)
  function deSuRubro(cl){
    const out = [], hoy = new Date().toISOString().slice(0, 10);
    if(!cl.size) return out;
    // 1) Su mercado: compras abiertas en sus categorías y cuáles concentran más
    if(typeof datos !== "undefined" && typeof DET !== "undefined"){
      const cuenta = new Map(); let abiertas = 0, semana = 0;
      datos.forEach(d => {
        const c = ((DET[d.codigo] && DET[d.codigo].c) || []).filter(x => cl.has(x)); if(!c.length) return;
        const h = d.cierre ? (new Date(d.cierre) - Date.now()) / 864e5 : null; if(h !== null && h < 0) return;
        abiertas++; if(h !== null && h <= 7) semana++;
        c.forEach(x => cuenta.set(x, (cuenta.get(x) || 0) + 1));
      });
      if(abiertas) out.push({id: "rubro-mercado-" + hoy, tipo: "estudio", tuyo: true, icono: "📊", titulo: "Tu rubro hoy: " + num(abiertas) + (abiertas === 1 ? " compra abierta" : " compras abiertas"),
        texto: [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => nombre(c) + " (" + n + ")").join(" · "),
        detalle: semana + (semana === 1 ? " cierra" : " cierran") + " en los próximos 7 días.", fecha: new Date().toISOString(), accion: "lista"});
    }
    // 2) Competencia en sus categorías (licitaciones ya adjudicadas)
    if(typeof COMP !== "undefined" && COMP){
      const f = [...cl].map(c => [c, COMP.clases[c]]).filter(([, x]) => x && x.n >= 3);
      if(f.length){
        const n = f.reduce((a, [, x]) => a + x.n, 0), med = f.reduce((a, [, x]) => a + x.med * x.n, 0) / n;
        const mejor = f.slice().sort((a, b) => a[1].med - b[1].med)[0];
        out.push({id: "rubro-competencia-" + String(COMP.fecha).slice(0, 10), tipo: "estudio", tuyo: true, icono: "🎯", titulo: "Competencia en lo que vendes",
          texto: "En tus categorías llegan en promedio " + med.toLocaleString("es-CL", {maximumFractionDigits: 1}) + " ofertas por licitación. Donde menos compiten: " + nombre(mejor[0]) + " (~" + mejor[1].med.toLocaleString("es-CL") + ").",
          detalle: "Según " + num(n) + " licitaciones adjudicadas de tu rubro.", fecha: COMP.fecha});
      }
    }
    // 3) Compra Ágil del mes en sus categorías: cuánto se pidió, a cuántos cotizan y quién compra
    if(typeof CA !== "undefined" && CA){
      const f = [...cl].map(c => CA.clases[c]).filter(Boolean);
      const s = f.reduce((a, x) => a + x.s, 0);
      if(s){
        const cot = f.reduce((a, x) => a + x.s * x.cot, 0) / s, monto = f.reduce((a, x) => a + x.s * (x.monto || 0), 0) / s;
        const org = new Map(); f.forEach(x => (x.org || []).forEach(([o, n]) => org.set(o, (org.get(o) || 0) + n)));
        const top = [...org].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([o]) => titulo(o));
        const mes = new Date(CA.mes + "-15").toLocaleDateString("es-CL", {month: "long"});
        out.push({id: "rubro-ca-" + CA.mes, tipo: "reporte", tuyo: true, icono: "⚡", titulo: "Compra Ágil de tu rubro en " + mes,
          texto: num(s) + " solicitudes, con " + cot.toLocaleString("es-CL", {maximumFractionDigits: 1}) + " cotizaciones en promedio" + (monto ? " y montos de " + plata(monto) + " en promedio" : "") + ".",
          detalle: top.length ? "Los que más compraron: " + top.join(" y ") + "." : "", fecha: new Date(CA.mes + "-28T12:00:00").toISOString()});
      }
    }
    // 4) Noticias de su rubro (temas asociados a sus segmentos de productos)
    if(noticias && noticias.temas && noticias.items){
      // segmentos con peso: categorías del cliente + compras abiertas que le calzan; quedan los que pesan al menos 40 % del principal
      const peso = new Map(), suma = (k, n) => peso.set(k, (peso.get(k) || 0) + n);
      cl.forEach(c => suma(String(c).slice(0, 2), 1));
      if(typeof resultados !== "undefined" && typeof DET !== "undefined") resultados.forEach(r => ((DET[r.codigo] && DET[r.codigo].c) || []).forEach(c => { if(cl.has(c)) suma(String(c).slice(0, 2), 1); }));
      const tope = Math.max(...peso.values()), seg = new Set([...peso].filter(([, n]) => n >= tope * 0.4).map(([k]) => k)), vistas = new Set();
      const mios = new Set(Object.entries(noticias.temas).filter(([, t]) => t.seg.some(x => x === "*" || seg.has(x))).map(([id]) => id));
      const region = typeof perfil !== "undefined" ? perfil.region || "" : "";
      const ICONO = {oportunidad: "🟢", adjudicacion: "🏆", normativa: "📜", mercado: "📰"};
      const POR_QUE = {oportunidad: "un organismo va a comprar en tu rubro; atento a cuando se publique en Mercado Público.",
        adjudicacion: "muestra qué se está comprando en tu rubro y quién; te sirve para preparar tu próxima oferta.",
        normativa: "cambia o explica cómo se compra; revísalo antes de tu próxima oferta.",
        mercado: "es movimiento en tu rubro que puede traer compras."};
      const ETIQUETA = {oportunidad: "Oportunidad que viene", adjudicacion: "Adjudicación", normativa: "Reglas de compra", mercado: "Mercado"};
      (noticias.items || []).filter(n => !n.x && n.te.some(t => mios.has(t))).forEach(n => {
        if(vistas.has(n.l)) return; vistas.add(n.l);
        const tema = noticias.temas[n.te.find(t => mios.has(t))].nombre, enRegion = !!(region && n.r === region);
        // orden: lo que viene primero, luego su región, la nota de la IA local, la autoridad de la fuente y lo reciente
        const peso = (n.k === "oportunidad" ? 4 : n.k === "adjudicacion" ? 1.5 : n.k === "normativa" ? 1 : 0) + (enRegion ? 2.5 : 0) + (n.v ? (n.v - 5) / 2 : 0) + (n.a || 1) * 0.5 + (n.o || 0) * 0.3 - (Date.now() - new Date(n.f)) / 864e5 / 7;
        out.push({id: "noticia-" + n.l.slice(-40), tipo: "noticia", tuyo: true, icono: ICONO[n.k] || "📰", titulo: n.t, peso,
          general: n.te.every(t => t === "general"),
          texto: "Por qué te importa: " + (n.te.every(t => t === "general") ? "son reglas y novedades de ChileCompra que afectan a todos los que venden al Estado." : POR_QUE[n.k] || POR_QUE.mercado),
          detalle: [ETIQUETA[n.k] || "", enRegion ? "En tu región" : n.r, n.s + (n.o ? " y " + n.o + (n.o === 1 ? " medio más" : " medios más") : "")].filter(Boolean).join(" · "),
          fecha: n.f, url: n.l});
      });
    }
    // 5) Estudio de mercado de sus categorías principales: qué piden, a qué precio, quién compra
    const ranking = new Map();
    cl.forEach(c => ranking.set(c, 0));
    if(typeof resultados !== "undefined" && typeof DET !== "undefined") resultados.forEach(r => ((DET[r.codigo] && DET[r.codigo].c) || []).forEach(c => { if(ranking.has(c)) ranking.set(c, ranking.get(c) + 1); }));
    // primero la categoría que mejor calza con cada producto que escribió el cliente; después, las con más compras abiertas
    const primeras = [];
    try{ if(typeof terminos === "function") terminos().forEach(t => { const r = Buscar.clasesDe(t, 1)[0]; if(r && cl.has(r.c)) primeras.push(String(r.c)); }); }catch(e){}
    const orden = [...new Set(primeras.concat([...ranking].sort((a, b) => b[1] - a[1]).map(([c]) => String(c))))];
    const pedir = [...new Set(orden.slice(0, 8).map(c => c.slice(0, 2)))].filter(sg => !(sg in MERCADO));
    pedir.forEach(sg => { MERCADO[sg] = null; fetch("mercado/" + sg + ".json", {cache: "no-store"}).then(r => r.ok ? r.json() : {}).then(j => { MERCADO[sg] = j || {}; contar(); }).catch(() => { MERCADO[sg] = {}; }); });
    const conDatos = orden.map(c => [c, MERCADO[c.slice(0, 2)] && MERCADO[c.slice(0, 2)].clases && MERCADO[c.slice(0, 2)].clases[c]]).filter(([, x]) => x && x.n >= 15).slice(0, 2);
    conDatos.forEach(([c, x]) => {
      const nom = nombre(c), base = MERCADO[c.slice(0, 2)], mesCA = base.mes_compra_agil ? new Date(base.mes_compra_agil + "-15").toLocaleDateString("es-CL", {month: "long"}) : "";
      const fuente = "Según " + num(x.n) + " compras" + (mesCA ? " (Compra Ágil de " + mesCA + " y licitaciones)" : "") + ".";
      if(x.rasgos && x.rasgos.length) out.push({id: "mercado-rasgos-" + c + "-" + base.fecha, tipo: "estudio", tuyo: true, icono: "🔎", titulo: "Lo que piden en " + nom,
        texto: "De las compras que detallan características: " + x.rasgos.slice(0, 5).map(([k, v]) => v + " % pide " + k).join(" · ") + ".",
        detalle: (x.claves && x.claves.length ? "Palabras que más se repiten: " + x.claves.slice(0, 5).join(", ") + ". " : "") + fuente, fecha: base.fecha + "T09:00:00"});
      const partes = [];
      if(x.rangos){ const top = x.rangos.slice().sort((a, b) => b[1] - a[1]).slice(0, 2); partes.push("Presupuestos: " + top.map(([e, v]) => v + " % " + e).join(", ") + " (al medio: " + plata(x.pres_med) + ")."); }
      if(x.precio) partes.push("Quien gana cobra por " + x.precio.producto.split(",")[0].toLowerCase() + " entre " + plata(x.precio.p25) + " y " + plata(x.precio.p75) + " (al medio " + plata(x.precio.med) + ").");
      if(x.baja) partes.push("Los ganadores ofertan " + x.baja + " % bajo el presupuesto.");
      if(partes.length) out.push({id: "mercado-precios-" + c + "-" + base.fecha, tipo: "estudio", tuyo: true, icono: "💲", titulo: "Precios y montos en " + nom,
        texto: partes.join(" "), detalle: fuente, fecha: base.fecha + "T09:00:00"});
      if(x.compradores && x.compradores.length) out.push({id: "mercado-compradores-" + c + "-" + base.fecha, tipo: "estudio", tuyo: true, icono: "🏛️", titulo: "Quién compra " + nom,
        texto: x.compradores.slice(0, 4).map(([o, k]) => o + " (" + k + ")").join(" · ") + (x.regiones && x.regiones.length ? ". Regiones: " + x.regiones.map(([g]) => g).join(", ") + "." : "."),
        detalle: [x.cot ? "Llegan " + x.cot.toLocaleString("es-CL") + " cotizaciones por compra" : "", x.plazo ? "el plazo de entrega típico es " + x.plazo + (x.plazo === 1 ? " día" : " días") : ""].filter(Boolean).join(" y ") + ".", fecha: base.fecha + "T09:00:00"});
    });
    return out;
  }
  // Con rubro conocido se muestran solo sus estudios; los nacionales quedan para quien aún no dice qué vende.
  function todas(){
    const cl = misClases(), propios = deSuRubro(cl);
    let generales = 0; // como máximo 2 noticias generales de ChileCompra; el resto, de su rubro
    const notis = propios.filter(n => n.tipo === "noticia").sort((a, b) => b.peso - a.peso).filter(n => !n.general || ++generales <= 2).slice(0, 6);
    const pub = publicas.filter(n => !cl.size || (n.tipo !== "estudio" && n.tipo !== "reporte"));
    return personales().concat(propios.filter(n => n.tipo !== "noticia"), notis, pub);
  }
  const coincide = n => filtro === "todo" || (filtro === "personal" && n.tipo === "personal") || (filtro === "estudios" && (n.tipo === "estudio" || n.tipo === "reporte")) || (filtro === "noticias" && n.tipo === "noticia") || (filtro === "promos" && (n.tipo === "promo" || n.tipo === "novedad"));

  function contar(){
    const leidas = new Set(get(LEIDAS, [])), n = todas().filter(x => !leidas.has(x.id)).length;
    const b = el("notifCuenta"); if(!b) return;
    b.textContent = n > 9 ? "9+" : n; b.hidden = !n;
    el("notifBtn").setAttribute("aria-label", n ? "Notificaciones: " + n + " sin leer" : "Notificaciones");
  }
  function pintar(){
    const leidas = new Set(get(LEIDAS, [])), lista = todas().filter(coincide);
    el("notifLista").innerHTML = lista.length ? lista.map((n, i) =>
      '<li class="notif' + (leidas.has(n.id) ? "" : " nueva") + '" style="--i:' + i + '"><button type="button" data-id="' + e(n.id) + '">' +
      '<span class="ni">' + e(n.icono || "•") + '</span><span class="nt"><b>' + e(n.titulo) + "</b><span>" + e(n.texto) + "</span>" +
      (n.detalle ? '<small>' + e(n.detalle) + "</small>" : "") + '<em>' + (n.tuyo && n.tipo !== "noticia" ? "De tu rubro · " : "") + hace(n.fecha) + "</em></span></button></li>").join("")
      : '<li class="vacio">No hay notificaciones aquí por ahora.</li>';
    document.querySelectorAll("#notifFiltros button").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === filtro));
  }
  function abrirPanel(){
    const p = el("notifPanel");
    pintar(); p.hidden = false;
    requestAnimationFrame(() => p.classList.add("abierto"));
    el("notifBtn").setAttribute("aria-expanded", "true");
    if(typeof resultados !== "undefined") set(VISTAS, resultados.map(x => x.codigo).slice(0, 3000)); // lo que ya vio
  }
  function cerrarPanel(){
    const p = el("notifPanel"); if(p.hidden) return;
    p.classList.remove("abierto"); el("notifBtn").setAttribute("aria-expanded", "false");
    setTimeout(() => { p.hidden = true; }, 130);
  }
  function leer(id){ const l = new Set(get(LEIDAS, [])); l.add(id); set(LEIDAS, [...l].slice(-400)); contar(); }

  document.addEventListener("DOMContentLoaded", iniciar);
  if(document.readyState !== "loading") iniciar();
  let listo = false;
  function iniciar(){
    if(listo || !el("notifBtn")) return; listo = true;
    fetch("notificaciones.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { publicas = (j && j.items) || []; contar(); }).catch(() => {});
    fetch("noticias.json", {cache: "no-store"}).then(r => r.ok ? r.json() : null).then(j => { noticias = j; contar(); }).catch(() => {});
    el("notifBtn").onclick = ev => { ev.stopPropagation(); el("notifPanel").hidden ? abrirPanel() : cerrarPanel(); };
    el("notifTodas").onclick = () => { set(LEIDAS, todas().map(n => n.id).concat(get(LEIDAS, [])).slice(0, 400)); pintar(); contar(); };
    el("notifFiltros").onclick = ev => { const b = ev.target.closest("button[data-f]"); if(b){ filtro = b.dataset.f; pintar(); } };
    el("notifLista").onclick = ev => {
      const b = ev.target.closest("button[data-id]"); if(!b) return;
      const n = todas().find(x => x.id === b.dataset.id); leer(b.dataset.id); cerrarPanel();
      if(!n) return;
      if(n.url) window.open(n.url, "_blank", "noopener");
      else if(n.codigo && typeof abrir === "function") abrir(n.codigo);
      else if(n.accion === "lista") el("lista").scrollIntoView({behavior: "smooth", block: "start"});
      else if(n.enlace && n.enlace.startsWith("?c=") && typeof abrir === "function") abrir(n.enlace.slice(3));
      else if(n.enlace) location.hash = n.enlace.replace(/^#/, "");
    };
    document.addEventListener("click", ev => { if(!ev.target.closest("#notifPanel")) cerrarPanel(); });
    document.addEventListener("keydown", ev => { if(ev.key === "Escape") cerrarPanel(); });
    setInterval(contar, 4000); // los avisos personales dependen de los datos que se van cargando
    setTimeout(contar, 1500);
  }
})();
