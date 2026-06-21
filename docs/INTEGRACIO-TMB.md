# AudioMetro — Integració amb dades reals de TMB

> Pas previ a programar: confirmar **exactament** quines dades en temps real existeixen i quines no.
> Principi: **no inventar capes de dades**. Si una dada no és accessible públicament, no s'usa.

---

## 1. Què tenim disponible (confirmat)

### 1.1 Estructura estàtica de la xarxa — ✅ disponible (ja l'usem)
De l'API `transit` de TMB (i del `network.json` que ja has generat):
línies, estacions, **ordre real**, **coordenades** (lat/lon), intercanviadors, colors oficials.
També hi ha **GTFS** (horaris teòrics, freqüències programades), actualitzat setmanalment.

### 1.2 Arribades en temps real — iMetro — ✅ disponible (a confirmar l'endpoint exacte)
Segons la teva pròpia descripció del projecte i l'accés que tens, per a cada estació l'iMetro dóna, per a cada tren imminent:

| Camp | Exemple | Ús sonor |
|------|---------|----------|
| línia | `L3` | pitch base |
| sentit | `1` / `2` | panoràmica / detune direccional |
| destinació | `Trinitat Nova` | offset cap al terminal (opcional) |
| codi de servei del tren | id | identificar trens individuals |
| **temps_arribada** (timestamp absolut, ms) | `1746449431000` | **programació de l'esdeveniment** |

> **Pendent de verificar amb tu** (no he pogut llegir el portal `developer.tmb.cat`, que requereix JS/login, i el sandbox no té sortida a internet): l'**URL exacta** de l'endpoint en temps real, l'**estructura JSON** (noms de claus, nidació) i si hi ha una crida **per a totes les estacions alhora** o **una per estació**. Això determina l'arquitectura de consultes (vegeu §3).

---

## 2. Què NO existeix (no s'usarà)

### 2.1 Ocupació / aforament dels trens en temps real — ❌ no a l'API pública
TMB **sí** mostra ocupació, però:

- A l'app és una **estimació mitjana per franja horària** (per línia, sentit, estació i tram horari) — és **estadística/històrica**, no l'ocupació real d'un tren concret ara mateix.
- Hi ha una iniciativa d'ocupació **en temps real amb càmeres + IA**, però és un projecte intern/de visualització (col·laboració amb Geomàtico), **no exposat a l'API pública d'arribades**.

**Conclusió:** no disposem d'ocupació real per tren a l'API. **No la farem servir.** (Si en el futur s'exposés la mitjana estimada com a dataset, es podria afegir com a capa *opcional* clarament etiquetada com a "estimada", mai com a real.)

### 2.2 Posició GPS contínua dels trens — ❌ no confirmada
No assumim *tracking* posicional continu. El que tenim són **timestamps d'arribada a estació**, que ja basten per a la sonificació.

---

## 3. Arquitectura de la integració

```
  cada 2 min ─► Worker/proxy ─► iMetro (totes les estacions) ─► arrivals normalitzats
                    │                                              │
                    └─ amaga app_id/app_key · cacheja 120 s        ▼
                                                         scheduler local (look-ahead)
                                                                   │
                                              en el moment t:  neurona (so) + node (mapa)
```

1. **Cada 2 min**, una consulta (al proxy) recupera les properes arribades.
2. Es **normalitzen** a `{estacioId, linia, sentit, desti, tArribada}`.
3. Es calcula `temps_restant = tArribada − now` (amb correcció de desviació de rellotge).
4. Es **programa localment** cada esdeveniment futur fins a la propera actualització (scheduler look-ahead amb el rellotge de Web Audio).
5. En el moment de cada arribada: **gest neurona** + **activació del node** al mapa.

**Dues restriccions tècniques reals:**
- **Proxy obligatori.** Cridar `api.tmb.cat` des del navegador exposaria les credencials i topa amb CORS. Cal el Worker (ja dissenyat a `ARQUITECTURA.md`): amaga claus, cacheja i serveix a tots els visitants amb **una** crida.
- **Per estació vs totes alhora.** Si iMetro només dóna arribades **per estació**, "totes les estacions cada 2 min" són ~138 crides/cicle → cal que el **proxy** les agregui i cachegi (el navegador rep un sol JSON). Ho confirmarem amb l'endpoint real.

---

## 4. Mapping sonor

### 4.1 Base (acordat)
- **Pitch base → línia** (cada línia, el seu registre dins una escala pentatònica).
- **Panoràmica E/D → posició X** de l'estació al mapa.
- **Intercanviadors → més energia i durada** (octava greu, ressò llarg).
- **Coincidències temporals entre línies → reforç harmònic** (accent + sub-greu).

### 4.2 Dimensions sonores addicionals — totes derivables de dades REALS
Cap d'aquestes necessita ocupació; surten dels **timestamps + sentit + topologia**:

1. **Imminència** (`tArribada − now`).
   Com més imminent el tren en programar-se, més **nítid i brillant** l'atac de la neurona (filtre/atac). Fa "sentir" la proximitat.
   *Dada: timestamp absolut. ✅*

2. **Freqüència de pas / regularitat per línia** (interval entre arribades consecutives a una estació).
   Mapeja a la **netedat del timbre**: línies regulars (automàtiques L9/L10/L11) → to net i afinat; línies amb més *jitter* (L1–L5) → vibrato/soroll lleuger. Fa audible el contrast auto/manual real de Barcelona.
   *Dada: diferència entre timestamps successius. ✅*

3. **Densitat temporal d'arribades** (arribades/min a tota la xarxa o per zona).
   Controla l'**energia global** i l'ambient (reverb, brillantor mestra). Fa emergir sol el **pols del dia** (hora punta densa i brillant; nit esparsa). Sense drons artificials.
   *Dada: recompte de timestamps en finestra. ✅*

4. **Centre ↔ perifèria** (centralitat de l'estació: nre. de línies / betweenness / distància al centre).
   Mapeja a **registre i riquesa**: nodes centrals greus i densos, perifèrics aguts i secs. Fa sentir l'esquelet de la xarxa.
   *Dada: topologia estàtica. ✅*

*(Extra fàcil, si vols: **sentit** → balanç estèreo/detune que revela la marea pendular matí/vespre; **nombre de trens imminents** per estació → densitat d'acord en aquell node.)*

---

## 5. Pla d'implementació

1. **Confirmar l'endpoint iMetro** (URL + JSON + per-estació/totes) — *et necessito a tu* (§6).
2. **Sonda** `fetch-imetro.mjs`: captura una resposta real i la desa, per blocar els noms de camp exactes.
3. **Adaptador** `parseImetro(raw) → [{estacioId,linia,sentit,desti,tArribada}]` (aïllat, fàcil d'ajustar).
4. **Scheduler real** que substitueix el Kuramoto simulat: programa per timestamp, dispara neurona + node.
5. **Mapping** base + 4 dimensions noves.
6. **Polling 2 min** + correcció de rellotge + degradació elegant (si falla una crida, manté les dades anteriors).
7. **Eliminar** el sistema d'oscil·ladors simulats.

---

## 6. El que necessito de tu per implementar amb exactitud

No puc llegir el portal `developer.tmb.cat` des d'aquí ni cridar l'API (sandbox sense xarxa), i **no vull inventar** ni l'URL ni els noms de camp. Per blocar-ho amb precisió, qualsevol d'aquestes dues coses em basta:

- **(a)** Enganxa'm **una resposta real** de l'iMetro (un fragment JSON d'una estació), o
- **(b)** Dis-me l'**URL exacta** de l'endpoint en temps real que fas servir.

Amb això escric l'adaptador i el scheduler reals i elimino el simulador. Mentre, l'scheduler i el mapping ja queden dissenyats aquí.

---

## Fonts
- [TMB — Tools for developers (API, GTFS)](https://www.tmb.cat/en/tmb-app-and-other-apps/tools-for-developers)
- [TMB Notícies — nivells d'ocupació consultables a les eines digitals (estimació per franja)](https://noticies.tmb.cat/transport/nivells-docupacio-metro-bus-consultables-eines-digitals-de-tmb)
- [Geomàtico — visualització de transport públic en temps real (projecte amb TMB)](https://geomatico.es/en/real-time-public-transportation/)
- [TMB-API-samples (mostres oficials de codi)](https://tmb-barcelona.github.io/TMB-API-samples/)
