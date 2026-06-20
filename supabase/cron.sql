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

-- Comprovacions útils:
--   select * from cron.job;                                   -- veure la tasca
--   select * from cron.job_run_details order by start_time desc limit 5;  -- últimes execucions
--   select count(*), max(captured_at) from arrivals;          -- l'històric ha de créixer cada 2 min
--   select cron.unschedule('ingest-imetro-2min');             -- aturar-la
