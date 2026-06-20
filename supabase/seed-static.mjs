#!/usr/bin/env node
/* AudioMetro · carrega la xarxa estàtica a Supabase (taules stations + lines)
   des de network.json. Executa'l UN cop (i quan canviï la xarxa).

     SUPABASE_URL=https://<ref>.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
     node supabase/seed-static.mjs

   (Usa la service_role key perquè escriu; no la posis mai al frontend.)
   network.json ha d'incloure el camp `codes` (re-executa fetch-network.mjs si cal).
*/
import fs from 'node:fs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Falten SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const net = JSON.parse(fs.readFileSync('network.json', 'utf8'));
if (!net.codes || !Object.keys(net.codes).length) {
  console.error('network.json no té `codes`. Re-executa: node fetch-network.mjs'); process.exit(1);
}

// stations: una fila per CODI (els transbords tenen diversos codis amb el mateix nom)
const stations = Object.entries(net.codes).map(([code, name]) => {
  const s = net.stations[name] || {};
  return { code: Number(code), name, lat: s.lat ?? null, lon: s.lon ?? null,
           interchange: !!s.interchange, lines: s.lines ?? [] };
});
const lines = net.lines.map(L => ({ id: L.id, color: L.color, stations: L.stations }));

const upsert = async (table, rows, onConflict) => {
  const r = await fetch(`${URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY,
               'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`);
  console.log(`✓ ${table}: ${rows.length} files`);
};

await upsert('lines', lines, 'id');
await upsert('stations', stations, 'code');
console.log('Xarxa estàtica carregada a Supabase.');
