import { assertConfig, config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './db.js';

// Konfigurasi wajib diperiksa sebelum server melayani permintaan.
assertConfig();

const app = createApp();

const server = app.listen(config.port, () => {
  process.stdout.write(`[server] REST API berjalan di http://localhost:${config.port}/api\n`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    process.stderr.write(
      `[server] Port ${config.port} sedang dipakai proses lain. Hentikan proses tersebut atau ubah PORT di file .env.\n`,
    );
  } else {
    process.stderr.write(`[server] Gagal menjalankan server: ${error.message}\n`);
  }
  process.exit(1);
});

async function shutdown(signal: string): Promise<void> {
  process.stdout.write(`[server] Menerima ${signal}, menutup koneksi...\n`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
