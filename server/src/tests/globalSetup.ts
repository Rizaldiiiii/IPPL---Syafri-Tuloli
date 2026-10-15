import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Menyiapkan database SQLite khusus test (`server/prisma/test.db`).
 * Database dibuat ulang dari skema Prisma setiap kali suite dijalankan,
 * sehingga test bersifat deterministik dan tidak menyentuh `dev.db`.
 */

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const testDatabasePath = path.join(serverRoot, 'prisma', 'test.db');

export default function setup(): () => void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const candidate = `${testDatabasePath}${suffix}`;
    if (fs.existsSync(candidate)) fs.rmSync(candidate);
  }

  execFileSync(
    'npx',
    ['prisma', 'db', 'push', '--skip-generate', '--force-reset', '--schema', 'prisma/schema.prisma'],
    {
      cwd: serverRoot,
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      shell: process.platform === 'win32',
    },
  );

  return () => {
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const candidate = `${testDatabasePath}${suffix}`;
      if (fs.existsSync(candidate)) fs.rmSync(candidate);
    }
  };
}
