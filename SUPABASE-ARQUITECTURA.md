# AudioMetro — Arquitectura d'ingestió amb Supabase

> Replantejament de la ingestió: de procés local (`fetch-imetro.mjs --watch`) a **backend persistent**.
> Proposta, **sense implementar encara**. Supabase passa a ser el proxy + cau + memòria del projecte.

```
TMB iMetro ──► Edge Function (ingest)  ◄── Supabase Cron (cada 2 min)
                     │
                     ▼
              Postgres (Supabase)  ── taules estàtiques + arribades + històric + rollups
                     │
        ┌────────────┴───────────────┐
        ▼                            ▼
  Vista/RPC "upcoming"         Realtime (push)
        │                            │
        └──────────► navegador (scheduler neurona + mapa)
```

Avantatges respecte al procés local: cap script obert a la teva màquina, **tots els usuaris veuen el mateix**, credencials TMB només al servidor, i —el més important— **memòria històrica** des del primer dia.

---

## 1. Estructura de taules recomanada

Dues capes: **estàtica** (la xarxa, un cop) i **dinàmica** (arribades, contínua).

### Estàtiques (es carreguen un cop des de `network.json`)

**`stations`**
| columna | tipus | nota |
|---|---|---|
| code | int **PK** | `codi_estacio` de l'iMetro |
| name | text | nom |
| lat, lon | double | coordenades |
| interchange | bool | transbord |
| lines | text[] | línies que hi passen |

**`lines`**
| columna | tipus | nota |
|---|---|---|
| id | text **PK** | `L1`, `L9S`, `FM`… |
| color | text | color oficial |
| stations | text[] | ordre real (seqüència) |

> Així la xarxa viu **al backend** (font de veritat única); el frontend la pot llegir d'aquí en lloc de `network-data.js`, i el mapa de codis `code → name` ja és la taula `stations`.

### Dinàmiques (les escriu l'Edge Function cada 2 min)

**`arrivals`** — *arxiu d'esdeveniments realitzats* (append/upsert, deduplicat)
| columna | tipus | nota |
|---|---|---|
| station_code | int | FK → stations.code |
| line | text | FK → lines.id (o `nom_linia`) |
| sentit | smallint | 1 / 2 |
| desti | text | destinació |
| codi_servei | text | id del tren |
| t_arribada | timestamptz | hora d'arribada prevista (la més recent) |
| captured_at | timestamptz | hora del snapshot (`timestamp` de TMB) |
| **PK natural** | (station_code, sentit, codi_servei, *finestra*) | per **upsert** |

L'**upsert** evita duplicar el mateix tren a cada cicle: si torna a aparèixer, s'**actualitza** `t_arribada` amb la predicció més fresca. Resultat: una fila per arribada real, no una per predicció.

**`snapshots_raw`** *(opcional, retenció curta)* — payload iMetro complet en `JSONB` per cicle, per a auditoria / *replay* fidel. Es purga als pocs dies.
| id | bigserial | |
| captured_at | timestamptz | |
| payload | jsonb | resposta sencera |

**`arrivals_minutely`** *(rollup, per a l'històric a llarg termini)*
| line, sentit, station_code, minute_bucket | | clau |
| count | int | arribades en aquell minut |
| avg_headway | real | freqüència de pas mitjana |

Quan es purgui el detall antic, aquests agregats conserven els **ritmes** sense ocupar tant.

---

## 2. Què val la pena persistir i què no

**Sí:** `station_code`, `line`, `sentit`, `desti`, `codi_servei`, `t_arribada`, `captured_at`.
Amb això es reconstrueix tot (so present, històric, mètriques).

**No (o derivat):**
- `color_linia` per fila → ja és a `lines` (estàtic).
- `nom_familia`/`codi_familia` → constant (sempre "Metro").
- Totes les **prediccions intermèdies** d'un mateix tren → només la més recent (l'upsert ho resol). Si vols fidelitat total, ja la dóna `snapshots_raw` amb retenció curta.
- Coordenades/noms per arribada → join amb `stations`.

Principi: **normalitzar** (codis, no text repetit) i **deduplicar** (esdeveniments, no prediccions).

---

## 3. Només l'últim snapshot, o també històric?

**Tots dos, però separats:**

- Per al **so present**, el scheduler només necessita les arribades **futures** (`t_arribada > now()`), que són essencialment l'últim snapshot. → s'exposa amb una **vista**.
- Per a la **memòria sonora**, cal **històric**: `arrivals` (append/upsert) és l'arxiu. És barat de començar i molt valuós després.

Recomanació de retenció:
- `arrivals` (detall) → finestra rodant (p. ex. 14–30 dies).
- `arrivals_minutely` (rollup) → **indefinit** (és lleuger).
- `snapshots_raw` → 2–7 dies (auditoria/replay).

Ordre de magnitud: snapshot cada 2 min ≈ 720/dia; l'arxiu deduplicat d'arribades reals queda en desenes/centenars de milers de files/dia — Postgres ho porta bé amb índexs per `captured_at` i `station_code`, i amb la purga + rollup es manté sostenible.

---

## 4. Ingestió (Edge Function + Cron)

- **Supabase Cron** (`pg_cron` + `pg_net`) invoca cada 2 min una **Edge Function** `ingest-imetro` (`*/2 * * * *`).
- La funció: crida TMB amb les credencials guardades com a **secrets** (mai al navegador), parseja (mateixa lògica que `parseImetro`), fa **upsert** a `arrivals`, opcionalment desa `snapshots_raw`, i actualitza `arrivals_minutely`.
- **Seguretat**: el frontend només fa servir la **anon key** amb **RLS** de només-lectura sobre les vistes; les claus de TMB queden al servidor. Això resol d'una vegada el problema del proxy/secret que teníem pendent.

`fetch-imetro.mjs` i `fetch-network.mjs` passen a ser eines **puntuals** (carregar la xarxa estàtica un cop, proves locals), no processos en marxa.

---

## 5. Com afecta el scheduler actual

**Molt poc** — el motor (neurona, mapping, dimensions, animació) no canvia. Només canvia **d'on** vénen les dades:

- Avui: `poll()` llegeix `imetro.json` / `window.IMETRO`.
- Demà: `poll()` fa una crida a Supabase (PostgREST a una **vista** `upcoming_arrivals`, o un **RPC** `get_upcoming()`), que retorna ja en format normalitzat `{station_code, line, sentit, desti, t_arribada}` + el join amb `stations`. La funció `ingest()` del client queda gairebé idèntica.
- **Correcció de rellotge**: en lloc del `timestamp` de TMB, s'usa `captured_at`/`now()` del servidor.
- **Opcional (millor)**: **Realtime** — el client se subscriu a nous snapshots i refresca en *push*, eliminant el *polling* i la deriva.
- Es pot afegir un **endpoint d'històric** (`get_arrivals(from, to)`) que alimenti el mateix scheduler per a **reproducció temporal** (vegeu §6).

En resum: una funció de càrrega nova, zero canvis al cor sonor.

---

## 6. Possibilitats artístiques de l'històric (la "memòria sonora")

Tenir setmanes de snapshots transforma el projecte de *sonificar el present* a *tenir un arxiu dels ritmes de Barcelona*:

- **El dia comprimit** — reproduir 24 h en 5–10 min (time-lapse, com el *Tomato Quintet* de Chafe): Barcelona despertant, hores punta, vall del migdia, nit. La ciutat **respirant**, ara amb dades reals.
- **Comparar dies** — feiner vs cap de setmana, festius, vagues, pluja, partits del Barça. Cada dia, una peça diferent.
- **Reproduir qualsevol moment** — "el metro a les 8:00 del dimarts passat".
- **Capa de memòria sobre el present** — barrejar el so en directe amb el "fantasma" mitjà d'aquella mateixa hora (esperit time-lapse de DuBois): present i memòria sonant alhora.
- **Mètriques emergents en el temps** — tendències de regularitat, detecció d'**anomalies/incidents** (buits anòmals) → sonificar el dia que una línia va fallar.
- **Sincronies i fase al llarg de setmanes** — veure si certs patrons de coincidència entre línies es repeteixen.
- **A llarg termini** — un arxiu estacional → una peça generativa molt més rica, fins i tot un "àlbum" dels ritmes de la ciutat.

**Idea clau:** comença a **enregistrar des del primer dia**, encara abans de construir cap reproducció. És barat (append a `arrivals`) i, en unes setmanes, tindràs un material únic que ara no existeix. La memòria només es pot capturar en temps real.

---

## 7. Pla per fases (proposta, no implementació)

1. **Esquema**: crear `stations`, `lines` (carregar des de `network.json`), `arrivals`, `snapshots_raw`, `arrivals_minutely` + RLS de lectura.
2. **Edge Function `ingest-imetro`** + **Cron** cada 2 min (secrets TMB al servidor).
3. **Vista/RPC `upcoming_arrivals`** per al scheduler + **adaptar `poll()`** del frontend (i carregar la xarxa des de `stations`/`lines`).
4. **Realtime** (push) — opcional, substitueix el polling.
5. **Retenció + rollup** (`arrivals_minutely`, purga del detall).
6. **Reproducció històrica** (`get_arrivals(from,to)`) → mode "memòria" al frontend.

---

## Preguntes obertes per a tu (abans d'implementar)
- Pla de Supabase (free/pro) → marca límits de files/storage i, per tant, la retenció raonable.
- Vols que la xarxa estàtica (`stations`/`lines`) també visqui a Supabase i el frontend la llegeixi d'allà (font única), o la deixem com a `network-data.js`?
- Activem `snapshots_raw` (replay 100% fidel, més storage) o ens quedem amb `arrivals` deduplicat (més lleuger)?

---

## Fonts
- [Supabase Cron (pg_cron + pg_net)](https://supabase.com/docs/guides/cron)
- [Scheduling Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions)
- [pg_cron | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pg_cron)
