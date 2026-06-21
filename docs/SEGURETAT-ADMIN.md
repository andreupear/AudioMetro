# AudioMetro — Seguretat del mode admin amb Supabase

## El problema actual
El gate d'admin és un **hash SHA-256 al client**. Amaga la UI de desenvolupament al públic, però **no és seguretat real**: qualsevol pot llegir el JS, veure el hash i, editant el codi al navegador, activar el mode admin igualment. I si demà l'admin pogués **escriure** dades (p. ex. la calibració compartida a Supabase), aquest gate no protegiria res.

Regla d'or: **la UI no protegeix; protegeix el servidor.** La seguretat de debò es fa amb **Supabase Auth + RLS** (Row Level Security), de manera que encara que algú "activi" el mode admin al navegador, la base de dades **rebutgi** qualsevol escriptura que no vingui de l'admin autenticat.

---

## Arquitectura recomanada

```
Admin → Supabase Auth (email+contrasenya) → JWT de sessió
                                              │
         lectura pública (anon)  ────────────┤  RLS: SELECT per a tothom
         escriptura (calibració, etc.) ──────┘  RLS: només l'usuari admin
```

- **Mode admin = sessió autenticada** (no un hash). Si no hi ha sessió vàlida, no hi ha admin.
- Les **escriptures** (per exemple guardar la calibració compartida) només les permet la RLS a l'usuari admin. Un visitant anònim només pot **llegir**.

---

## Passos

### 1. Crear l'usuari admin (i tancar els registres públics)
- Supabase → **Authentication → Users → Add user** → posa el teu email + contrasenya.
- Authentication → **Providers / Sign In**: desactiva "Enable sign-ups" (que ningú més es pugui registrar).
- Anota el teu **user UID** (Authentication → Users) per a les polítiques.

### 2. Taula de calibració compartida (substitueix disposicio.json)
```sql
create table if not exists layout (
  id int primary key default 1,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table layout enable row level security;

-- tothom pot LLEGIR la calibració
create policy "read layout" on layout for select to anon, authenticated using (true);

-- només l'admin (autenticat, amb el teu UID) pot ESCRIURE
create policy "admin write layout" on layout
  for all to authenticated
  using  (auth.uid() = '<EL-TEU-USER-UID>')
  with check (auth.uid() = '<EL-TEU-USER-UID>');
```
> Així, encara que algú falsegi el mode admin al navegador, sense la sessió de l'admin la BD **denega** l'escriptura.

### 3. Protegir també les altres taules
- `arrivals`, `stations`, `lines`: deixa-les **només lectura** per a anon (com ja estan). Les escriu només l'Edge Function amb la service_role key (servidor), mai el navegador.
- Si afegeixes accions sensibles, fes-les en **Edge Functions que verifiquin el JWT** (sense `--no-verify-jwt`) i comprovin que és l'admin.

### 4. Frontend: login real en lloc del hash
Carrega supabase-js i substitueix el gate:
```html
<script src="https://esm.sh/@supabase/supabase-js@2"></script>
```
```js
const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// admin = hi ha sessió
async function isAdmin(){ const { data } = await sb.auth.getSession(); return !!data.session; }

// botó Admin → demana email+contrasenya (o magic link) i inicia sessió
adminBtn.onclick = async () => {
  if (await isAdmin()) { await sb.auth.signOut(); admin=false; applyMode(); return; }
  const email = prompt('Email admin:'); const pass = prompt('Contrasenya:');
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { alert('Accés denegat'); return; }
  admin = true; applyMode();
};
sb.auth.onAuthStateChange((_e, session)=>{ admin = !!session; applyMode(); });
```

### 5. Guardar la calibració de manera compartida i dinàmica
Amb l'admin autenticat, "Guardar" escriu a la taula `layout` (la RLS ho permet només a l'admin):
```js
// GUARDAR (admin): instantàniament compartit amb tothom, sense re-desplegar
await sb.from('layout').upsert({ id:1, data:LAY, updated_at:new Date().toISOString() });

// CARREGAR (tothom, a l'arrencada):
const { data } = await sb.from('layout').select('data').eq('id',1).single();
if (data?.data) { LAY = data.data; computeWarp(); layout(); }
```
> Això és millor que `disposicio.json`: l'admin desa i **tots els usuaris ho veuen al recarregar**, sense tornar a desplegar cap fitxer.

---

## Notes importants
- La **anon key** és pública (va al frontend) — és correcte; qui mana és la **RLS**.
- **No** facis servir mai la **service_role key** al frontend (salta la RLS). Només al servidor (Edge Functions, scripts).
- El gate visual (hash) es pot mantenir només com a comoditat d'UI, però la protecció real és: **RLS denega escriptures a qui no sigui l'admin autenticat**.
- Magic link (sb.auth.signInWithOtp) és encara més còmode i evita gestionar contrasenyes.

---

## Resum
1. Crea l'usuari admin a Supabase Auth i tanca els registres.
2. Calibració → taula `layout` amb RLS (lectura pública, escriptura només admin).
3. Frontend: login amb supabase-js; "admin" = sessió vàlida.
4. Guardar/carregar la calibració des de `layout` → compartida i dinàmica.
5. Res sensible depèn de la UI; tot està protegit per RLS al servidor.
