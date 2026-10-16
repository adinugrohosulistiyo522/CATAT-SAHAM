# CatatSaham — Implementasi Cloudflare Pages + Google Apps Script

Paket ini menggantikan penyimpanan browser demo dengan Apps Script + Google Sheets. Database Data, Database Akun, schema, akun demo, master sekuritas/model, subset master emiten dan beberapa baris contoh dibuat otomatis oleh `setupCatatSaham()`.

## Isi paket

- `index.html`: UI CatatSaham (Trading Plan, Trading Saya, Jurnal Trading, analitik, target monitor, pencatatan dividen dan ekspor) dengan login dan auto-save ke backend.
- `functions/api.js`: Cloudflare Pages Function pada route `/api`. API key hanya ditambahkan server-side, tidak dikirim oleh browser.
- `appsscript/Code.gs`: membuat kedua spreadsheet, seed data demo, memvalidasi login, session token, penyimpanan state per akun dan pembaruan tab database.

## A. Buat kedua database otomatis

1. Buka https://script.google.com/ lalu buat project Apps Script baru.
2. Buka `appsscript/Code.gs` dari paket ini, salin seluruh isi, lalu tempel ke `Code.gs` di Apps Script.
3. Pilih fungsi `setupCatatSaham` lalu klik **Run/Jalankan**. Setujui permission Google yang diminta.
4. Buka **Execution log / Log eksekusi** dan cari `CATATSAHAM_SETUP_RESULT`. Di sana ada tautan `dataSpreadsheetUrl`, `accountSpreadsheetUrl`, nilai `apiKey`, serta username/password awal.
5. Pastikan dua spreadsheet baru sudah muncul di Google Drive:
   - **CatatSaham - Database Data**: tab TradingPlan, TradingPlanRows, TradingSaya, TradingSayaRows, JurnalTrading, Dividen, MasterSekuritas, MasterModelTrading, MasterEmiten, TemplateImport, AppState, Panduan.
   - **CatatSaham - Database Akun**: tab Akun, Panduan. Password tersimpan sebagai hash + salt, bukan teks biasa.

Fungsi setup bersifat repeat-safe: menjalankannya lagi tidak akan menghapus data yang sudah ada. Jika pernah menjalankan setup tetapi ingin mengulang database dari nol, jangan hapus spreadsheet produksi; buat project Apps Script baru atau hapus ID property hanya setelah memastikan datanya tidak dibutuhkan.

## B. Deploy Apps Script sebagai Web App

1. Klik **Deploy > New deployment**.
2. Pilih tipe **Web app**.
3. **Execute as:** Me.
4. **Who has access:** Anyone. API tetap memeriksa `CATATSAHAM_API_KEY`; akses spreadsheet tidak perlu dibagikan ke publik.
5. Deploy dan salin **Web app URL yang berakhiran `/exec`**. Jangan gunakan URL `/dev`.

## C. Impor ke GitHub dan deploy Cloudflare Pages

1. Buat repository GitHub baru dan unggah semua file/folder dari paket ini dengan struktur apa adanya. `index.html` harus berada di root repo, `functions/api.js` harus berada di folder `functions/api.js`.
2. Cloudflare Dashboard > **Workers & Pages > Create > Pages > Connect to Git** lalu pilih repository ini.
3. Build settings: **Framework preset: None**, **Build command: kosong**, **Build output directory: `/` atau `.`** sesuai pilihan dashboard (karena `index.html` berada di root). Tidak diperlukan build step.
4. Sebelum membuka situs, masuk **Settings > Variables and Secrets > Production** (dan Preview jika diperlukan), lalu tambahkan dua environment variables:
   - `APPS_SCRIPT_URL` = URL Web App Apps Script yang berakhiran `/exec`.
   - `CATATSAHAM_API_KEY` = nilai `apiKey` dari `CATATSAHAM_SETUP_RESULT` pada log Apps Script (simpan sebagai **Secret**, bukan plaintext variable jika dashboard memberi pilihan).
5. Simpan, lalu jalankan deployment ulang jika variabel ditambahkan setelah deploy. Jangan pernah menaruh `CATATSAHAM_API_KEY` di `index.html`, repo GitHub publik, atau variabel `VITE_*`/`NEXT_PUBLIC_*`.
6. Buka URL Cloudflare Pages. Login memakai akun awal demo di bawah.

## D. Akun awal

- Username: `demo_admin`
- Password awal: `CatatSaham@2026`
- Tersedia juga `trader01` / `TraderDemo@2026` untuk menguji isolasi akun; `trader02` dibuat nonaktif sebagai contoh status akun.

**Ganti password akun demo segera setelah login.** Gunakan tombol **Ganti Password** di header. Password disimpan sebagai hash dan salt di Database Akun.

## Perilaku data dan batasan penting

- Perubahan data disimpan otomatis ke Apps Script setelah jeda singkat. Indikator di header menampilkan status simpan ke Google Sheets. Ketika indikator menyatakan gagal menyimpan, periksa environment dan deploy Apps Script sebelum mengandalkan perubahan tersebut.
- Data pengguna ditandai sebagai data demo dan dapat diedit/hapus. AppState menyimpan snapshot per AccountID; tab transaksi dinormalisasi dan dipisahkan per AccountID. Login akun berbeda tidak membaca transaksi akun lain.
- `MasterEmiten` merupakan subset 182 emiten contoh dari paket demo sebelumnya, bukan klaim bahwa daftar BEI lengkap atau sudah terverifikasi. Kolom HargaSaatIni mencoba formula `GOOGLEFINANCE("IDX:TICKER","price")`; ketersediaan dan waktu pembaruan tergantung dukungan Google Finance. Jika tidak ada harga, aplikasi memakai HargaDemoFallback yang ditandai DEMO.
- GOOGLEFINANCE bukan feed bursa resmi real-time yang dijamin; untuk keputusan transaksi, verifikasi harga di platform broker. Data historis/kinerja yang dihitung aplikasi berasal dari transaksi yang dimasukkan pengguna.
- Master fee broker hanya nilai awal indikatif. Verifikasi fee sesuai akun dan trade confirmation Anda.
- App Script Web App memakai URL publik `Anyone`, tetapi endpoint menolak semua request tanpa API key. Karena itu simpan key di Cloudflare secret dan Script Properties Apps Script. Jika key terpapar, perbarui property `CATATSAHAM_API_KEY` dan Cloudflare environment secara bersamaan.
- Apps Script / Google Sheets cocok untuk MVP dan uji coba. Untuk penggunaan multi-akun dengan traffic tinggi, audit concurrency, quota, strategi backup dan logging sebelum membuka akses luas.

## Troubleshooting cepat

- **Environment belum diisi**: periksa `APPS_SCRIPT_URL` dan `CATATSAHAM_API_KEY` di environment Production Pages, bukan hanya Local/Preview.
- **API key tidak valid**: salin ulang `apiKey` dari execution log; jangan membuat key manual yang berbeda antara Apps Script dan Cloudflare.
- **Sesi berakhir**: login ulang. Token sesi berlaku sekitar 6 jam.
- **Spreadsheet tidak dibuat**: jalankan `setupCatatSaham()` dan cek Execution log/izin Google.
- **Baris transaksi belum terlihat dalam tab database**: login ke aplikasi setidaknya sekali. App mengirim snapshot lengkap dan mengisi ulang tabel ter-normalisasi otomatis setelah login pertama.

## Struktur repository

```text
/
├── index.html
├── functions/
│   └── api.js
├── appsscript/
│   └── Code.gs
├── README.md
└── .gitignore
```
