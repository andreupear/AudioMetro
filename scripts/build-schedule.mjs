#!/usr/bin/env node
/* AudioMetro · GTFS → taula gtfs_schedule (horari de L9/L10)
   Fallback robust de l'Edge Function refresh-gtfs (i el que fa servir GitHub Actions).

     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/build-schedule.mjs [carpeta_gtfs]

   - carpeta_gtfs: GTFS ja descomprimit (def: "gtfs")
   - Si no hi ha credencials Supabase, escriu gtfs_schedule.json local (per inspecció).
   Mapeja les parades amb network.json (arrel). Calcula dow_mask (dies que circula cada servei).
*/
import fs from 'node:fs';
import readline from 'node:readline';

const GTFS = process.argv.slice(2).find(a => !a.startsWith('-')) || 'gtfs';
const LINES_WANT = new Set(['L9N','L9S','L10N','L10S']);
const path = f => `${GTFS}/${f}`;
const exists = f => fs.existsSync(path(f));

function parseLine(line){const o=[];let c='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];
  if(q){if(ch==='"'){if(line[i+1]==='"'){c+='"';i++;}else q=false;}else c+=ch;}
  else{if(ch===','){o.push(c);c='';}else if(ch==='"')q=true;else c+=ch;}}o.push(c);return o;}
function readCSV(f){const t=fs.readFileSync(path(f),'utf8').split(/\r?\n/).filter(Boolean);
  const h=parseLine(t[0]);return t.slice(1).map(l=>{const v=parseLine(l);const r={};h.forEach((k,i)=>r[k]=v[i]);return r;});}
const toSec = hms => { const [h,m,s]=hms.split(':').map(Number); return h*3600+m*60+(s||0); };

// rutes
const routeLine={}; for(const r of readCSV('routes.txt')) if(LINES_WANT.has(r.route_short_name)) routeLine[r.route_id]=r.route_short_name;
// dies per servei. TMB defineix el servei de L9/L10 amb calendar_dates.txt (una entrada per data
// d'operació), no amb calendar.txt. Construïm una SETMANA REPRESENTATIVA: per a cada dia de la
// setmana agafem la seva data més recent amb trens i li assignem aquell dia. Així hi ha dades,
// es preserva feiner/cap de setmana i queda un sol clon per tren.
const cal    = exists('calendar.txt')       ? readCSV('calendar.txt')       : [];
const cdates = exists('calendar_dates.txt') ? readCSV('calendar_dates.txt') : [];
// trips crus + serveis usats
const rawTrips=[]; const usedSids=new Set();
for(const t of readCSV('trips.txt')){const line=routeLine[t.route_id];if(!line)continue;
  rawTrips.push({id:t.trip_id,sid:t.service_id,line,sentit:t.direction_id==='0'?1:2,desti:t.trip_headsign});
  usedSids.add(t.service_id);}
const z=n=>String(n).padStart(2,'0'); const _d=new Date();
const TODAY=+`${_d.getFullYear()}${z(_d.getMonth()+1)}${z(_d.getDate())}`;
const wdayOf=ymd=>{const s=String(ymd);return new Date(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8)).getDay();}; // 0=dg..6=ds
const dow={};   // service_id → màscara de dies
// via A — calendar_dates.txt (exception_type=1 = circula aquell dia), només serveis amb trens
const dateSv={};
for(const e of cdates){ if(e.exception_type!=='1')continue; if(!usedSids.has(e.service_id))continue;
  (dateSv[+e.date]||(dateSv[+e.date]=new Set())).add(e.service_id); }
const datesWithSv=Object.keys(dateSv).map(Number).sort((a,b)=>a-b);
const chosen={};  // dia_setmana → data representativa
for(const d of datesWithSv){ if(d>TODAY)continue; const wd=wdayOf(d); if(chosen[wd]==null||d>chosen[wd]) chosen[wd]=d; } // més recent ≤ avui
for(const d of datesWithSv){ const wd=wdayOf(d); if(chosen[wd]==null) chosen[wd]=d; }                                  // si cap ≤ avui, la més propera
for(const wd in chosen){ const d=chosen[wd]; const bit=1<<wdayOf(d); for(const sid of dateSv[d]) dow[sid]=(dow[sid]||0)|bit; }
// via B — calendar.txt per als serveis que no surtin per dates
for(const c of cal){ if(dow[c.service_id]!=null)continue; let m=0;
  if(c.sunday==='1')m|=1;if(c.monday==='1')m|=2;if(c.tuesday==='1')m|=4;if(c.wednesday==='1')m|=8;
  if(c.thursday==='1')m|=16;if(c.friday==='1')m|=32;if(c.saturday==='1')m|=64;dow[c.service_id]=m;}
const noInfo=Object.keys(dow).length===0;
console.log(`Servei: avui ${TODAY} · dates amb trens: ${datesWithSv.length} · setmana representativa: ${Object.values(chosen).sort().join(',')||'(cap)'}`);
const trips={};
for(const t of rawTrips){ const mask = noInfo?127:(dow[t.sid]||0); if(!mask)continue;
  trips[t.id]={line:t.line,sentit:t.sentit,desti:t.desti,mask};}
// stops
const stopName={}; for(const s of readCSV('stops.txt')) stopName[s.stop_id]=s.stop_name;
// nom → codi (network.json)
const net=JSON.parse(fs.readFileSync('network.json','utf8'));
const nameToCode={}; for(const c in net.codes){ if(nameToCode[net.codes[c]]==null) nameToCode[net.codes[c]]=+c; }

console.log('Rutes:',Object.values(routeLine).join(', '),'· trips:',Object.keys(trips).length);

// stop_times (stream) → agrupa per trip
const byTrip=new Map(); const unmatched=new Set();
const rl=readline.createInterface({input:fs.createReadStream(path('stop_times.txt')),crlfDelay:Infinity});
let header=true;
for await (const line of rl){
  if(header){header=false;continue;}
  const c=line.indexOf(','); if(c<0)continue;
  const tripId=line.slice(0,c); const tr=trips[tripId]; if(!tr)continue;
  const f=line.split(',');
  const name=stopName[f[3]]; if(!name)continue;
  const code=nameToCode[name]; if(code==null){unmatched.add(name);continue;}
  let a=byTrip.get(tripId); if(!a){a=[];byTrip.set(tripId,a);}
  a.push({line:tr.line,station_code:code,sentit:tr.sentit,desti:tr.desti,depart_sec:toSec(f[2]||f[1]),dow_mask:tr.mask,trip:tripId});
}
rl.close();
if(unmatched.size) console.warn('⚠ Parades sense codi:',[...unmatched].join(', '));

// DEDUP DE TRIPS CLONATS: dos trips amb el MATEIX horari (mateixa seqüència estació:segon)
// són clons del calendari de TMB → en queda un de sol. Així el compte de trens és real,
// passi el que passi amb els períodes/excepcions del GTFS.
const sigMap=new Map(); const order=[]; let clones=0;
for(const [,recs] of byTrip){
  recs.sort((x,y)=>x.depart_sec-y.depart_sec);
  const sig=recs[0].line+'|'+recs.map(r=>r.station_code+':'+r.depart_sec).join(',');
  const ex=sigMap.get(sig);
  if(ex){clones++; const m=recs[0].dow_mask; for(const r of ex)r.dow_mask|=m; continue;} // fusiona els dies del clon
  sigMap.set(sig,recs); order.push(recs);
}
const out=[]; for(const recs of order) for(const r of recs) out.push(r);
console.log(`Trips: ${byTrip.size} · clonats descartats: ${clones} · trips únics: ${byTrip.size-clones}`);
console.log('Files:',out.length,'· línies:',[...new Set(out.map(r=>r.line))].join(', '));

const URL=process.env.SUPABASE_URL, KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!URL||!KEY){ fs.writeFileSync('gtfs_schedule.json',JSON.stringify(out)); console.log('Sense credencials Supabase → desat gtfs_schedule.json local.'); process.exit(0); }

const H={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
// reemplaça la taula
let r=await fetch(`${URL}/rest/v1/gtfs_schedule?station_code=gte.0`,{method:'DELETE',headers:{...H,Prefer:'return=minimal'}});
if(!r.ok) throw new Error('DELETE '+r.status+' '+await r.text());
for(let i=0;i<out.length;i+=1000){
  r=await fetch(`${URL}/rest/v1/gtfs_schedule`,{method:'POST',headers:{...H,Prefer:'return=minimal'},body:JSON.stringify(out.slice(i,i+1000))});
  if(!r.ok) throw new Error('POST '+r.status+' '+await r.text());
}
console.log(`✓ gtfs_schedule actualitzada (${out.length} files).`);
