# Kitforge

Kumpulan tools yang berjalan langsung di browser (browser-native toolkit). Tidak perlu build, dan file tidak di-upload ke server.

## Tools

**Image Lab**

- **PixelPress** (Image → WebP): ubah JPG, PNG, GIF, BMP, AVIF, atau SVG ke WebP. Atur kualitas (1–100) dan batas ukuran.
- **ScaleShift** (Image Resizer): kecilkan resolusi dengan rasio terkunci, berdasarkan persentase, lebar, tinggi, atau sisi terpanjang. Format hasil bisa sama seperti asli, JPG, PNG, atau WebP.

**Doc Lab**

- **Markflow** (Document → Markdown): ubah DOCX, PDF, HTML, CSV/TSV, dan TXT ke Markdown. Judul, list, tabel, bold/italic, dan link ikut terbawa. Hasil bisa dilihat, disalin, atau di-download.

**Content Lab**

- **Pulse** (Post Analytics): dashboard performa post dari file ekspor CSV/JSON (Meta Business Suite, TikTok Studio, YouTube Studio, atau spreadsheet sendiri). Menampilkan ringkasan, grafik views per post dengan garis median, post yang menonjol (≥ 2× median), insight hari/jam/durasi terbaik, dan tabel yang bisa diurutkan. Data digabung antar-file dan disimpan di `localStorage` browser. Untuk Instagram, Pulse juga bisa mengambil data live lewat `api/instagram.js` (lihat [Pulse live](#pulse-live-instagram)).

Semua tool memproses banyak file sekaligus tanpa batas jumlah, lalu hasilnya bisa di-download per file atau dalam satu ZIP.

Markflow memuat library dari CDN jsDelivr saat pertama dipakai (Mammoth untuk DOCX, pdf.js untuk PDF, Turndown untuk HTML), jadi butuh koneksi internet. Isi file tetap diproses di browser dan tidak dikirim ke mana pun.

## Menjalankan

```bash
node scripts/serve.js
```

lalu buka http://localhost:5173.

`index.html` juga bisa dibuka langsung, tapi tanpa server gambar diproses satu per satu karena Web Worker tidak jalan di `file://`.

## Performa

- Halaman awal hanya memuat `util.js`, `registry.js`, dan `app.js`. Kode tiap tool dimuat saat tool dibuka, dan sudah mulai dimuat saat kursor mengarah ke menunya.
- Gambar diproses paralel di Web Worker (maks. 4 sekaligus, menyesuaikan jumlah core CPU), jadi halaman tetap responsif. Kalau worker tidak tersedia, proses otomatis pindah ke halaman.
- Daftar file memakai thumbnail kecil (112 px) dan `content-visibility`, jadi ribuan file tetap ringan.
- `zip.js` dan library dokumen baru dimuat saat dibutuhkan.
- `sw.js` mengambil file aplikasi dari jaringan dulu (network-first, jadi update langsung terlihat) dan menyimpannya untuk dipakai saat offline. Library CDN disimpan cache-first, jadi tidak diunduh ulang. Service worker tidak aktif di `localhost` supaya tidak mengganggu saat development.

## Menambah tool baru

1. Tambahkan metadata tool di `js/registry.js`: `id`, `name`, `tagline`, `group`, `icon` (nama ikon dari `HTUtil.icon`), `description`, dan `scripts` yang perlu dimuat.
2. Buat `js/tools/<nama-tool>.js` yang memanggil `HT.register('<id>', { mount(el) { ... } })`.
   `mount` merender isi tool ke dalam `el` dan boleh mengembalikan fungsi cleanup.

Tool otomatis muncul di sidebar dan bisa dibuka lewat `#/<id>`. Judul, breadcrumb, dan deskripsi halaman diambil dari metadata.

Untuk tampilan yang seragam, pakai `HTUtil.block()` (section), `HTUtil.dropzone()`, dan kelas `.fields` / `.fieldbox` / `.control` untuk pengaturan.

Untuk tool yang memproses banyak gambar, pakai `HTImg.mountBatch()` dari `js/lib/image-batch.js`. Modul ini sudah menangani pengaturan, dropzone, antrean paralel, daftar file, dan ZIP. Tool cukup menyediakan field pengaturan dan fungsi `encode()`. Contohnya ada di `js/tools/image-resizer.js`.

## Deploy ke Vercel

Tidak ada proses build, jadi cukup:

1. Push repo ini ke GitHub.
2. Di Vercel, pilih **Add New → Project**, lalu import repo ini.
3. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan.
4. Klik **Deploy**.

`vercel.json` membuat `sw.js` selalu dicek ulang (supaya update langsung sampai ke pengunjung) dan menambah header keamanan dasar. `.vercelignore` membuat file khusus development tidak ikut ter-deploy.

## Pulse live (Instagram)

`api/instagram.js` adalah Vercel Function yang mengambil 30 post terbaru beserta insight-nya (views, reach, likes, komentar, shares, saves) lewat Instagram API with Instagram Login. Pulse memanggilnya tiap 15 menit selama halaman terbuka. Hasilnya di-cache 10 menit di server supaya tetap jauh di bawah batas ±200 panggilan per jam.

### Setup (sekali saja)

1. **Akun Instagram Profesional.** Di Instagram buka Settings → Account type and tools, lalu pilih Creator atau Business. Tidak perlu Facebook Page.
2. **Buat aplikasi Meta.** Buka [developers.facebook.com/apps](https://developers.facebook.com/apps), klik Create app, lalu pilih use case untuk mengelola konten dan insight Instagram ("Instagram API").
3. **Buat token.** Di aplikasi itu buka Instagram → API setup with Instagram login.
   - Pastikan izin `instagram_business_basic` dan `instagram_business_manage_insights` aktif.
   - Di bagian Generate access tokens, klik Add account, lalu login sebagai akun Instagram Anda. Kalau diminta menjadi *tester*, terima undangannya di Instagram lewat Settings → Website permissions/Apps and websites → Tester invites.
   - Klik Generate token, lalu salin tokennya. Token ini berlaku 60 hari.
4. **Isi Environment Variables di Vercel.** Buka Project → Settings → Environment Variables, lalu isi:
   | Nama | Isi |
   |---|---|
   | `IG_ACCESS_TOKEN` | token dari langkah 3 |
   | `PULSE_KEY` | kunci akses buatan sendiri (seperti password), dipakai untuk membuka data live di Pulse |
   | `CRON_SECRET` | teks acak panjang, dipakai Vercel Cron untuk memperpanjang token |
5. **Redeploy** (Deployments → titik tiga → Redeploy) supaya variabel terbaca.
6. **Sambungkan di Pulse.** Buka Pulse, isi kunci akses dengan `PULSE_KEY`, lalu klik Sambungkan.

### Catatan

- Token diperpanjang otomatis tiap Senin pukul 03.00 UTC oleh Vercel Cron (`vercel.json`). Kalau Pulse menampilkan "Token Instagram kedaluwarsa", buat token baru (langkah 3) lalu perbarui `IG_ACCESS_TOKEN` dan redeploy.
- Token tidak pernah dikirim ke browser. Tanpa `PULSE_KEY` yang benar, endpoint menolak permintaan. Kunci disimpan di `localStorage` browser yang dipakai untuk menyambungkan, dan klik Putuskan untuk menghapusnya.
- Durasi video tidak tersedia di API. Kalau pernah diunggah lewat file ekspor, durasinya tetap disimpan.
- Untuk mencoba secara lokal: `IG_ACCESS_TOKEN=... PULSE_KEY=... node scripts/serve.js`. Server development juga menjalankan `api/*.js`.
