# AudioMetro — Posada en marxa de Supabase (Fases 1–3)

Objectiu: que TMB → Supabase → navegador funcioni, i que **comenci a guardar històric des del primer minut**.
Decisions preses: pla **Free**; taules `stations`, `lines`, `arrivals`; **sense** `snapshots_raw`; històric des del dia 1; el frontend manté `network-data.js` (la xarxa visual no es migra encara).

## Requisits previs
- `network.json` amb el camp `codes` → si no el té: `node fetch-network.mjs`.

## Fase 1 · Esquema
1. Supabase → **SQL Editor** → enganxa i executa `supabase/schema.sql`.
   Crea `stations`, `lines`, `arrivals`, la RLS de lectura i les funcions `get_upcoming` / `get_arrivals`.
2. Carrega la xarxa estàtica a Supabase:
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
   node supabase/seed-static.mjs
   ```

## Fase 2 · Ingestió (Edge Function + Cron)
1. Secrets (Project Settings → Edge Functions → Secrets): `TMB_APP_ID`, `TMB_APP_KEY`, `IMETRO_URL`
   (la mateixa URL amb què vas obtenir `imetro-sample.json`).
2. Desplega la funció:
   ```bash
   supabase functions deploy ingest-imetro --no-verify-jwt
   ```
3. Activa les extensions **pg_cron** i **pg_net** (Database → Extensions).
4. SQL Editor → executa `supabase/cron.sql` (substitueix `<PROJECT_REF>` i `<SERVICE_ROLE_KEY>`).
5. Comprova: al cap de 2 min, `select count(*) from arrivals;` ha de créixer.
   A partir d'aquí, **la memòria històrica ja s'està enregistrant**.

## Fase 3 · Frontend
1. Omple `supabase-config.js` amb `SUPABASE_URL` i `SUPABASE_ANON_KEY` (Project Settings → API).
2. Obre `mapa-hibrid.html`. Prem **Activa l'àudio**.
   El panell "Dades reals (TMB)" mostrarà *"Supabase a punt (N arribades)"* i sonarà amb dades reals,
   refrescant cada 2 min. Si Supabase no està configurat, cau al snapshot local automàticament.

## Notes
- Credencials TMB: només als secrets de l'Edge Function. El navegador fa servir l'anon key (lectura, RLS).
- `fetch-imetro.mjs` queda com a eina de proves; ja no cal tenir-lo corrent.
- Retenció/rollups i reproducció històrica (`get_arrivals`) → fases següents; l'esquema ja hi està preparat.
