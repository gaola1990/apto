"""Competencia histórica para Apto: cuántas ofertas reciben las licitaciones, por tipo de producto y por comprador.
Fuente: API pública de Mercado Público (licitaciones adjudicadas, campo Adjudicacion.NumeroOferentes).
1. bajar: agrega a datos-abiertos/adjudicadas.jsonl las adjudicadas de los últimos días que falten (con tiempo máximo).
2. resumir: escribe competencia.json con cifras agregadas (sin datos de proveedores).
Lo corre GitHub Actions; también sirve en el PC.   python herramientas/competencia.py [--dias 3] [--minutos 15] [--codigos archivo.txt]"""
import os, json, time, argparse, datetime, statistics, urllib.request
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json"
TICKET = os.environ.get("MP_TICKET") or "F8537A18-6766-4DEF-9E59-426B4FEE2844"
ADJ = os.path.join(RAIZ, "datos-abiertos", "adjudicadas.jsonl")
SALIDA = os.path.join(RAIZ, "competencia.json")


def get(q, intentos=4):
    for i in range(intentos):
        try:
            return json.loads(urllib.request.urlopen(f"{API}?{q}&ticket={TICKET}", timeout=90).read())
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def ya_bajadas():
    if not os.path.exists(ADJ):
        return set()
    return {json.loads(l)["codigo"] for l in open(ADJ, encoding="utf8") if l.strip()}


def bajar(dias, minutos, codigos_extra=()):
    os.makedirs(os.path.dirname(ADJ), exist_ok=True)
    hechas = ya_bajadas()
    pendientes = list(codigos_extra)
    hoy = datetime.date.today()
    for k in range(1, dias + 1):
        f = (hoy - datetime.timedelta(days=k)).strftime("%d%m%Y")
        r = get(f"fecha={f}&estado=adjudicada")
        pendientes += [x["CodigoExterno"] for x in (r or {}).get("Listado", [])]
    pendientes = [c for c in dict.fromkeys(pendientes) if c not in hechas]
    fin, n = time.time() + minutos * 60, 0
    with open(ADJ, "a", encoding="utf8") as out:
        for c in pendientes:
            if time.time() > fin:
                break
            r = get("codigo=" + c, intentos=3)
            x = ((r or {}).get("Listado") or [None])[0]
            if x and (x.get("Adjudicacion") or {}).get("NumeroOferentes") is not None:
                items = (x.get("Items") or {}).get("Listado", [])
                comp = x.get("Comprador") or {}
                out.write(json.dumps({
                    "codigo": c, "fecha": ((x.get("Adjudicacion") or {}).get("Fecha") or "")[:10],
                    "oferentes": x["Adjudicacion"]["NumeroOferentes"], "tipo": x.get("Tipo"),
                    "clases": sorted({str(i.get("CodigoCategoria") or "")[:6] for i in items if i.get("CodigoCategoria")}),
                    "organismo": comp.get("NombreOrganismo"), "region": (comp.get("RegionUnidad") or "").strip()},
                    ensure_ascii=False) + "\n")
                n += 1
            time.sleep(0.5 if os.environ.get("MP_TICKET") else 1.5)
    print(f"adjudicadas.jsonl: {n} nuevas ({len(pendientes) - n} pendientes para la próxima corrida)")


def resumir():
    filas = [json.loads(l) for l in open(ADJ, encoding="utf8") if l.strip()] if os.path.exists(ADJ) else []
    por_clase, por_org = defaultdict(list), defaultdict(list)
    for f in filas:
        if not isinstance(f.get("oferentes"), int):
            continue
        for c in f["clases"]:
            por_clase[c].append(f["oferentes"])
        if f.get("organismo"):
            por_org[f["organismo"]].append(f["oferentes"])
    resumen = lambda v: {"n": len(v), "med": statistics.median(v), "pocas": round(100 * sum(1 for x in v if x <= 2) / len(v))}
    out = {"fecha": datetime.date.today().isoformat(), "licitaciones": len(filas),
           "fuente": "API pública de Mercado Público (NumeroOferentes de licitaciones adjudicadas)",
           "clases": {c: resumen(v) for c, v in por_clase.items() if len(v) >= 3},
           "organismos": {o: resumen(v) for o, v in por_org.items() if len(v) >= 3}}
    json.dump(out, open(SALIDA, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    print(f"competencia.json: {len(filas)} licitaciones, {len(out['clases'])} clases y {len(out['organismos'])} compradores con 3 o más")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dias", type=int, default=3)
    ap.add_argument("--minutos", type=int, default=15)
    ap.add_argument("--codigos", default=None, help="archivo con códigos de licitaciones adjudicadas a agregar")
    ap.add_argument("--solo-resumir", action="store_true")
    a = ap.parse_args()
    if not a.solo_resumir:
        extra = [l.strip() for l in open(a.codigos, encoding="utf8") if l.strip()] if a.codigos else []
        bajar(a.dias, a.minutos, extra)
    resumir()
