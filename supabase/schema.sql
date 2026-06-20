-- ════════════════════════════════════════════════════════════════════
-- AudioMetro · Esquema Supabase (Fase 1)
-- Taules: stations, lines (estàtiques) · arrivals (històric + present)
-- Executa-ho a Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════

-- ---------- ESTÀTIQUES (referència de la xarxa; es carreguen amb seed-static.mjs) ----------
create table if not exists stations (
  code        integer primary key,         -- codi_estacio de l'iMetro
  name        text not null,
  lat         double precision,
  lon         double precision,
  interchange boolean default false,
  lines       text[]
);

create table if not exists lines (
  id       text primary key,               -- L1, L9S, FM…
  color    text,
  stations text[]                          -- ordre real de la seqüència
);

-- ---------- DINÀMICA (arxiu d'arribades: memòria sonora des del dia 1) ----------
create table if not exists arrivals (
  id           bigint generated always as identity primary key,
  station_code integer not null,
  line         text not null,
  sentit       smallint not null,
  desti        text,
  codi_servei  text not null,
  t_arribada   timestamptz not null,       -- hora d'arribada (predicció més recent)
  captured_at  timestamptz not null default now(),
  service_date date not null               -- dia de servei (hora local) per deduplicar
);

-- una fila per tren/estació/sentit i dia → l'upsert actualitza t_arribada amb la predicció fresca
create unique index if not exists arrivals_uniq
  on arrivals (station_code, sentit, codi_servei, service_date);
create index if not exists arrivals_tarr     on arrivals (t_arribada);
create index if not exists arrivals_captured on arrivals (captured_at);

-- ---------- SEGURETAT (RLS: lectura pública; escriptura només service_role) ----------
alter table stations enable row level security;
alter table lines    enable row level security;
alter table arrivals enable row level security;

create policy "read stations" on stations for select to anon, authenticated using (true);
create policy "read lines"    on lines    for select to anon, authenticated using (true);
create policy "read arrivals" on arrivals for select to anon, authenticated using (true);
-- (les escriptures les fa l'Edge Function amb la service_role key, que salta la RLS)

-- ---------- API per al frontend ----------
-- Properes arribades (present) + hora del servidor per sincronitzar el rellotge.
create or replace function get_upcoming(horizon_minutes int default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'server_now', (extract(epoch from now()) * 1000)::bigint,
    'arrivals', coalesce(jsonb_agg(jsonb_build_object(
        'code',   station_code,
        'line',   line,
        'sentit', sentit,
        'desti',  desti,
        'servei', codi_servei,
        'tArr',   (extract(epoch from t_arribada) * 1000)::bigint
      ) order by t_arribada), '[]'::jsonb)
  )
  from arrivals
  where t_arribada between now() - interval '1 minute'
                       and now() + make_interval(mins => horizon_minutes);
$$;
grant execute on function get_upcoming(int) to anon, authenticated;

-- Arribades d'un interval històric (per a la "memòria sonora" / reproducció temporal — fase futura).
create or replace function get_arrivals(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code',   station_code,
      'line',   line,
      'sentit', sentit,
      'desti',  desti,
      'servei', codi_servei,
      'tArr',   (extract(epoch from t_arribada) * 1000)::bigint
    ) order by t_arribada), '[]'::jsonb)
  from arrivals
  where t_arribada >= p_from and t_arribada < p_to;
$$;
grant execute on function get_arrivals(timestamptz, timestamptz) to anon, authenticated;
