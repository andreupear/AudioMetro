# AudioMetro

Sonificació en temps real de la xarxa de Metro de Barcelona com a organisme sonor.
Cada arribada de tren és un impuls (gest «neurona») que sona i encén la seva estació al mapa.
Dades reals de TMB (iMetro en temps real per a L1–L5/L11 i horari GTFS per a L9/L10), servides via Supabase.

🌐 **Producció:** [audiometro.andreuperello.cat](https://audiometro.andreuperello.cat)

Un projecte d'[Andreu Perelló](https://andreuperello.cat).

---

## Estructura

```
index.html            ← l'aplicació (mapa + motor de so + SEO + PWA)
network-data.js       ← xarxa estàtica (línies, estacions, codis) per al navegador
supabase-config.js    ← URL + anon key de Supabase + domini d'email admin (públic)
mapa-oficial.jpg      ← imatge de fons del mapa
network.json          ← font de la xarxa (genera network-data.js)

audiometro.png        ← icona / imatge de previsualització social
icon-192.png          ← icona PWA (192 px)
icon-512.png          ← icona PWA (512 px)
manifest.webmanifest  ← manifest PWA (instal·lable; nom curt "AudioMetro")
sw.js                 ← service worker (network-first; permet instal·lar a Android)
robots.txt            ← SEO: permet indexació + apunta al sitemap
sitemap.xml           ← SEO: mapa del lloc per a Google

docs/                 ← documentació de disseny i recerca
scripts/              ← eines de desenvolupament (Node)
  fetch-network.mjs   ← baixa la xarxa de TMB → network.json + network-data.js
  fetch-imetro.mjs    ← snapshot local d'arribades (proves)
  probe-imetro.mjs    ← sonda per validar l'endpoint iMetro
  build-schedule.mjs  ← GTFS → taula gtfs_schedule (el que fa servir GitHub Actions)
supabase/             ← backend
  schema.sql          ← taules stations/lines/arrivals + RLS + RPCs
  layout.sql          ← taula de calibració compartida + RLS
  gtfs.sql            ← taula gtfs_schedule + get_upcoming() FUSIONAT (temps real + horari)
  cron.sql            ← cron: ingest-imetro (2 min) + refresh-gtfs (setmanal)
  seed-static.mjs     ← carrega stations/lines a Supabase
  functions/
    ingest-imetro/    ← Edge Function: TMB iMetro → arrivals (cada 2 min)
    refresh-gtfs/     ← Edge Function: ZIP GTFS → gtfs_schedule (setmanal, autònom)
.github/workflows/
  refresh-gtfs.yml    ← refresc setmanal del GTFS (GitHub Actions, via Mobility Database)
assets/               ← fonts pesades del mapa (PDF/PNG, no versionades)
_arxiu/               ← prototips antics (no versionats)
```

## Desplegament (hosting estàtic)
Cal servir aquests fitxers a l'arrel del domini:
`index.html`, `network-data.js`, `supabase-config.js`, `mapa-oficial.jpg`,
`audiometro.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest`, `sw.js`,
`robots.txt`, `sitemap.xml`.
La resta de dades (arribades i calibració) vénen de Supabase en temps d'execució.

> El service worker requereix **HTTPS** (el subdomini ja en té) i que `sw.js`, el manifest
> i les icones siguin accessibles des de l'arrel.

## Backend (Supabase) — posada en marxa
Vegeu `docs/SUPABASE-SETUP.md` i `supabase/FASE2-ingest.md`. Resum:
1. `supabase/schema.sql`, `supabase/layout.sql` i `supabase/gtfs.sql` al SQL Editor.
2. `node supabase/seed-static.mjs` (carrega stations/lines).
3. Secrets de l'Edge Function (`TMB_APP_ID`, `TMB_APP_KEY`, `IMETRO_URL`) i
   `supabase functions deploy ingest-imetro --no-verify-jwt`.
4. `supabase/cron.sql` (cada 2 min). A partir d'aquí s'enregistra l'històric.

L'horari de L9/L10 és **autònom**: cada setmana, GitHub Actions (`refresh-gtfs.yml`) baixa el
GTFS més recent de la Mobility Database, construeix una setmana representativa i actualitza
`gtfs_schedule`. Vegeu `docs/GTFS-AUTONOM.md`.

## Eines locals (executar des de l'arrel)
```bash
node scripts/fetch-network.mjs          # regenera network.json + network-data.js
```
Les credencials de TMB van a `tmb_credentials.txt` (NO es versiona).

## Mode admin
Botó «Admin» → login amb **Supabase Auth** (usuari + contrasenya; l'usuari es crea a Supabase).
Permet calibrar el mapa i publicar la calibració per a tothom («Actualitza online»), que
s'escriu a la taula `layout` (la RLS només ho permet a l'admin autenticat).
Seguretat: vegeu `docs/SEGURETAT-ADMIN.md`.

## Instal·lació com a app (PWA)
L'app és instal·lable a **Android i iOS**. Al popup «Sobre» hi ha el botó «Instal·la com a app»:
a Android dispara la instal·lació del navegador; a iOS indica Compartir → «Afegir a la pantalla
d'inici». El nom a la pantalla d'inici és **AudioMetro**.

## SEO i previsualització social
`index.html` inclou meta `description`/`keywords`, `canonical`, Open Graph i Twitter Card
(amb `audiometro.png` com a imatge), i dades estructurades JSON-LD (`WebApplication`).
`robots.txt` + `sitemap.xml` per a la indexació. Per accelerar Google, dona d'alta el domini a
Google Search Console i envia-hi el `sitemap.xml`.

## Avisos
- `tmb_credentials.txt` i la `service_role` key **mai** es versionen ni van al frontend.
- L'`anon key` de Supabase és pública (la protecció real és la RLS).
