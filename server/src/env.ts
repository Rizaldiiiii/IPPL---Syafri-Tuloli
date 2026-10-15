/**
 * Memuat variabel lingkungan dari file `.env` terdekat.
 *
 * Skrip dapat dijalankan dari root repository maupun dari `server/`, sehingga
 * beberapa kandidat lokasi diperiksa. `dotenv` tidak menimpa variabel yang sudah
 * ada di `process.env`, jadi nilai dari luar (misalnya konfigurasi test) menang.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '..', '..', '.env'),
];

for (const candidate of candidates) {
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    dotenv.config({ path: candidate });
    break;
  }
}
