// Noticias por rubro para el centro de notificaciones (noticias.json). Cada tema se asocia a segmentos del catálogo
// de Mercado Público (2 primeros dígitos del código ONU), así cada cliente ve solo las noticias de lo que vende.
// Fuentes: Google News RSS y el feed oficial de ChileCompra (gratis, públicos); se guarda solo título, medio, fecha y enlace.
//   node herramientas/noticias.js
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
const COMPRAS = '(licitación OR licitaciones OR ChileCompra OR "Mercado Público" OR municipalidad OR "compra pública")';
const TEMAS = [
  {id: "salud-insumos", nombre: "Insumos y equipos médicos", seg: ["42", "41"], q: '("insumos médicos" OR "equipamiento médico" OR "equipos médicos" OR hospital)'},
  {id: "medicamentos", nombre: "Medicamentos", seg: ["51"], q: "(medicamentos OR fármacos OR Cenabast)"},
  {id: "salud-servicios", nombre: "Servicios de salud", seg: ["85"], q: '("atención primaria" OR CESFAM OR "servicios de salud")'},
  {id: "construccion", nombre: "Construcción y obras", seg: ["72", "30", "10", "81"], q: '(construcción OR "obras públicas" OR infraestructura OR pavimentación)'},
  {id: "ferreteria", nombre: "Ferretería, herramientas y materiales", seg: ["31", "27", "11", "40", "23"], q: '(ferretería OR herramientas OR "materiales de construcción")'},
  {id: "computacion", nombre: "Computación y tecnología", seg: ["43", "32", "45", "52"], q: "(computadores OR notebooks OR tecnología OR software OR impresoras)"},
  {id: "personal", nombre: "Servicios profesionales y personal", seg: ["80", "84", "86", "93"], q: '(consultoría OR asesoría OR capacitación OR "servicios profesionales")'},
  {id: "deportes", nombre: "Deportes y recreación", seg: ["49", "60"], q: '(deportivo OR deportivos OR "implementos deportivos" OR IND OR juegos OR juguetes)'},
  {id: "transporte", nombre: "Transporte y vehículos", seg: ["78", "25", "15", "26"], q: '(transporte OR vehículos OR buses OR "transporte escolar" OR combustible)'},
  {id: "vestuario", nombre: "Vestuario y uniformes", seg: ["53"], q: "(uniformes OR vestuario OR calzado OR textil)"},
  {id: "eventos", nombre: "Alimentación, eventos y turismo", seg: ["90", "50", "48"], q: '(alimentación OR banquetería OR eventos OR "Programa de Alimentación Escolar" OR Junaeb)'},
  {id: "iluminacion", nombre: "Iluminación y electricidad", seg: ["39"], q: '(iluminación OR luminarias OR "alumbrado público" OR LED)'},
  {id: "mobiliario", nombre: "Mobiliario", seg: ["56", "24"], q: '(mobiliario OR muebles OR "mobiliario escolar")'},
  {id: "seguridad", nombre: "Seguridad", seg: ["46", "92"], q: '(seguridad OR cámaras OR vigilancia OR "guardias de seguridad" OR incendios)'},
  {id: "oficina", nombre: "Útiles de oficina e imprenta", seg: ["44", "14", "55", "82"], q: '("útiles de oficina" OR imprenta OR papelería OR publicidad)'},
  {id: "aseo", nombre: "Aseo, limpieza y residuos", seg: ["76", "47", "12"], q: '(aseo OR limpieza OR residuos OR basura OR reciclaje)'},
  {id: "areas-verdes", nombre: "Áreas verdes y jardines", seg: ["70", "21"], q: '("áreas verdes" OR jardines OR paisajismo OR arbolado OR plazas)'},
  {id: "mantencion", nombre: "Mantención y reparación", seg: ["73", "22", "20"], q: '(mantención OR mantenimiento OR reparación OR maquinaria)'},
  {id: "cuidado", nombre: "Cuidado de personas", seg: ["91", "94"], q: '("adultos mayores" OR cuidado OR "salas cuna" OR jardines infantiles)'},
  {id: "telecom", nombre: "Telecomunicaciones y servicios básicos", seg: ["83"], q: '(telefonía OR internet OR conectividad OR "agua potable")'},
  {id: "medioambiente", nombre: "Medio ambiente", seg: ["77", "71", "13"], q: '("medio ambiente" OR ambiental OR contaminación)'}
];
const sin = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// palabras del tema (sin tildes, raíz de 6 letras): el titular debe nombrar al menos una para que la noticia sea del rubro
const claves = q => [...new Set(sin(q).replace(/[()"]/g, " ").split(/\s+/).filter(w => w && w !== "or" && w.length > 2).map(w => w.length > 6 ? w.slice(0, 6) : w))];
const NEGOCIO = / (licit|compra|adjudic|contrat|proveed|inversi|millon|mil millones|adquisi|financ|convenio|bases |presupuest|chilecompra|mercado publico|cenabast|junaeb|equipa|implement|renova|entrega|nuev[oa]s? )/;
const des = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

// Región de la noticia (por nombre de región o de sus ciudades principales), con los mismos nombres que usa el perfil
const REGIONES = {
  "Arica y Parinacota": "arica|parinacota|putre", "Tarapacá": "tarapaca|iquique|alto hospicio|pica|pozo almonte",
  "Antofagasta": "antofagasta|calama|tocopilla|mejillones|taltal", "Atacama": "atacama|copiapo|vallenar|caldera|chanaral|freirina",
  "Coquimbo": "coquimbo|la serena|ovalle|illapel|vicuna", "Valparaíso": "valparaiso|vina del mar|quilpue|villa alemana|san antonio|quillota|la calera|los andes|san felipe|olmue|limache",
  "Metropolitana": "santiago|metropolitana|maipu|puente alto|providencia|las condes|nunoa|la florida|lo barnechea|vitacura|pudahuel|quilicura|lo prado|recoleta|independencia|penalolen|san bernardo|colina",
  "O'Higgins": "o.?higgins|rancagua|san fernando|pichilemu|machali|rengo", "Maule": "maule|talca|curico|linares|cauquenes|constitucion|yerbas buenas",
  "Ñuble": "nuble|chillan|san carlos|bulnes", "Biobío": "biobio|bio bio|concepcion|talcahuano|los angeles|coronel|tome|chiguayante|hualpen|lota|alto biobio|alto bio bio",
  "Araucanía": "araucania|temuco|padre las casas|villarrica|pucon|angol|nueva imperial|puren|lautaro|victoria",
  "Los Ríos": "los rios|valdivia|la union|panguipulli|niebla|lanco", "Los Lagos": "los lagos|puerto montt|osorno|castro|chiloe|ancud|calbuco|puerto varas|curaco de velez|san juan de la costa",
  "Aysén": "aysen|aisen|coyhaique|coihaique", "Magallanes": "magallanes|punta arenas|puerto natales|antartica"
};
const regionDe = tt => { for(const [r, x] of Object.entries(REGIONES)) if(new RegExp(" (" + x + ") ").test(tt)) return r; return ""; };
// Qué clase de noticia es, para quien vende al Estado: lo que viene (oportunidad) va primero
const tipoDe = tt => / (licitara|licitaran|publicara|abre licitacion|abren licitacion|llama a licitacion|llamado a licitacion|consulta al mercado|bases de licitacion|publica nuevas bases|aprueba adquisicion|aprueba compra|aprobo|destinara|invertira|proyecta|financiamiento|licita |licitan )/.test(tt) ? "oportunidad"
  : / (adjudic|se adjudico|gano la licitacion|contrato con)/.test(tt) ? "adjudicacion"
  : / (ley|reglamento|directiva|normativa|convenio marco|contraloria|chilecompra|compras publicas)/.test(tt) ? "normativa" : "mercado";
// Autoridad de la fuente: primero lo oficial, luego medios nacionales conocidos
const OFICIAL = /chilecompra|ministerio|mop|gob\.cl|gobierno|municipalidad|municipio|ilustre|cenabast|junaeb|minsal|servicio de salud|instituto nacional de deportes|subdere|serviu|minvu|contraloria|gore|gobierno regional|senapred/;
const NACIONAL = /biobiochile|la tercera|emol|el mercurio|cooperativa|diario financiero|df\.cl|ex-ante|cnn chile|24 horas|t13|adn|el mostrador|ciper|the clinic|soychile|el dinamo|la nacion/;
const autoridad = (fuente, titulo) => OFICIAL.test(sin(fuente)) ? 3 : NACIONAL.test(sin(fuente)) ? 2 : OFICIAL.test(sin(titulo)) ? 1.5 : 1;
// Huella del hecho (palabras de 4+ letras, raíz de 6) para juntar la misma noticia publicada por varios medios
const huella = tt => new Set(tt.split(" ").filter(w => w.length > 3).map(w => w.slice(0, 6)));
const parecido = (a, b) => { let n = 0; a.forEach(w => { if(b.has(w)) n++; }); return n / Math.max(1, Math.min(a.size, b.size)); };
const leerRSS = async url => {
  const xml = await (await fetch(url, {signal: AbortSignal.timeout(20000), headers: {"User-Agent": "Mozilla/5.0 (compatible; noticias-rubro)"}})).text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => { const g = k => { const x = m[1].match(new RegExp("<" + k + "[^>]*>([\\s\\S]*?)</" + k + ">")); return x ? des(x[1]) : ""; }; return {titulo: g("title"), fuente: g("source"), fecha: g("pubDate"), link: g("link")}; });
};
const FUERA = /colombia|per[uú]|m[eé]xico|argentina|ecuador|espa[ñn]a|c[oó]rdoba|buenos aires|bolivia|uruguay|paraguay/i;

(async () => {
  const previo = (() => { try{ return JSON.parse(fs.readFileSync(path.join(RAIZ, "noticias.json"), "utf8")); }catch(e){ return {}; } })();
  const iaPrevia = new Map((previo.items || []).filter(n => n.p || n.x).map(n => [n.l, n])); // lo que ya revisó la IA local
  const candidatas = [], limite = Date.now() - 30 * 864e5;
  const agregar = (temaId, x) => {
    const fuente = x.fuente || "ChileCompra", titulo = x.titulo.replace(new RegExp("\\s+[-–]\\s+" + fuente.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "").trim();
    const f = new Date(x.fecha); if(!titulo || isNaN(f) || f < limite || FUERA.test(titulo + " " + fuente)) return;
    const tt = " " + sin(titulo).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ") + " ";
    candidatas.push({t: titulo.slice(0, 160), s: fuente.slice(0, 60), f: f.toISOString(), l: x.link, te: [temaId], k: tipoDe(tt), r: regionDe(tt), a: autoridad(fuente, titulo), tt, h: huella(tt)});
  };
  let fallas = 0;
  for(const t of TEMAS){
    const ks = claves(t.q);
    try{
      const items = await leerRSS("https://news.google.com/rss/search?q=" + encodeURIComponent(t.q + " " + COMPRAS + " Chile when:30d") + "&hl=es-419&gl=CL&ceid=CL:es-419");
      items.forEach(x => {
        const tt = " " + sin(x.titulo).replace(/[^a-z0-9ñ ]/g, " ") + " ";
        if(!ks.some(k => k.length <= 3 ? tt.includes(" " + k + " ") : tt.includes(" " + k))) return; // no habla del rubro
        if(!NEGOCIO.test(tt)) return; // y debe tratar de compras, contratos o inversión
        agregar(t.id, x);
      });
    }catch(e){ fallas++; console.log("Noticias " + t.id + ": sin respuesta (" + e.message + ")"); }
    await new Promise(r => setTimeout(r, 800));
  }
  // Fuente oficial: noticias de ChileCompra (reglas, convenios marco, capacitaciones), para todos los clientes (tema "general").
  try{
    (await leerRSS("https://www.chilecompra.cl/feed/")).forEach(x => {
      const tt = " " + sin(x.titulo).replace(/[^a-z0-9ñ ]/g, " ") + " ";
      if(/ (noviembre|diciembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre) \d/.test(tt)) return; // avisos de organismos con fecha, no son noticias
      agregar("general", {...x, fuente: "ChileCompra"}); // reglas y avisos de compras públicas: le sirven a todos
    });
  }catch(e){ console.log("ChileCompra: sin respuesta (" + e.message + ")"); }

  // Un hecho, una noticia: se junta la misma historia de varios medios (se queda la fuente con más autoridad)
  candidatas.sort((a, b) => b.a - a.a || new Date(b.f) - new Date(a.f));
  const items = [];
  for(const c of candidatas){
    const igual = items.find(x => x.l === c.l || parecido(x.h, c.h) >= 0.6);
    if(igual){ igual.te = [...new Set(igual.te.concat(c.te))]; if(igual.l !== c.l) igual.o = (igual.o || 0) + 1; continue; }
    items.push(c);
  }
  // Por tema quedan las mejores 8: oportunidades primero, luego autoridad y lo más reciente
  const puntaje = n => (n.k === "oportunidad" ? 3 : n.k === "adjudicacion" ? 1.5 : n.k === "normativa" ? 1 : 0) + n.a + (n.o || 0) * 0.5 - (Date.now() - new Date(n.f)) / 864e5 / 10;
  const quedan = new Set();
  Object.keys(TEMAS.reduce((o, t) => (o[t.id] = 1, o), {general: 1})).forEach(id => items.filter(n => n.te.includes(id)).sort((a, b) => puntaje(b) - puntaje(a)).slice(0, 8).forEach(n => quedan.add(n)));
  const salida = [...quedan].map(({tt, h, ...n}) => { const ia = iaPrevia.get(n.l); return ia ? {...n, p: ia.p, v: ia.v, x: ia.x} : n; });
  if(!salida.length && previo.items){ console.log("Sin noticias nuevas: se mantienen las anteriores"); return; }
  const temas = Object.fromEntries(TEMAS.map(t => [t.id, {nombre: t.nombre, seg: t.seg}]).concat([["general", {nombre: "Compras públicas", seg: ["*"]}]]));
  fs.writeFileSync(path.join(RAIZ, "noticias.json"), JSON.stringify({fecha: new Date().toISOString(), fuente: "Google News y ChileCompra", temas, items: salida}));
  const k = salida.reduce((o, n) => (o[n.k] = (o[n.k] || 0) + 1, o), {});
  console.log("noticias.json: " + salida.length + " noticias (" + Object.entries(k).map(([a, b]) => b + " " + a).join(", ") + "), " + (candidatas.length - items.length) + " repetidas juntadas" + (fallas ? ", " + fallas + " temas sin respuesta" : ""));
})();
