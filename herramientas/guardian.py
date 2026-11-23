"""Guardián de lo que publica Apto: detiene la publicación si un archivo público trae datos personales
(correos, teléfonos de contacto o RUT de personas) o si un archivo de datos está roto.
Lo usan el hook pre-commit del PC y GitHub Actions antes de subir datos.
Distingue falsos positivos comunes de Mercado Público: ISBN, códigos BIP, números de repuesto, RUT de empresas y organismos.
  python herramientas/guardian.py [archivos...]   (sin archivos revisa todos los publicables)"""
import os, re, sys, json, glob

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORREO = re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?", re.I)
# Números que se publican a propósito (contacto de Apto). Cualquier otro teléfono sigue bloqueado.
TELEFONOS_PUBLICOS = {"56982944893"}
CORREOS_OK = re.compile(r"@(empresa|ejemplo)\.cl$|@users\.noreply\.github\.com$|noreply@anthropic\.com$|^apto\.reportes@gmail\.com$", re.I)
TELEFONO = re.compile(r"(?:\+\s?56[\s-]?9[\s-]?\d{4}[\s-]?\d{4})|(?:(?:fono|tel[eé]fono|tel\.|cel(?:ular)?|whatsapp|wsp|contacto)\s*:?\s*\(?\+?\d[\d\s\-()]{7,})", re.I)
RUT = re.compile(r"(?<![\d.])(\d{1,2})\.(\d{3})\.(\d{3})-[\dkK](?![\d])")
PUBLICABLES = ["*.json", "*.js", "*.html", "datos-abiertos/*.jsonl"]


def revisar(ruta):
    problemas = []
    texto = open(ruta, encoding="utf8", errors="replace").read()
    if ruta.endswith(".json"):
        try:
            json.loads(texto)
        except Exception as e:
            problemas.append(f"JSON roto: {e}")
    if ruta.endswith(".jsonl"):
        for i, l in enumerate(texto.splitlines(), 1):
            if l.strip():
                try:
                    json.loads(l)
                except Exception:
                    problemas.append(f"línea {i}: JSON roto"); break
    for m in CORREO.finditer(texto):
        if not CORREOS_OK.search(m.group(0)):
            problemas.append(f"correo: {m.group(0)[:3]}…")
    for m in TELEFONO.finditer(texto):
        if re.sub(r"\D", "", m.group(0)) in TELEFONOS_PUBLICOS:
            continue   # el WhatsApp de contacto que Gonzalo autorizó publicar (21-11-2026)
        problemas.append("teléfono de contacto: …" + texto[max(0, m.start() - 15):m.start()].replace("\n", " ")[-15:] + "[número]")
    for m in RUT.finditer(texto):
        n = int(m.group(1) + m.group(2) + m.group(3))
        antes = texto[max(0, m.start() - 20):m.start()].upper()
        if n < 30_000_000 and "BIP" not in antes and "FRPD" not in antes and "ISBN" not in antes:
            problemas.append("RUT de persona: …" + antes[-15:] + "[RUT]")
    return problemas


def main(archivos):
    if not archivos:
        archivos = [f for p in PUBLICABLES for f in glob.glob(os.path.join(RAIZ, p))]
    malos = {}
    for f in archivos:
        if os.path.exists(f) and os.path.getsize(f) < 200 * 1024 * 1024:
            p = revisar(f)
            if p:
                malos[os.path.relpath(f, RAIZ)] = p
    if malos:
        print("GUARDIÁN: hay datos que no deben publicarse o archivos rotos:")
        for f, p in malos.items():
            print(f"  {f}: {len(p)} problema(s), p. ej. {p[0]}")
        sys.exit(1)
    print(f"Guardián: {len(archivos)} archivos revisados, sin datos personales ni archivos rotos.")


if __name__ == "__main__":
    main(sys.argv[1:])
