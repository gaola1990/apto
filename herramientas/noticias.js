// Noticias por rubro para el centro de notificaciones (noticias.json). Cada tema se asocia a segmentos del catálogo
// de Mercado Público (2 primeros dígitos del código ONU), así cada cliente ve solo las noticias de lo que vende.
// Fuente: Google News RSS (gratis, público); se guarda solo título, medio, fecha y enlace. Lo corre GitHub Actions.
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

(async () => {
  const anterior = (() => { try{ return JSON.parse(fs.readFileSync(path.join(RAIZ, "noticias.json"), "utf8")).temas || {}; }catch(e){ return {}; } })();
  const temas = {};
  for(const t of TEMAS){
    const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(t.q + " " + COMPRAS + " Chile when:30d") + "&hl=es-419&gl=CL&ceid=CL:es-419";
    try{
      const xml = await (await fetch(url, {signal: AbortSignal.timeout(20000), headers: {"User-Agent": "Mozilla/5.0 (compatible; noticias-rubro)"}})).text();
      const vistos = new Set(), items = [], ks = claves(t.q);
      for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){
        const g = k => { const x = m[1].match(new RegExp("<" + k + "[^>]*>([\\s\\S]*?)</" + k + ">")); return x ? des(x[1]) : ""; };
        const fuente = g("source"), titulo = g("title").replace(new RegExp("\\s+-\\s+" + fuente.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
        const clave = titulo.toLowerCase().slice(0, 60);
        if(!titulo || vistos.has(clave) || /colombia|per[uú]|m[eé]xico|argentina|ecuador|espa[ñn]a|c[oó]rdoba|buenos aires|bolivia|uruguay|paraguay/i.test(titulo + " " + fuente)) continue;
        const tt = " " + sin(titulo).replace(/[^a-z0-9ñ ]/g, " ") + " ";
        if(!ks.some(k => k.length <= 3 ? tt.includes(" " + k + " ") : tt.includes(" " + k))) continue; // no habla del rubro
        if(!NEGOCIO.test(tt)) continue; // y debe tratar de compras, contratos o inversión (lo que le sirve a quien vende al Estado)
        vistos.add(clave);
        items.push({t: titulo.slice(0, 160), s: fuente.slice(0, 60), f: new Date(g("pubDate")).toISOString(), l: g("link")});
      }
      items.sort((a, b) => new Date(b.f) - new Date(a.f));
      temas[t.id] = {nombre: t.nombre, seg: t.seg, items: items.slice(0, 5)};
    }catch(e){
      if(anterior[t.id]) temas[t.id] = anterior[t.id]; // si Google News no responde, se mantienen las de antes
      console.log("Noticias " + t.id + ": sin respuesta (" + e.message + ")");
    }
    await new Promise(r => setTimeout(r, 800));
  }
  fs.writeFileSync(path.join(RAIZ, "noticias.json"), JSON.stringify({fecha: new Date().toISOString(), fuente: "Google News", temas}));
  console.log("noticias.json: " + Object.keys(temas).length + " temas, " + Object.values(temas).reduce((a, t) => a + t.items.length, 0) + " noticias");
})();
