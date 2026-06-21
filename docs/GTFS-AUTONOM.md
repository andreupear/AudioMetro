# AudioMetro — Horari GTFS autònom (L9/L10)

Objectiu: que L9/L10 sonin per **horari programat** (no tenen temps real a l'iMetro) **sense cap
intervenció manual**. Tot viu a Supabase; el frontend només crida `get_upcoming()`.

## Flux de dades

```
                 (setmanal)
  cron ───► Edge Function refresh-gtfs ───► baixa ZIP GTFS de TMB
                                            parseja L9/L10 (routes/trips/stop_times/calendar)
                                            ▼
                                      taula  gtfs_schedule   (horari setmanal)
  cron (2 min) ─► ingest-imetro ─► taula  arrivals          (temps real L1-L5, L11)
                                            │
                              get_upcoming()  ── FUSIONA arrivals + gtfs_schedule
                                            ▼
                                        navegador (mateix scheduler / neurona)
```

- **Temps real** (L1–L5, L11): taula `arrivals`, refrescada cada 2 min per `ingest-imetro`.
- **Horari** (L9/L10): taula `gtfs_schedule`, refrescada cada setmana per `refresh-gtfs`.
- **`get_upcoming()`** uneix les dues fonts i les retorna en el mateix format. El frontend no distingeix: tot són "arribades".

## Esquema (taula `gtfs_schedule`)
| columna | tipus | nota |
|---|---|---|
| line | text | L9N/L9S/L10N/L10S |
| station_code | int | compatible amb els codis de `network-data.js` |
| sentit | smallint | 1/2 |
| desti | text | terminal |
| depart_sec | int | segons des de mitjanit local (pot superar 86400) |
| dow_mask | smallint | bits 0..6 = dg..ds en què circula el servei |
| trip | text | id del tren (compta trens únics) |

`get_upcoming()` filtra per `dow_mask` del dia actual i per la finestra `[ara−1min, ara+horitzó]`,
i converteix `depart_sec` a timestamp absolut amb la zona `Europe/Madrid`.

## Posada en marxa (un cop)
1. **SQL**: executa `supabase/gtfs.sql` (crea `gtfs_schedule`, RLS i el nou `get_upcoming` fusionat).
2. **`stations` carregades** (cal per mapejar nom→codi): `node supabase/seed-static.mjs`.
3. **Secret** `GTFS_URL` = URL del ZIP GTFS de TMB (amb `app_id/app_key` si cal).
4. **Desplega**: `supabase functions deploy refresh-gtfs --no-verify-jwt`.
5. **Cron**: executa la part de `refresh-gtfs-setmanal` de `supabase/cron.sql`.
6. Primera càrrega: crida la funció un cop (o espera el cron) i comprova:
   `select line, count(*) from gtfs_schedule group by line;`

A partir d'aquí, **es manté sol**: cada setmana es refà l'horari i cada 2 min el temps real.

## Robustesa: via alternativa (GitHub Actions)
Parsejar un GTFS gran pot superar els límits de memòria/CPU d'una Edge Function. Si `refresh-gtfs`
falla per mida, hi ha una via equivalent i fiable que escriu a la **mateixa taula**:

- `.github/workflows/refresh-gtfs.yml` (setmanal) baixa el ZIP, el descomprimeix i executa
  `scripts/build-schedule.mjs`, que fa l'upsert a `gtfs_schedule`.
- Secrets del repo: `GTFS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Totes dues vies són autònomes; pots tenir-ne una o l'altra (o l'Edge Function com a primària i
Actions com a còpia de seguretat). El resultat a `gtfs_schedule` és idèntic.

## Notes
- L9/L10 sonen segons **horari teòric** (no reflecteixen retards); per a línies automàtiques és molt fidel.
- FM (funicular) queda fora del projecte.
- `service_role` només al servidor (Edge Function / Actions), mai al frontend.
