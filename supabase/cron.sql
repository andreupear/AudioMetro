-- ════════════════════════════════════════════════════════════════════
-- AudioMetro · Supabase Cron — invoca ingest-imetro cada 2 min
-- Requisits: activa les extensions pg_cron i pg_net
--   (Dashboard → Database → Extensions → activa "pg_cron" i "pg_net")
-- Substitueix <SERVICE_ROLE_KEY> pel teu valor (Project Settings → API).
-- El project ref ja està posat: lvxwomfnvyuhjyssihrm
-- ════════════════════════════════════════════════════════════════════

select cron.schedule(
  'ingest-imetro-2min',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://lvxwomfnvyuhjyssihrm.supabase.co/functions/v1/ingest-imetro',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Refresc setmanal de l'horari GTFS (L9/L10) — dilluns 03:30
select cron.schedule(
  'refresh-gtfs-setmanal',
  '30 3 * * 1',
  $$
  select net.http_post(
    url     := 'https://lvxwomfnvyuhjyssihrm.supabase.co/functions/v1/refresh-gtfs',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 280000
  );
  $$
);

-- Comprovacions útils:
--   select * from cron.job;                                   -- veure les tasques
--   select * from cron.job_run_details order by start_time desc limit 5;  -- últimes execucions
--   select count(*), max(captured_at) from arrivals;          -- l'històric ha de créixer cada 2 min
--   select line, count(*) from gtfs_schedule group by line;   -- horari carregat (L9/L10)
--   select cron.unschedule('ingest-imetro-2min');
--   select cron.unschedule('refresh-gtfs-setmanal');
