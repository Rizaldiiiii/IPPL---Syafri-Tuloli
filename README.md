# GanttKu — Aplikasi Manajemen Proyek Gantt Chart

Aplikasi web manajemen proyek berbasis **Gantt Chart** untuk banyak pengguna. Seluruh data tersimpan di database melalui REST API (bukan `localStorage`). Antarmuka berbahasa Indonesia.

## Fitur

1. **Manajemen tugas** — tambah, ubah, hapus tugas; durasi dalam hari kerja; tanggal mulai paling awal; prioritas Rendah/Sedang/Tinggi; warna indikator; progres; sub-tugas (parent–child) maksimal 3 level.
2. **Dependensi dan timeline** — hubungan **Finish-to-Start (FS)** dan **Start-to-Start (SS)** dengan jeda (lag) dalam hari kerja; grafik Gantt dengan bar berwarna, lapisan progres, panah dependensi, serta drag dan resize bar.
3. **Manajemen resource** — anggota tim (nama, email, peran, gaji) dan alokasi anggota ke tugas beserta persentasenya.
4. **Kalender proyek** — pengaturan hari akhir pekan (bebas, tidak harus Sabtu–Minggu) dan hari libur khusus; durasi hanya menghitung hari kerja.
5. **Analisis proyek** — Critical Path Method (ES/EF/LS/LF/float), jalur kritis, diagram PERT dengan estimasi tiga titik, biaya proyek, dan peringatan over-alokasi.

Fitur tambahan di luar daftar di atas: autentikasi (register/login) dan halaman daftar proyek.

## Tech stack

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, react-hook-form, zod |
| Backend | Node.js, Express, TypeScript (tsx untuk dev), zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit |
| Database | SQLite dengan Prisma ORM |
| Logika inti | Paket `@gantt/shared` (TypeScript murni, dipakai server dan client) |
| Gantt dan PERT | Digambar sendiri dengan SVG, tanpa library Gantt eksternal |
| Test | Vitest, Supertest, Testing Library |
| Tooling | npm workspaces, concurrently |

Mesin penjadwalan berada di paket `shared` agar identik di server (sumber kebenaran, hasil disimpan ke database) dan di client (pratinjau saat drag).

## Prasyarat

- Node.js 20 atau lebih baru (diuji pada Node 24)
- npm 10 atau lebih baru

## Instalasi

```bash
npm install                     # memasang semua workspace + generate Prisma Client
cp .env.example .env            # Windows (cmd): copy .env.example .env
# isi JWT_SECRET di .env dengan string acak, contoh:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run db:migrate              # menerapkan migrasi ke server/prisma/dev.db
npm run db:seed                 # mengisi data contoh (idempoten)
```

`npm install` di root sudah memasang dependensi seluruh workspace. File `.env` dan database **tidak** di-commit.

> Catatan Windows: hentikan `npm run dev` sebelum menjalankan `npm install`. Skrip `postinstall` menjalankan `prisma generate` yang menulis ke `node_modules`, dan berkas Prisma yang sedang dipakai proses dev dapat terkunci.

Variabel lingkungan (lihat `.env.example`):

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Path SQLite, relatif terhadap `server/prisma/schema.prisma` (default `file:./dev.db`) |
| `JWT_SECRET` | **Wajib.** Server gagal start dengan pesan jelas bila kosong |
| `PORT` | Port REST API (default `3001`) |
| `JWT_EXPIRES_IN` | Umur token (default `7d`) |
| `CORS_ORIGIN` | Opsional, daftar origin dipisah koma untuk akses API langsung |

## Menjalankan aplikasi

```bash
npm run dev
```

- Antarmuka web: **http://localhost:5173**
- REST API: **http://localhost:3001/api** (Vite mem-proxy `/api` ke port 3001)
- Cek kesehatan: **http://localhost:3001/api/health**

### Akun demo

Setelah `npm run db:seed`:

| Email | Password |
| --- | --- |
| `demo@example.com` | `Demo12345` |

## Test dan build

```bash
npm run typecheck   # tsc --noEmit di semua workspace (shared dibangun lebih dulu)
npm test            # Vitest: unit shared, integrasi server, komponen client
npm run build       # build shared, server, dan client
```

Menjalankan test satu workspace: `npm test -w shared`, `npm test -w server`, `npm test -w client`.

Test integrasi server memakai database SQLite terpisah (`server/prisma/test.db`) yang dibuat ulang otomatis oleh global setup Vitest, sehingga `dev.db` tidak terganggu.

## Perintah database

| Perintah | Fungsi |
| --- | --- |
| `npm run db:migrate` | Menerapkan migrasi yang sudah ada (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Membuat migrasi baru saat skema berubah |
| `npm run db:generate` | Membuat ulang Prisma Client |
| `npm run db:seed` | Mengisi data contoh (aman dijalankan ulang) |
| `npm run db:reset` | Menghapus database, menerapkan ulang migrasi, lalu seed |

## Ringkasan API

Prefiks `/api`. Semua rute selain `/auth/register`, `/auth/login`, dan `/health` memerlukan header `Authorization: Bearer <token>`. Setiap data dibatasi kepemilikannya: proyek milik pengguna lain dijawab `404`.

Bentuk error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "pesan bahasa Indonesia", "details": {} } }
```

Status: `400/422` validasi, `401` belum login, `404` tidak ditemukan, `409` konflik.

| Method dan path | Fungsi |
| --- | --- |
| `GET /health` | Cek server hidup |
| `POST /auth/register` | Daftar (name, email, password min 8 karakter) |
| `POST /auth/login` | Masuk, mengembalikan token dan user |
| `GET /auth/me` | Data user saat ini |
| `GET`, `POST /projects` | Daftar dan buat proyek |
| `GET`, `PATCH`, `DELETE /projects/:id` | Detail (snapshot lengkap), ubah, hapus |
| `POST /projects/:id/tasks` | Buat tugas (bisa dengan `parentId`) |
| `PATCH`, `DELETE /tasks/:id` | Ubah (jadwal dihitung ulang) / hapus beserta anaknya |
| `POST /tasks/:id/move` | Ubah induk dan posisi |
| `POST /tasks/:id/dependencies` | Tambah pendahulu (`predecessorId`, `type`, `lagDays`) |
| `PATCH`, `DELETE /dependencies/:id` | Ubah atau hapus dependensi |
| `GET`, `POST /projects/:id/resources` | Daftar dan tambah anggota tim |
| `PATCH`, `DELETE /resources/:id` | Ubah atau hapus anggota |
| `POST /tasks/:id/assignments` | Alokasikan anggota (`resourceId`, `allocationPercent`) |
| `PATCH`, `DELETE /assignments/:id` | Ubah atau hapus alokasi |
| `PUT /projects/:id/calendar` | Atur `weekendDays`, jadwal dihitung ulang |
| `POST /projects/:id/holidays` | Tambah hari libur (`date`, `name`) |
| `DELETE /holidays/:id` | Hapus hari libur |
| `GET /projects/:id/analysis` | CPM, jalur kritis, data PERT, biaya, beban resource |

Setiap mutasi yang mengubah jadwal mengembalikan `{ "tasks": [...] }` berisi seluruh tugas terbaru proyek, sehingga client cukup mengganti cache-nya.

## Struktur repository

```
├─ package.json          npm workspaces: shared, server, client
├─ tsconfig.base.json
├─ shared/src/           dates · calendar · scheduler · cpm · pert · cost · schemas · types
├─ server/prisma/        schema.prisma · migrations/ · seed.ts
├─ server/src/           app · config · db · middleware/ · routes/ · services/ · tests/
└─ client/src/           api/ · hooks/ · lib/ · pages/ · components/ (gantt, pert, tasks, ui, layout)
```

## Asumsi

Hal-hal yang tidak diatur eksplisit pada spesifikasi dan diputuskan sebagai berikut:

1. **Posisi tugas induk.** `startDate` tugas induk tetap disimpan (default tanggal mulai proyek) tetapi tidak dipakai dalam perhitungan; rentang dan durasinya selalu diturunkan dari sub-tugas.
2. **Batas awal.** `scheduledStart` dihitung dari `max(startDate, batas seluruh predecessor)` tanpa dipotong ke tanggal mulai proyek, sehingga pengguna boleh memakai `startDate` lebih awal dari tanggal mulai proyek.
3. **Ordinal CPM.** Ordinal hari kerja tidak pernah negatif: tugas yang selesai sebelum tanggal mulai proyek dihitung sebagai ordinal 0.
4. **Status kode.** Larangan pada aturan dependensi (diri sendiri, duplikat, siklus, tugas induk) dibalas `422` sesuai aturan bisnis; aturan “tugas yang sudah punya dependensi/alokasi tidak boleh diberi anak” dibalas `409`. Alokasi duplikat pada tugas yang sama dibalas `409`.
5. **Normalisasi posisi.** Saat tugas dihapus atau dipindahkan, `position` saudara-saudaranya dirapikan otomatis (0, 1, 2, …).
6. **Tombol “Hari ini”.** Menggeser gulungan timeline ke posisi tanggal hari ini; bila tanggal tersebut di luar rentang proyek, timeline tetap digulir ke titik terdekat.
7. **Snap drag.** Tanggal hasil drag dibulatkan ke hari dan digeser maju ke hari kerja terdekat bila jatuh pada akhir pekan atau hari libur.
8. **Zoom disimpan di memori.** Preferensi zoom (Hari/Minggu/Bulan) adalah state komponen, bukan data yang dipersistensi.
9. **Over-alokasi.** Peringatan dihitung per hari kerja: total alokasi seorang anggota pada tugas daun yang tumpang tindih melebihi 100%. Daftar peringatan dibatasi maksimal 200 baris.
10. **CORS.** Secara default hanya origin Vite dev/preview (`localhost:5173`, `127.0.0.1:5173`, `localhost:4173`) yang diizinkan; dapat ditambah lewat `CORS_ORIGIN`.
11. **Rate limit.** Rute register dan login dibatasi 30 permintaan per 15 menit per alamat IP, dan dinonaktifkan saat `NODE_ENV=test`.
12. **Kolom weekendDays.** Disimpan sebagai string berisi daftar angka (0 = Minggu … 6 = Sabtu) dan diterjemahkan menjadi array oleh API.
13. **Delete cascade.** Menghapus proyek menghapus tugas, dependensi, resource, alokasi, dan hari liburnya; menghapus tugas menghapus anak, dependensi, dan alokasinya; menghapus anggota menghapus alokasinya.
