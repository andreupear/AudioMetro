// ════════════════════════════════════════════════════════════════════
// AudioMetro · Edge Function "ingest-imetro" (Fase 2)
// Consulta TMB iMetro (TOTA la xarxa en una crida) i fa UPSERT a `arrivals`.
// Confirmat: 1 crida amb tots els codis → 11 línies / ~338 estacions / ~96 KB.
//
// Mode de prova:  ?dry=1  → parseja i retorna mostra, sense escriure a la BD.
//
// Secrets (Project Settings → Edge Functions → Secrets):
//   TMB_APP_ID, TMB_APP_KEY
//   IMETRO_URL = https://api.tmb.cat/v1/itransit/metro/estacions   (base, SENSE ?estacions)
//   IMETRO_CODES (opcional) = "120,121,…"  ← només si NO carregues la taula stations
//   (SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY ja hi són per defecte.)
//
// Codis d'estació: es llegeixen de la taula `stations` (recomanat: executa seed-static.mjs);
// si la taula és buida, s'usa el secret IMETRO_CODES.
//
// Desplegament:  supabase functions deploy ingest-imetro --no-verify-jwt
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function parseImetro(raw: any) {
  const capturedMs = raw?.timestamp ?? Date.now();
  const rows: Record<string, unknown>[] = [];
  for (const L of raw?.linies ?? []) {
    const line = L?.nom_linia;
    for (const e of L?.estacions ?? []) {
      const station_code = e?.codi_estacio;
      const sentit = e?.id_sentit;
      for (const tr of e?.linies_trajectes ?? []) {
        const desti = tr?.desti_trajecte;
        for (const t of tr?.propers_trens ?? []) {
          if (station_code == null || t?.temps_arribada == null) continue;
          const service_date = new Date(t.temps_arribada)
            .toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
          rows.push({
            station_code, line, sentit, desti,
            codi_servei: String(t.codi_servei),
            t_arribada: new Date(t.temps_arribada).toISOString(),
            captured_at: new Date(capturedMs).toISOString(),
            service_date,
          });
        }
      }
    }
  }
  return { capturedMs, rows };
}

Deno.serve(async (req) => {
  try {
    const dry = new URL(req.url).searchParams.has("dry");
    const ID = Deno.env.get("TMB_APP_ID");
    const KEY = Deno.env.get("TMB_APP_KEY");
    const BASE = Deno.env.get("IMETRO_URL");
    if (!ID || !KEY || !BASE) {
      return json({ error: "Falten secrets TMB_APP_ID / TMB_APP_KEY / IMETRO_URL" }, 500);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) codis d'estació: de la taula stations, o del secret IMETRO_CODES
    let codes: (number | string)[] = [];
    const { data: st } = await sb.from("stations").select("code");
    if (st && st.length) codes = st.map((r: any) => r.code);
    else if (Deno.env.get("IMETRO_CODES")) codes = Deno.env.get("IMETRO_CODES")!.split(",").map(s => s.trim()).filter(Boolean);
    if (!codes.length) {
      return json({ error: "Sense codis d'estació: executa seed-static.mjs (taula stations) o defineix el secret IMETRO_CODES" }, 500);
    }

    // 2) crida única a TMB amb tots els codis
    const sep = BASE.includes("?") ? "&" : "?";
    const url = `${BASE}${sep}estacions=${codes.join(",")}&app_id=${ID}&app_key=${KEY}`;
    const res = await fetch(url);
    if (!res.ok) return json({ error: `TMB HTTP ${res.status}`, body: (await res.text()).slice(0, 300) }, 502);
    const raw = await res.json();

    // 3) parseja
    const { capturedMs, rows } = parseImetro(raw);
    const summary = {
      captured_at: new Date(capturedMs).toISOString(),
      codis_enviats: codes.length,
      linies: (raw?.linies ?? []).length,
      estacions: (raw?.linies ?? []).reduce((a: number, L: any) => a + (L?.estacions?.length ?? 0), 0),
      arribades: rows.length,
    };

    if (dry) return json({ ok: true, dry: true, ...summary, sample: rows.slice(0, 6) });

    // 4) UPSERT deduplicat (per blocs)
    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await sb.from("arrivals")
        .upsert(chunk, { onConflict: "station_code,sentit,codi_servei,service_date" });
      if (error) return json({ error: "DB: " + error.message, written }, 500);
      written += chunk.length;
    }
    return json({ ok: true, ...summary, written });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { "Content-Type": "application/json" },
  });
}
