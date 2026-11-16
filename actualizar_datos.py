"""Descarga las licitaciones activas de Mercado Publico y guarda una copia local
(datos.js) que la app usa como respaldo cuando la API no responde.

Uso:  python actualizar_datos.py [ticket]
Sin IA y sin dependencias externas. El ticket por defecto es el de ejemplo que
publica ChileCompra en su documentacion; para uso real hay que pedir uno propio
en https://api.mercadopublico.cl (gratis).
"""
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

TICKET_EJEMPLO = "F8537A18-6766-4DEF-9E59-426B4FEE2844"
URL = "https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?estado=activas&ticket={}"


def main():
    ticket = sys.argv[1] if len(sys.argv) > 1 else TICKET_EJEMPLO
    with urllib.request.urlopen(URL.format(ticket), timeout=90) as r:
        data = json.loads(r.read().decode("utf-8"))
    listado = data.get("Listado") or []
    if not listado:
        sys.exit("La API no devolvio licitaciones: %s" % str(data)[:200])
    filas = [[x.get("CodigoExterno"), x.get("Nombre"), x.get("FechaCierre")] for x in listado]
    copia = {"fecha": datetime.now().isoformat(timespec="minutes"), "listado": filas}
    destino = Path(__file__).with_name("datos.js")
    destino.write_text("window.SNAPSHOT=" + json.dumps(copia, ensure_ascii=False) + ";", encoding="utf-8")
    print("Guardadas %d licitaciones activas en %s" % (len(filas), destino.name))


if __name__ == "__main__":
    main()
