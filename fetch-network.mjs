#!/usr/bin/env node
/* AudioMetro · baixa la xarxa real de metro des de l'API de TMB → network.json
   Executa'l a la TEVA màquina (té sortida a internet, el sandbox de Claude no):
       node fetch-network.mjs
   Llegeix les credencials de tmb_credentials.txt (mateixa carpeta).
   Resultat: network.json amb línies, estacions ordenades, coordenades i intercanviadors.
*/
import fs from 'node:fs';

const cred = Object.fromEntries(
  fs.readFileSync('tmb_credentials.txt','utf8').trim().split('\n')
    .map(l=>l.split('=').map(s=>s.trim()))
);
const ID = cred.TMB_APP_ID, KEY = cred.TMB_APP_KEY;
const auth = `app_id=${ID}&app_key=${KEY}`;
const base = 'https://api.tmb.cat/v1/transit';

const get = async (u) => {
  const r = await fetch(u);
  if(!r.ok) throw new Error(`HTTP ${r.status} a ${u}`);
  return r.json();
};

// ordre real de les estacions per línia (autoritatiu; l'API no el dóna fiable)
const ORDER={
 L1:["Hospital de Bellvitge","Bellvitge","Av. Carrilet","Rambla Just Oliveras","Can Serra","Florida","Torrassa","Santa Eulàlia","Mercat Nou","Plaça de Sants","Hostafrancs","Espanya","Rocafort","Urgell","Universitat","Catalunya","Urquinaona","Arc de Triomf","Marina","Glòries","Clot","Navas","La Sagrera","Fabra i Puig","Sant Andreu","Torras i Bages","Trinitat Vella","Baró de Viver","Santa Coloma","Fondo"],
 L2:["Paral·lel","Sant Antoni","Universitat","Passeig de Gràcia","Tetuan","Monumental","Sagrada Família","Encants","Clot","Bac de Roda","Sant Martí","La Pau","Verneda","Artigues | Sant Adrià","Sant Roc","Gorg","Pep Ventura","Badalona Pompeu Fabra"],
 L3:["Zona Universitària","Palau Reial","Maria Cristina","Les Corts","Plaça del Centre","Sants Estació","Tarragona","Espanya","Poble Sec","Paral·lel","Drassanes","Liceu","Catalunya","Passeig de Gràcia","Diagonal","Fontana","Lesseps","Vallcarca","Penitents","Vall d'Hebron","Montbau","Mundet","Valldaura","Canyelles","Roquetes","Trinitat Nova"],
 L4:["Trinitat Nova","Via Júlia","Llucmajor","Maragall","Guinardó | Hospital de Sant Pau","Alfons X","Joanic","Verdaguer","Girona","Passeig de Gràcia","Urquinaona","Jaume I","Barceloneta","Ciutadella | Vila Olímpica","Bogatell","Llacuna","Poblenou","Selva de Mar","El Maresme | Fòrum","Besòs Mar","Besòs","La Pau"],
 L5:["Cornellà Centre","Gavarra","Sant Ildefons","Can Boixeres","Can Vidalet","Pubilla Cases","Ernest Lluch","Collblanc","Badal","Plaça de Sants","Sants Estació","Entença","Hospital Clínic","Diagonal","Verdaguer","Sagrada Família","Sant Pau | Dos de Maig","Camp de l'Arpa","La Sagrera","Congrés","Maragall","Virrei Amat","Vilapicina","Horta","El Carmel","El Coll | La Teixonera","Vall d'Hebron"],
 L9N:["La Sagrera","Onze de Setembre","Bon Pastor","Can Peixauet","Santa Rosa","Fondo","Església Major","Singuerlín","Can Zam"],
 L9S:["Aeroport T1","Aeroport T2","Mas Blau","Parc Nou","Cèntric","El Prat Estació","Les Moreres","Mercabarna","Parc Logístic","Fira","Europa | Fira","Can Tries | Gornal","Torrassa","Collblanc","Zona Universitària"],
 L10N:["La Sagrera","Onze de Setembre","Bon Pastor","Llefià","La Salut","Gorg"],
 L10S:["Collblanc","Torrassa","Can Tries | Gornal","Provençana","Ciutat de la Justícia","Foneria","Foc","Zona Franca","Port Comercial | La Factoria","Ecoparc","ZAL | Riu Vell"],
 L11:["Trinitat Nova","Casa de l'Aigua","Torre Baró | Vallbona","Ciutat Meridiana","Can Cuiàs"],
 FM:["Paral·lel","Parc de Montjuïc"],
};
// reordena estacions sense ordre fiable: extrems + cadena de veí més proper
const d2 = (a,b)=>{const dx=a.lon-b.lon,dy=a.lat-b.lat;return dx*dx+dy*dy;};
function orderByGeo(arr){
  if(arr.length<3) return arr;
  let A=0,best=-1;
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){const d=d2(arr[i],arr[j]);if(d>best){best=d;A=i;}}
  const used=new Array(arr.length).fill(false); used[A]=true;
  const path=[arr[A]]; let cur=arr[A];
  while(path.length<arr.length){
    let nn=-1,nd=Infinity;
    for(let i=0;i<arr.length;i++){if(used[i])continue;const d=d2(cur,arr[i]);if(d<nd){nd=d;nn=i;}}
    used[nn]=true; path.push(arr[nn]); cur=arr[nn];
  }
  return path;
}

const run = async () => {
  // 1) línies de metro
  const linies = await get(`${base}/linies/metro?${auth}`);
  const out = { generatAt: Date.now(), lines: [], stations: {}, codes: {} };

  for (const lf of linies.features) {
    const p = lf.properties;
    const codi = p.CODI_LINIA;          // identificador intern
    const lineId = p.NOM_LINIA;         // p.ex. "L3"
    const color = '#' + (p.COLOR_LINIA || '888888');

    // 2) estacions de la línia (amb geometria/coordenades)
    const est = await get(`${base}/linies/metro/${codi}/estacions?${auth}`);
    let pts = est.features.map(f => {
      const sp = f.properties;
      const [lon,lat] = f.geometry.coordinates;     // GeoJSON: [lon,lat]
      const name = sp.NOM_ESTACIO;
      const ordre = sp.ORDRE_ESTACIO_LINIA ?? sp.ORDRE_ESTACIO ?? sp.ORDRE ?? null;
      if(!out.stations[name]) out.stations[name] = { name, lat, lon, lines: [] };
      if(!out.stations[name].lines.includes(lineId)) out.stations[name].lines.push(lineId);
      // codi(s) d'estació → nom, per lligar les arribades iMetro (camp codi_estacio)
      for (const cf of ['CODI_ESTACIO','CODI_GRUP_ESTACIO']) {
        if (sp[cf] != null) out.codes[String(sp[cf])] = name;
      }
      return { name, lat, lon, ordre };
    });

    // ordena: ordre real conegut > camp d'ordre de l'API > geomètric
    const ord = ORDER[lineId];
    if (ord) {
      const extra = pts.filter(p => !ord.includes(p.name)).map(p=>p.name);
      if (extra.length) console.log(`  ⚠ ${lineId}: estacions fora de l'ordre conegut: ${extra.join(', ')}`);
      pts.sort((a,b)=>{
        const ia = ord.indexOf(a.name), ib = ord.indexOf(b.name);
        return (ia<0?1e9:ia) - (ib<0?1e9:ib);
      });
    } else if (pts.every(p => p.ordre != null)) {
      pts.sort((a,b)=> a.ordre - b.ordre);
    } else {
      pts = orderByGeo(pts);
    }

    out.lines.push({ id: lineId, color, stations: pts.map(p=>p.name) });
    console.log(`✓ ${lineId}  ${out.lines.at(-1).stations.length} estacions`);
  }

  // intercanviadors = estacions amb més d'una línia
  for (const s of Object.values(out.stations)) s.interchange = s.lines.length > 1;

  fs.writeFileSync('network.json', JSON.stringify(out, null, 2));
  fs.writeFileSync('network-data.js', 'window.NETWORK = ' + JSON.stringify(out) + ';\n');
  console.log(`\nDesat network.json + network-data.js · ${out.lines.length} línies · ${Object.keys(out.stations).length} estacions · ${Object.keys(out.codes).length} codis`);
};

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
