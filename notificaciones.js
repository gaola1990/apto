// Centro de notificaciones de Apto: avisos personales (calculados en la página), estudios y reportes del mercado,
// promociones y novedades (notificaciones.json). Lo leído se recuerda en el navegador y en la cuenta.
(function(){
  const LEIDAS = "rp_leidas", VISTAS = "rp_vistas";
  const get = (k, d) => { try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } };
  const set = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  let publicas = [], filtro = "todo";
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
  const todas = () => personales().concat(publicas);
  const coincide = n => filtro === "todo" || (filtro === "personal" && n.tipo === "personal") || (filtro === "estudios" && (n.tipo === "estudio" || n.tipo === "reporte")) || (filtro === "promos" && (n.tipo === "promo" || n.tipo === "novedad"));

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
      (n.detalle ? '<small>' + e(n.detalle) + "</small>" : "") + '<em>' + hace(n.fecha) + "</em></span></button></li>").join("")
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
    el("notifBtn").onclick = ev => { ev.stopPropagation(); el("notifPanel").hidden ? abrirPanel() : cerrarPanel(); };
    el("notifTodas").onclick = () => { set(LEIDAS, todas().map(n => n.id).concat(get(LEIDAS, [])).slice(0, 400)); pintar(); contar(); };
    el("notifFiltros").onclick = ev => { const b = ev.target.closest("button[data-f]"); if(b){ filtro = b.dataset.f; pintar(); } };
    el("notifLista").onclick = ev => {
      const b = ev.target.closest("button[data-id]"); if(!b) return;
      const n = todas().find(x => x.id === b.dataset.id); leer(b.dataset.id); cerrarPanel();
      if(!n) return;
      if(n.codigo && typeof abrir === "function") abrir(n.codigo);
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
