// Baja de avisos con un clic desde el correo (sin iniciar sesión): usa el token secreto del enlace.
(async function(){
  const msg = document.getElementById("msg");
  const t = new URLSearchParams(location.search).get("t") || "";
  if(!/^[0-9a-f-]{36}$/i.test(t)){ msg.textContent = "El enlace no es válido."; return; }
  try{
    const r = await fetch("https://izxhfajflqmfhgligblu.supabase.co/rest/v1/rpc/dar_de_baja", {method: "POST",
      headers: {"apikey": "sb_publishable_bhXkro91FvseczW7qIU0bw_W2psbU40", "Content-Type": "application/json"}, body: JSON.stringify({token: t})});
    const ok = r.ok && (await r.json()) === true;
    msg.textContent = ok ? "Listo: ya no recibirás avisos por correo. Si cambias de opinión, puedes activarlos de nuevo en Mi cuenta."
                         : "No encontramos ese enlace. Puede que ya te hayas dado de baja.";
  }catch(e){ msg.textContent = "No pudimos procesar la baja ahora. Intenta de nuevo en unos minutos."; }
})();
