-- ════════════════════════════════════════════════════════════════════
-- AudioMetro · Taula de calibració compartida (posicions del mapa)
-- Executa-ho a Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════
create table if not exists layout (
  id         int primary key default 1,
  data       jsonb not null,            -- { "Nom estació": {fx,fy}, ... }
  updated_at timestamptz default now()
);
alter table layout enable row level security;

-- tothom pot LLEGIR la calibració (la web la carrega a l'arrencada)
drop policy if exists "read layout" on layout;
create policy "read layout" on layout for select to anon, authenticated using (true);

-- ESCRIPTURA: només l'admin autenticat (pas 4/5 de SEGURETAT-ADMIN.md).
-- Substitueix <EL-TEU-USER-UID> pel UID de l'usuari admin (Authentication → Users).
drop policy if exists "admin write layout" on layout;
create policy "admin write layout" on layout
  for all to authenticated
  using      (auth.uid() = '<EL-TEU-USER-UID>')
  with check (auth.uid() = '<EL-TEU-USER-UID>');

-- (Anon NO té policy d'escriptura → no pot escriure des del navegador.)
-- Alternativa sense Auth: deixar només la policy de lectura i escriure via
-- l'Edge Function save-layout (service_role + hash). Amb Auth, aquesta funció ja no cal.
