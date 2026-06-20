# AudioMetro — Propietats emergents sonificables

> Segona ronda de recerca conceptual. Pregunta central:
> **quines propietats reals del sistema metro de Barcelona són difícils de veure però fàcils de sentir?**
>
> No busquem una metàfora bonica, sinó propietats genuïnes de la xarxa que l'**oïda detecta millor que la vista**.
> Aquesta vegada partim de la riquesa completa de dades (línia, sentit, destinació, codi de servei,
> múltiples arribades, timestamps absoluts) i de la topologia estàtica (ordre d'estacions,
> intercanviadors, longitud de línies, graf complet).

---

## 0. Per què l'oïda i no l'ull (el fonament)

Tota la proposta es recolza en un fet perceptiu ben establert: **l'oïda humana està optimitzada per al temps**. Discrimina entre senyals periòdics i aperiòdics, detecta canvis minúsculs de freqüència en senyals continus, percep **batecs de fase** entre dues fonts gairebé sincronitzades, i fa emergir *flares* ràpids o oscil·lacions subtils amagades dins un senyal de fons — coses que la vista, optimitzada per a l'espai i la forma, perd o difumina.

Un mapa de metro és una eina **espacial**: mostra excel·lentment *on* són les coses, però amaga *quan* i *amb quin ritme* passen. Justament el domini on l'oïda guanya. Aquesta és la tesi d'AudioMetro: **el so revela la dimensió temporal i rítmica de la xarxa que el mapa no pot mostrar.**

Les deu direccions següents s'ordenen, aproximadament, de "més privilegiada per l'oïda" a "més contextual".

---

## 1. Sincronització de fase entre línies (el model de Kuramoto urbà)

**Propietat audible.** Cada línia té una freqüència pròpia (la seva freqüència de pas / *headway*). Vuit línies són **vuit oscil·ladors independents** que, com els oscil·ladors acoblats de Kuramoto o les lluernes que parpellegen, entren i surten de fase entre si. Quan dos *headways* són propers, apareixen **batecs lents** d'interferència; en certs moments les línies s'alineen i en d'altres es dispersen.

**Per què interessa.** És una propietat emergent autèntica i pràcticament **invisible en un mapa**: ningú "veu" que la L3 i la L5 estan en fase ara mateix. Però l'oïda és literalment un detector de batecs (com quan s'afinen dues cordes): percep l'alineació i el desfasament sense esforç. Revela la coreografia oculta del sistema.

**Experiència de l'oient.** Pulsacions que es desplacen lentament, moments de convergència que es viuen com a clímax naturals (sense que ningú els hagi compost) i passatges de dispersió. Una tensió-resolució que ve de la pura física dels horaris.

**Estratègia sonora.** Cada línia = un tren de polsos a la seva freqüència real de pas. Deixar que **bateguin acústicament** entre ells (no quantitzar!). Reforçar les coincidències reals als intercanviadors amb un accent. Inspiració: phasing de Steve Reich, però no compost — descobert a les dades.

---

## 2. Regularitat vs irregularitat (el "batec sa" de cada línia)

**Propietat audible.** La **estabilitat de l'interval** entre trens. Les línies automàtiques de Barcelona (L9, L10, L11, sense conductor) passen amb regularitat gairebé metronòmica; les línies clàssiques (L1–L5) tenen més *jitter* (variació humana, congestió, esperes). El *train bunching* —trens que s'agrupen, una inestabilitat clàssica del transport— és exactament una pèrdua de regularitat.

**Per què interessa.** L'oïda distingeix **instantàniament** un pols estable d'un que trontolla, molt millor que l'ull llegint una taula d'horaris. Fa audible una diferència real i molt barcelonina: **el contrast entre el metro automàtic i el manual**, entre salut rítmica i estrès de la xarxa.

**Experiència de l'oient.** Algunes línies sonen com un rellotge serè; d'altres "respiren" amb irregularitat, s'acceleren, ensopeguen. Reconeixes la "personalitat rítmica" de cada línia sense mirar res.

**Estratègia sonora.** Cada línia és un *click-track* viu; el *jitter* es percep com a inestabilitat rítmica. Es pot mapejar la regularitat a la "neteja" del timbre: línia regular = to net i afinat; línia irregular = to amb soroll o vibrato inestable.

---

## 3. Coherència global de la xarxa (un sol paràmetre d'ordre)

**Propietat audible.** Del model de Kuramoto es manlleva el **paràmetre d'ordre** *r*: una sola mesura, entre 0 i 1, de **com de sincronitzat està tot el sistema** en cada instant. Es pot calcular en temps real a partir de les fases de totes les línies/trens.

**Per què interessa.** Resumeix l'estat global d'un sistema de centenars d'elements en una magnitud que l'oïda tradueix perfectament a **consonància vs soroll**, a *afinat vs desafinat*, a *compacte vs difús*. El conjunt es percep com un "estat d'ànim" de la ciutat que no apareix enlloc del mapa.

**Experiència de l'oient.** Quan la xarxa està coherent, tot sona afinat, tens, junt; quan es dispersa, el so s'enterboleix i es desafina lleugerament. Sents la ciutat "quallar" i "desfer-se" al llarg del dia.

**Estratègia sonora.** *r* alt → acord consonant, estret, brillant; *r* baix → clúster lleugerament desafinat i difús (detune, *spread*, soroll). Un únic timbre mestre que respira amb la coherència del sistema. Model-based sonification en estat pur.

---

## 4. La marea pendular (asimetria de sentits)

**Propietat audible.** La dada de **sentit/destinació** revela el flux pendular: al matí la ciutat aspira cap al centre, al vespre exhala cap a la perifèria. És una **asimetria direccional** que canvia de signe al llarg del dia.

**Per què interessa.** És una propietat socialment significativa (el ritme del treball, el moviment col·lectiu de centenars de milers de persones) i **molt difícil de veure** —un mapa mostra trens en totes direccions alhora— però fàcil de separar per l'oïda si cada sentit ocupa el seu espai/timbre.

**Experiència de l'oient.** Dos cors espacialitzats: "cap endins" i "cap enfora". El seu equilibri es desplaça hora a hora. Literalment **sents la ciutat inspirar al matí i expirar al vespre**. En time-lapse, una respiració diària.

**Estratègia sonora.** Sentit 1 vs sentit 2 = dos fluxos amb pan oposat i tessitura diferent. La diferència de densitat entre tots dos controla el balanç esquerra/dreta i el registre. La metàfora "respirar" hi és, però aquí està **ancorada en una dada real**.

---

## 5. Propagació d'ones (el front que recorre la línia)

**Propietat audible.** Un tren és una **pertorbació que viatja** node a node per una línia; molts trens generen patrons d'ones que es propaguen i, de vegades, fronts de densitat que recorren la xarxa. És espai-temps, no només temps.

**Per què interessa.** L'oïda percep el **moviment** (escombrada espacial, Doppler, glissando) de manera immediata i corporal. La propagació és visible en un mapa animat només si t'hi fixes molt; en so, el barret del moviment és inevitable: el sents passar.

**Experiència de l'oient.** Arpegis i glissandi que recorren l'espai estèreo seguint el tren per les estacions. Cascades sonores que "viatgen" de cap a cap d'una línia. La ciutat com a medi pel qual es propaguen ones.

**Estratègia sonora.** Mapejar l'ordre d'estacions a un eix tonal o espacial: una arribada que avança per la línia dispara notes successives → una melodia que es desplaça. Pan segons geografia; lleuger Doppler en acostar-se/allunyar-se d'un punt d'escolta.

---

## 6. Centralitat / jerarquia de nodes (l'esquelet audible)

**Propietat audible.** No tots els nodes són iguals: els intercanviadors d'alta **betweenness** (Diagonal, Catalunya, Sants, Passeig de Gràcia, Espanya) concentren molt més flux i connectivitat. La centralitat és una propietat estructural del graf (documentada per a sistemes de metro del món).

**Per què interessa.** L'oïda jerarquitza sense esforç via volum, registre i timbre: pot posar uns elements en **primer pla** i altres al fons. Així es fa **sentir l'esquelet** de la xarxa —quins nodes la sostenen— alguna cosa que un mapa tracta tots els punts gairebé igual.

**Experiència de l'oient.** Els grans intercanviadors sonen com a **òrgans greus i ressonants**, àncores recurrents del paisatge; les estacions perifèriques, com a detalls aguts i esparsos. Reconeixes el centre de gravetat de la ciutat només escoltant.

**Estratègia sonora.** Pes = centralitat (betweenness o nombre de línies). Node central → registre greu, més harmònics, més reverb/sustain. Node perifèric → agut, sec, breu. La forma del graf esdevé orquestració.

---

## 7. Ressonància de la topologia (la xarxa com a graf que vibra)

**Propietat audible.** Quan arriba un tren a un intercanviador, l'"energia" pot **propagar-se simpàticament** als nodes connectats, sonificant directament les **connexions del graf** (camins, veïnatges, accessibilitat) i no només els esdeveniments aïllats.

**Per què interessa.** Fa audible la **connectivitat** —què està enllaçat amb què— que en un mapa és un embull de línies encreuades. L'oïda segueix molt bé el *call-and-response* a través de l'espai: un node "respon" a un altre i percebem el cablejat.

**Experiència de l'oient.** Com cordes simpàtiques d'una sitar o un piano amb el pedal: tocar un node fa vibrar lleugerament els seus veïns. La xarxa sona "connectada", teixida; sents l'estructura, no només els punts.

**Estratègia sonora.** Graf d'adjacència → acoblament sonor. Una arribada excita el seu node i envia una excitació atenuada als nodes adjacents (ressonadors). Inspiració: physical modeling, xarxes de guies d'ona, sympathetic strings.

---

## 8. Densitat espacial mòbil (la meteorologia de l'activitat)

**Propietat audible.** On es **concentra** l'activitat geogràficament en cada moment: el centre se satura a hora punta, la perifèria queda en silenci; els punts calents es desplacen al llarg del dia. És un camp de densitat espai-temporal.

**Per què interessa.** Amb escolta espacial (estèreo/binaural), l'oïda **localitza** i percep la densitat com a gruix de textura. Es fa sentir el "temps meteorològic" de la ciutat —on plou activitat ara mateix— d'una manera immersiva que un *heatmap* estàtic no transmet.

**Experiència de l'oient.** Una atmosfera que es mou: nuvolades d'activitat que es formen sobre el centre i s'esvaeixen cap als barris. Pots tancar els ulls i "apuntar" cap on bull la ciutat.

**Estratègia sonora.** Espacialització binaural segons les coordenades reals de les estacions. Densitat local → gruix espectral i nombre de veus en aquella regió de l'espai. La ciutat com a paisatge sonor navegable amb les orelles.

---

## 9. El ritme circadià (el dia com a macro-forma)

**Propietat audible.** El **pols urbà** a gran escala: matinada en repòs, dues crestes d'hora punta, vall del migdia, tancament nocturn, contrast feiner/cap de setmana. Un macro-ritme de 24 h.

**Per què interessa.** És el comportament col·lectiu emergent més humà de tots, i l'oïda percep molt bé les **envolupants de tempo i densitat** —sobretot comprimides en *time-lapse* (un dia en cinc minuts, com el *Tomato Quintet* de Chafe). Revela la forma del dia que cap instant individual conté.

**Experiència de l'oient.** En directe: una respiració lenta de fons. En time-lapse: una peça amb arc dramàtic real —despertar, accelerar, culminar, calmar, dormir— composta per la ciutat mateixa.

**Estratègia sonora.** Densitat global → tempo i energia d'una capa lenta de fons (sense drons artificials: l'energia surt de la freqüència real d'esdeveniments). Mode "rebobinar el dia" que comprimeix el temps i fa audible el cicle.

---

## 10. Anomalies i ruptures de ritme (el sentit de l'inesperat)

**Propietat audible.** La **ruptura d'un patró establert**: un buit anòmal, un *bunching* sobtat, una línia que emmudeix, una irregularitat fora de norma. Possible incident de servei.

**Per què interessa.** L'oïda és extraordinària detectant el que **trenca** una regularitat: un batec que falta, un silenci inesperat, salta a la consciència immediatament (és un mecanisme de vigilància evolutiu). Sovint **sentiries un problema abans de veure'l** en un panell.

**Experiència de l'oient.** Sobre una textura estable i previsible, una anomalia "punxa": un sobtat buit, un ensopec rítmic, una veu que desapareix. La normalitat es torna fons i l'excepció, figura.

**Estratègia sonora.** Establir una base rítmica regular i fiable perquè les desviacions ressaltin soles (no cal sonificar l'anomalia: emergeix del contrast). Opcionalment, marcar buits superiors a l'esperat amb silenci accentuat o un canvi de timbre.

---

## Síntesi: on l'oïda guanya de debò

Quatre direccions són les que millor compleixen el llistó "**impossible de veure, immediat de sentir**", perquè exploten exactament allò per què l'oïda és superior:

1. **Sincronització de fase (#1)** — l'oïda és un detector de batecs nat.
2. **Regularitat vs jitter (#2)** — discriminació temporal fina; a més, propietat molt barcelonina (auto vs manual).
3. **Coherència global (#3)** — un paràmetre d'ordre → consonància/soroll, l'estat del sistema sencer en un timbre.
4. **Marea pendular (#4)** — separació de fluxos direccionals → la ciutat respirant, però ancorada en dades.

La meva recomanació de **direcció rectora** per a AudioMetro:

> **La xarxa com a sistema d'oscil·ladors acoblats (Kuramoto urbà).**
> Tractar cada línia com un oscil·lador a la seva freqüència real de pas, fer-los **batre i sincronitzar-se acústicament** (#1, #2), i derivar-ne un **paràmetre de coherència global** que governi la consonància del conjunt (#3). Sobre aquesta base, la **centralitat** orquestra qui sona en primer pla (#6) i el **sentit** obre l'espai esquerra/dreta de la marea pendular (#4).

Per què aquesta és la idea forta i no només bonica:

- **Revela física real, no decoració.** Els batecs, les sincronies i la coherència *existeixen* a les dades; no els inventem. L'oclient sent una propietat verdadera del sistema.
- **És exactament el terreny on l'oïda derrota l'ull.** Fase, periodicitat i sincronia són invisibles en un mapa i evidents a l'orella.
- **Genera forma sola.** Les convergències i divergències de fase produeixen tensió i clímax sense composició manual: la ciutat es composa a si mateixa.
- **Escala a la riquesa de dades.** Aprofita sentit, *headways*, topologia i centralitat —no només "temps d'espera".
- **És honest amb el concepte d'organisme.** Un organisme és, precisament, un eixam d'oscil·ladors acoblats (cor, neurones, respiració). La metàfora deixa de ser decorativa i passa a ser estructural.

Les direccions #5 (propagació), #7 (ressonància de topologia), #8 (densitat espacial), #9 (circadià) i #10 (anomalies) són **capes o modes** que aquesta base pot anar absorbint, no alternatives excloents.

---

## Nota per a la propera fase

Quan passem a validar amb les orelles, la prova decisiva ja no és "sona bé una arribada?", sinó:
**quan deixo dues línies a les seves freqüències reals, l'oïda percep el batec de fase com a interessant?**
Es pot provar amb dades mock parametritzades (dues freqüències properes) abans de tocar res de TMB.

---

## Fonts

- [Derrible — *Network Centrality of Metro Systems* (PLOS ONE)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0040575)
- [*Exploring the association between network centralities and passenger flows in metro systems* (Applied Network Science)](https://appliednetsci.springeropen.com/articles/10.1007/s41109-023-00583-2)
- [Strogatz et al. — *Oscillators that sync and swarm* (model de Kuramoto)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5686229/)
- [*Rhythmic synchronization and hybrid collective states of globally coupled oscillators* (Scientific Reports)](https://www.nature.com/articles/s41598-018-31278-9)
- [*Exploring blazars through sonification* — avantatges perceptius de l'oïda (arXiv)](https://arxiv.org/pdf/2502.01929)
- [*Swarm Intelligence for Generative Music* (IEEE)](https://ieeexplore.ieee.org/document/5365338/)
- [Swarm Sonification — flocking/Boids sonificat (GitHub)](https://github.com/JackNGoodwin/Swarm-Sonification)
