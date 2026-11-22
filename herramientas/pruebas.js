// Pruebas automáticas de Apto (node herramientas/pruebas.js). Si alguna falla, no se publica.
// Revisan que el buscador siga entendiendo sinónimos, abreviaturas y errores, que no haya falsos calces conocidos,
// que el diccionario apunte a los productos correctos y que lo aprendido y lo bloqueado se respeten.
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
require(path.join(RAIZ, "buscar.js"));
const B = globalThis.Buscar;
let ok = 0, malas = [];
const prueba = (nombre, cond) => { if(cond) ok++; else malas.push(nombre); };
const calza = (q, texto) => { const t = B.expandir(B.norm(texto)); return B.calza(B.armar(q), t, t.split(" ")); };

// 1) Búsqueda por palabras, variantes, sinónimos y abreviaturas
const LIC = "SEGUNDO LLAMADO SERVICIOS DE MANT. Y REPARACIÓN DE COMPUTADORES DE ESCRITORIO";
prueba("palabras en cualquier orden", calza("mantencion de computadores", LIC));
prueba("sinónimo pc = computador", calza("mantencion de pc", LIC));
prueba("variante mantenimiento", calza("mantenimiento de computadores", LIC));
prueba("abreviatura del comprador (MANT.)", calza("mantención", "SERV. DE MANT. DE ASCENSORES"));
prueba("abreviatura del vendedor (serv aseo)", calza("serv aseo", "SERVICIO DE ASEO DE OFICINAS"));
prueba("aseo = limpieza", calza("aseo", "Servicio de limpieza de edificios"));
prueba("mascarilla = cubrebocas", calza("mascarillas", "Adquisición de cubrebocas desechables"));
prueba("frase de sinónimo (arreglos florales)", calza("arreglos florales", "Compra de flores para ceremonia"));

// 2) Falsos calces que NO deben ocurrir
prueba("computadores ≠ computarizado", !calza("computadores", "Tomógrafo axial computarizado"));
prueba("pc dentro de un código no calza", !calza("pc", "Mantención de ascensores ACADEPC 6789"));
prueba("'mant' sola no calza con manteles", !calza("mant", "Compra de manteles"));
prueba("sello ≠ sellado", !calza("sello", "Servicio de sellado de juntas"));
prueba("van ≠ vanitorio", !calza("van", "Compra de vanitorios"));

// 3) Errores de escritura (con vocabulario de ejemplo)
B.vocabulario([["computadores", "impresoras", "vigilancia", "mantencion", "higiene", "fumigacion", "mantel"]]);
for(const [mal, bien] of [["computadres", "computadores"], ["inpresoras", "impresoras"], ["bijilancia", "vigilancia"], ["mantension", "mantencion"], ["igiene", "higiene"]])
  prueba(`corrige ${mal} → ${bien}`, B.corregir(mal) === bien);
prueba("no corrige palabras que existen (mantel)", B.corregir("mantel") === null);
B.vocabulario([]);

// 4) Diccionario de productos (catálogo oficial ONU + palabras reales)
const dic = JSON.parse(fs.readFileSync(path.join(RAIZ, "diccionario.json"), "utf8"));
B.cargarDiccionario(dic.clases);
const clases = q => B.clasesDe(B.armar(q)).map(r => r.c);
prueba("diccionario: notebook → Computadores (432115)", clases("notebook")[0] === "432115");
prueba("diccionario: pc incluye Computadores", clases("pc").includes("432115"));
prueba("diccionario: aseo → Suministros para aseo (471317)", clases("aseo").includes("471317"));
prueba("diccionario: tóner incluye suministros de impresora (441031)", clases("toner").includes("441031"));
prueba("diccionario tiene más de 1.500 clases", Object.keys(dic.clases).length > 1500);

// 5) Lo aprendido manda y lo bloqueado se quita
B.cargarAprendido({relaciones: [["carpas", "901016", "descripciones", 3]], bloqueadas: []});
prueba("aprendido: carpas → servicios de fiestas en carpas", clases("carpas")[0] === "901016");
prueba("aprendido descarta coincidencias débiles (peces)", !clases("carpas").includes("101017"));
B.cargarAprendido({relaciones: [["carpas", "901016", "descripciones", 3]], bloqueadas: [["carpas", "901016"]]});
prueba("bloqueado: deja de usarse", !clases("carpas").includes("901016"));
B.cargarAprendido({});

// 5b) Frases con plural y sinónimos de varias palabras (auditoría 2026-11-22)
prueba("frase en plural: «insumos médicos» calza con «insumos medicos»", calza("insumos médicos", "SUMINISTRO DE INSUMOS MEDICOS PARA CESFAM"));
prueba("frase en singular: «insumo médico» calza con «insumos clínicos»", calza("insumo médico", "ADQUISICION DE INSUMOS CLINICOS"));
prueba("la frase no calza si falta una palabra", !calza("insumos médicos", "ADQUISICION DE INSUMOS DE OFICINA"));
B.sumarSinonimos([["materiales de oficina", "utiles de oficina", "papeleria"]]);
prueba("«papelería» calza con «materiales de oficina»", calza("papeleria", "ADQ. MATERIALES DE OFICINA PARA SEREMI"));

// 6) Archivos de datos válidos
for(const f of ["detalles.json", "precios.json", "categorias.json", "compra_agil.json", "aprendido.json", "sinonimos.json"]){
  const p = path.join(RAIZ, f);
  if(fs.existsSync(p)){ let v = true; try{ JSON.parse(fs.readFileSync(p, "utf8")); }catch(e){ v = false; } prueba(`${f} es JSON válido`, v); }
}
const dj = fs.readFileSync(path.join(RAIZ, "datos.js"), "utf8");
let lista = []; try{ lista = JSON.parse(dj.slice(dj.indexOf("{"), dj.lastIndexOf("}") + 1)).listado; }catch(e){}
prueba("datos.js trae más de 1.000 licitaciones", lista.length > 1000);

console.log(`Pruebas de Apto: ${ok} bien, ${malas.length} mal.`);
if(malas.length){ console.log("Fallaron:\n  - " + malas.join("\n  - ")); process.exit(1); }
