"""Actualización de datos de Apto en GitHub Actions (no necesita el PC de Gonzalo ni IA).
1. datos.js: licitaciones abiertas de la API pública de Mercado Público.
2. detalles.json: descripción, productos y categorías de las abiertas (incremental, con tiempo máximo).
3. datos-abiertos/descripciones.jsonl: descripciones reales de productos, para que el diccionario aprenda.
El ticket propio se guarda como secreto del repositorio (MP_TICKET); si no está, se usa el ticket de ejemplo público.
Sin dependencias externas.  python herramientas/nube.py [--minutos 40]"""
import os, re, sys, json, time, argparse, unicodedata, urllib.request, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guardian import CORREO, TELEFONO


def limpiar(t):
    """Quita correos y teléfonos de contacto de los textos de compradores antes de guardarlos."""
    return TELEFONO.sub(" ", CORREO.sub(" ", t or ""))

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json"
TICKET = os.environ.get("MP_TICKET") or "F8537A18-6766-4DEF-9E59-426B4FEE2844"
VACIAS = set(("para con por del los las una uno que segun adquisicion compra servicio servicios suministro contratacion "
              "licitacion publica municipalidad comuna region hospital cesfam establecimiento unidad anual mensual meses "
              "bases tecnicas segun otros varios diversos general generales").split())


def nrm(s):
    s = unicodedata.normalize("NFKD", str(s or "").lower()).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", s).split())


def compacto(texto, maximo=60):
    vistas = []
    for w in nrm(texto).split():
        if len(w) >= 4 and w not in VACIAS and not w.isdigit() and w not in vistas:
            vistas.append(w)
    return " ".join(vistas[:maximo])


def get(q, intentos=6):
    for i in range(intentos):
        try:
            return json.loads(urllib.request.urlopen(f"{API}?{q}&ticket={TICKET}", timeout=90).read())
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def main(minutos):
    j = get("estado=activas")
    ruta_datos = os.path.join(RAIZ, "datos.js")
    if j and j.get("Listado"):
        filas = [[x.get("CodigoExterno"), x.get("Nombre"), x.get("FechaCierre")] for x in j["Listado"]]
        open(ruta_datos, "w", encoding="utf8").write("window.SNAPSHOT=" + json.dumps(
            {"fecha": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).isoformat(timespec="minutes")[:16],
             "listado": filas}, ensure_ascii=False) + ";")
        print(f"datos.js: {len(filas)} licitaciones abiertas")
    else:
        t = open(ruta_datos, encoding="utf8").read()
        filas = json.loads(t[t.index("{"):t.rindex("}") + 1])["listado"]
        print("La API no respondió el listado; se mantiene la copia anterior.")
    activas = {c: cierre for c, _, cierre in filas}
    ruta_det = os.path.join(RAIZ, "detalles.json")
    det = json.load(open(ruta_det, encoding="utf8")).get("items", {}) if os.path.exists(ruta_det) else {}
    det = {c: v for c, v in det.items() if c in activas}
    faltan = sorted((c for c in activas if c not in det), key=lambda c: activas[c] or "9999")
    # las que ya tienen detalle pero aún no la región (se agregó el 2026-11-20): se completan de a poco, después de las nuevas
    faltan += sorted((c for c in activas if c in det and "r" not in det[c]), key=lambda c: activas[c] or "9999")
    os.makedirs(os.path.join(RAIZ, "datos-abiertos"), exist_ok=True)
    ruta_desc = os.path.join(RAIZ, "datos-abiertos", "descripciones.jsonl")
    fin, nuevas = time.time() + minutos * 60, 0
    with open(ruta_desc, "a", encoding="utf8") as fd:
        for c in faltan:
            if time.time() > fin:
                break
            r = get("codigo=" + c, intentos=3)
            x = ((r or {}).get("Listado") or [None])[0]
            if x:
                items = (x.get("Items") or {}).get("Listado", [])
                det[c] = {"t": compacto((x.get("Descripcion") or "") + " " + " ".join((i.get("NombreProducto") or "") + " " + (i.get("Descripcion") or "") for i in items)),
                          "c": sorted({str(i.get("CodigoCategoria") or "")[:6] for i in items if i.get("CodigoCategoria")}),
                          "m": x.get("MontoEstimado") or 0,
                          "r": region(((x.get("Comprador") or {}).get("RegionUnidad") or "")),  # para mostrar primero las de su región
                          "o": ((x.get("Comprador") or {}).get("NombreOrganismo") or "").strip()[:80]}
                for i in items:
                    if i.get("CodigoProducto"):
                        fd.write(json.dumps({"cat": str(i.get("CodigoCategoria") or "")[:6], "prod": str(i["CodigoProducto"]),
                                             "t": limpiar((i.get("NombreProducto") or "") + " " + (i.get("Descripcion") or ""))[:400]}, ensure_ascii=False) + "\n")
                nuevas += 1
            time.sleep(0.5 if os.environ.get("MP_TICKET") else 1.5)
    json.dump({"fecha": datetime.datetime.now().isoformat(timespec="minutes"), "items": det}, open(ruta_det, "w", encoding="utf8"),
              ensure_ascii=False, separators=(",", ":"))
    print(f"detalles.json: {nuevas} nuevas | con detalle {len(det)} de {len(activas)} abiertas")


def region(g):
    """'Región de la Araucanía ' -> 'Araucanía' (los mismos nombres que usa el perfil del vendedor)."""
    g = " ".join(str(g).split())
    for p in ("Región de la ", "Región del ", "Región de ", "Región "):
        if g.startswith(p):
            g = g[len(p):]; break
    g = g.replace("Metropolitana de Santiago", "Metropolitana").replace("Libertador General Bernardo O´Higgins", "O'Higgins").replace("Libertador General Bernardo O'Higgins", "O'Higgins")
    g = g.replace("Aysén del General Carlos Ibáñez del Campo", "Aysén").replace("Magallanes y de la Antártica Chilena", "Magallanes").replace("Magallanes y de la Antártica", "Magallanes")
    return g[:1].upper() + g[1:]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutos", type=int, default=40)
    main(ap.parse_args().minutos)
