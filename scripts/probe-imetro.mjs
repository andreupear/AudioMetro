#!/usr/bin/env node
/* AudioMetro · sonda per confirmar l'estratègia d'ingestió iMetro (NO desplega res).
   Comprova si una sola crida amb tots els codis retorna tota la xarxa.

     node probe-imetro.mjs "<BASE_URL_metro_estacions>"

   <BASE_URL> = l'endpoint iMetro SENSE el paràmetre ?estacions
   (la base de la URL amb què vas obtenir imetro-sample.json).
   Llegeix credencials de tmb_credentials.txt i codis de network.json.
*/
import fs from 'node:fs';

const cred = Object.fromEntries(
  fs.readFileSync('tmb_credentials.txt','utf8').trim().split('\n').map(l=>l.split('=').map(s=>s.trim()))
);
const auth = `app_id=${cred.TMB_APP_ID}&app_key=${cred.TMB_APP_KEY}`;
const RAW = process.argv.find(a => a.startsWith('http'));
if (!RAW) {
  console.error('Ús: node probe-imetro.mjs "<URL>"');
  console.error('  Enganxa la URL que vas fer servir per treure imetro-sample.json (sencera, amb o sense paràmetres).');
  console.error('  Candidats probables si no la recordes:');
  console.error('    https://api.tmb.cat/v1/imetro/estacions');
  console.error('    https://api.tmb.cat/v1/imetro/metro/estacions');
  process.exit(1);
}
// neteja: treu estacions/app_id/app_key de la URL i es queda amb la base
const parsed = new URL(RAW);
for (const p of ['estacions','app_id','app_key']) parsed.searchParams.delete(p);
const BASE = parsed.origin + parsed.pathname + (parsed.searchParams.toString() ? '?' + parsed.searchParams.toString() : '');

const net = JSON.parse(fs.readFileSync('network.json','utf8'));
const codes = Object.keys(net.codes || {});
if (!codes.length) { console.error('network.json no té `codes`.'); process.exit(1); }

const buildUrl = csv => BASE + (BASE.includes('?') ? '&' : '?') + `estacions=${csv}&${auth}`;
console.log('Base detectada:', BASE);

async function call(label, csv) {
  const url = buildUrl(csv);
  let r, text;
  try { r = await fetch(url); text = await r.text(); }
  catch (e) { console.log(`${label}: ERROR de xarxa ${e.message}`); return null; }
  let j = null; try { j = JSON.parse(text); } catch {}
  const nLin = j?.linies?.length || 0;
  const nEst = (j?.linies || []).reduce((a, L) => a + (L?.estacions?.length || 0), 0);
  console.log(`${label}\n  HTTP ${r.status} · urlLen ${url.length} · bytes ${text.length} · línies ${nLin} · estacions ${nEst}`);
  if (r.status !== 200) console.log('  resposta:', text.slice(0, 200));
  return { nEst, nLin };
}

console.log(`Codis coneguts: ${codes.length}\n`);
await call('① una sola estació (' + codes[0] + ')', codes[0]);
console.log('');
const all = await call(`② TOTS els codis (${codes.length})`, codes.join(','));

console.log('\nConclusió:');
if (all && all.nEst >= 100) console.log('  ✅ Una sola crida retorna (gairebé) tota la xarxa → ingestió amb 1 crida/2 min.');
else if (all && all.nEst > 0) console.log('  ⚠️ Retorna parcial: potser hi ha límit de codis per crida → cal batching.');
else console.log('  ❌ No retorna res amb tots els codis: revisa la URL base o el tipus de codi (codi_estacio vs codi_grup_estacio).');
