# AudioMetro

Sonificació en temps real de la xarxa de Metro de Barcelona com a organisme sonor.
Cada arribada de tren és un impuls (gest "neurona") que sona i encén la seva estació al mapa.
Dades reals de l'API iMetro de TMB, servides via Supabase.

🌐 **Producció:** audiometro.andreuperello.cat

---

## Estructura

```
index.html            ← l'aplicació (mapa + motor de so)
network-data.js       ← xarxa estàtica (línies, estacions, codis) per al navegador
supabase-config.js    ← URL + anon key de Supabase + config admin (públic)
mapa-oficial.jpg      ← imatge de fons del mapa
network.json          ← font de la xarxa (genera network-data.js)

docs/                 ← documentació de disseny i recerca
scripts/              ← eines de desenvolupament (Node)
  fetch-network.mjs   ← baixa la xarxa de TMB → network.json + network-data.js
  fetch-imetro.mjs    ← snapshot local d'arribades (proves)
  probe-imetro.mjs    ← sonda per validar l'endpoint iMetro
  build-schedule.mjs  ← GTFS → taula gtfs_schedule (fallback/GitHub Actions de refresh-gtfs)
  hash-password.mjs   ← genera el hash d'una contrasenya admin
supabase/             ← backend
  schema.sql          ← taules stations/lines/arrivals + RLS + RPCs
  layout.sql          ← taula de calibració compartida + RLS
  gtfs.sql            ← taula gtfs_schedule + get_upcoming() FUSIONAT (temps real + horari)
  cron.sql            ← cron: ingest-imetro (2 min) + refresh-gtfs (setmanal)
  seed-static.mjs     ← carrega stations/lines a Supabase
  functions/
    ingest-imetro/    ← Edge Function: TMB iMetro → arrivals (cada 2 min)
    refresh-gtfs/     ← Edge Function: ZIP GTFS → gtfs_schedule (setmanal, autònom)
    save-layout/      ← Edge Function: desa la calibració (reserva)
.github/workflows/
  refresh-gtfs.yml    ← alternativa robusta a refresh-gtfs (GitHub Actions setmanal)
assets/               ← fonts pesades del mapa (PDF/PNG, no versionades)
_arxiu/               ← prototips antics (no versionats)
```

## Desplegament (hosting estàtic)
Només cal servir aquests fitxers a l'arrel del domini:
`index.html`, `network-data.js`, `supabase-config.js`, `mapa-oficial.jpg`.
La resta de dades (arribades i calibració) vénen de Supabase en temps d'execució.

## Backend (Supabase) — posada en marxa
Vegeu `docs/SUPABASE-SETUP.md` i `supabase/FASE2-ingest.md`. Resum:
1. `supabase/schema.sql` i `supabase/layout.sql` al SQL Editor.
2. `node supabase/seed-static.mjs` (carrega stations/lines).
3. Secrets de l'Edge Function (`TMB_APP_ID`, `TMB_APP_KEY`, `IMETRO_URL`) i `supabase functions deploy ingest-imetro --no-verify-jwt`.
4. `supabase/cron.sql` (cada 2 min). A partir d'aquí s'enregistra l'històric.

## Eines locals (executar des de l'arrel)
```bash
node scripts/fetch-network.mjs          # regenera network.json + network-data.js
node scripts/hash-password.mjs "clau"   # hash per a la contrasenya admin
# L'horari de L9/L10 és autònom (Edge Function refresh-gtfs + cron). Vegeu docs/GTFS-AUTONOM.md.
```
Les credencials de TMB van a `tmb_credentials.txt` (NO es versiona).

## Mode admin
Botó "Admin" → login amb Supabase Auth (usuari + contrasenya).
Permet calibrar el mapa i publicar la calibració per a tothom ("Actualitza online").
Seguretat: vegeu `docs/SEGURETAT-ADMIN.md`.

## Avisos
- `tmb_credentials.txt` i la `service_role` key **mai** es versionen ni van al frontend.
- L'`anon key` de Supabase és pública (la protecció real és la RLS).
