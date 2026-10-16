# CatatSaham v3 — Cloudflare Worker + Apps Script

Paket ini adalah **satu jalur deployment saja**: Cloudflare Workers Builds membaca `wrangler.jsonc`, menerbitkan `worker.js`, dan melayani frontend dari `public/`. Tidak menggunakan Cloudflare Pages Functions, tidak menggunakan folder `functions/`, dan tidak memakai deployment assets-only.

## Struktur repository yang wajib

File berikut harus terlihat langsung di **root repository GitHub** (bukan satu tingkat di dalam folder proyek):

```text
wrangler.jsonc
worker.js
package.json
.gitignore
.dev.vars.example
START_HERE.txt
README.md
appsscript/Code.gs
appsscript/README_APPS_SCRIPT.txt
public/index.html
scripts/test-worker.mjs
```

Nama Worker di `wrangler.jsonc` adalah `catat-saham`. Jika Worker di dashboard menggunakan nama yang berbeda, samakan nama tersebut atau ubah `name` sebelum deploy. Untuk kasus Anda, pertahankan `catat-saham`.

## A. Membuat database melalui Apps Script

1. Buka [Google Apps Script](https://script.google.com/) dan buat project baru.
2. Salin seluruh isi `appsscript/Code.gs` ke file `Code.gs` di editor.
3. Pilih fungsi `setupCatatSaham()` lalu klik **Run** dan setujui izin Google.
4. Buka **Execution log**. Simpan URL database data, URL database akun, dan `apiKey` dari objek `CATATSAHAM_SETUP_RESULT`.
5. Fungsi ini membuat dua spreadsheet: **CatatSaham - Database Data** dan **CatatSaham - Database Akun**, termasuk tab, master data, dan transaksi demo.

Akun demo awal:

- `demo_admin` / `CatatSaham@2026`
- `trader01` / `TraderDemo@2026`

Gunakan hanya untuk pengujian dan ganti password setelah login. Jangan jalankan setup berulang kali hanya untuk memperbaiki deployment frontend. Fungsi setup ditujukan repeat-safe, tetapi database yang telah digunakan jangan dihapus atau diganti demi mengatasi masalah routing Worker.

## B. Deploy Apps Script sebagai Web App

1. Di Apps Script pilih **Deploy → New deployment → Web app**.
2. **Execute as:** Me.
3. **Who has access:** Anyone.
4. Klik **Deploy**, lalu salin URL `/exec`.
5. Jika kode Apps Script berubah sesudah deploy, buat versi deployment baru/kelola deployment agar URL yang dipakai menjalankan versi terbaru.

Jangan menaruh API key di frontend, `wrangler.jsonc`, atau GitHub.

## C. GitHub dan Workers Builds — konfigurasi yang benar

Paket ini dibuat untuk produk **Workers**, bukan Pages. Hubungkan repository ke Worker `catat-saham` yang sudah ada melalui Cloudflare Dashboard:

1. **Workers & Pages → catat-saham → Settings → Builds → Connect** (atau buka konfigurasi Builds yang sudah ada).
2. **Git repository:** repository CatatSaham.
3. **Production branch:** branch utama repository (misalnya `main`).
4. **Root directory:** kosong. Jika repo Anda berisi paket ini dalam subfolder, isi Root directory dengan nama subfolder yang berisi `wrangler.jsonc`; tetapi rekomendasi paket ini adalah menaruh semua isi paket langsung di root.
5. **Build command:** kosong / tidak diperlukan.
6. **Deploy command:** `npx wrangler deploy`.
7. Simpan pengaturan, lalu push commit baru atau jalankan retry build. Buka log build dan pastikan `wrangler.jsonc` terbaca serta deployment Worker berhasil.

Dokumentasi resmi Workers Builds menjelaskan bahwa file Wrangler harus berada pada direktori root yang dikonfigurasi, dan deploy command standar adalah `npx wrangler deploy`. `name` di konfigurasi juga harus cocok dengan nama Worker dashboard.

## D. Tes Worker sebelum mengisi environment

**Jangan lanjut ke environment apabila langkah ini belum lolos.** Setelah deployment berhasil, buka kedua endpoint ini:

- `https://catat-saham.adinugrohosulistiyo.workers.dev/healthz`
- `https://catat-saham.adinugrohosulistiyo.workers.dev/api`

Keduanya harus langsung menampilkan JSON dan memuat `"workerVersion":"3.0.0"`. `/healthz` tidak membutuhkan Apps Script atau API key. `/api` juga merespons GET tanpa menghubungi Apps Script.

Bila kedua endpoint terus loading/timeout, jangan ubah Apps Script atau membuat spreadsheet baru. Periksa **Settings → Builds** pada Worker `catat-saham`, pastikan repository/branch/root directory, `Deploy command`, dan deployment Production terbaru benar-benar memakai konfigurasi ini. Bila build log belum memperlihatkan `worker.js`/Wrangler config, konfigurasi deploy belum membaca paket ini. Jika build sukses namun `workerVersion` bukan `3.0.0`, alamat masih menyajikan versi deployment yang lama.

## E. Runtime Variables & Secrets di Cloudflare

Setelah `/healthz` berhasil memuat `workerVersion: 3.0.0`, buka **catat-saham → Settings → Variables and Secrets → Production** lalu tambahkan:

| Name | Type | Value |
|---|---|---|
| `APPS_SCRIPT_URL` | Text | URL Web App Google Apps Script, berakhiran `/exec` |
| `CATATSAHAM_API_KEY` | Secret | Nilai `apiKey` dari log fungsi `setupCatatSaham()` |

Simpan, lalu redeploy/redeploy latest deployment sesuai dashboard. Buka `/healthz` lagi; dua properti `apiConfigured` dan `apiKeyConfigured` seharusnya bernilai `true`. Endpoint tersebut hanya menampilkan status terkonfigurasi, tidak pernah mengeluarkan nilai secret.

## F. Uji login dan penyimpanan

1. Buka root URL `workers.dev`.
2. Login menggunakan akun demo.
3. Buat atau ubah sebuah Trading Plan, tunggu indikator penyimpanan, refresh, dan pastikan perubahan tetap ada.
4. Login menggunakan `trader01`; histori tradingnya harus terpisah dari `demo_admin`.
5. Coba ganti password melalui tombol akun bila diperlukan.

## Tes kode lokal

Dengan Node.js 20+:

```bash
npm install
npm run test:worker
npm run dev
```

Tes lokal memverifikasi respons `/healthz`, respons cepat `GET /api` tanpa Apps Script, penyajian aset melalui binding `ASSETS`, pesan environment yang hilang, dan pemblokiran request dari origin lain. Tes lokal bukan pengganti tes deployment produksi.

## Troubleshooting cepat

- **Menu Variables and Secrets masih nonaktif / Worker hanya static assets:** deployment belum memakai entrypoint `worker.js` melalui `wrangler.jsonc`. Periksa Settings → Builds, root directory, deploy command, dan log build.
- **`/healthz` timeout:** ini terjadi sebelum Apps Script terlibat; perbaiki deployment/domain Worker dahulu.
- **`/healthz` memberi versi 3.0.0 tetapi `apiConfigured:false`:** tambah `APPS_SCRIPT_URL` pada Production Runtime Variables.
- **`apiKeyConfigured:false`:** tambah `CATATSAHAM_API_KEY` sebagai Secret.
- **GET `/api` jalan, tetapi login gagal:** periksa URL `/exec`, versi Web App Apps Script, nilai API key, dan log eksekusi Apps Script.
- **Respons 502:** pesan JSON berisi diagnosa dasar; cek akses Web App Apps Script serta log eksekusi.

## Keamanan

- API key hanya disuntikkan oleh Worker ke permintaan server-to-server. Browser tidak menerima API key.
- `CATATSAHAM_API_KEY` harus disimpan sebagai Cloudflare Secret, bukan Text variable bila dashboard menyediakan pilihan Secret.
- Jangan commit `.dev.vars` atau token asli ke GitHub.
- Data emiten contoh dan harga fallback diberi penanda demo; daftar 182 contoh bukan daftar resmi BEI lengkap yang telah diverifikasi.
