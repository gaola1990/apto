"""Envía los avisos que armó herramientas/avisos.js, desde el Gmail de Apto, y registra el envío en Supabase.
Solo envía si ENVIAR=1 (si no, muestra cuántos enviaría: modo prueba). Secretos (GitHub → Settings → Secrets → Actions):
  SUPABASE_URL, SUPABASE_SERVICE_KEY, GMAIL_USUARIO, GMAIL_CLAVE_APP. El cliente no configura nada.
Límites: hasta 400 correos por corrida (Gmail permite ~500 al día) y una pausa entre correos."""
import os, sys, json, time, smtplib, tempfile, datetime, urllib.request
from email.message import EmailMessage
from email.utils import formataddr

SALIDA = os.environ.get("AVISOS_SALIDA") or os.path.join(tempfile.gettempdir(), "apto-avisos.json")
URL, KEY = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_KEY", "")
USUARIO, CLAVE = os.environ.get("GMAIL_USUARIO", ""), os.environ.get("GMAIL_CLAVE_APP", "")
SITIO = "https://gaola1990.github.io/apto/"


def registrar(x):
    ahora = datetime.datetime.now(datetime.timezone.utc).isoformat()
    datos = {"ultimo_aviso": ahora, "avisados": x.get("avisados_nuevo", [])} if x["tipo"] == "novedades" else {"ultimo_recuerdo": ahora}
    datos["plantillas"] = x.get("plantillas_nuevo", [])  # para no repetir la misma plantilla
    r = urllib.request.Request(f"{URL}/rest/v1/cuentas?user_id=eq.{x['user_id']}", json.dumps(datos).encode(), method="PATCH",
                               headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Prefer": "return=minimal"})
    urllib.request.urlopen(r, timeout=30)


def main():
    lista = json.load(open(SALIDA, encoding="utf8")) if os.path.exists(SALIDA) else []
    if os.environ.get("ENVIAR") != "1":
        print(f"Modo prueba: se enviarían {len(lista)} avisos (no se envió nada). Para enviar de verdad: ENVIAR=1.")
        return
    if not (USUARIO and CLAVE and URL and KEY):
        sys.exit("Faltan secretos: GMAIL_USUARIO, GMAIL_CLAVE_APP, SUPABASE_URL o SUPABASE_SERVICE_KEY")
    enviados = 0
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=60) as s:
        s.starttls(); s.login(USUARIO, CLAVE)
        for x in lista[:400]:
            m = EmailMessage()
            m["From"] = formataddr(("Apto", USUARIO)); m["To"] = x["email"]; m["Subject"] = x["asunto"]
            baja = x["html"].split('baja.html?t=')[1].split('"')[0] if 'baja.html?t=' in x["html"] else ""
            if baja:
                m["List-Unsubscribe"] = f"<{SITIO}baja.html?t={baja}>"
            m.set_content(x["texto"]); m.add_alternative(x["html"], subtype="html")
            try:
                s.send_message(m); registrar(x); enviados += 1
            except Exception as e:
                print("No se pudo enviar un aviso:", str(e)[:120])
            time.sleep(2)
    os.remove(SALIDA)  # contiene correos: no se deja en el servidor
    print(f"Avisos enviados: {enviados} de {len(lista)}")


if __name__ == "__main__":
    main()
