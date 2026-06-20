# AudioMetro — Arquitectura tècnica i motor de sonificació

Sonificació en temps real de la xarxa de Metro de Barcelona (TMB) com a organisme sonor.
Web sempre accessible a `audiometro.andreuperello.cat`: qui entra, sent la xarxa viva i sincronitzada amb dades reals.

---

## 1. Decisions arquitectòniques clau

**Síntesi al client.** El navegador de cada visitant consulta les dades, programa els esdeveniments i sintetitza el so localment amb Tone.js. No hi ha cap servidor d'àudio. Això és barat, escalable a infinits oients i és l'única opció coherent amb un scheduler basat en timestamps.

**Cal un proxy backend (no negociable).** L'API iMetro exigeix `app_id` + `app_key`. Si es criden des del navegador, qualsevol pot robar les credencials des de la pestanya de xarxa. Per tant:

```
Navegador ──► proxy propi (audiometro.andreuperello.cat/api) ──► api.tmb.cat
                     │
                     └─ guarda app_id/app_key com a variables d'entorn
                     └─ cacheja la resposta i la serveix a TOTS els clients
```

El proxy també resol el **rate limit**: en lloc que 500 visitants peguin a TMB, el proxy fa **una** crida cada 2 min i serveix la mateixa resposta cachejada a tothom. TMB veu sempre 1 client.

**"Sempre sonant" = sempre viu en obrir.** Amb síntesi al client no hi ha so quan ningú mira (és correcte i desitjable: estalvia recursos). Cada visita arrenca l'organisme en l'estat real d'aquell instant. L'única fricció és la **política d'autoplay**: els navegadors bloquegen àudio sense una interacció. Es resol amb una pantalla d'entrada ("Entra a la xarxa" / tap per començar) que fa `Tone.start()`.

---

## 2. Arquitectura de desplegament

| Capa | Tecnologia recomanada | Funció |
|------|----------------------|--------|
| Front estàtic | Vite + JS/TS, hostatjat a Cloudflare Pages, Netlify o Vercel | Serveix `index.html` + el motor de so |
| Proxy / cache | Cloudflare Worker o funció serverless (Vercel/Netlify) | Crida TMB, amaga credencials, cacheja 120 s |
| Domini | DNS de `andreuperello.cat` → CNAME a `audiometro` | Subdomini públic |

Tot pot anar a **Cloudflare** (Pages + Worker + DNS): gratuït, el Worker manté la cau global, i la mateixa resposta serveix tots els oients. Alternativa equivalent: Vercel (static + edge function).

### Endpoint del proxy

```
GET /api/arribades            → totes les estacions (la resposta cachejada sencera)
GET /api/arribades?estacio=ID → filtrat per una estació (opcional)
```

Pseudocodi del Worker:

```js
const TTL = 120; // segons
export default {
  async fetch(req, env, ctx) {
    const cache = caches.default;
    const key = new Request("https://cache/arribades");
    let res = await cache.match(key);
    if (!res) {
      const upstream = await fetch(
        "https://api.tmb.cat/v1/itransit/metro/?app_id=" + env.APP_ID +
        "&app_key=" + env.APP_KEY
      );
      const data = await upstream.json();
      res = new Response(JSON.stringify(normalitza(data)), {
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${TTL}`,
          "access-control-allow-origin": "*",
        },
      });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    return res;
  },
};
```

> `normalitza()` (secció 3) converteix la resposta de TMB a l'estructura interna i s'executa **al proxy**, així el client rep dades ja netes i lleugeres.

---

## 3. Estructura de dades

### 3.1 Model intern

Tres nivells: xarxa → estacions → arribades.

```ts
type Linia = "L1"|"L2"|"L3"|"L4"|"L5"|"L9"|"L10"|"L11";

interface Estacio {
  id: string;          // codi estació
  nom: string;
  linies: Linia[];
  esIntercanviador: boolean;  // òrgan: més activitat
  pes: number;         // nombre de línies → intensitat sonora
  lat: number; lon: number;   // per a la visualització (opcional)
}

interface Arribada {
  estacioId: string;
  linia: Linia;
  sentit: 1 | 2;
  desti: string;
  tArribada: number;   // timestamp absolut (ms), el camp clau
}

interface Snapshot {
  generatAt: number;       // quan el proxy va cridar TMB
  validFins: number;       // generatAt + finestra
  arribades: Arribada[];   // totes, ordenades per tArribada
}
```

### 3.2 Notes de normalització

- **Timestamps absoluts (ms).** `tArribada: 1746449431000`. No facis servir "minuts restants": fes servir el timestamp absolut i resta `Date.now()` només en el moment de programar. Així evites deriva.
- **Sincronia de rellotge.** El rellotge del client pot anar desviat respecte al servidor. El proxy hauria d'incloure `generatAt` (hora del servidor); el client calcula `offset = generatAt − Date.now()` en rebre la resposta i ajusta totes les programacions amb aquest offset.
- **Deduplicació.** Una mateixa estació apareix per cada línia/sentit. Indexa per `estacioId` per agrupar l'activitat d'un "node".
- **Pes de node.** `pes = linies.length`; intercanviadors (Diagonal, Catalunya, Sants…) tenen pes alt → es mapegen a veus més riques o més greus (òrgans).

### 3.3 Índexs en memòria al client

```ts
const perEstacio: Map<string, Arribada[]>;   // node → properes arribades
const perLinia:   Map<Linia, Arribada[]>;    // línia → flux
const cua: Arribada[];                        // totes, ordenades per tArribada (min-heap)
```

---

## 4. Scheduler d'esdeveniments

### 4.1 Principi: rellotge d'àudio, no `setTimeout`

`setTimeout`/`setInterval` no són prou precisos per a música (deriven, es pausen en segon pla). La tècnica estàndard és el **look-ahead scheduler** (patró de Chris Wilson "A Tale of Two Clocks"): un timer barroer mira endavant una finestra curta i encua els esdeveniments imminents directament al rellotge d'alta precisió de Web Audio (`AudioContext.currentTime`). Tone.js ja implementa això amb `Tone.Transport` i `Tone.Draw`.

```
cada 2 min:  fetch → omple la cua d'esdeveniments futurs (fins a 120 s)
cada 25 ms:  lookAhead() agafa de la cua tot el que cau dins dels propers 100 ms
             i ho programa amb temps absolut d'àudio
```

### 4.2 Conversió temps real → temps d'àudio

La clau és traduir el timestamp del món real a la línia de temps de l'`AudioContext`:

```ts
// en rebre snapshot:
clockOffset = snapshot.generatAt - Date.now();   // correcció de deriva
audioEpoch  = audioCtx.currentTime;              // ancoratge
wallEpoch   = Date.now() + clockOffset;

function aTempsAudio(tArribadaMs) {
  return audioEpoch + (tArribadaMs - wallEpoch) / 1000;
}
```

### 4.3 Bucle de programació

```ts
const LOOKAHEAD = 0.1;     // s: quant endavant programem
const TICK = 25;           // ms: cada quant revisem
const HORITZO = 120;       // s: finestra fins a la propera actualització

function lookAhead() {
  const ara = audioCtx.currentTime;
  while (cua.length && aTempsAudio(cua[0].tArribada) < ara + LOOKAHEAD) {
    const ev = cua.shift();
    const t = aTempsAudio(ev.tArribada);
    if (t >= ara) tocarArribada(ev, t);   // descarta passades
  }
}
setInterval(lookAhead, TICK);
```

### 4.4 Cicle d'actualització (cada 2 min)

```ts
async function refresca() {
  const snap = await fetch("/api/arribades").then(r => r.json());
  reindexa(snap);
  // afegeix a la cua només esdeveniments DINS l'horitzó i que no tinguem ja
  for (const a of snap.arribades) {
    if (a.tArribada > Date.now() && a.tArribada < Date.now() + HORITZO*1000)
      encua(a);
  }
}
setInterval(refresca, 120_000);
refresca(); // arrencada
```

**Solapament net:** programa fins a `HORITZO` (120 s) però refresca cada 120 s. Deixa marge: programa fins a ~110 s i refresca a 100 s, així sempre hi ha dades noves abans que s'esgotin les velles. Usa una clau `estacioId+linia+sentit+tArribada` per no duplicar arribades ja encuades en el refresc anterior.

---

## 5. Motor de síntesi (Tone.js)

### 5.1 Per què Tone.js sobre Web Audio cru

Tone.js aporta `Transport`, scheduling musical, sintetitzadors i efectes ja fets, i gestió de temps en notació musical. Per a centenars d'esdeveniments simultanis, però, cal vigilar la **polifonia** (secció 6).

### 5.2 Arquitectura de veus (l'organisme)

Pensa en capes, no en "un so per tren":

```
                        ┌─────────────┐
  arribades ──► veus ──►│  bus / mix  │──► reverb ──► limiter ──► sortida
                        └─────────────┘
```

| Capa sonora | Origen de dades | Síntesi |
|-------------|-----------------|---------|
| **Pols (impuls nerviós)** | cada arribada | percussió curta / pluck (`Tone.MetalSynth`, `MembraneSynth`) |
| **Drons d'òrgan** | intercanviadors actius | pad sostingut (`Tone.FMSynth`) modulat per la densitat |
| **Harmonia de fons** | densitat global de la xarxa | acord lent que canvia amb el "pols" general |
| **Espacialitat** | posició geogràfica estació | panoràmica L/R segons longitud; reverb segons profunditat |

Cada **línia** = un timbre o color harmònic fix (L1 vermell → un registre, L3 verd → un altre…). Així l'oïda distingeix línies com l'ull distingeix colors al mapa.

### 5.3 Cadena mestra

```ts
const limiter = new Tone.Limiter(-3).toDestination();
const reverb  = new Tone.Reverb({ decay: 6, wet: 0.35 }).connect(limiter);
const bus     = new Tone.Gain(0.8).connect(reverb);
```

Un **limiter mestre** és imprescindible: amb centenars d'esdeveniments el risc de clipping és real.

---

## 6. Gestió eficient de centenars d'arribades

El coll d'ampolla és la **polifonia**: instanciar un synth per esdeveniment satura CPU i memòria. Solucions, de més a menys important:

**1. Voice pooling.** Crea un pool fix (p. ex. 16–32 veus per capa) i recicla'ls. Tone.js: `Tone.PolySynth` amb `maxPolyphony` limitat. Si arriben més esdeveniments que veus, es roben les més antigues (voice stealing).

```ts
const pols = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 24 }).connect(bus);
```

**2. Sample-based per als impulsos.** Per a percussió curta, un `Tone.Sampler` o `Tone.Players` reproduint buffers pregravats és molt més barat que síntesi en viu. Sintetitza pocs timbres una vegada, reprodueix-los molts cops.

**3. Decimació / agrupació temporal.** Si en 50 ms cauen 40 arribades, l'oïda no les distingeix. Agrupa esdeveniments dins una finestra (p. ex. 30 ms) en **un sol** accent més fort + densitat. Converteix "soroll" en "intensitat".

**4. Pressupost d'esdeveniments.** Limita esdeveniments/segon (p. ex. màx. 30/s). Prioritza per pes de node i proximitat temporal; descarta o fusiona la resta.

**5. Cull del que no se sent.** No programis arribades a >110 s; no mantinguis objectes d'arribades passades. Buida la cua agressivament.

**6. Visualització desacoblada.** Si fas representació visual, fes el render amb `Tone.Draw.schedule()` (sincronitzat amb àudio) o `requestAnimationFrame` llegint estat, mai bloquejant el fil d'àudio.

---

## 7. Mapping dades → paràmetres sonors

El cor expressiu del projecte. Proposta de mapatge:

| Dada del metro | Paràmetre sonor | Justificació conceptual |
|----------------|-----------------|--------------------------|
| **Línia** | timbre / color (registre, forma d'ona) | cada "nervi" té el seu so |
| **Sentit** | panoràmica o detune lleuger (±) | direcció = espai |
| **Pes de l'estació** (nº línies) | registre (greu/agut) + riquesa harmònica | intercanviadors = òrgans greus i densos |
| **Densitat d'arribades** (esdev./s) | volum del dron de fons + tempo harmònic | activitat = energia de l'organisme |
| **Hora del dia** (implícit en densitat) | brillantor / filtre passa-baixos | hora punta = més brillant i dens; nit = fosc i espaiat |
| **Posició geogràfica** | pan (longitud) + reverb (profunditat) | mapa sonor de la ciutat |
| **Proximitat de l'arribada** | atac / dinàmica del pols | tren imminent = accent més marcat |

Recomanacions de disseny sonor:

- **Quantització suau (opcional).** Per evitar caos rítmic, pots "imantar" lleugerament els polsos a una graella lenta (p. ex. corxeres a 60–80 BPM) amb `Tone.Transport`. Manté musicalitat sense perdre la relació amb les dades reals. És un compromís: com més quantitzes, menys fidel al temps real.
- **Escala fixa.** Restringeix les notes a una escala (pentatònica, dòrica…) perquè sempre soni consonant independentment de quantes coincidències hi hagi.
- **Mapatge logarítmic** per a volum i freqüència (l'oïda és logarítmica).

---

## 8. Estat global "organisme" i robustesa

- **Indicador de batec.** Calcula un "pols global" = arribades/minut suavitzat (mitjana mòbil). Mapeja'l a tempo i densitat harmònica → la web "respira".
- **Degradació elegant.** Si una crida al proxy falla, segueix sonant amb les dades anteriors (mai silenci sobtat). Mostra estat "reconnectant".
- **Servei nocturn.** De ~02:00 a 05:00 el metro tanca: l'organisme entra en repòs (drons mínims, polsos esporàdics). No és un bug; és part de la narrativa.
- **Pausa en segon pla.** Quan la pestanya perd focus (`visibilitychange`), el rellotge d'àudio es pot alentir; en tornar, força un `refresca()` i re-ancora `audioEpoch`.

---

## 9. Estructura de fitxers proposada

```
audiometro/
├── public/
│   └── samples/            # buffers de percussió pregravats
├── src/
│   ├── main.ts             # arrencada, pantalla d'entrada (Tone.start)
│   ├── data/
│   │   ├── client.ts       # fetch al proxy, offset de rellotge
│   │   └── model.ts        # tipus + reindexació
│   ├── engine/
│   │   ├── scheduler.ts    # look-ahead, cua, conversió temps
│   │   ├── voices.ts       # pools de veus per capa
│   │   └── mapping.ts      # dades → paràmetres
│   ├── audio/
│   │   └── master.ts       # bus, reverb, limiter
│   └── viz/                # visualització (opcional)
├── worker/
│   └── proxy.ts            # Cloudflare Worker (credencials + cache)
└── index.html
```

---

## 10. Pla d'implementació per fases

1. **Proxy + dades.** Worker que crida TMB, amaga credencials, cacheja 120 s i normalitza. Verifica el format real de la resposta.
2. **Scheduler en sec.** Sense so: registra a consola els esdeveniments programats i comprova sincronia amb timestamps reals.
3. **Una veu.** Un sol `pluck` per arribada. Validar que el ritme "sona com es mou el metro".
4. **Capes i mapping.** Afegir línies (timbres), intercanviadors (drons), pol global.
5. **Optimització.** Voice pooling, agrupació, limiter, pressupost d'esdeveniments. Provar en hora punta.
6. **Entrada + sempre sonant.** Pantalla d'inici (autoplay), degradació elegant, mode nocturn.
7. **Visualització** (opcional) i desplegament al subdomini.

---

## Fonts

- [TMB — iMetro Next train](https://www.tmb.cat/en/barcelona/tmb-imetro)
- [TMB — Tools for developers](https://www.tmb.cat/en/tmb-app-and-other-apps/tools-for-developers) · portal: [developer.tmb.cat](https://developer.tmb.cat/)
- [GitHub — TMB-Barcelona/TMB-API-samples](https://github.com/TMB-Barcelona/TMB-API-samples)
