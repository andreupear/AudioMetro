// AudioMetro · configuració del frontend per a Supabase.
// Omple aquests dos valors (Project Settings → API).
// L'anon key és pública i de només-lectura (RLS) — és segur posar-la al frontend.
// Mentre estiguin buits, el mapa farà servir el snapshot local (imetro-data.js).
window.SUPABASE_URL = "https://lvxwomfnvyuhjyssihrm.supabase.co";       // p. ex. "https://lvxwomfnvyuhjyssihrm.supabase.co"
window.SUPABASE_ANON_KEY = "sb_publishable_k3RvcAQvLPUQURyqMC0nCw_Z3zHTuld";  // anon public key

// Login amb NOM D'USUARI: la pàgina hi afegeix aquest domini per formar l'email de Supabase.
// L'usuari admin a Supabase s'ha de crear amb email "<usuari>@<aquest-domini>" (p. ex. admin@audiometro.local).
window.ADMIN_EMAIL_DOMAIN = "gmail.com";
