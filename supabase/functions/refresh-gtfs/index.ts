// ════════════════════════════════════════════════════════════════════
// AudioMetro · Edge Function "refresh-gtfs"
// Baixa el ZIP GTFS de TMB, parseja l'horari de L9/L10 i el persisteix a
// la taula gtfs_schedule. La crida un cron setmanal. 100% autònom.
//
// Secret necessari:  GTFS_URL  = URL del ZIP GTFS de TMB (amb app_id/app_key si cal)
// (SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY ja hi són.)
//
// Desplegament:  supabase functions deploy refresh-gtfs --no-verify-jwt
//
// Nota: parsejar un GTFS gran té cost de memòria/CPU. Si l'Edge Function
// no se'n surt amb el ZIP complet, fes servir el flux de GitHub Actions
// (scripts/build-schedule.mjs), que escriu a la mateixa taula.
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const LINES_WANT = new Set(["L9N", "L9S", "L10N", "L10S"]);

function parseLine(line: string): string[] {
  const o: string[] = []; let c = "", q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i];
    if (q) { if (ch === '"') { if (line[i+1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === ",") { o.push(c); c = ""; } else if (ch === '"') q = true; else c += ch; } }
  o.push(c); return o;
}
function rows(u8: Uint8Array) {
  const txt = new TextDecoder().decode(u8).split(/\r?\n/).filter(Boolean);
  const h = parseLine(txt[0]);
  return txt.slice(1).map((l) => { const v = parseLine(l); const r: Record<string,string> = {}; h.forEach((k,i)=>r[k]=v[i]); return r; });
}
const toSec = (hms: string) => { const [h,m,s] = hms.split(":").map(Number); return h*3600 + m*60 + (s||0); };

Deno.serve(async () => {
  try {
    const GTFS_URL = Deno.env.get("GTFS_URL");
    if (!GTFS_URL) return new Response("Falta el secret GTFS_URL", { status: 500 });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 0) codis d'estació (nom → codi) des de la taula stations
    const { data: sts, error: e0 } = await sb.from("stations").select("code,name");
    if (e0) return new Response("DB stations: " + e0.message, { status: 500 });
    const nameToCode: Record<string, number> = {};
    for (const s of sts ?? []) if (nameToCode[s.name] == null) nameToCode[s.name] = s.code;

    // 1) baixa i descomprimeix només els fitxers necessaris
    const zipBuf = new Uint8Array(await (await fetch(GTFS_URL)).arrayBuffer());
    const need = new Set(["routes.txt","trips.txt","stops.txt","stop_times.txt","calendar.txt","calendar_dates.txt"]);
    const files = unzipSync(zipBuf, { filter: (f) => need.has(f.name) });

    // 2) rutes volgudes
    const routeLine: Record<string,string> = {};
    for (const r of rows(files["routes.txt"])) if (LINES_WANT.has(r.route_short_name)) routeLine[r.route_id] = r.route_short_name;

    // 3) dies de servei. TMB usa calendar_dates.txt (una entrada per data) per a L9/L10. Construïm una
    // SETMANA REPRESENTATIVA: per cada dia de la setmana, la seva data més recent amb trens → aquell dia.
    const cal    = files["calendar.txt"]       ? rows(files["calendar.txt"])       : [];
    const cdates = files["calendar_dates.txt"] ? rows(files["calendar_dates.txt"]) : [];
    // 4) trips crus + serveis usats
    const rawTrips: {id:string;sid:string;line:string;sentit:number;desti:string}[] = [];
    const usedSids = new Set<string>();
    for (const t of rows(files["trips.txt"])) {
      const line = routeLine[t.route_id]; if (!line) continue;
      rawTrips.push({ id:t.trip_id, sid:t.service_id, line, sentit:t.direction_id==="0"?1:2, desti:t.trip_headsign });
      usedSids.add(t.service_id);
    }
    const z = (n:number)=>String(n).padStart(2,"0"); const _d = new Date();
    const TODAY = +`${_d.getFullYear()}${z(_d.getMonth()+1)}${z(_d.getDate())}`;
    const wdayOf = (ymd:number)=>{const s=String(ymd);return new Date(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8)).getDay();};
    const dow: Record<string,number> = {};
    const dateSv: Record<number,Set<string>> = {};
    for (const e of cdates) { if (e.exception_type!=="1") continue; if (!usedSids.has(e.service_id)) continue;
      (dateSv[+e.date] || (dateSv[+e.date]=new Set())).add(e.service_id); }
    const datesWithSv = Object.keys(dateSv).map(Number).sort((a,b)=>a-b);
    const chosen: Record<number,number> = {};
    for (const d of datesWithSv) { if (d>TODAY) continue; const wd=wdayOf(d); if (chosen[wd]==null||d>chosen[wd]) chosen[wd]=d; }
    for (const d of datesWithSv) { const wd=wdayOf(d); if (chosen[wd]==null) chosen[wd]=d; }
    for (const wd in chosen) { const d=chosen[wd]; const bit=1<<wdayOf(d); for (const sid of dateSv[d]) dow[sid]=(dow[sid]||0)|bit; }
    for (const c of cal) { if (dow[c.service_id]!=null) continue; let m=0;
      if (c.sunday==="1")m|=1; if (c.monday==="1")m|=2; if (c.tuesday==="1")m|=4; if (c.wednesday==="1")m|=8;
      if (c.thursday==="1")m|=16; if (c.friday==="1")m|=32; if (c.saturday==="1")m|=64; dow[c.service_id]=m; }
    const noInfo = Object.keys(dow).length === 0;
    const trips: Record<string,{line:string;sentit:number;desti:string;mask:number}> = {};
    for (const t of rawTrips) {
      const mask = noInfo ? 127 : (dow[t.sid] || 0); if (!mask) continue;
      trips[t.id] = { line:t.line, sentit:t.sentit, desti:t.desti, mask };
    }

    // 5) stop_id → nom
    const stopName: Record<string,string> = {};
    for (const s of rows(files["stops.txt"])) stopName[s.stop_id] = s.stop_name;

    // 6) stop_times (gran): escaneig per bytes per estalviar memòria → agrupa per trip
    const buf = files["stop_times.txt"]; const dec = new TextDecoder();
    const byTrip = new Map<string, any[]>(); let start = 0, header = true;
    for (let i = 0; i <= buf.length; i++) {
      if (i === buf.length || buf[i] === 10) {
        const end = (i>0 && buf[i-1]===13) ? i-1 : i;
        const line = dec.decode(buf.subarray(start, end)); start = i+1;
        if (header) { header = false; continue; }
        if (!line) continue;
        const f = line.split(",");                 // stop_times no porta cometes
        const tr = trips[f[0]]; if (!tr) continue;
        const name = stopName[f[3]]; if (!name) continue;
        const code = nameToCode[name]; if (code == null) continue;
        let a = byTrip.get(f[0]); if (!a) { a = []; byTrip.set(f[0], a); }
        a.push({ line: tr.line, station_code: code, sentit: tr.sentit, desti: tr.desti,
                 depart_sec: toSec(f[2] || f[1]), dow_mask: tr.mask, trip: f[0] });
      }
    }

    // 6b) DEDUP de trips clonats: mateix horari (estació:segon) → un de sol (fusiona els dies).
    const sigMap = new Map<string, any[]>(); const order: any[][] = []; let clones = 0;
    for (const recs of byTrip.values()) {
      recs.sort((x,y)=>x.depart_sec-y.depart_sec);
      const sig = recs[0].line + "|" + recs.map(r=>r.station_code+":"+r.depart_sec).join(",");
      const ex = sigMap.get(sig);
      if (ex) { clones++; const m = recs[0].dow_mask; for (const r of ex) r.dow_mask |= m; continue; }
      sigMap.set(sig, recs); order.push(recs);
    }
    const out: any[] = []; for (const recs of order) for (const r of recs) out.push(r);

    // 7) reemplaça la taula
    await sb.from("gtfs_schedule").delete().neq("trip", "");
    for (let i = 0; i < out.length; i += 1000) {
      const { error } = await sb.from("gtfs_schedule").insert(out.slice(i, i + 1000));
      if (error) return new Response("DB insert: " + error.message, { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, files: Object.keys(files).length, rows: out.length,
      trips: byTrip.size, clones, lines: [...new Set(out.map(r=>r.line))] }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response("Error: " + String((e as any)?.message ?? e), { status: 500 });
  }
});
