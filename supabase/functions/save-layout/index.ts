// ════════════════════════════════════════════════════════════════════
// AudioMetro · Edge Function "save-layout"
// Rep la calibració des de la pàgina admin i la desa a la taula `layout`.
// Autoritza per hash SHA-256 de la contrasenya admin (mateix que el frontend).
//
// Secret necessari:  ADMIN_HASH  = sha256 de la contrasenya admin
//   (per defecte, "audiometro": 577fc7e7e80a57f513a92c27f7ef62a61522b10284f43c2f59941158ebcd7f05)
//
// Desplegament:  supabase functions deploy save-layout --no-verify-jwt
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Mètode no permès" }, 405);
  try {
    const { hash, data } = await req.json();
    if (!hash || hash !== Deno.env.get("ADMIN_HASH")) return json({ error: "No autoritzat" }, 401);
    if (!data || typeof data !== "object") return json({ error: "Dades invàlides" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await sb.from("layout")
      .upsert({ id: 1, data, updated_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, estacions: Object.keys(data).length });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
