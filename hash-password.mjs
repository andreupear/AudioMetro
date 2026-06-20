#!/usr/bin/env node
/* AudioMetro · genera el hash SHA-256 d'una contrasenya per al mode admin.
     node hash-password.mjs "la-teva-contrasenya"
   Copia el hash resultant a supabase-config.js → window.ADMIN_HASH.
   (El hash és el que es guarda; la contrasenya en clar no es desa enlloc.)
*/
import crypto from 'node:crypto';
const pass = process.argv.slice(2).join(' ');
if (!pass) { console.error('Ús: node hash-password.mjs "la-teva-contrasenya"'); process.exit(1); }
console.log(crypto.createHash('sha256').update(pass).digest('hex'));
