# PROGRESS.md

Status pengerjaan sesuai Blueprint Full-Stack Aplikasi Manajemen Proyek Gantt Chart (Bagian 10 dan 12).

## Fase

- [x] **Fase 0: Fondasi** — monorepo npm workspaces (`shared`, `server`, `client`), `tsconfig.base.json`, Vite + React + Tailwind, Express dengan `/api/health`, skrip root, `.gitignore`, `.env.example`, `PROGRESS.md`.
  - Gate: `npm install` dan `npm run typecheck` sukses. **LOLOS**
- [x] **Fase 1: Mesin inti (`shared`)** — `dates.ts`, `calendar.ts`, `scheduler.ts`, `cpm.ts`, `pert.ts`, `cost.ts`, `schemas.ts`, `types.ts` + seluruh vektor uji 6.11.
  - Gate: `npm test -w shared` → **44 test lolos (6 berkas)**.
- [x] **Fase 2: Backend** — skema Prisma + migrasi `20261015173938_init`, auth JWT + bcrypt, seluruh rute Bagian 7, `recompute` dan `snapshot`, middleware error/validasi, cek kepemilikan, seed idempoten, test integrasi Supertest dengan database SQLite terpisah.
  - Gate: `npm run typecheck -w server` sukses, `npm test -w server` → **54 test lolos (7 berkas)**, `npm run db:seed` berhasil (17 tugas dijadwalkan ulang).
- [x] **Fase 3: Frontend** — Bagian 8 lengkap: Login, Register, Projects, Gantt (SVG, drag/resize, zoom, sorot jalur kritis), Tim, Kalender, Analisis + diagram PERT, serta test komponen.
  - Gate: `npm run typecheck -w client`, `npm test -w client` → **15 test lolos (4 berkas)**, dan `npm run build -w client` sukses.
- [x] **Fase 4: Integrasi dan verifikasi**
  - `npm install` → exit 0
  - `npm run typecheck` → exit 0 (shared, server, client)
  - `npm test` → exit 0, **113 test lolos** (44 shared + 54 server + 15 client)
  - `npm run build` → exit 0 (shared, server, client)
  - `npm run dev` → http://localhost:3001/api/health dan http://localhost:5173 merespons 200; proxy `/api` dari Vite berfungsi.
- [x] **Fase 5: Rapikan sebelum push** — `.gitignore` mengecualikan `node_modules`, `dist`, `.env`, `*.db*`, `coverage`; README lengkap dengan bagian Asumsi; pemindaian rahasia bersih.
  - Gate: `git status` tidak memuat file yang seharusnya diabaikan.
- [ ] **Fase 6: Push ke GitHub** — commit lokal dibuat; **menunggu URL repository dari manusia** (`https://github.com/USERNAME/gantt-project-app.git`) sebelum `git remote add origin` dan `git push`.

## Acceptance checklist (Bagian 12)

Metode verifikasi: **API** = test integrasi Supertest (`server/src/tests`) dan pemeriksaan curl terhadap data seed; **UI** = test komponen Testing Library dan pemeriksaan berkas hasil build.

### Tugas
- [x] Tambah, ubah, dan hapus tugas berhasil — API: `tasks.test.ts` (CRUD), pemeriksaan curl pada data seed.
- [x] Durasi, tanggal mulai, prioritas, dan warna tersimpan — API: `tasks.test.ts` (durasi, `startDate`, `priority`, `color`, penolakan warna non-heks).
- [x] Sub-tugas (parent-child) bisa dibuat, dan induk menghitung rentang serta progres otomatis — API: `tasks.test.ts` (rentang 19–28 Okt, progres 71, batas 3 level, 409 untuk tugas yang sudah punya dependensi).

### Dependensi dan Gantt
- [x] Predecessor FS dan SS dengan lag mengubah posisi bar sesuai 6.4 dan vektor uji 6.11 — API: `dependencies.test.ts` (FS lag 0 → 28 Okt, SS lag 2 → 27 Okt, bar kembali ke batas predecessor); unit: `shared/src/scheduler.test.ts`.
- [x] Bar Gantt tampil, ada panah dependensi (FS dan SS), dan bar bisa di-drag serta di-resize — UI: `GanttTimeline.test.tsx` (4 bar, panah `gantt-dep-fs1`/`ss1` dengan `data-type` FS/SS dan geometri siku-siku) dan `GanttPage.test.tsx`; pratinjau drag memakai `scheduleTasks` dari `shared`.
- [x] Dependensi yang membentuk siklus ditolak dengan pesan jelas — API: `dependencies.test.ts` (`422 CYCLE_DETECTED`).

### Resource
- [x] Tambah anggota tim (nama, email, peran, gaji) dan alokasikan ke tugas — API: `resources.test.ts`.
- [x] Biaya dan peringatan over-alokasi muncul benar — API: `analysis.test.ts` (biaya 5.000.000 untuk 10 hari × 50% dari gaji 22 juta; peringatan 120% selama 3 hari); pemeriksaan curl pada data seed (6 hari over-alokasi).

### Kalender
- [x] Ubah akhir pekan dan tambah hari libur, lalu jadwal bergeser otomatis — API: `calendar.test.ts` (weekend [5,6] menggeser mulai; libur 26 Okt menggeser selesai ke 28 Okt).
- [x] Durasi tidak menghitung akhir pekan dan hari libur — API: `calendar.test.ts`; unit: `shared/src/calendar.test.ts`.

### Analisis
- [x] Halaman Analisis menampilkan Critical Path dan diagram PERT, node kritis berwarna merah — UI: `PertDiagram.test.tsx` (node A, C, D `data-critical="true"`, hanya panah A→C dan C→D kritis); API: `analysis.test.ts` (jalur kritis A → C → D, PE = 8, float B = 3).

### Persistensi dan akun
- [x] Data tidak hilang saat halaman di-refresh (data berasal dari database) — seluruh data dimuat lewat TanStack Query dari REST API; token JWT di `localStorage`, data lain hanya dari server.
- [x] Register, login, dan logout berfungsi, dan pengguna A tidak bisa melihat data pengguna B — API: `auth.test.ts` dan `ownership.test.ts` (semua akses lintas pengguna dijawab 404); UI: `LoginPage`/`RegisterPage` + `useAuth`.

### Repository
- [x] Ada folder `src` di tiap workspace, `package.json`, dan `README.md`.
- [x] `node_modules`, `.env`, dan file database tidak ikut ter-commit — lihat `.gitignore` dan hasil `git status`.
- [x] `npm run typecheck`, `npm test`, dan `npm run build` lolos tanpa error (hasil: 44 + 54 + 15 = 113 test).

## Catatan lanjutan

- Verifikasi UI dilakukan lewat test komponen Testing Library dan build produksi; belum ada uji end-to-end otomatis di peramban sungguhan. Uji manual sesuai Bagian 12 tetap dianjurkan.
- Push ke GitHub (Fase 6) belum dijalankan karena URL repository belum tersedia.
