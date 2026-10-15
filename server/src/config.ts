import './env.js';

export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  databaseUrl: string;
}

function readConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3001),
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    databaseUrl: process.env.DATABASE_URL ?? '',
  };
}

export const config: AppConfig = readConfig();

/** Menghentikan proses dengan pesan jelas bila konfigurasi wajib belum diisi. */
export function assertConfig(): void {
  const problems: string[] = [];
  if (!config.jwtSecret) {
    problems.push('JWT_SECRET belum diisi. Salin .env.example menjadi .env lalu isi JWT_SECRET dengan string acak.');
  }
  if (!config.databaseUrl) {
    problems.push('DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu jalankan `npm run db:migrate`.');
  }
  if (!Number.isFinite(config.port) || config.port <= 0) {
    problems.push(`PORT tidak valid: ${process.env.PORT ?? ''}`);
  }
  if (problems.length > 0) {
    for (const problem of problems) {
      process.stderr.write(`[konfigurasi] ${problem}\n`);
    }
    process.exit(1);
  }
}
