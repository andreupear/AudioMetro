#!/usr/bin/env node
/* AudioMetro · baixa les arribades reals iMetro → imetro.json + imetro-data.js
   Executa'l a la TEVA màquina (té internet; el sandbox no):

     node fetch-imetro.mjs "<URL_EXACTA_DE_IMETRO>"          # un cop
     node fetch-imetro.mjs "<URL_EXACTA_DE_IMETRO>" --watch  # cada 2 min

   La URL és la mateixa amb què vas obtenir imetro-sample.json.
   També es pot fixar amb la variable d'entorn IMETRO_URL.
   Les credencials (app_id/app_key) es llegeixen de tmb_credentials.txt i s'afegeixen soles.
*/
import fs from 'node:fs';

const cred = Object.fromEntries(
  fs.readFileSync('tmb_credentials.txt','utf8').trim().split('\n').map(l=>l.split('=').map(s=>s.trim()))
);
const ID = cred.TMB_APP_ID, KEY = cred.TMB_APP_KEY;

let URL_BASE = process.argv.find(a=>a.startsWith('http')) || process.env.IMETRO_URL
  || 'https://api.tmb.cat/v1/itransit/metro/estacions';
// injecta TOTS els codis d'estació de network.json (tota la xarxa en 1 crida)
const net = JSON.parse(fs.readFileSync('network.json','utf8'));
const codes = Object.keys(net.codes || {});
if (!codes.length) { console.error('network.json no té `codes`. Executa: node fetch-network.mjs'); process.exit(1); }
const buildUrl = () => {
  const u = new URL(URL_BASE);
  u.searchParams.set('estacions', codes.join(','));
  u.searchParams.set('app_id', ID);
  u.searchParams.set('app_key', KEY);
  return u.toString();
};

async function once(){
  const r = await fetch(buildUrl());
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  fs.writeFileSync('imetro.json', JSON.stringify(j));
  fs.writeFileSync('imetro-data.js', 'window.IMETRO = ' + JSON.stringify(j) + ';\n');
  const nEst = (j.linies||[]).reduce((a,L)=>a+(L.estacions||[]).length,0);
  const nTr  = (j.linies||[]).reduce((a,L)=>a+(L.estacions||[]).reduce((b,e)=>
    b+(e.linies_trajectes||[]).reduce((c,t)=>c+(t.propers_trens||[]).length,0),0),0);
  console.log(`${new Date().toLocaleTimeString()}  OK · línies ${(j.linies||[]).length} · estacions ${nEst} · arribades ${nTr}`);
}

await once().catch(e=>{ console.error('Error:', e.message); process.exit(1); });
if (process.argv.includes('--watch')) {
  console.log('Mode --watch: actualitzant cada 2 min. Atura amb Ctrl+C.');
  setInterval(()=>once().catch(e=>console.error('Error:', e.message)), 120000);
}
