-- ════════════════════════════════════════════════════════════════════
-- AudioMetro · Horari programat (GTFS) per a L9/L10 + get_upcoming fusionat
-- Executa-ho al SQL Editor (després de schema.sql).
-- ════════════════════════════════════════════════════════════════════

create table if not exists gtfs_schedule (
  line         text     not null,
  station_code integer  not null,      -- codi compatible amb network-data.js (CODES)
  sentit       smallint not null,      -- 1 / 2
  desti        text,
  depart_sec   integer  not null,      -- segons des de mitjanit local (pot superar 86400)
  dow_mask     smallint not null,      -- bits 0..6 = diumenge..dissabte on circula
  trip         text     not null       -- id del tren (compta trens únics)
);
create index if not exists gtfs_sched_depart on gtfs_schedule(depart_sec);

alter table gtfs_schedule enable row level security;
drop policy if exists "read gtfs" on gtfs_schedule;
create policy "read gtfs" on gtfs_schedule for select to anon, authenticated using (true);
-- escriptura: només la service_role (Edge Function refresh-gtfs). Cap policy per a anon.

-- ──────────────────────────────────────────────────────────────────
-- get_upcoming() FUSIONAT: temps real (arrivals) + horari (gtfs_schedule)
-- ──────────────────────────────────────────────────────────────────
create or replace function get_upcoming(horizon_minutes int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  with l as (select (now() at time zone 'Europe/Madrid') as lt),
  p as (
    select extract(epoch from (lt - date_trunc('day', lt)))::int as now_sec,
           extract(dow from lt)::int as dow,
           lt::date as d
    from l
  ),
  rt as (   -- temps real
    select station_code as code, line, sentit, desti, codi_servei as servei,
           (extract(epoch from t_arribada)*1000)::bigint as tarr
    from arrivals
    where t_arribada between now() - interval '1 minute'
                         and now() + make_interval(mins => horizon_minutes)
  ),
  sch as (  -- horari programat per al dia i la finestra actuals
    select g.station_code as code, g.line, g.sentit, g.desti, g.trip as servei,
           (extract(epoch from ((p.d + make_interval(secs => g.depart_sec))
                                 at time zone 'Europe/Madrid'))*1000)::bigint as tarr
    from gtfs_schedule g, p
    where (g.dow_mask & (1 << p.dow)) <> 0
      and g.depart_sec between p.now_sec - 60 and p.now_sec + horizon_minutes*60
  )
  select jsonb_build_object(
    'server_now', (extract(epoch from now())*1000)::bigint,
    'arrivals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',code,'line',line,'sentit',sentit,'desti',desti,'servei',servei,'tArr',tarr
      ) order by tarr)
      from (select * from rt union all select * from sch) u
    ), '[]'::jsonb)
  );
$$;
grant execute on function get_upcoming(int) to anon, authenticated;
