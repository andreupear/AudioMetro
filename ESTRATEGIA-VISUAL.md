# AudioMetro — Estratègia de representació visual de la xarxa

> Decisions ja preses: **gest sonor = "neurona"** (tancat) · objectiu actual = **forma visual** de la xarxa.
> Cadena que volem validar: `arribada → activació visual al node → impuls sonor`.

---

## 0. Anàlisi del PDF adjuntat (important)

He inspeccionat el fitxer `mapa-metro-barcelona-2026-big.pdf`:

- **No és vectorial.** Generat amb *"Microsoft: Print To PDF"*, conté **0 text i 0 traços vectorials**: és una **imatge rasteritzada** (40 tires JPEG, ~**12288 × 8277 px**).
- És l'**esquema topològic oficial** (angles de 45°, *no* geogràfic) i és **multimodal**: barreja metro (L1–L5, L9/L10/L11) amb FGC, Rodalies, Tram, funiculars i bus.

**Conseqüència directa:** el PDF **no serveix com a font de dades ni com a SVG**. Vectoritzar-lo (image tracing) donaria un SVG brut, pesat i inanimable. El seu valor real és un altre: **referència estètica** (estil esquemàtic, colors oficials de línia, noms i posicions relatives). El farem servir per *mirar*, no per *importar*.

---

## 1. La decisió de fons abans de triar tecnologia: geogràfic vs esquemàtic

Hi ha dues maneres oposades de disposar la xarxa, i afecten tant l'estètica com la sonificació:

| | **Geogràfic** (coordenades reals) | **Esquemàtic / octilineal** (estil mapa oficial) |
|---|---|---|
| Aspecte | Forma real de Barcelona; centre dens i atapeït | Net, llegible, icònic; espaiat uniforme |
| Cost | Baix (dades ja existeixen) | Alt (disseny manual o algorisme de layout) |
| Sonificació | **Coherent amb el pan per geografia** que ja fa el motor | El pan deixa de correspondre a l'espai real |
| Identitat | "Barcelona com a organisme físic" | "Barcelona com a diagrama / circuit" |

Recomanació: **geogràfic per al MVP** (barat, honest i ja lligat al mapping sonor de pan) i **esquemàtic refinat per a la versió final** (la identitat visual forta, quan el concepte ja estigui validat). El bo és que totes dues poden compartir **les mateixes dades** canviant només les coordenades de cada node.

---

## 2. Avaluació de les quatre opcions

### Opció 1 — SVG vectorial manual
Dibuixar a mà cada línia i estació en un editor (Figma/Illustrator) i exportar SVG.
- **A favor:** control estètic total; pot reproduir la bellesa del mapa oficial.
- **En contra:** ~160-180 estacions de metro → desenes d'hores de feina; difícil de mantenir; els nodes no queden lligats a dades (cal etiquetar-los un per un per animar-los).
- **Veredicte:** excel·lent per a la *versió final* si vols l'estètica esquemàtica, **excessiu per al MVP**.

### Opció 2 — Conversió del mapa existent (el PDF)
Vectoritzar la imatge del PDF.
- **A favor:** cap.
- **En contra:** el PDF és **raster** (secció 0); el traçat automàtic dóna SVG il·legible i no animable; a més és multimodal (sobra FGC/Rodalies/Tram).
- **Veredicte:** **descartada** com a font. Només referència visual.

### Opció 3 — Dades geogràfiques reals (TMB / OpenData / OSM)
Construir la xarxa a partir de dades obertes: **GTFS de TMB** (línies, estacions, ordre i coordenades, actualitzat setmanalment), complementable amb OpenData BCN i OpenStreetMap.
- **A favor:** **font de veritat única**, precisa, mantenible; dóna coordenades reals → pan geogràfic; el mateix fitxer alimenta visual *i* so; filtrable a les 8 línies de metro.
- **En contra:** layout geogràfic atapeït al centre; cal un petit pas de preprocés (GTFS → JSON propi).
- **Veredicte:** **la millor base de dades del projecte**, tant per a MVP com per a final.

### Opció 4 — Graf abstracte de la xarxa
Representar la xarxa com un graf (nodes + arestes) amb posicions calculades per un algorisme (force-directed o octilineal).
- **A favor:** zero disseny manual; emergeix sol; conceptualment alineat amb "xarxa / sistema d'oscil·ladors".
- **En contra:** el force-directed dóna formes orgàniques però **irreconeixibles** (no sembla Barcelona); l'octilineal automàtic que imita el mapa oficial és un problema difícil.
- **Veredicte:** interessant com a **mode alternatiu** (vista "abstracta" commutable), no com a vista principal.

---

## 3. Arquitectura visual recomanada

### Principi rector: una sola font de dades per a so i imatge

```
GTFS de TMB ──(preprocés, 1 cop)──► network.json
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                              ▼
  motor de so (pitch,        render visual (nodes,        scheduler (arribades)
  pan, centralitat)           línies, intercanviadors)     dispara TOTS DOS alhora
```

`network.json` (estructura proposada):
```json
{
  "lines": [{ "id":"L3", "color":"#2e9e3f", "stations":["...","..."] }],
  "stations": {
    "be": { "name":"Besòs", "lat":41.41, "lon":2.21,
            "lines":["L4"], "interchange":false,
            "x":0.82, "y":0.30 }          // x,y normalitzats per al render
  }
}
```
El `x,y` es genera del lat/lon (MVP) o es reescriu amb posicions esquemàtiques (final). El **so i el visual llegeixen el mateix node**, així l'activació sempre quadra.

### MVP — SVG data-driven, geogràfic, només metro

- **Tecnologia:** un únic **SVG** generat per codi a partir de `network.json`.
  - Línies = `<path>`/`<polyline>` amb el color oficial.
  - Estacions = `<circle>` (un node per estació, amb `id` = codi → fàcil d'animar).
  - Intercanviadors = cercle més gran, anell blanc o doble anell.
- **Abast:** només les **8 línies de metro** (fora FGC/Rodalies/Tram de moment).
- **Animació "neurona":** en cada arribada, el mateix scheduler que dispara el so anima el node: un *flash* (radi + opacitat + glow breu) que decau, idèntic al gest sonor (atac → ressò visual). Reutilitza el bucle `requestAnimationFrame` del prototip actual.
- **Per què SVG i no Canvas aquí:** ~180 nodes és molt assumible per al DOM; SVG dóna nitidesa, estilat fàcil i *binding* directe node↔dada. Perfecte per validar la cadena `arribada → flash → so`.

### Versió final — SVG estàtic + capa Canvas/WebGL per als impulsos

Quan el concepte estigui validat i vulguis qualitat i densitat altes:

- **Esquelet estàtic en SVG** (xarxa, línies, noms) — possiblement amb **layout esquemàtic/octilineal** refinat per recuperar la identitat del mapa oficial (Opció 1 dirigida per les dades de l'Opció 3).
- **Capa dinàmica en Canvas o WebGL (PixiJS)** per sobre, dedicada als **impulsos neuronals**: glow, partícules, propagació d'ones per la línia. El Canvas absorbeix centenars d'animacions simultànies sense saturar el DOM (el coll d'ampolla típic dels filtres SVG amb molts elements alhora).
- **Càmera:** zoom/pan, i possibilitat de canviar entre vista **geogràfica ↔ esquemàtica ↔ graf abstracte** (Opció 4) interpolant les coordenades `x,y` dels mateixos nodes.

### Resum de la recomanació

| | MVP | Final |
|---|---|---|
| Dades | GTFS → `network.json` (Opció 3) | igual (font única) |
| Layout | Geogràfic | Esquemàtic/octilineal (Opció 1 sobre dades) |
| Render xarxa | SVG | SVG estàtic |
| Render impulsos | SVG (atributs) | Canvas/WebGL (PixiJS) |
| Abast | 8 línies metro | + modes i càmera |
| PDF | referència estètica (colors) | referència estètica |

---

## 4. Sincronia visual ↔ so (el cor del MVP)

L'scheduler ja existent és l'**únic rellotge**. En cada arribada emet un esdeveniment que conté `{stationId, lineId, time, hub, reinforced}`. Aquest esdeveniment:

1. dispara el **gest sonor "neurona"** (so) a `time`;
2. marca el **node visual** perquè faci el seu *flash* sincronitzat (mateix `time`, via `Tone.Draw.schedule()` per quadrar amb l'àudio).

Així la percepció és unitària: *veus* la neurona disparar exactament quan la *sents*. Els intercanviadors fan un flash més gran i greu (visual + sonor); les coincidències reforçades, un destell blanc (com ja fa la visualització del prototip actual, però ara sobre el mapa real).

---

## 5. Pròxim pas concret

1. **Generar `network.json`** des del GTFS de TMB, filtrat a les 8 línies (puc fer el preprocés quan tinguis el GTFS descarregat, o amb dades OSM si prefereixes no autenticar encara).
2. **Render SVG data-driven** d'aquest JSON (geogràfic).
3. **Connectar-hi l'scheduler "neurona"** del prototip actual perquè els nodes s'encenguin amb les arribades simulades.

El resultat serà la primera vegada que el projecte es **veu i se sent alhora** com una peça. A partir d'aquí decidim si el salt a l'estètica esquemàtica i a WebGL val la pena.

---

## Fonts

- [TMB — Tools for developers (GTFS setmanal: línies, estacions, coordenades, shapes)](https://www.tmb.cat/en/about-tmb/tools-for-developers)
- [osm-catalunya-transport-public — dades de transport públic obert (GitHub)](https://github.com/JaumeFigueras/osm-catalunya-transport-public)
