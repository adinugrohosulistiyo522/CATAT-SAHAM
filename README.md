# CatatSaham — Google Apps Script + Cloudflare Worker

Paket ini berisi UI CatatSaham, Apps Script untuk membuat dua database dan akun demo, serta **Worker entrypoint** untuk proxy API. Deployment Worker tidak lagi hanya berupa aset statis: `worker.js` dan `wrangler.jsonc` membuat Cloudflare mengenali kode server-side sehingga Runtime Variables/Secrets dapat dikonfigurasi.

## Isi utama

- `public/index.html`: frontend yang disajikan Cloudflare Worker.
- `index.html`: salinan sumber frontend untuk inspeksi dan deployment alternatif.
- `worker.js`: entrypoint Cloudflare Worker, menangani `/api` dan menyajikan static assets.
- `wrangler.jsonc`: menunjuk entrypoint Worker dan folder `public` serta mengarahkan `/api` ke Worker sebelum asset handling.
- `appsscript/Code.gs`: setup Database Data, Database Akun, data demo, login, session, dan penyimpanan per akun.
- `functions/api.js`: alternatif proxy jika nanti memilih **Cloudflare Pages**. Untuk Worker service yang sedang Anda gunakan, gunakan `worker.js` dan `wrangler.jsonc`.

## A. Buat database dan akun dengan Apps Script

1. Buka https://script.google.com/ lalu buat project Apps Script.
2. Salin seluruh isi `appsscript/Code.gs` dari paket ke `Code.gs`.
3. Pilih `setupCatatSaham()` lalu klik **Run/Jalankan** dan setujui izin yang diminta.
4. Di Execution log, salin nilai pada `CATATSAHAM_SETUP_RESULT`: `dataSpreadsheetUrl`, `accountSpreadsheetUrl`, `apiKey`, dan kredensial demo.
5. Pastikan dua spreadsheet telah dibuat. Database Data berisi tab transaksi/master; Database Akun berisi tab `Akun` dan `Panduan`. Password akun disimpan sebagai hash + salt.

Setup aman dijalankan ulang untuk memastikan tab/master tersedia; tidak dirancang untuk menghapus transaksi yang sudah ada. Jangan menghapus Script Properties atau ID database pada project yang telah dipakai tanpa backup.

## B. Deploy Apps Script Web App

1. Di Apps Script pilih **Deploy → New deployment → Web app**.
2. **Execute as:** Me. **Who has access:** Anyone.
3. Deploy dan salin URL Web App yang berakhiran `/exec`, bukan `/dev`.
4. Jangan membagikan spreadsheet database ke publik. Proxy Worker menyisipkan API key server-side.

## C. Import GitHub dan deploy sebagai Cloudflare Worker (disarankan untuk service `catat-saham`)

1. Buat repository GitHub dan unggah isi paket dengan struktur folder tetap. Pastikan `worker.js` dan `wrangler.jsonc` ada di root; folder `public` harus memuat `index.html`.
2. Di Cloudflare pilih **Workers & Pages → Create → Workers → Connect to Git** (atau hubungkan repo ke Worker yang sudah dibuat). Jangan pilih mode yang hanya mengunggah static assets.
3. Pastikan konfigurasi deployment mendeteksi `wrangler.jsonc`; entrypoint harus `worker.js`. `wrangler.jsonc` sudah menyetel direktori asset ke `./public` dan menjalankan Worker untuk route `/api` serta `/api/*`.
4. Setelah Worker code aktif, buka **Settings → Variables and secrets → Production**. Tambahkan:
   - `APPS_SCRIPT_URL` = URL Web App Apps Script yang berakhiran `/exec`.
   - `CATATSAHAM_API_KEY` = nilai `apiKey` dari `CATATSAHAM_SETUP_RESULT`; simpan sebagai **Secret**.
5. Save dan buat deployment baru. Jangan pernah menulis API key pada HTML, `wrangler.jsonc`, atau repository GitHub.
6. Uji endpoint Worker melalui browser dengan membuka `/api` — harus muncul JSON bertuliskan `CatatSaham API proxy`. Kemudian login melalui halaman utama.

**Mengapa screenshot sebelumnya menolak environment?** Worker yang aktif terlihat dikonfigurasi hanya sebagai static assets, jadi dashboard tidak menyediakan Runtime Variables/Bindings. Paket ini menyertakan entrypoint `worker.js` + `wrangler.jsonc`, agar deployment berisi Worker code selain asset statis. Setelah repository redeploy memakai konfigurasi ini, pengaturan Variables and Secrets akan tersedia. Bila layanan Cloudflare tetap menyatakan *static assets only*, berarti deployment masih memakai konfigurasi lama atau repository tidak sedang deploy melalui Wrangler config; pastikan `wrangler.jsonc` di root repo benar-benar dipakai oleh build/deployment.

## D. Akun demo awal

- Admin demo: `demo_admin` / `CatatSaham@2026`
- User demo: `trader01` / `TraderDemo@2026`
- User nonaktif: `trader02`

Akun admin memiliki seed data demo; akun user aktif kedua mulai dengan state kosong sehingga dapat dipakai untuk menguji pemisahan data. **Ganti password admin setelah login pertama**, memakai tombol **Ganti Password**.

## E. Revisi UI Statistik yang sudah diimplementasikan

- Panel Filter Statistik tetap sticky di bagian atas ketika halaman digulir.
- Filter lebih rapat, dengan layout dua baris di desktop untuk menghemat ruang analisis.
- Setiap panel analisis membatasi tinggi konten dan memiliki scroll vertikal sendiri jika isinya panjang.
- Judul/subjudul analisis berada di luar area scroll sehingga tidak ikut tergulir.
- Jika sebuah analisis memuat tabel, header kolom dibuat sticky di dalam scroll panel.
- Di layar kecil, filter dan batas panel menyesuaikan viewport agar tidak memakan seluruh area kerja.

## F. Data demo, keamanan, dan batasan

- Data Trading Plan dan Trading Saya akun `demo_admin` adalah data contoh untuk pengujian, bukan transaksi real pengguna.
- `MasterEmiten` merupakan subset 182 contoh emiten, bukan daftar BEI lengkap yang sudah diverifikasi.
- Harga Google Finance/fallback bukan jaminan feed real-time resmi; verifikasi di platform broker sebelum keputusan trading.
- Master fee sekuritas adalah nilai indikatif. Cocokkan dengan fee di akun dan trade confirmation.
- Token sesi disimpan di `sessionStorage` dan berlaku sekitar 6 jam. Tiap state aplikasi dimuat/disimpan berdasarkan `AccountID`.
- Apps Script/Sheets cocok untuk MVP, namun audit quota, concurrency, backup, dan logging sebelum skala penggunaan besar.

## Troubleshooting

- **Menu environment masih tidak aktif / static assets only:** pastikan Worker deploy memakai `wrangler.jsonc` dan `worker.js`, bukan deployment assets-only lama.
- **APPS_SCRIPT_URL belum diisi:** pastikan nilai memakai URL `/exec`.
- **API key tidak valid:** gunakan persis `apiKey` dari log setup, kemudian simpan di Secret Cloudflare.
- **Respons Apps Script bukan JSON:** deploy ulang Apps Script sebagai Web App; akses harus `Anyone` agar proxy dapat memanggilnya.
- **Sesi berakhir:** login ulang. Token sesi Apps Script berlaku sekitar enam jam.
- **Database tidak dibuat:** jalankan `setupCatatSaham()` dan cek Execution log.

## Struktur repository

```text
/
├── worker.js
├── wrangler.jsonc
├── index.html                  # copy/source mirror
├── public/
│   ├── index.html              # website yang disajikan Worker
│   └── .assetsignore
├── functions/
│   └── api.js                  # alternatif untuk Cloudflare Pages
├── appsscript/
│   ├── Code.gs
│   └── README_APPS_SCRIPT.txt
├── README.md
└── .gitignore
```
