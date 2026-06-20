# AudioMetro — Fase 2: Edge Function `ingest-imetro`

Objectiu: que TMB → `arrivals` funcioni i **comenci a guardar històric**. Validem la funció
**manualment** abans d'activar el cron.

## 1. Estructura de carpetes (exacta)

```
AudioMetro/
└── supabase/
    ├── config.toml          ← el crea `supabase init` (si encara no hi és)
    ├── schema.sql           ← ja executat
    ├── cron.sql             ← NO executar encara
    └── functions/
        └── ingest-imetro/
            └── index.ts     ← la funció (ja creada)
```

## 2. Instal·lar i enllaçar la CLI (un cop)

```bash
npm install -g supabase            # o: brew install supabase/tap/supabase
supabase login
cd /ruta/al/projecte/AudioMetro
supabase init                      # només si no existeix supabase/config.toml
supabase link --project-ref lvxwomfnvyuhjyssihrm
```

## 3. Secrets (les credencials TMB viuen NOMÉS aquí)

Endpoint confirmat per la sonda: base `https://api.tmb.cat/v1/itransit/metro/estacions`
(la funció hi afegeix sola `?estacions=<tots els codis>`).

```bash
supabase secrets set \
  TMB_APP_ID=<your_tmb_app_id> \
  TMB_APP_KEY=<your_tmb_app_key> \
  IMETRO_URL="https://api.tmb.cat/v1/itransit/metro/estacions"
```
(o bé Dashboard → Project Settings → Edge Functions → Secrets → afegir els tres).

> `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` ja existeixen automàticament dins la funció.

## 3b. Codis d'estació per a la funció (un cop)

La funció necessita els 304 codis per construir `?estacions=`. Els llegeix de la taula `stations`.
**Carrega-la un cop** (no afecta el frontend, que segueix amb `network-data.js`):
```bash
SUPABASE_URL=https://lvxwomfnvyuhjyssihrm.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
node supabase/seed-static.mjs
```
Alternativa sense taula: defineix el secret `IMETRO_CODES="120,121,…"` amb tots els codis.

## 4. Desplegar

```bash
supabase functions deploy ingest-imetro --no-verify-jwt
```
`--no-verify-jwt` permet provar-la amb un simple `curl` sense token (ho podrem restringir més endavant).

## 5. Provar MANUALMENT (abans del cron)

**5.1 — Dry run (no escriu res, només parseja):**
```bash
curl "https://lvxwomfnvyuhjyssihrm.supabase.co/functions/v1/ingest-imetro?dry=1"
```
Resposta esperada (exemple):
```json
{ "ok": true, "dry": true,
  "captured_at": "2026-…Z",
  "linies": 11, "estacions": 300+, "arribades": 800+,
  "sample": [ { "station_code": 120, "line": "L1", "sentit": 1,
               "codi_servei": "101", "t_arribada": "…", "service_date": "…" }, … ] }
```

> ⚠️ **Comprovació important:** mira `linies` i `estacions`. Han de ser ~11 línies i centenars
> d'estacions (tota la xarxa). Si surt `linies: 1, estacions: 1`, l'`IMETRO_URL` és un endpoint
> **per estació** (com el sample, que només tenia la 120) i necessitem la variant de **tota la xarxa**.
> Si és el cas, atura't aquí i ho resolem abans de continuar.

**5.2 — Execució real (escriu a `arrivals`):**
```bash
curl -X POST "https://lvxwomfnvyuhjyssihrm.supabase.co/functions/v1/ingest-imetro"
```
Resposta: `{ "ok": true, "linies":…, "arribades":…, "written":… }`

**5.3 — Verificar a Supabase (SQL Editor):**
```sql
select count(*) as files, max(captured_at) as ultim from arrivals;
select station_code, line, sentit, desti, t_arribada
from arrivals order by captured_at desc, t_arribada limit 10;
```

**5.4 — Comprovar la deduplicació:** torna a executar `5.2` un parell de cops seguits.
El `count(*)` **no s'ha de disparar**: els mateixos trens s'actualitzen (mateix
`station_code+sentit+codi_servei+service_date`), no es dupliquen. Només creix amb trens nous.

## 6. Quan funcioni

Avisa'm i passem a:
- **Cron** (`cron.sql`) per automatitzar cada 2 min → la memòria històrica s'omple sola.
- **Fase 3**: el frontend ja està preparat (`supabase-config.js` omplert) per consumir `get_upcoming`.

No executis `cron.sql` fins que 5.1–5.4 estiguin verificats.
