"""Compra Ágil en Apto, con los datos abiertos mensuales de ChileCompra (cotizaciones del mes anterior).
ChileCompra no publica las Compras Ágiles abiertas en la API; sí publica cada mes todas las cotizaciones del mes anterior:
https://transparenciachc.blob.core.windows.net/trnspchc/COT_{año}-{mes}.zip
Este script baja el último mes disponible, lo procesa EN ESTE PC con DuckDB y publica solo cifras agregadas por clase
de producto (código ONU de 6 dígitos): cuántas solicitudes hubo, cuántas cotizaciones recibe cada una, cuánto ganan
las MiPymes, montos típicos y qué organismos compran más. NO se publica ningún dato personal (contactos, teléfonos,
correos, nombres de proveedores ni RUT): esas columnas ni siquiera se leen.
  python compra_agil.py [--mes 2026-10]"""
import os, json, argparse, datetime, urllib.request, zipfile
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # raíz del repositorio (GitHub Actions)

DIR = os.environ.get("CA_TMP") or os.path.join(RAIZ, ".tmp-compra-agil")  # temporal: no se publica
SALIDA = os.path.join(RAIZ, "compra_agil.json")
URL = "https://transparenciachc.blob.core.windows.net/trnspchc/COT_{}.zip"


def bajar(mes):
    os.makedirs(DIR, exist_ok=True)
    z = os.path.join(DIR, f"COT_{mes}.zip")
    if not os.path.exists(z):
        urllib.request.urlretrieve(URL.format(mes), z)
    salidas = []
    with zipfile.ZipFile(z) as f:
        for n in f.namelist():
            if not n.lower().endswith(".csv"):
                continue
            dest = os.path.join(DIR, n[:-4] + "_utf8.csv")
            if not os.path.exists(dest):  # el archivo viene en Windows-1252 con bytes sueltos: se pasa a UTF-8
                with f.open(n) as src, open(dest, "w", encoding="utf8", newline="") as out:
                    while True:
                        b = src.read(8 << 20)
                        if not b:
                            break
                        out.write(b.decode("cp1252", errors="replace"))
            salidas.append(dest)
    return salidas


def ultimo_mes():
    hoy = datetime.date.today().replace(day=1)
    for k in range(1, 4):
        m = (hoy - datetime.timedelta(days=28 * k)).strftime("%Y-%m")
        try:
            urllib.request.urlopen(urllib.request.Request(URL.format(m), method="HEAD"), timeout=60)
            return m
        except Exception:
            continue
    raise SystemExit("No hay archivos de Compra Ágil disponibles")


def main(mes=None):
    import duckdb
    mes = mes or ultimo_mes()
    csvs = bajar(mes)
    con = duckdb.connect()
    lista = "[" + ",".join("'" + c.replace("\\", "/") + "'" for c in csvs) + "]"
    # solo columnas no personales
    con.execute(f"""
      create view cot as select
        "CodigoCotizacion" as solicitud, "NombreOOPP" as organismo, trim("Region") as region,
        cast("CodigoProducto" as varchar) as producto, "NombreProductoGenerico" as nombre_producto,
        try_cast("CantidadSolicitada" as double) as cantidad, "Estado" as estado, "Tamano" as tamano,
        lower("ProveedorSeleccionado") = 'si' as gano, try_cast("MontoTotal" as double) as monto
      from read_csv({lista}, delim=';', quote='"', header=true, all_varchar=true, ignore_errors=true)
    """)
    total = con.execute("select count(distinct solicitud), count(*) from cot").fetchone()
    clases = con.execute("""
      with por_sol as (
        select left(producto, 6) as clase, solicitud, any_value(organismo) as organismo, any_value(region) as region,
               count(*) as cotizaciones, bool_or(gano) as adjudicada,
               max(case when gano then tamano end) as tamano_ganador, max(case when gano then monto end) as monto_ganador
        from cot where producto is not null and length(producto) >= 6
        group by 1, 2)
      select clase, count(*) as solicitudes, round(avg(cotizaciones), 1) as cotizaciones_prom,
             round(100.0 * avg(case when adjudicada then 1 else 0 end)) as pct_adjudicadas,
             round(100.0 * sum(case when tamano_ganador = 'MiPyme' then 1 else 0 end) / nullif(sum(case when adjudicada then 1 else 0 end), 0)) as pct_mipyme,
             round(median(monto_ganador)) as monto_mediano
      from por_sol group by 1 having count(*) >= 3 order by solicitudes desc
    """).fetchall()
    tops = con.execute("""
      select clase, organismo, n from (
        select left(producto, 6) as clase, organismo, count(distinct solicitud) as n,
               row_number() over (partition by left(producto, 6) order by count(distinct solicitud) desc) as r
        from cot where producto is not null group by 1, 2) where r <= 3
    """).fetchall()
    regiones = con.execute("""
      select clase, region, n from (
        select left(producto, 6) as clase, region, count(distinct solicitud) as n,
               row_number() over (partition by left(producto, 6) order by count(distinct solicitud) desc) as r
        from cot where producto is not null and region is not null group by 1, 2) where r <= 3
    """).fetchall()
    top_org, top_reg = {}, {}
    for c, o, n in tops:
        top_org.setdefault(c, []).append([o, n])
    for c, r, n in regiones:
        top_reg.setdefault(c, []).append([r, n])
    out = {c: {"s": s, "cot": cp, "adj": pa, "mipyme": pm, "monto": mm, "org": top_org.get(c, []), "reg": top_reg.get(c, [])}
           for c, s, cp, pa, pm, mm in clases}
    json.dump({"mes": mes, "fuente": "ChileCompra, datos abiertos de Compra Ágil (agregados; sin datos personales)",
               "solicitudes": total[0], "cotizaciones": total[1], "clases": out},
              open(SALIDA, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    print(f"compra_agil.json ({mes}): {total[0]} solicitudes, {total[1]} cotizaciones, {len(out)} clases | "
          f"{os.path.getsize(SALIDA) // 1024} KB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mes", default=None)
    main(ap.parse_args().mes)
